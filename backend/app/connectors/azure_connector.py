import io
from typing import Optional, Tuple, Dict, Any, List
import pandas as pd
from .base import BaseConnector
from ..models.schemas import AzureLakehouseConfig, FileFormat
from ..config import settings

class AzureLakehouseConnector(BaseConnector):
    def __init__(self, config: AzureLakehouseConfig):
        self.config = config

    def _get_blob_service_client(self):
        """
        Instantiate Azure BlobServiceClient using Account Key, SAS Token,
        Connection String, or Anonymous Public Endpoint.
        """
        try:
            from azure.storage.blob import BlobServiceClient
        except ImportError:
            raise RuntimeError("Azure Storage SDK is not installed. Please run: pip install azure-storage-blob")

        account_name = (self.config.account_name or "").strip()
        if not account_name:
            raise ValueError("Azure Storage Account Name is required.")

        raw_conn = (self.config.connection_string or "").strip()
        raw_key = (self.config.account_key or "").strip()
        raw_sas = (self.config.sas_token or "").strip()

        # 1. Connection String Check
        if raw_conn:
            if "DefaultEndpointsProtocol=" in raw_conn or "AccountName=" in raw_conn:
                return BlobServiceClient.from_connection_string(raw_conn)
            elif raw_conn.startswith("?") or "sig=" in raw_conn or "sv=" in raw_conn:
                sas = raw_conn if raw_conn.startswith("?") else f"?{raw_conn}"
                return BlobServiceClient(account_url=f"https://{account_name}.blob.core.windows.net{sas}")
            else:
                # Raw account key provided in connection string field
                return BlobServiceClient(account_url=f"https://{account_name}.blob.core.windows.net", credential=raw_conn)

        # 2. SAS Token Check
        if raw_sas:
            sas = raw_sas if raw_sas.startswith("?") else f"?{raw_sas}"
            return BlobServiceClient(account_url=f"https://{account_name}.blob.core.windows.net{sas}")

        # 3. Account Key Check
        if raw_key:
            if raw_key.startswith("DefaultEndpointsProtocol=") or "AccountName=" in raw_key:
                return BlobServiceClient.from_connection_string(raw_key)
            elif raw_key.startswith("?") or "sig=" in raw_key or "sv=" in raw_key:
                sas = raw_key if raw_key.startswith("?") else f"?{raw_key}"
                return BlobServiceClient(account_url=f"https://{account_name}.blob.core.windows.net{sas}")
            else:
                return BlobServiceClient(account_url=f"https://{account_name}.blob.core.windows.net", credential=raw_key)

        # 4. Anonymous / Public Container Access
        account_url = f"https://{account_name}.blob.core.windows.net"
        return BlobServiceClient(account_url=account_url)

    @staticmethod
    def _format_azure_error(e: Exception, account_name: str, container_name: str) -> str:
        msg = str(e)
        if "NoAuthenticationInformation" in msg or "AuthenticationFailed" in msg or "401" in msg or "Server failed to authenticate" in msg:
            return f"Azure Authentication Required: Please provide your Storage Account Key, SAS Token, or Connection String for account '{account_name}'."
        elif "ContainerNotFound" in msg or "404" in msg:
            return f"Azure Container '{container_name}' was not found on storage account '{account_name}'."
        elif "AuthorizationPermissionMismatch" in msg or "403" in msg:
            return f"Azure Access Denied (403): The provided credentials do not have read permissions on container '{container_name}'."
        return msg

    def test_connection(self) -> Tuple[bool, str]:
        """
        Validates connection and verifies container existence on Azure.
        """
        try:
            client = self._get_blob_service_client()
            container_name = (self.config.container_name or "").strip()
            if not container_name:
                return False, "Azure Container Name is required."

            container_client = client.get_container_client(container_name)
            exists = container_client.exists()
            if not exists:
                return False, f"Container '{container_name}' was not found on Azure Storage account '{self.config.account_name}'."

            return True, f"Successfully connected to Azure Lakehouse container '{container_name}' on '{self.config.account_name}.blob.core.windows.net'"
        except Exception as e:
            return False, self._format_azure_error(e, self.config.account_name, self.config.container_name)

    def list_hierarchy(self, prefix: str = "", delimiter: str = "/") -> Dict[str, Any]:
        """
        Lists real folders (virtual directories) and blobs within a given prefix in the Azure container.
        """
        clean_prefix = prefix.lstrip("/")
        if clean_prefix and not clean_prefix.endswith("/"):
            clean_prefix += "/"

        container_name = (self.config.container_name or "").strip()
        if not container_name:
            raise ValueError("Azure Container Name is required to browse files.")

        try:
            client = self._get_blob_service_client()
            container_client = client.get_container_client(container_name)

            if not container_client.exists():
                raise RuntimeError(f"Container '{container_name}' does not exist on storage account '{self.config.account_name}'.")

            folders: List[Dict[str, str]] = []
            files: List[Dict[str, Any]] = []

            for item in container_client.walk_blobs(name_starts_with=clean_prefix, delimiter=delimiter):
                if getattr(item, "is_prefix", False) or item.name.endswith("/"):
                    folder_path = item.name
                    folder_name = folder_path[len(clean_prefix):].rstrip("/")
                    if folder_name:
                        folders.append({
                            "name": folder_name,
                            "path": folder_path
                        })
                else:
                    blob_path = item.name
                    file_name = blob_path[len(clean_prefix):]
                    ext = file_name.split(".")[-1].lower() if "." in file_name else "auto"
                    last_mod = item.last_modified.isoformat() if hasattr(item, "last_modified") and item.last_modified else None
                    files.append({
                        "name": file_name,
                        "path": blob_path,
                        "size_bytes": getattr(item, "size", 0),
                        "last_modified": last_mod,
                        "format": ext
                    })

            return {
                "current_prefix": clean_prefix,
                "folders": folders,
                "files": files,
                "is_simulated": False
            }
        except Exception as e:
            raise RuntimeError(self._format_azure_error(e, self.config.account_name, container_name))

    def extract_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        """
        Downloads and parses the actual data file from Azure Blob / ADLS Gen2
        with automatic magic-bytes format detection and graceful multi-format fallback.
        """
        client = self._get_blob_service_client()
        container_name = (self.config.container_name or "").strip()
        blob_path = (self.config.path or "").strip()

        if not container_name:
            raise ValueError("Azure Container Name is required.")
        if not blob_path:
            raise ValueError("Azure Blob Path is required to extract data.")

        try:
            blob_client = client.get_blob_client(container=container_name, blob=blob_path)
            download_stream = blob_client.download_blob()
            content = download_stream.readall()
        except Exception as e:
            raise RuntimeError(self._format_azure_error(e, self.config.account_name, container_name))

        fmt = self.config.file_format
        p = blob_path.lower()
        pref = str(fmt.value if hasattr(fmt, "value") else (fmt or "")).lower()

        # 1. Quick Magic bytes check for Parquet
        is_parquet_magic = content.startswith(b"PAR1") or (len(content) >= 4 and content[-4:] == b"PAR1")
        if is_parquet_magic:
            try:
                df = pd.read_parquet(io.BytesIO(content))
                return df.head(limit) if limit and len(df) > limit else df
            except Exception:
                pass

        # 2. Try preferred format first
        if pref in ["parquet", "delta"] or p.endswith(".parquet"):
            try:
                df = pd.read_parquet(io.BytesIO(content))
                return df.head(limit) if limit and len(df) > limit else df
            except Exception:
                pass

        if pref == "json" or p.endswith(".json"):
            try:
                df = pd.read_json(io.BytesIO(content))
                return df.head(limit) if limit and len(df) > limit else df
            except Exception:
                try:
                    df = pd.read_json(io.BytesIO(content), lines=True)
                    return df.head(limit) if limit and len(df) > limit else df
                except Exception:
                    pass

        if pref == "csv" or p.endswith(".csv") or p.endswith(".tsv") or p.endswith(".txt"):
            for sep in [",", None, "\t", ";", "|"]:
                try:
                    df = pd.read_csv(io.BytesIO(content), sep=sep, nrows=limit)
                    if len(df.columns) > 0 and len(df) >= 0:
                        return df
                except Exception:
                    pass

        # 3. Universal Fallback Cascade across all common formats
        # A. CSV / TSV / Delimited Text (with auto delimiter & encoding detection)
        for enc in ["utf-8", "latin1", "cp1252", "utf-16"]:
            for sep in [",", None, "\t", ";", "|"]:
                try:
                    df = pd.read_csv(io.BytesIO(content), sep=sep, encoding=enc, nrows=limit, on_bad_lines="skip")
                    if len(df.columns) > 0 and len(df) >= 0:
                        return df
                except Exception:
                    pass

        # B. JSON / Line-delimited JSON
        try:
            df = pd.read_json(io.BytesIO(content))
            return df.head(limit) if limit and len(df) > limit else df
        except Exception:
            pass
        try:
            df = pd.read_json(io.BytesIO(content), lines=True)
            return df.head(limit) if limit and len(df) > limit else df
        except Exception:
            pass

        # C. Parquet
        try:
            df = pd.read_parquet(io.BytesIO(content))
            return df.head(limit) if limit and len(df) > limit else df
        except Exception:
            pass

        # D. Excel
        try:
            df = pd.read_excel(io.BytesIO(content))
            return df.head(limit) if limit and len(df) > limit else df
        except Exception:
            pass

        raise RuntimeError(f"Could not parse the format of Azure file '{blob_path}'. Please ensure it is a valid CSV, Parquet, JSON, or TSV tabular file.")

    def upload_data(self, df: pd.DataFrame, target_path: Optional[str] = None, file_format: str = "parquet", overwrite: bool = True) -> Dict[str, Any]:
        """
        Uploads a Pandas DataFrame directly to Azure Blob / ADLS Gen2 container as CSV, Parquet, or JSON.
        """
        client = self._get_blob_service_client()
        container_name = (self.config.container_name or "").strip()
        blob_path = (target_path or self.config.path or "").strip().lstrip("/")

        if not container_name:
            raise ValueError("Azure Container Name is required for export.")
        if not blob_path:
            raise ValueError("Azure destination blob Path is required for export.")

        # Serialize dataframe to in-memory byte buffer
        buffer = io.BytesIO()
        ext = blob_path.split(".")[-1].lower() if "." in blob_path else file_format.lower()

        if ext == "csv":
            df.to_csv(buffer, index=False)
            content_type = "text/csv"
        elif ext == "json":
            df.to_json(buffer, orient="records", indent=2)
            content_type = "application/json"
        else: # default to parquet
            df.to_parquet(buffer, index=False)
            content_type = "application/octet-stream"

        buffer.seek(0)
        data_bytes = buffer.getvalue()

        try:
            container_client = client.get_container_client(container_name)
            # Create container if it does not exist
            try:
                if not container_client.exists():
                    container_client.create_container()
            except Exception:
                pass

            blob_client = client.get_blob_client(container=container_name, blob=blob_path)
            blob_client.upload_blob(data_bytes, overwrite=overwrite)

            return {
                "success": True,
                "blob_path": blob_path,
                "container": container_name,
                "account": self.config.account_name,
                "size_bytes": len(data_bytes),
                "rows_uploaded": len(df),
                "url": f"https://{self.config.account_name}.blob.core.windows.net/{container_name}/{blob_path}"
            }
        except Exception as e:
            raise RuntimeError(self._format_azure_error(e, self.config.account_name, container_name))

    def get_source_summary(self) -> str:
        return f"Azure Lakehouse: abfss://{self.config.container_name}@{self.config.account_name}.dfs.core.windows.net/{self.config.path}"
