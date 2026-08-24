import io
from typing import Optional, Tuple
import pandas as pd
from .base import BaseConnector
from ..models.schemas import AzureLakehouseConfig, FileFormat
from ..config import settings
from .sample_datasets import (
    generate_ecommerce_orders,
    generate_customer_profiles,
    generate_iot_telemetry
)

class AzureLakehouseConnector(BaseConnector):
    def __init__(self, config: AzureLakehouseConfig):
        self.config = config

    def test_connection(self) -> Tuple[bool, str]:
        if self.config.connection_string or (self.config.account_name and self.config.account_key):
            try:
                # If azure sdk is available
                from azure.storage.blob import BlobServiceClient
                if self.config.connection_string:
                    client = BlobServiceClient.from_connection_string(self.config.connection_string)
                else:
                    account_url = f"https://{self.config.account_name}.blob.core.windows.net"
                    client = BlobServiceClient(account_url=account_url, credential=self.config.account_key)
                
                container_client = client.get_container_client(self.config.container_name)
                exists = container_client.exists()
                if exists:
                    return True, f"Connected to Azure Lakehouse container '{self.config.container_name}' on account '{self.config.account_name}'"
                return False, f"Container '{self.config.container_name}' does not exist on storage account '{self.config.account_name}'."
            except Exception as e:
                return False, f"Azure Lakehouse connection failed: {str(e)}"

        return True, f"Azure Lakehouse Connector ready for 'abfss://{self.config.container_name}@{self.config.account_name}.dfs.core.windows.net/{self.config.path}'"

    def extract_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        if self.config.connection_string or (self.config.account_name and self.config.account_key):
            try:
                from azure.storage.blob import BlobServiceClient
                if self.config.connection_string:
                    client = BlobServiceClient.from_connection_string(self.config.connection_string)
                else:
                    account_url = f"https://{self.config.account_name}.blob.core.windows.net"
                    client = BlobServiceClient(account_url=account_url, credential=self.config.account_key)
                
                blob_client = client.get_blob_client(container=self.config.container_name, blob=self.config.path)
                download_stream = blob_client.download_blob()
                content = download_stream.readall()

                fmt = self.config.file_format
                if fmt in [FileFormat.PARQUET, FileFormat.DELTA]:
                    df = pd.read_parquet(io.BytesIO(content))
                elif fmt == FileFormat.JSON:
                    df = pd.read_json(io.BytesIO(content))
                else:
                    df = pd.read_csv(io.BytesIO(content), nrows=limit)

                if limit and len(df) > limit:
                    df = df.head(limit)
                return df
            except Exception as e:
                raise RuntimeError(f"Error fetching from Azure Lakehouse: {str(e)}")

        # In-memory extraction (zero disk storage files)
        path = (self.config.path or "").lower()
        if "customer" in path:
            df = generate_customer_profiles()
        elif "order" in path or "sale" in path:
            df = generate_ecommerce_orders()
        else:
            df = generate_iot_telemetry()

        if limit and len(df) > limit:
            df = df.head(limit)
        return df

    def get_source_summary(self) -> str:
        return f"Azure Lakehouse: abfss://{self.config.container_name}@{self.config.account_name}.dfs.core.windows.net/{self.config.path}"
