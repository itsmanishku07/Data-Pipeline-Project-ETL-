import json
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import create_engine, text
from ..config import settings

_GLOBAL_MYSQL_ENGINE = None

def get_db_connection():
    """Returns pooled MySQL engine singleton if enabled, otherwise returns SQLite connection."""
    global _GLOBAL_MYSQL_ENGINE
    if settings.USE_MYSQL_METADATA:
        if _GLOBAL_MYSQL_ENGINE is not None:
            return "mysql", _GLOBAL_MYSQL_ENGINE

        try:
            connect_args = {
                "connect_timeout": 10,
                "read_timeout": 20,
                "write_timeout": 20,
                "charset": "utf8mb4"
            }
            host = (settings.MYSQL_HOST or "").lower()
            if any(cloud_domain in host for cloud_domain in [".azure.com", ".amazonaws.com", ".psdb.cloud", ".aivencloud.com", ".digitalocean.com"]):
                connect_args["ssl"] = {"ssl_disabled": False}

            engine = create_engine(
                settings.get_mysql_metadata_url(),
                connect_args=connect_args,
                pool_size=5,
                max_overflow=10,
                pool_recycle=300,
                pool_pre_ping=True
            )
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            _GLOBAL_MYSQL_ENGINE = engine
            return "mysql", _GLOBAL_MYSQL_ENGINE
        except Exception:
            pass
    
    return "sqlite", None

def init_db():
    """Initializes metadata tables in MySQL (if accessible) and SQLite catalog fallback."""
    # 1. Initialize SQLite catalog fallback
    settings.CATALOG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.CATALOG_DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'General',
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS staged_datasets (
        id TEXT PRIMARY KEY,
        flow_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        source_summary TEXT,
        row_count INTEGER,
        column_count INTEGER,
        storage_path TEXT NOT NULL,
        storage_format TEXT NOT NULL,
        created_at TEXT NOT NULL,
        columns_json TEXT NOT NULL,
        file_size_bytes INTEGER DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pipeline_jobs (
        id TEXT PRIMARY KEY,
        flow_id TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL DEFAULT 0.0,
        message TEXT,
        input_rows INTEGER DEFAULT 0,
        output_rows INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        output_dataset_id TEXT,
        output_file_path TEXT,
        logs_json TEXT NOT NULL,
        error TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        summary TEXT NOT NULL,
        details_json TEXT,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ingestion_history (
        id TEXT PRIMARY KEY,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        host TEXT,
        database_name TEXT,
        table_query TEXT,
        row_count INTEGER DEFAULT 0,
        column_count INTEGER DEFAULT 0,
        duration_ms REAL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'SUCCESS',
        error_message TEXT,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transformation_history (
        id TEXT PRIMARY KEY,
        staging_dataset_id TEXT NOT NULL,
        rule_count INTEGER DEFAULT 0,
        rules_json TEXT NOT NULL,
        initial_rows INTEGER DEFAULT 0,
        transformed_rows INTEGER DEFAULT 0,
        execution_time_ms REAL DEFAULT 0.0,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saved_connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        summary TEXT,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT
    )
    """)

    conn.commit()
    conn.close()

    # 2. Initialize MySQL tables if accessible
    db_type, engine = get_db_connection()
    if db_type == "mysql" and engine is not None:
        try:
            with engine.connect() as mconn:
                mconn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_flows (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    category VARCHAR(64) DEFAULT 'General',
                    status VARCHAR(32) DEFAULT 'active',
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NULL,
                    INDEX idx_flows_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                mconn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_staged_datasets (
                    id VARCHAR(64) PRIMARY KEY,
                    flow_id VARCHAR(64) NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    source_type VARCHAR(64) NOT NULL,
                    source_summary TEXT,
                    row_count INT DEFAULT 0,
                    column_count INT DEFAULT 0,
                    storage_path TEXT NOT NULL,
                    storage_format VARCHAR(32) DEFAULT 'mysql_table',
                    columns_json JSON NOT NULL,
                    file_size_bytes BIGINT DEFAULT 0,
                    created_at DATETIME NOT NULL,
                    INDEX idx_ds_flow (flow_id),
                    INDEX idx_ds_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                mconn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_pipeline_jobs (
                    id VARCHAR(64) PRIMARY KEY,
                    flow_id VARCHAR(64) NULL,
                    name VARCHAR(255) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    progress FLOAT DEFAULT 0.0,
                    message TEXT,
                    input_rows INT DEFAULT 0,
                    output_rows INT DEFAULT 0,
                    created_at DATETIME NOT NULL,
                    completed_at DATETIME NULL,
                    output_dataset_id VARCHAR(64) NULL,
                    output_file_path TEXT NULL,
                    logs_json JSON NOT NULL,
                    error TEXT NULL,
                    INDEX idx_jobs_flow (flow_id),
                    INDEX idx_jobs_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                mconn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_audit_logs (
                    id VARCHAR(64) PRIMARY KEY,
                    event_type VARCHAR(64) NOT NULL,
                    entity_id VARCHAR(64) NULL,
                    entity_type VARCHAR(64) NULL,
                    summary VARCHAR(255) NOT NULL,
                    details_json JSON NULL,
                    created_at DATETIME NOT NULL,
                    INDEX idx_audit_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                mconn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_ingestion_history (
                    id VARCHAR(64) PRIMARY KEY,
                    source_name VARCHAR(255) NOT NULL,
                    source_type VARCHAR(64) NOT NULL,
                    host VARCHAR(255) NULL,
                    database_name VARCHAR(255) NULL,
                    table_query TEXT NULL,
                    row_count INT DEFAULT 0,
                    column_count INT DEFAULT 0,
                    duration_ms FLOAT DEFAULT 0.0,
                    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
                    error_message TEXT NULL,
                    created_at DATETIME NOT NULL,
                    INDEX idx_ingest_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                mconn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_transformation_history (
                    id VARCHAR(64) PRIMARY KEY,
                    staging_dataset_id VARCHAR(64) NOT NULL,
                    rule_count INT DEFAULT 0,
                    rules_json JSON NOT NULL,
                    initial_rows INT DEFAULT 0,
                    transformed_rows INT DEFAULT 0,
                    execution_time_ms FLOAT DEFAULT 0.0,
                    created_at DATETIME NOT NULL,
                    INDEX idx_trans_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                mconn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_saved_connections (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    source_type VARCHAR(64) NOT NULL,
                    summary TEXT NULL,
                    config_json JSON NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NULL,
                    INDEX idx_conn_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                mconn.commit()
        except Exception as e:
            print(f"[WARN] MySQL metadata table initialization skipped: {e}")

# Run initialization at module load
init_db()

def _format_row(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to ensure all datetime values in a record are ISO 8601 formatted strings."""
    out = {}
    for k, v in row_dict.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

class CatalogDB:
    # --- SAVED SOURCE CONNECTIONS ---
    @staticmethod
    def save_connection(conn_dict: Dict[str, Any]) -> Dict[str, Any]:
        conn_id = conn_dict.get("id") or f"conn_{uuid.uuid4().hex[:8]}"
        now_str = datetime.utcnow().isoformat()
        config_json_str = json.dumps(conn_dict.get("config", {}))

        # 1. MySQL First
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("""
                    INSERT INTO dataflow_saved_connections (id, name, source_type, summary, config_json, created_at, updated_at)
                    VALUES (:id, :name, :source_type, :summary, :config_json, NOW(), NOW())
                    ON DUPLICATE KEY UPDATE name=:name, source_type=:source_type, summary=:summary, config_json=:config_json, updated_at=NOW()
                    """), {
                        "id": conn_id,
                        "name": conn_dict["name"],
                        "source_type": conn_dict["source_type"],
                        "summary": conn_dict.get("summary", ""),
                        "config_json": config_json_str
                    })
                    mconn.commit()
            except Exception:
                pass

        # 2. SQLite Sync
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO saved_connections (id, name, source_type, summary, config_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (conn_id, conn_dict["name"], conn_dict["source_type"], conn_dict.get("summary", ""), config_json_str, now_str, now_str))
            conn.commit()
            conn.close()
        except Exception:
            pass

        CatalogDB.record_audit_log(
            event_type="CONNECTION_SAVED",
            entity_id=conn_id,
            entity_type="DATA_SOURCE",
            summary=f"Saved {conn_dict['source_type'].upper()} connection '{conn_dict['name']}'"
        )

        return CatalogDB.get_saved_connection(conn_id)

    @staticmethod
    def get_saved_connection(conn_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_saved_connections WHERE id = :id"), {"id": conn_id})
                    row = res.fetchone()
                    if row:
                        d = _format_row(dict(row._mapping))
                        d["config"] = json.loads(d["config_json"]) if isinstance(d.get("config_json"), str) else (d.get("config_json") or {})
                        d.pop("config_json", None)
                        return d
            except Exception:
                pass

        # Fallback to SQLite
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM saved_connections WHERE id = ?", (conn_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                d = dict(row)
                d["config"] = json.loads(d["config_json"]) if isinstance(d.get("config_json"), str) else (d.get("config_json") or {})
                d.pop("config_json", None)
                return d
        except Exception:
            pass
        return None

    @staticmethod
    def list_saved_connections(source_type: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    if source_type:
                        res = mconn.execute(text("SELECT * FROM dataflow_saved_connections WHERE source_type = :st ORDER BY updated_at DESC"), {"st": source_type})
                    else:
                        res = mconn.execute(text("SELECT * FROM dataflow_saved_connections ORDER BY updated_at DESC"))
                    rows = res.fetchall()
                    results = []
                    for r in rows:
                        d = _format_row(dict(r._mapping))
                        d["config"] = json.loads(d["config_json"]) if isinstance(d.get("config_json"), str) else (d.get("config_json") or {})
                        d.pop("config_json", None)
                        results.append(d)
                    return results
            except Exception:
                pass

        # Fallback to SQLite
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if source_type:
                cursor.execute("SELECT * FROM saved_connections WHERE source_type = ? ORDER BY updated_at DESC", (source_type,))
            else:
                cursor.execute("SELECT * FROM saved_connections ORDER BY updated_at DESC")
            rows = cursor.fetchall()
            conn.close()
            results = []
            for r in rows:
                d = dict(r)
                d["config"] = json.loads(d["config_json"]) if isinstance(d.get("config_json"), str) else (d.get("config_json") or {})
                d.pop("config_json", None)
                results.append(d)
            return results
        except Exception:
            return []

    @staticmethod
    def delete_saved_connection(conn_id: str) -> bool:
        affected = 0
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("DELETE FROM dataflow_saved_connections WHERE id = :id"), {"id": conn_id})
                    mconn.commit()
                    affected += res.rowcount
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM saved_connections WHERE id = ?", (conn_id,))
            affected += cursor.rowcount
            conn.commit()
            conn.close()
        except Exception:
            pass

        CatalogDB.record_audit_log(
            event_type="CONNECTION_DELETED",
            entity_id=conn_id,
            entity_type="DATA_SOURCE",
            summary=f"Deleted saved connection {conn_id}"
        )
        return True

    # --- FLOW MANAGEMENT ---
    @staticmethod
    def create_flow(flow_dict: Dict[str, Any]) -> Dict[str, Any]:
        flow_id = flow_dict.get("id") or f"flow_{uuid.uuid4().hex[:8]}"
        now_str = datetime.utcnow().isoformat()

        # 1. MySQL First
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("""
                    INSERT INTO dataflow_flows (id, name, description, category, status, created_at, updated_at)
                    VALUES (:id, :name, :description, :category, :status, NOW(), NOW())
                    ON DUPLICATE KEY UPDATE name=:name, description=:description, category=:category, status=:status, updated_at=NOW()
                    """), {
                        "id": flow_id,
                        "name": flow_dict["name"],
                        "description": flow_dict.get("description", ""),
                        "category": flow_dict.get("category", "General"),
                        "status": flow_dict.get("status", "active"),
                    })
                    mconn.commit()
            except Exception:
                pass

        # 2. SQLite Sync
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO flows (id, name, description, category, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (flow_id, flow_dict["name"], flow_dict.get("description", ""), flow_dict.get("category", "General"), flow_dict.get("status", "active"), now_str, now_str))
            conn.commit()
            conn.close()
        except Exception:
            pass

        CatalogDB.record_audit_log(
            event_type="FLOW_CREATED",
            entity_id=flow_id,
            entity_type="DATA_FLOW",
            summary=f"Created new data flow: '{flow_dict['name']}' ({flow_dict.get('category', 'General')})",
            details=flow_dict
        )

        return CatalogDB.get_flow(flow_id)

    @staticmethod
    def list_flows() -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_flows ORDER BY created_at DESC"))
                    rows = res.fetchall()
                    flows = []
                    for r in rows:
                        f = _format_row(dict(r._mapping))
                        # Fetch linked dataset count & row count
                        ds_res = mconn.execute(text("SELECT COUNT(*), COALESCE(SUM(row_count), 0) FROM dataflow_staged_datasets WHERE flow_id = :fid OR flow_id IS NULL"), {"fid": f["id"]})
                        ds_count, total_rows = ds_res.fetchone()
                        f["dataset_count"] = ds_count or 0
                        f["total_rows"] = int(total_rows or 0)
                        flows.append(f)
                    return flows
            except Exception:
                pass

        # Fallback to SQLite
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM flows ORDER BY created_at DESC")
            rows = cursor.fetchall()
            flows = []
            for r in rows:
                f = dict(r)
                cursor.execute("SELECT COUNT(*), COALESCE(SUM(row_count), 0) FROM staged_datasets WHERE flow_id = ? OR flow_id IS NULL", (f["id"],))
                ds_count, total_rows = cursor.fetchone()
                f["dataset_count"] = ds_count or 0
                f["total_rows"] = int(total_rows or 0)
                flows.append(f)
            conn.close()
            return flows
        except Exception:
            return []

    @staticmethod
    def get_flow(flow_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_flows WHERE id = :id"), {"id": flow_id})
                    row = res.fetchone()
                    if row:
                        f = _format_row(dict(row._mapping))
                        ds_res = mconn.execute(text("SELECT COUNT(*), COALESCE(SUM(row_count), 0) FROM dataflow_staged_datasets WHERE flow_id = :fid OR flow_id IS NULL"), {"fid": flow_id})
                        ds_count, total_rows = ds_res.fetchone()
                        f["dataset_count"] = ds_count or 0
                        f["total_rows"] = int(total_rows or 0)
                        return f
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM flows WHERE id = ?", (flow_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return None
            f = dict(row)
            cursor.execute("SELECT COUNT(*), COALESCE(SUM(row_count), 0) FROM staged_datasets WHERE flow_id = ? OR flow_id IS NULL", (flow_id,))
            ds_count, total_rows = cursor.fetchone()
            f["dataset_count"] = ds_count or 0
            f["total_rows"] = int(total_rows or 0)
            conn.close()
            return f
        except Exception:
            return None

    @staticmethod
    def delete_flow(flow_id: str) -> bool:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("DELETE FROM dataflow_flows WHERE id = :id"), {"id": flow_id})
                    mconn.commit()
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM flows WHERE id = ?", (flow_id,))
            conn.commit()
            conn.close()
        except Exception:
            pass

        CatalogDB.record_audit_log(
            event_type="FLOW_DELETED",
            entity_id=flow_id,
            entity_type="DATA_FLOW",
            summary=f"Deleted data flow {flow_id}"
        )
        return True

    # --- AUDIT & INGESTION ---
    @staticmethod
    def record_audit_log(event_type: str, summary: str, entity_id: Optional[str] = None, entity_type: Optional[str] = None, details: Optional[Any] = None):
        log_id = f"aud_{uuid.uuid4().hex[:10]}"
        now_str = datetime.utcnow().isoformat()
        details_str = json.dumps(details) if details is not None else None

        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("""
                    INSERT INTO dataflow_audit_logs (id, event_type, entity_id, entity_type, summary, details_json, created_at)
                    VALUES (:id, :event_type, :entity_id, :entity_type, :summary, :details_json, NOW())
                    """), {
                        "id": log_id,
                        "event_type": event_type,
                        "entity_id": entity_id,
                        "entity_type": entity_type,
                        "summary": summary,
                        "details_json": details_str
                    })
                    mconn.commit()
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO audit_logs (id, event_type, entity_id, entity_type, summary, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (log_id, event_type, entity_id, entity_type, summary, details_str, now_str))
            conn.commit()
            conn.close()
        except Exception:
            pass

    @staticmethod
    def record_ingestion(source_name: str, source_type: str, host: Optional[str] = None, database_name: Optional[str] = None, table_query: Optional[str] = None, row_count: int = 0, column_count: int = 0, duration_ms: float = 0.0, status: str = "SUCCESS", error_message: Optional[str] = None):
        ingest_id = f"ing_{uuid.uuid4().hex[:10]}"
        now_str = datetime.utcnow().isoformat()

        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("""
                    INSERT INTO dataflow_ingestion_history (id, source_name, source_type, host, database_name, table_query, row_count, column_count, duration_ms, status, error_message, created_at)
                    VALUES (:id, :source_name, :source_type, :host, :database_name, :table_query, :row_count, :column_count, :duration_ms, :status, :error_message, NOW())
                    """), {
                        "id": ingest_id,
                        "source_name": source_name,
                        "source_type": source_type,
                        "host": host,
                        "database_name": database_name,
                        "table_query": table_query,
                        "row_count": row_count,
                        "column_count": column_count,
                        "duration_ms": duration_ms,
                        "status": status,
                        "error_message": error_message
                    })
                    mconn.commit()
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO ingestion_history (id, source_name, source_type, host, database_name, table_query, row_count, column_count, duration_ms, status, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (ingest_id, source_name, source_type, host, database_name, table_query, row_count, column_count, duration_ms, status, error_message, now_str))
            conn.commit()
            conn.close()
        except Exception:
            pass

    @staticmethod
    def record_transformation(staging_dataset_id: str, rule_count: int, rules: List[Any], initial_rows: int, transformed_rows: int, execution_time_ms: float):
        tx_id = f"tx_{uuid.uuid4().hex[:10]}"
        now_str = datetime.utcnow().isoformat()
        rules_json_str = json.dumps([r if isinstance(r, dict) else (r.dict() if hasattr(r, "dict") else str(r)) for r in rules])

        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("""
                    INSERT INTO dataflow_transformation_history (id, staging_dataset_id, rule_count, rules_json, initial_rows, transformed_rows, execution_time_ms, created_at)
                    VALUES (:id, :staging_dataset_id, :rule_count, :rules_json, :initial_rows, :transformed_rows, :execution_time_ms, NOW())
                    """), {
                        "id": tx_id,
                        "staging_dataset_id": staging_dataset_id,
                        "rule_count": rule_count,
                        "rules_json": rules_json_str,
                        "initial_rows": initial_rows,
                        "transformed_rows": transformed_rows,
                        "execution_time_ms": execution_time_ms
                    })
                    mconn.commit()
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO transformation_history (id, staging_dataset_id, rule_count, rules_json, initial_rows, transformed_rows, execution_time_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (tx_id, staging_dataset_id, rule_count, rules_json_str, initial_rows, transformed_rows, execution_time_ms, now_str))
            conn.commit()
            conn.close()
        except Exception:
            pass

    record_transformation_event = record_transformation

    # --- STAGING DATASETS ---
    @staticmethod
    def save_staged_dataset(dataset_dict: Dict[str, Any]):
        created_str = dataset_dict["created_at"] if isinstance(dataset_dict["created_at"], str) else dataset_dict["created_at"].isoformat()
        columns_json_str = json.dumps([col.dict() if hasattr(col, "dict") else col for col in dataset_dict["columns"]])

        # 1. MySQL First
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("""
                    INSERT INTO dataflow_staged_datasets 
                    (id, flow_id, name, description, source_type, source_summary, row_count, column_count, storage_path, storage_format, columns_json, file_size_bytes, created_at)
                    VALUES (:id, :flow_id, :name, :description, :source_type, :source_summary, :row_count, :column_count, :storage_path, :storage_format, :columns_json, :file_size_bytes, NOW())
                    ON DUPLICATE KEY UPDATE 
                        flow_id=:flow_id, name=:name, description=:description, row_count=:row_count, column_count=:column_count, storage_path=:storage_path, storage_format=:storage_format, file_size_bytes=:file_size_bytes
                    """), {
                        "id": dataset_dict["id"],
                        "flow_id": dataset_dict.get("flow_id"),
                        "name": dataset_dict["name"],
                        "description": dataset_dict.get("description", ""),
                        "source_type": dataset_dict["source_type"] if isinstance(dataset_dict["source_type"], str) else dataset_dict["source_type"].value,
                        "source_summary": dataset_dict.get("source_summary", ""),
                        "row_count": dataset_dict["row_count"],
                        "column_count": dataset_dict["column_count"],
                        "storage_path": dataset_dict["storage_path"],
                        "storage_format": dataset_dict.get("storage_format", "mysql_table"),
                        "columns_json": columns_json_str,
                        "file_size_bytes": dataset_dict.get("file_size_bytes", 0)
                    })
                    mconn.commit()
            except Exception:
                pass

        # 2. SQLite Sync
        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO staged_datasets 
            (id, flow_id, name, description, source_type, source_summary, row_count, column_count, storage_path, storage_format, created_at, columns_json, file_size_bytes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                dataset_dict["id"],
                dataset_dict.get("flow_id"),
                dataset_dict["name"],
                dataset_dict.get("description", ""),
                dataset_dict["source_type"] if isinstance(dataset_dict["source_type"], str) else dataset_dict["source_type"].value,
                dataset_dict.get("source_summary", ""),
                dataset_dict["row_count"],
                dataset_dict["column_count"],
                dataset_dict["storage_path"],
                dataset_dict.get("storage_format", "mysql_table"),
                created_str,
                columns_json_str,
                dataset_dict.get("file_size_bytes", 0)
            ))
            conn.commit()
            conn.close()
        except Exception:
            pass

        CatalogDB.record_audit_log(
            event_type="DATASET_STAGED",
            entity_id=dataset_dict["id"],
            entity_type="STAGED_DATASET",
            summary=f"Staged dataset '{dataset_dict['name']}' ({dataset_dict['row_count']} rows, {dataset_dict['column_count']} cols) to MySQL Database",
            details={"id": dataset_dict["id"], "flow_id": dataset_dict.get("flow_id"), "format": dataset_dict.get("storage_format", "mysql_table")}
        )

    @staticmethod
    def get_staged_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_staged_datasets WHERE id = :id"), {"id": dataset_id})
                    row = res.fetchone()
                    if row:
                        d = _format_row(dict(row._mapping))
                        d["columns"] = json.loads(d["columns_json"]) if isinstance(d.get("columns_json"), str) else (d.get("columns_json") or [])
                        d.pop("columns_json", None)
                        return d
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM staged_datasets WHERE id = ?", (dataset_id,))
            row = cursor.fetchone()
            conn.close()
            if not row:
                return None
            d = dict(row)
            d["columns"] = json.loads(d["columns_json"]) if isinstance(d.get("columns_json"), str) else (d.get("columns_json") or [])
            d.pop("columns_json", None)
            return d
        except Exception:
            return None

    @staticmethod
    def list_staged_datasets(flow_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    if flow_id:
                        res = mconn.execute(text("SELECT * FROM dataflow_staged_datasets WHERE flow_id = :fid OR flow_id IS NULL ORDER BY created_at DESC"), {"fid": flow_id})
                    else:
                        res = mconn.execute(text("SELECT * FROM dataflow_staged_datasets ORDER BY created_at DESC"))
                    rows = res.fetchall()
                    results = []
                    for r in rows:
                        d = _format_row(dict(r._mapping))
                        d["columns"] = json.loads(d["columns_json"]) if isinstance(d.get("columns_json"), str) else (d.get("columns_json") or [])
                        d.pop("columns_json", None)
                        results.append(d)
                    return results
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if flow_id:
                cursor.execute("SELECT * FROM staged_datasets WHERE flow_id = ? OR flow_id IS NULL ORDER BY created_at DESC", (flow_id,))
            else:
                cursor.execute("SELECT * FROM staged_datasets ORDER BY created_at DESC")
            rows = cursor.fetchall()
            conn.close()
            results = []
            for r in rows:
                d = dict(r)
                d["columns"] = json.loads(d["columns_json"]) if isinstance(d.get("columns_json"), str) else (d.get("columns_json") or [])
                d.pop("columns_json", None)
                results.append(d)
            return results
        except Exception:
            return []

    @staticmethod
    def delete_staged_dataset(dataset_id: str) -> bool:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("DELETE FROM dataflow_staged_datasets WHERE id = :id"), {"id": dataset_id})
                    clean_id = dataset_id.replace("-", "_")
                    mconn.execute(text(f"DROP TABLE IF EXISTS `stg_data_{clean_id}`"))
                    mconn.commit()
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM staged_datasets WHERE id = ?", (dataset_id,))
            conn.commit()
            conn.close()
        except Exception:
            pass

        CatalogDB.record_audit_log(
            event_type="DATASET_DELETED",
            entity_id=dataset_id,
            entity_type="STAGED_DATASET",
            summary=f"Deleted staged dataset {dataset_id}"
        )
        return True

    # --- PIPELINE JOBS ---
    @staticmethod
    def save_job(job_dict: Dict[str, Any]):
        created_str = job_dict["created_at"] if isinstance(job_dict["created_at"], str) else job_dict["created_at"].isoformat()
        logs_json_str = json.dumps(job_dict.get("logs", []))

        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("""
                    INSERT INTO dataflow_pipeline_jobs 
                    (id, flow_id, name, status, progress, message, input_rows, output_rows, created_at, completed_at, output_dataset_id, output_file_path, logs_json, error)
                    VALUES (:id, :flow_id, :name, :status, :progress, :message, :input_rows, :output_rows, NOW(), NULL, :output_dataset_id, :output_file_path, :logs_json, :error)
                    ON DUPLICATE KEY UPDATE 
                        status=:status, progress=:progress, message=:message, output_rows=:output_rows, completed_at=NOW(), output_dataset_id=:output_dataset_id, output_file_path=:output_file_path, logs_json=:logs_json, error=:error
                    """), {
                        "id": job_dict["id"],
                        "flow_id": job_dict.get("flow_id"),
                        "name": job_dict["name"],
                        "status": job_dict["status"],
                        "progress": job_dict.get("progress", 0.0),
                        "message": job_dict.get("message", ""),
                        "input_rows": job_dict.get("input_rows", 0),
                        "output_rows": job_dict.get("output_rows", 0),
                        "output_dataset_id": job_dict.get("output_dataset_id"),
                        "output_file_path": job_dict.get("output_file_path"),
                        "logs_json": logs_json_str,
                        "error": job_dict.get("error")
                    })
                    mconn.commit()
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO pipeline_jobs
            (id, flow_id, name, status, progress, message, input_rows, output_rows, created_at, completed_at, output_dataset_id, output_file_path, logs_json, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job_dict["id"],
                job_dict.get("flow_id"),
                job_dict["name"],
                job_dict["status"],
                job_dict.get("progress", 0.0),
                job_dict.get("message", ""),
                job_dict.get("input_rows", 0),
                job_dict.get("output_rows", 0),
                created_str,
                job_dict.get("completed_at"),
                job_dict.get("output_dataset_id"),
                job_dict.get("output_file_path"),
                logs_json_str,
                job_dict.get("error")
            ))
            conn.commit()
            conn.close()
        except Exception:
            pass

    @staticmethod
    def get_job(job_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_pipeline_jobs WHERE id = :id"), {"id": job_id})
                    row = res.fetchone()
                    if row:
                        d = _format_row(dict(row._mapping))
                        d["logs"] = json.loads(d["logs_json"]) if isinstance(d.get("logs_json"), str) else (d.get("logs_json") or [])
                        d.pop("logs_json", None)
                        return d
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM pipeline_jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            conn.close()
            if not row:
                return None
            d = dict(row)
            d["logs"] = json.loads(d["logs_json"]) if isinstance(d.get("logs_json"), str) else (d.get("logs_json") or [])
            d.pop("logs_json", None)
            return d
        except Exception:
            return None

    @staticmethod
    def list_jobs(limit: int = 50, flow_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    if flow_id:
                        res = mconn.execute(text("SELECT * FROM dataflow_pipeline_jobs WHERE flow_id = :fid ORDER BY created_at DESC LIMIT :lim"), {"fid": flow_id, "lim": limit})
                    else:
                        res = mconn.execute(text("SELECT * FROM dataflow_pipeline_jobs ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                    rows = res.fetchall()
                    results = []
                    for r in rows:
                        d = _format_row(dict(r._mapping))
                        d["logs"] = json.loads(d["logs_json"]) if isinstance(d.get("logs_json"), str) else (d.get("logs_json") or [])
                        d.pop("logs_json", None)
                        results.append(d)
                    return results
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if flow_id:
                cursor.execute("SELECT * FROM pipeline_jobs WHERE flow_id = ? ORDER BY created_at DESC LIMIT ?", (flow_id, limit))
            else:
                cursor.execute("SELECT * FROM pipeline_jobs ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            results = []
            for r in rows:
                d = dict(r)
                d["logs"] = json.loads(d["logs_json"]) if isinstance(d.get("logs_json"), str) else (d.get("logs_json") or [])
                d.pop("logs_json", None)
                results.append(d)
            return results
        except Exception:
            return []

    @staticmethod
    def list_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_audit_logs ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                    rows = res.fetchall()
                    results = []
                    for r in rows:
                        d = _format_row(dict(r._mapping))
                        d["details"] = json.loads(d["details_json"]) if isinstance(d.get("details_json"), str) else d.get("details_json")
                        d.pop("details_json", None)
                        results.append(d)
                    return results
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            results = []
            for r in rows:
                d = dict(r)
                d["details"] = json.loads(d["details_json"]) if d.get("details_json") else None
                d.pop("details_json", None)
                results.append(d)
            return results
        except Exception:
            return []

    @staticmethod
    def list_ingestion_history(limit: int = 50) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_ingestion_history ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                    rows = res.fetchall()
                    return [_format_row(dict(r._mapping)) for r in rows]
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM ingestion_history ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception:
            return []

    @staticmethod
    def list_transformation_history(limit: int = 50) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    res = mconn.execute(text("SELECT * FROM dataflow_transformation_history ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                    rows = res.fetchall()
                    results = []
                    for r in rows:
                        d = _format_row(dict(r._mapping))
                        d["rules"] = json.loads(d["rules_json"]) if isinstance(d.get("rules_json"), str) else (d.get("rules_json") or [])
                        d.pop("rules_json", None)
                        results.append(d)
                    return results
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transformation_history ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            results = []
            for r in rows:
                d = dict(r)
                d["rules"] = json.loads(d["rules_json"]) if d.get("rules_json") else []
                d.pop("rules_json", None)
                results.append(d)
            return results
        except Exception:
            return []

    @staticmethod
    def get_metadata_summary() -> Dict[str, Any]:
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    f_cnt = mconn.execute(text("SELECT COUNT(*) FROM dataflow_flows")).scalar() or 0
                    s_cnt = mconn.execute(text("SELECT COUNT(*) FROM dataflow_staged_datasets")).scalar() or 0
                    j_cnt = mconn.execute(text("SELECT COUNT(*) FROM dataflow_pipeline_jobs")).scalar() or 0
                    a_cnt = mconn.execute(text("SELECT COUNT(*) FROM dataflow_audit_logs")).scalar() or 0
                    i_cnt = mconn.execute(text("SELECT COUNT(*) FROM dataflow_ingestion_history")).scalar() or 0
                    t_cnt = mconn.execute(text("SELECT COUNT(*) FROM dataflow_transformation_history")).scalar() or 0
                    return {
                        "metadata_storage_engine": "MySQL Active",
                        "mysql_database": settings.MYSQL_DATABASE,
                        "flows_count": f_cnt,
                        "staged_datasets_count": s_cnt,
                        "pipeline_jobs_count": j_cnt,
                        "audit_logs_count": a_cnt,
                        "ingestion_events_count": i_cnt,
                        "transformation_events_count": t_cnt,
                    }
            except Exception:
                pass

        try:
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM flows")
            flows_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM staged_datasets")
            staged_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM pipeline_jobs")
            jobs_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM audit_logs")
            audit_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM ingestion_history")
            ingestion_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM transformation_history")
            transform_count = cursor.fetchone()[0]
            conn.close()
            return {
                "metadata_storage_engine": "SQLite Catalog (Local Fallback)",
                "mysql_database": settings.MYSQL_DATABASE,
                "flows_count": flows_count,
                "staged_datasets_count": staged_count,
                "pipeline_jobs_count": jobs_count,
                "audit_logs_count": audit_count,
                "ingestion_events_count": ingestion_count,
                "transformation_events_count": transform_count,
            }
        except Exception:
            return {
                "metadata_storage_engine": "Unknown",
                "mysql_database": settings.MYSQL_DATABASE,
                "flows_count": 0,
                "staged_datasets_count": 0,
                "pipeline_jobs_count": 0,
                "audit_logs_count": 0,
                "ingestion_events_count": 0,
                "transformation_events_count": 0,
            }

    @staticmethod
    def clear_all_metadata():
        """Completely purges all historical metadata, flows, staging sets, and audit records."""
        db_type, engine = get_db_connection()
        if db_type == "mysql" and engine is not None:
            try:
                with engine.connect() as mconn:
                    mconn.execute(text("DELETE FROM dataflow_flows"))
                    mconn.execute(text("DELETE FROM dataflow_staged_datasets"))
                    mconn.execute(text("DELETE FROM dataflow_pipeline_jobs"))
                    mconn.execute(text("DELETE FROM dataflow_audit_logs"))
                    mconn.execute(text("DELETE FROM dataflow_ingestion_history"))
                    mconn.execute(text("DELETE FROM dataflow_transformation_history"))
                    
                    # Drop all dedicated MySQL staging tables
                    res = mconn.execute(text("SHOW TABLES LIKE 'stg_data_%'"))
                    stg_tables = [r[0] for r in res.fetchall()]
                    for tbl in stg_tables:
                        mconn.execute(text(f"DROP TABLE IF EXISTS `{tbl}`"))

                    mconn.commit()
            except Exception:
                pass

        try:
            settings.CATALOG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(settings.CATALOG_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM flows")
            cursor.execute("DELETE FROM staged_datasets")
            cursor.execute("DELETE FROM pipeline_jobs")
            cursor.execute("DELETE FROM audit_logs")
            cursor.execute("DELETE FROM ingestion_history")
            cursor.execute("DELETE FROM transformation_history")
            conn.commit()
            conn.close()
        except Exception:
            pass
