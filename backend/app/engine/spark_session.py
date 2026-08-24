import os
import logging
from typing import Optional, Any
from ..config import settings

logger = logging.getLogger(__name__)

class SparkSessionManager:
    _instance: Optional[Any] = None
    _is_native_spark: bool = False

    @classmethod
    def get_session(cls, s3_config: Optional[dict] = None, azure_config: Optional[dict] = None) -> Any:
        if cls._instance is not None:
            return cls._instance

        try:
            from pyspark.sql import SparkSession
            import pyspark

            builder = (
                SparkSession.builder
                .appName(settings.SPARK_APP_NAME)
                .master(settings.SPARK_MASTER)
                .config("spark.sql.execution.arrow.pyspark.enabled", "true")
                .config("spark.driver.memory", "2g")
                .config("spark.sql.shuffle.partitions", "4")
                .config("spark.ui.enabled", "false")
            )

            # S3 configurations
            if s3_config:
                if s3_config.get("access_key") and s3_config.get("secret_key"):
                    builder = builder.config("spark.hadoop.fs.s3a.access.key", s3_config["access_key"])
                    builder = builder.config("spark.hadoop.fs.s3a.secret.key", s3_config["secret_key"])
                if s3_config.get("endpoint_url"):
                    builder = builder.config("spark.hadoop.fs.s3a.endpoint", s3_config["endpoint_url"])

            # Azure configurations
            if azure_config:
                account_name = azure_config.get("account_name")
                account_key = azure_config.get("account_key")
                if account_name and account_key:
                    builder = builder.config(f"spark.hadoop.fs.azure.account.key.{account_name}.dfs.core.windows.net", account_key)

            spark = builder.getOrCreate()
            cls._instance = spark
            cls._is_native_spark = True
            logger.info("Initialized native Apache Spark session successfully.")
            return spark
        except Exception as e:
            logger.warning(f"Native SparkSession initialization fallback triggered: {e}")
            cls._is_native_spark = False
            return None

    @classmethod
    def is_spark_available(cls) -> bool:
        try:
            session = cls.get_session()
            return session is not None
        except Exception:
            return False

spark_manager = SparkSessionManager()
