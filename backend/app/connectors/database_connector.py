import os
import urllib.parse
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
import pandas as pd
from sqlalchemy import create_engine, inspect, text
from .base import BaseConnector
from ..models.schemas import DatabaseSourceConfig, DatabaseType

class DatabaseConnector(BaseConnector):
    def __init__(self, config: DatabaseSourceConfig):
        self.config = config

    def _get_connect_args(self) -> dict:
        host = (self.config.host or "").lower()
        if self.config.db_type == DatabaseType.MYSQL:
            args = {"connect_timeout": 15}
            # Enable SSL automatically for cloud-hosted MySQL instances (Azure, AWS RDS, PlanetScale, Aiven, etc.)
            if any(cloud_domain in host for cloud_domain in [".azure.com", ".amazonaws.com", ".psdb.cloud", ".aivencloud.com", ".digitalocean.com"]):
                args["ssl"] = {"ssl_disabled": False}
            return args
        elif self.config.db_type == DatabaseType.POSTGRES:
            return {"timeout": 15}
        elif self.config.db_type == DatabaseType.SQLITE:
            return {"timeout": 15}
        return {}

    def _get_connection_url(self) -> str:
        raw_host = (self.config.host or "localhost").strip()
        raw_user = (self.config.username or "").strip()
        raw_pwd = self.config.password or ""
        port = self.config.port

        # Handle accidental "user@host" or "host:port" in host input
        if "@" in raw_host:
            parts = raw_host.split("@")
            if not raw_user:
                raw_user = parts[0]
            raw_host = parts[-1]

        if ":" in raw_host and not raw_host.startswith("http"):
            parts = raw_host.split(":")
            raw_host = parts[0]
            try:
                port = int(parts[1])
            except Exception:
                pass

        user = urllib.parse.quote_plus(raw_user) if raw_user else ""
        pwd = f":{urllib.parse.quote_plus(raw_pwd)}" if raw_pwd else ""
        auth = f"{user}{pwd}@" if user else ""

        if self.config.db_type == DatabaseType.POSTGRES:
            port = port or 5432
            db = self.config.database or "postgres"
            user_default = auth if auth else "postgres@"
            return f"postgresql+pg8000://{user_default}{raw_host}:{port}/{db}"

        elif self.config.db_type == DatabaseType.MYSQL:
            port = port or 3306
            db = self.config.database or ""
            user_default = auth if auth else "root@"
            return f"mysql+pymysql://{user_default}{raw_host}:{port}/{db}"

        elif self.config.db_type == DatabaseType.SQLSERVER:
            port = port or 1433
            db = self.config.database or "master"
            user_default = auth if auth else "sa@"
            return f"mssql+pymssql://{user_default}{raw_host}:{port}/{db}"

        elif self.config.db_type == DatabaseType.SQLITE:
            path = self.config.sqlite_path or "storage/app.db"
            return f"sqlite:///{path}"

        elif self.config.db_type == DatabaseType.DUCKDB:
            return "duckdb:///:memory:"

        return f"sqlite:///storage/app.db"

    def test_connection(self) -> Tuple[bool, str]:
        db_type_name = self.config.db_type.value.upper()
        try:
            engine = create_engine(
                self._get_connection_url(), 
                connect_args=self._get_connect_args(),
                pool_pre_ping=True
            )
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, f"Successfully connected to live {db_type_name} database at {self.config.host}:{self.config.port}/{self.config.database or ''}"
        except Exception as e:
            return False, f"Connection to {db_type_name} failed: {str(e)}"

    def get_tables(self) -> List[Dict[str, Any]]:
        """List available tables in the real database catalog."""
        try:
            engine = create_engine(
                self._get_connection_url(),
                connect_args=self._get_connect_args(),
                pool_pre_ping=True
            )
            insp = inspect(engine)
            table_names = insp.get_table_names()
            return [{"table_name": t, "type": "TABLE"} for t in table_names]
        except Exception as e:
            print(f"[WARN] Failed to fetch tables from {self.config.db_type}: {e}")
            return []

    def extract_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        try:
            engine = create_engine(
                self._get_connection_url(),
                connect_args=self._get_connect_args(),
                pool_pre_ping=True
            )
            if self.config.query:
                sql = self.config.query
            elif self.config.table_name:
                sql = f"SELECT * FROM {self.config.table_name}"
            else:
                raise ValueError("No table_name or query specified for database extraction.")

            if limit and "LIMIT" not in sql.upper() and "TOP" not in sql.upper():
                sql = f"{sql} LIMIT {limit}"

            df = pd.read_sql(sql, con=engine)
            return df
        except Exception as e:
            raise RuntimeError(f"Database Query Error on {self.config.db_type.value}: {str(e)}")

    def get_source_summary(self) -> str:
        target = self.config.table_name or ("SQL Query: " + self.config.query[:35] + "..." if self.config.query else "Database Catalog")
        return f"{self.config.db_type.value.upper()}: {target}"
