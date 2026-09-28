import os
import json
import urllib.parse
from pathlib import Path
from datetime import datetime
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
            if k == "aud_last_update" and (v is None or pd.isna(v) or str(v).lower() in ("nat", "none", "nan")):
                cleaned[k] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            elif pd.isna(v) or v is None:
                cleaned[k] = None
            elif hasattr(v, "isoformat"):
                cleaned[k] = v.isoformat()
            elif isinstance(v, (int, float, str, bool)):
                cleaned[k] = v
            else:
                cleaned[k] = str(v)
        if "aud_last_update" not in cleaned or not cleaned["aud_last_update"]:
            cleaned["aud_last_update"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        return cleaned

    @staticmethod
    def save_staged_dataframe(
        dataset_id: str, 
        df: pd.DataFrame, 
        flow_id: Optional[str] = None,
        sync_mode: str = "full",
        primary_key: Optional[str] = None,
        watermark_col: str = "aud_last_update"
    ) -> Tuple[str, str, int, int, Optional[str]]:
        """
        Saves DataFrame records into the unified standard staging table with support for:
        - `full`: Complete refresh
        - `incremental_append`: Appends new records into stage
        - `incremental_merge`: Upserts records matching primary_key with latest aud_last_update
        Returns: (storage_path, storage_format, size_bytes, total_row_count, new_watermark_value)
        """
        records = df.to_dict(orient="records")
        db_type, engine = get_db_connection()
        
        # Calculate new watermark
        new_watermark = None
        if watermark_col in df.columns and not df[watermark_col].empty:
            non_null_wm = df[watermark_col].dropna()
            if not non_null_wm.empty:
                max_val = non_null_wm.max()
                if max_val is not None and not pd.isna(max_val):
                    new_watermark = max_val.isoformat() if hasattr(max_val, "isoformat") else str(max_val)
        if not new_watermark and not df.empty and "aud_last_update" in df.columns:
            non_null_aud = df["aud_last_update"].dropna()
            if not non_null_aud.empty:
                max_val = non_null_aud.max()
                if max_val is not None and not pd.isna(max_val):
                    new_watermark = max_val.isoformat() if hasattr(max_val, "isoformat") else str(max_val)
        
        if new_watermark is not None:
            if pd.isna(new_watermark) or str(new_watermark).strip().lower() in ("nat", "nan", "none", "<na>", "null", ""):
                new_watermark = None
            else:
                new_watermark = str(new_watermark)

        total_count = len(records)

        # 1. MySQL Storage
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as conn:
                    if sync_mode == "incremental_merge" and primary_key:
                        # Load existing records for merging
                        res = conn.execute(
                            text("SELECT data_json FROM dataflow_staged_records WHERE dataset_id = :did"),
                            {"did": dataset_id}
                        )
                        existing_rows = res.fetchall()
                        merged_dict = {}
                        for r in existing_rows:
                            d = json.loads(r[0])
                            pk_val = str(d.get(primary_key, ""))
                            if pk_val:
                                merged_dict[pk_val] = d

                        # Update / merge with new batch
                        for r in records:
                            cleaned_r = DataStoreEngine._clean_record(r)
                            pk_val = str(cleaned_r.get(primary_key, ""))
                            if pk_val:
                                merged_dict[pk_val] = cleaned_r

                        final_records = list(merged_dict.values())
                        conn.execute(text("DELETE FROM dataflow_staged_records WHERE dataset_id = :did"), {"did": dataset_id})
                        records_to_insert = final_records
                        start_idx = 0
                        total_count = len(final_records)
                    elif sync_mode == "incremental_append":
                        # Get current max index
                        res = conn.execute(
                            text("SELECT COALESCE(MAX(row_index), -1) FROM dataflow_staged_records WHERE dataset_id = :did"),
                            {"did": dataset_id}
                        )
                        start_idx = (res.scalar() or -1) + 1
                        records_to_insert = records
                        total_count = start_idx + len(records)
                    else:
                        # Full replace
                        conn.execute(text("DELETE FROM dataflow_staged_records WHERE dataset_id = :did"), {"did": dataset_id})
                        records_to_insert = records
                        start_idx = 0
                        total_count = len(records)

                    if records_to_insert:
                        batch_data = []
                        for idx, r in enumerate(records_to_insert):
                            cleaned_r = DataStoreEngine._clean_record(r)
                            batch_data.append({
                                "dataset_id": dataset_id,
                                "flow_id": flow_id,
                                "row_index": start_idx + idx,
                                "data_json": json.dumps(cleaned_r)
                            })
                        
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
                return storage_path, "mysql_table", 0, total_count, new_watermark
            except Exception as e:
                print(f"[WARN] Failed to write into MySQL dataflow_staged_records: {e}")

        # 2. SQLite Storage Fallback
        init_db()
        conn = sqlite3.connect(settings.CATALOG_DB_PATH)
        cursor = conn.cursor()

        if sync_mode == "incremental_merge" and primary_key:
            cursor.execute("SELECT data_json FROM staged_records WHERE dataset_id = ?", (dataset_id,))
            existing_rows = cursor.fetchall()
            merged_dict = {}
            for r in existing_rows:
                d = json.loads(r[0])
                pk_val = str(d.get(primary_key, ""))
                if pk_val:
                    merged_dict[pk_val] = d
            for r in records:
                cleaned_r = DataStoreEngine._clean_record(r)
                pk_val = str(cleaned_r.get(primary_key, ""))
                if pk_val:
                    merged_dict[pk_val] = cleaned_r
            final_records = list(merged_dict.values())
            cursor.execute("DELETE FROM staged_records WHERE dataset_id = ?", (dataset_id,))
            records_to_insert = final_records
            start_idx = 0
            total_count = len(final_records)
        elif sync_mode == "incremental_append":
            cursor.execute("SELECT COALESCE(MAX(row_index), -1) FROM staged_records WHERE dataset_id = ?", (dataset_id,))
            row = cursor.fetchone()
            start_idx = (row[0] if row else -1) + 1
            records_to_insert = records
            total_count = start_idx + len(records)
        else:
            cursor.execute("DELETE FROM staged_records WHERE dataset_id = ?", (dataset_id,))
            records_to_insert = records
            start_idx = 0
            total_count = len(records)

        if records_to_insert:
            batch_data = []
            for idx, r in enumerate(records_to_insert):
                cleaned_r = DataStoreEngine._clean_record(r)
                batch_data.append((dataset_id, flow_id, start_idx + idx, json.dumps(cleaned_r)))
            cursor.executemany("""
            INSERT INTO staged_records (dataset_id, flow_id, row_index, data_json, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            """, batch_data)

        conn.commit()
        conn.close()
        storage_path = f"sqlite://table/staged_records/{dataset_id}"
        return storage_path, "sqlite_table", 0, total_count, new_watermark

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

