import os
import urllib.parse
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from sqlalchemy import text
from ..config import settings
from ..models.db_models import get_db_connection, init_db
import sqlite3

class DataStoreEngine:
    """
    100% Database-Centric Storage Engine.
    Stores all staged datasets and curated outputs directly into MySQL database tables,
    eliminating all local disk file storage (.parquet/.csv).
    """

    @staticmethod
    def get_table_name_for_dataset(dataset_id: str) -> str:
        clean_id = dataset_id.replace("-", "_")
        return f"stg_data_{clean_id}"

    @staticmethod
    def save_staged_dataframe(dataset_id: str, df: pd.DataFrame) -> Tuple[str, str, int]:
        """
        Saves a DataFrame directly into a dedicated MySQL staging table.
        Returns: (storage_path, storage_format, size_bytes)
        """
        table_name = DataStoreEngine.get_table_name_for_dataset(dataset_id)
        db_type, engine = get_db_connection()

        if db_type == "mysql" and engine is not None:
            # Save directly into MySQL table
            df.to_sql(name=table_name, con=engine, if_exists="replace", index=False)
            storage_path = f"mysql://{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}/{table_name}"
            return storage_path, "mysql_table", 0
        else:
            # Fallback to local SQLite table in catalog.db (zero parquet files)
            init_db()
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            df.to_sql(name=table_name, con=conn, if_exists="replace", index=False)
            conn.close()
            storage_path = f"sqlite://catalog.db/{table_name}"
            return storage_path, "sqlite_table", 0

    @staticmethod
    def load_staged_dataframe(meta: Dict[str, Any]) -> pd.DataFrame:
        """
        Loads a DataFrame from its MySQL staging table (or SQLite fallback).
        """
        storage_path = meta.get("storage_path", "")
        storage_format = meta.get("storage_format", "")
        table_name = DataStoreEngine.get_table_name_for_dataset(meta["id"])

        db_type, engine = get_db_connection()

        # 1. MySQL Table Loading
        if (db_type == "mysql" and engine is not None) or "mysql://" in storage_path or storage_format == "mysql_table":
            try:
                with engine.connect() as conn:
                    return pd.read_sql(text(f"SELECT * FROM `{table_name}`"), con=conn)
            except Exception as e:
                # If table name was custom encoded in storage_path
                if "/" in storage_path:
                    custom_table = storage_path.split("/")[-1]
                    try:
                        with engine.connect() as conn:
                            return pd.read_sql(text(f"SELECT * FROM `{custom_table}`"), con=conn)
                    except Exception:
                        pass
                raise RuntimeError(f"Failed to read MySQL staging table '{table_name}': {e}")

        # 2. SQLite Table Loading
        if "sqlite://" in storage_path or storage_format == "sqlite_table":
            init_db()
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            try:
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
                conn.close()
                return df
            except Exception as e:
                conn.close()
                raise RuntimeError(f"Failed to read SQLite staging table '{table_name}': {e}")

        # 3. Legacy Parquet disk fallback (if existing from previous sessions)
        if Path(storage_path).exists():
            return pd.read_parquet(storage_path)

        raise RuntimeError(f"Staged data source for '{meta['name']}' not found in database or storage.")

    @staticmethod
    def get_staged_preview_slice(
        meta: Dict[str, Any], 
        page: int = 1, 
        page_size: int = 50, 
        search: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int, List[str]]:
        """
        Performs high-performance paginated SQL queries directly on the database table.
        Returns: (rows, total_rows, columns)
        """
        table_name = DataStoreEngine.get_table_name_for_dataset(meta["id"])
        db_type, engine = get_db_connection()

        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as conn:
                    # Get column list
                    res_cols = conn.execute(text(f"SHOW COLUMNS FROM `{table_name}`"))
                    columns = [r[0] for r in res_cols.fetchall()]

                    # Count total rows
                    if search and search.strip():
                        # Search across all columns
                        search_clauses = " OR ".join([f"CAST(`{c}` AS CHAR) LIKE :search" for c in columns])
                        count_sql = f"SELECT COUNT(*) FROM `{table_name}` WHERE {search_clauses}"
                        data_sql = f"SELECT * FROM `{table_name}` WHERE {search_clauses} LIMIT :limit OFFSET :offset"
                        params = {"search": f"%{search.strip()}%", "limit": page_size, "offset": (page - 1) * page_size}
                    else:
                        count_sql = f"SELECT COUNT(*) FROM `{table_name}`"
                        data_sql = f"SELECT * FROM `{table_name}` LIMIT :limit OFFSET :offset"
                        params = {"limit": page_size, "offset": (page - 1) * page_size}

                    total_rows = conn.execute(text(count_sql), params).scalar() or 0
                    result = conn.execute(text(data_sql), params)
                    raw_rows = [dict(r._mapping) for r in result.fetchall()]

                    # Clean dates and JSON formatting
                    rows = []
                    for r in raw_rows:
                        cleaned = {}
                        for k, v in r.items():
                            if pd.isna(v) or v is None:
                                cleaned[k] = None
                            elif hasattr(v, "isoformat"):
                                cleaned[k] = v.isoformat()
                            else:
                                cleaned[k] = v
                        rows.append(cleaned)

                    return rows, total_rows, columns
            except Exception:
                pass

        # In-memory / Fallback path
        df = DataStoreEngine.load_staged_dataframe(meta)
        total_rows = len(df)
        columns = list(df.columns)

        if search and search.strip():
            mask = df.astype(str).apply(lambda row: row.str.contains(search, case=False).any(), axis=1)
            df = df[mask]
            total_rows = len(df)

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        df_slice = df.iloc[start_idx:end_idx]

        rows = df_slice.to_dict(orient="records")
        for r in rows:
            for k, v in r.items():
                if pd.isna(v):
                    r[k] = None
                elif hasattr(v, "isoformat"):
                    r[k] = v.isoformat()

        return rows, total_rows, columns

    @staticmethod
    def drop_staged_table(dataset_id: str):
        """
        Drops the dedicated staging table from MySQL / SQLite.
        """
        table_name = DataStoreEngine.get_table_name_for_dataset(dataset_id)
        db_type, engine = get_db_connection()

        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as conn:
                    conn.execute(text(f"DROP TABLE IF EXISTS `{table_name}`"))
                    conn.commit()
            except Exception:
                pass

        init_db()
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.execute(f"DROP TABLE IF EXISTS {table_name}")
            conn.commit()
            conn.close()
        except Exception:
            pass
