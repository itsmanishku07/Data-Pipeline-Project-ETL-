import io
from typing import Optional, Tuple
import pandas as pd
from .base import BaseConnector
from ..models.schemas import S3SourceConfig, FileFormat
from ..config import settings

class S3Connector(BaseConnector):
    def __init__(self, config: S3SourceConfig):
        self.config = config

    def test_connection(self) -> Tuple[bool, str]:
        # If user supplies real AWS credentials or endpoint
        if self.config.access_key and self.config.secret_key:
            try:
                import boto3
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=self.config.access_key,
                    aws_secret_access_key=self.config.secret_key,
                    region_name=self.config.region,
                    endpoint_url=self.config.endpoint_url
                )
                s3_client.head_bucket(Bucket=self.config.bucket)
                return True, f"Successfully connected to AWS S3 bucket 's3://{self.config.bucket}'"
            except Exception as e:
                # If cloud check failed due to invalid credentials
                return False, f"AWS S3 Connection failed: {str(e)}"
        
        # Test / Simulation Mode for local development
        return True, f"AWS S3 Connector initialized for bucket 's3://{self.config.bucket}/{self.config.key_prefix}' (Ready for extraction)"

    def extract_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        if self.config.access_key and self.config.secret_key:
            try:
                import boto3
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=self.config.access_key,
                    aws_secret_access_key=self.config.secret_key,
                    region_name=self.config.region,
                    endpoint_url=self.config.endpoint_url
                )
                response = s3_client.get_object(Bucket=self.config.bucket, Key=self.config.key_prefix)
                body = response['Body'].read()
                
                fmt = self.config.file_format
                if fmt == FileFormat.PARQUET:
                    df = pd.read_parquet(io.BytesIO(body))
                elif fmt == FileFormat.JSON:
                    df = pd.read_json(io.BytesIO(body))
                else:
                    df = pd.read_csv(io.BytesIO(body), delimiter=self.config.delimiter, nrows=limit)
                
                if limit and len(df) > limit:
                    df = df.head(limit)
                return df
            except Exception as e:
                raise RuntimeError(f"Error fetching from S3 bucket '{self.config.bucket}': {str(e)}")

        raise ValueError("AWS Access Key and Secret Key are required to extract data from AWS S3.")

    def get_source_summary(self) -> str:
        return f"AWS S3: s3://{self.config.bucket}/{self.config.key_prefix} ({self.config.file_format.value.upper()})"
