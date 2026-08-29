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

        # 1. Direct Connection String
        if self.config.connection_string and self.config.connection_string.strip():
            return BlobServiceClient.from_connection_string(self.config.connection_string.strip())

        # 2. SAS Token
        if self.config.sas_token and self.config.sas_token.strip():
            sas = self.config.sas_token.strip()
            if sas.startswith("?"):
                account_url = f"https://{account_name}.blob.core.windows.net{sas}"
                return BlobServiceClient(account_url=account_url)
            else:
                account_url = f"https://{account_name}.blob.core.windows.net"
                return BlobServiceClient(account_url=account_url, credential=sas)

        # 3. Account Key (or SAS Token entered into key field)
        if self.config.account_key and self.config.account_key.strip():
            key = self.config.account_key.strip()
            if key.startswith("DefaultEndpointsProtocol="):
                return BlobServiceClient.from_connection_string(key)
            elif key.startswith("?") or "sig=" in key or "sv=" in key or "sp=" in key:
                if key.startswith("?"):
                    account_url = f"https://{account_name}.blob.core.windows.net{key}"
                    return BlobServiceClient(account_url=account_url)
                else:
                    account_url = f"https://{account_name}.blob.core.windows.net"
                    return BlobServiceClient(account_url=account_url, credential=key)
            else:
                account_url = f"https://{account_name}.blob.core.windows.net"
                return BlobServiceClient(account_url=account_url, credential=key)

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
                    ext = file_name.split(".")[-1].lower() if "." in file_name else "parquet"
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
        Downloads and parses the actual data file from Azure Blob / ADLS Gen2.
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

        try:
            if fmt == FileFormat.PARQUET or p.endswith(".parquet"):
                df = pd.read_parquet(io.BytesIO(content))
            elif fmt == FileFormat.JSON or p.endswith(".json"):
                try:
                    df = pd.read_json(io.BytesIO(content))
                except Exception:
                    df = pd.read_json(io.BytesIO(content), lines=True)
            elif fmt == FileFormat.DELTA:
                try:
                    df = pd.read_parquet(io.BytesIO(content))
                except Exception:
                    import deltalake
                    dt = deltalake.DeltaTable(f"abfss://{container_name}@{self.config.account_name}.dfs.core.windows.net/{blob_path}")
                    df = dt.to_pandas()
            else: # CSV, TSV, TXT
                delimiter = "\t" if p.endswith(".tsv") else ","
                try:
                    df = pd.read_csv(io.BytesIO(content), delimiter=delimiter, nrows=limit)
                except Exception:
                    df = pd.read_csv(io.BytesIO(content), nrows=limit)

            if limit and len(df) > limit:
                df = df.head(limit)
            return df
        except Exception as e:
            raise RuntimeError(f"Error parsing downloaded Azure file '{blob_path}': {str(e)}")

    def get_source_summary(self) -> str:
        return f"Azure Lakehouse: abfss://{self.config.container_name}@{self.config.account_name}.dfs.core.windows.net/{self.config.path}"
