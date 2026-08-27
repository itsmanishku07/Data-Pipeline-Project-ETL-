import os
import json
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
    100% Database-Centric Unified Stage Storage Engine.
    All staged datasets and curated pipeline outputs across ALL flows are stored 
    in ONE single unified standard table: `dataflow_staged_records` (MySQL) / `staged_records` (SQLite),
    completely eliminating dynamic per-dataset table creation (e.g. stg_data_...).
    """

    @staticmethod
    def _clean_record(rec: Dict[str, Any]) -> Dict[str, Any]:
        cleaned = {}
        for k, v in rec.items():
            if pd.isna(v) or v is None:
                cleaned[k] = None
            elif hasattr(v, "isoformat"):
                cleaned[k] = v.isoformat()
            elif isinstance(v, (int, float, str, bool)):
                cleaned[k] = v
            else:
                cleaned[k] = str(v)
        return cleaned

    @staticmethod
    def save_staged_dataframe(dataset_id: str, df: pd.DataFrame, flow_id: Optional[str] = None) -> Tuple[str, str, int]:
        """
        Saves DataFrame records into the unified standard `dataflow_staged_records` table.
        Returns: (storage_path, storage_format, size_bytes)
        """
        records = df.to_dict(orient="records")
        db_type, engine = get_db_connection()

        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as conn:
                    # Delete any previous rows for this dataset
                    conn.execute(text("DELETE FROM dataflow_staged_records WHERE dataset_id = :did"), {"did": dataset_id})
                    
                    # Batch insert all rows into unified table
                    if records:
                        batch_data = []
                        for idx, r in enumerate(records):
                            cleaned_r = DataStoreEngine._clean_record(r)
                            batch_data.append({
                                "dataset_id": dataset_id,
                                "flow_id": flow_id,
                                "row_index": idx,
                                "data_json": json.dumps(cleaned_r)
                            })
                        
                        # Chunked multi-row inserts
                        chunk_size = 1000
                        for i in range(0, len(batch_data), chunk_size):
                            chunk = batch_data[i:i + chunk_size]
                            conn.execute(
                                text("""
                                INSERT INTO dataflow_staged_records (dataset_id, flow_id, row_index, data_json, created_at)
                                VALUES (:dataset_id, :flow_id, :row_index, :data_json, NOW())
                                """),
                                chunk
                            )
                    conn.commit()
                storage_path = f"mysql://table/dataflow_staged_records/{dataset_id}"
                return storage_path, "mysql_table", 0
            except Exception as e:
                print(f"[WARN] Failed to write into MySQL dataflow_staged_records: {e}")

        # Fallback / sync into SQLite staged_records
        init_db()
        conn = sqlite3.connect(settings.CATALOG_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM staged_records WHERE dataset_id = ?", (dataset_id,))
        if records:
            batch_data = []
            for idx, r in enumerate(records):
                cleaned_r = DataStoreEngine._clean_record(r)
                batch_data.append((dataset_id, flow_id, idx, json.dumps(cleaned_r)))
            cursor.executemany("""
            INSERT INTO staged_records (dataset_id, flow_id, row_index, data_json, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            """, batch_data)
        conn.commit()
        conn.close()
        storage_path = f"sqlite://table/staged_records/{dataset_id}"
        return storage_path, "sqlite_table", 0

    @staticmethod
    def _enforce_schema_types(df: pd.DataFrame, columns_meta: List[Any]) -> pd.DataFrame:
        """
        Guarantees that all updated column datatypes configured during Schema Casting
        are preserved throughout the entire transformation and pipeline execution lifecycle.
        """
        if df.empty or not columns_meta:
            return df

        for col_info in columns_meta:
            col_name = col_info.get("name") if isinstance(col_info, dict) else getattr(col_info, "name", None)
            spark_type = col_info.get("spark_type") if isinstance(col_info, dict) else getattr(col_info, "spark_type", None)
            if col_name and spark_type and col_name in df.columns:
                try:
                    if "Integer" in spark_type:
                        df[col_name] = pd.to_numeric(df[col_name], errors="coerce").astype("Int32")
                    elif "Long" in spark_type:
                        df[col_name] = pd.to_numeric(df[col_name], errors="coerce").astype("Int64")
                    elif "Double" in spark_type or "Float" in spark_type or "Decimal" in spark_type:
                        df[col_name] = pd.to_numeric(df[col_name], errors="coerce")
                    elif "Boolean" in spark_type:
                        df[col_name] = df[col_name].astype("boolean")
                    elif "Date" in spark_type:
                        df[col_name] = pd.to_datetime(df[col_name], errors="coerce").dt.date
                    elif "Timestamp" in spark_type:
                        df[col_name] = pd.to_datetime(df[col_name], errors="coerce")
                    elif "String" in spark_type:
                        df[col_name] = df[col_name].astype(str).replace({"nan": None, "None": None, "<NA>": None})
                except Exception:
                    pass
        return df

    @staticmethod
    def load_staged_dataframe(meta: Dict[str, Any]) -> pd.DataFrame:
        """
        Loads a DataFrame from the unified standard staging table with strict schema type enforcement.
        """
        dataset_id = meta.get("id")
        storage_path = meta.get("storage_path", "")
        storage_format = meta.get("storage_format", "")
        columns_meta = meta.get("columns", [])

        db_type, engine = get_db_connection()
        loaded_df = None

        # 1. MySQL Unified Table Loading
        if (db_type == "mysql" and engine is not None) or "mysql://" in storage_path or storage_format == "mysql_table":
            try:
                with engine.connect() as conn:
                    res = conn.execute(
                        text("SELECT data_json FROM dataflow_staged_records WHERE dataset_id = :did ORDER BY row_index ASC"),
                        {"did": dataset_id}
                    )
                    rows = res.fetchall()
                    if rows:
                        data = [json.loads(r[0]) for r in rows]
                        loaded_df = pd.DataFrame(data)
            except Exception as e:
                print(f"[WARN] MySQL load failed: {e}")

        # 2. SQLite Unified Table Loading
        if loaded_df is None:
            init_db()
            try:
                conn = sqlite3.connect(settings.CATALOG_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT data_json FROM staged_records WHERE dataset_id = ? ORDER BY row_index ASC", (dataset_id,))
                rows = cursor.fetchall()
                conn.close()
                if rows:
                    data = [json.loads(r[0]) for r in rows]
                    loaded_df = pd.DataFrame(data)
            except Exception as e:
                print(f"[WARN] SQLite load failed: {e}")

        # 3. Disk Parquet fallback if existing
        if loaded_df is None and storage_path and Path(storage_path).exists():
            try:
                loaded_df = pd.read_parquet(storage_path)
            except Exception:
                pass

        if loaded_df is None:
            cols = [c["name"] if isinstance(c, dict) else getattr(c, "name", str(c)) for c in columns_meta]
            loaded_df = pd.DataFrame(columns=cols)

        # Enforce exact Spark/SQL datatypes defined in schema
        return DataStoreEngine._enforce_schema_types(loaded_df, columns_meta)

    @staticmethod
    def get_staged_preview_slice(
        meta: Dict[str, Any], 
        page: int = 1, 
        page_size: int = 50, 
        search: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int, List[str]]:
        """
        Performs high-performance paginated queries directly from the unified staging table.
        Returns: (rows, total_rows, columns)
        """
        dataset_id = meta.get("id")
        cols = [c["name"] if isinstance(c, dict) else getattr(c, "name", str(c)) for c in meta.get("columns", [])]
        db_type, engine = get_db_connection()

        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as conn:
                    if search and search.strip():
                        count_res = conn.execute(
                            text("SELECT COUNT(*) FROM dataflow_staged_records WHERE dataset_id = :did AND data_json LIKE :search"),
                            {"did": dataset_id, "search": f"%{search.strip()}%"}
                        )
                        total_rows = count_res.scalar() or 0
                        data_res = conn.execute(
                            text("SELECT data_json FROM dataflow_staged_records WHERE dataset_id = :did AND data_json LIKE :search ORDER BY row_index ASC LIMIT :limit OFFSET :offset"),
                            {"did": dataset_id, "search": f"%{search.strip()}%", "limit": page_size, "offset": (page - 1) * page_size}
                        )
                    else:
                        count_res = conn.execute(
                            text("SELECT COUNT(*) FROM dataflow_staged_records WHERE dataset_id = :did"),
                            {"did": dataset_id}
                        )
                        total_rows = count_res.scalar() or 0
                        data_res = conn.execute(
                            text("SELECT data_json FROM dataflow_staged_records WHERE dataset_id = :did ORDER BY row_index ASC LIMIT :limit OFFSET :offset"),
                            {"did": dataset_id, "limit": page_size, "offset": (page - 1) * page_size}
                        )

                    rows = [json.loads(r[0]) for r in data_res.fetchall()]
                    if rows and not cols:
                        cols = list(rows[0].keys())
                    return rows, total_rows, cols
            except Exception as e:
                print(f"[WARN] MySQL slice error: {e}")

        # SQLite fallback
        try:
            init_db()
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            if search and search.strip():
                cursor.execute(
                    "SELECT COUNT(*) FROM staged_records WHERE dataset_id = ? AND data_json LIKE ?",
                    (dataset_id, f"%{search.strip()}%")
                )
                total_rows = cursor.fetchone()[0] or 0
                cursor.execute(
                    "SELECT data_json FROM staged_records WHERE dataset_id = ? AND data_json LIKE ? ORDER BY row_index ASC LIMIT ? OFFSET ?",
                    (dataset_id, f"%{search.strip()}%", page_size, (page - 1) * page_size)
                )
            else:
                cursor.execute("SELECT COUNT(*) FROM staged_records WHERE dataset_id = ?", (dataset_id,))
                total_rows = cursor.fetchone()[0] or 0
                cursor.execute(
                    "SELECT data_json FROM staged_records WHERE dataset_id = ? ORDER BY row_index ASC LIMIT ? OFFSET ?",
                    (dataset_id, page_size, (page - 1) * page_size)
                )
            rows = [json.loads(r[0]) for r in cursor.fetchall()]
            conn.close()
            if rows and not cols:
                cols = list(rows[0].keys())
            return rows, total_rows, cols
        except Exception as e:
            print(f"[WARN] SQLite slice error: {e}")
            return [], 0, cols

    @staticmethod
    def drop_staged_table(dataset_id: str):
        """
        Deletes the dataset rows from the unified standard staging table.
        """
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dataflow_staged_records WHERE dataset_id = :did"), {"did": dataset_id})
                    conn.commit()
            except Exception:
                pass

        init_db()
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.execute("DELETE FROM staged_records WHERE dataset_id = ?", (dataset_id,))
            conn.commit()
            conn.close()
        except Exception:
            pass

