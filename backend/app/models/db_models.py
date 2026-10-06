import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import create_engine, text
from ..config import settings

_GLOBAL_ENGINE = None
_GLOBAL_ENGINE_TYPE = None

def reset_db_connection():
    """Closes and resets the active SQLAlchemy engine pool."""
    global _GLOBAL_ENGINE, _GLOBAL_ENGINE_TYPE
    if _GLOBAL_ENGINE is not None:
        try:
            _GLOBAL_ENGINE.dispose()
        except Exception:
            pass
    _GLOBAL_ENGINE = None
    _GLOBAL_ENGINE_TYPE = None

def get_db_connection():
    """
    Returns (engine_type, engine) for the currently configured metadata database (MySQL or PostgreSQL).
    Does NOT fall back to SQLite.
    """
    global _GLOBAL_ENGINE, _GLOBAL_ENGINE_TYPE
    target_engine = (settings.METADATA_ENGINE or "mysql").lower()

    if _GLOBAL_ENGINE is not None and _GLOBAL_ENGINE_TYPE == target_engine:
        return _GLOBAL_ENGINE_TYPE, _GLOBAL_ENGINE

    if target_engine == "postgres":
        try:
            # 1. Ensure target postgres database exists (attempt creation via default postgres database)
            try:
                import urllib.parse
                user = urllib.parse.quote_plus(settings.POSTGRES_USER)
                pwd = f":{urllib.parse.quote_plus(settings.POSTGRES_PASSWORD)}" if settings.POSTGRES_PASSWORD else ""
                admin_url = f"postgresql+psycopg2://{user}{pwd}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/postgres"
                admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT", connect_args={"connect_timeout": 4})
                with admin_engine.connect() as aconn:
                    check_db = aconn.execute(text("SELECT 1 FROM pg_database WHERE datname = :db"), {"db": settings.POSTGRES_DATABASE})
                    if not check_db.fetchone():
                        safe_db = settings.POSTGRES_DATABASE.replace('"', '').replace("'", "")
                        aconn.execute(text(f'CREATE DATABASE "{safe_db}";'))
                admin_engine.dispose()
            except Exception:
                pass

            # 2. Connect to the specific target database
            connect_args = {
                "connect_timeout": 5,
                "options": f"-csearch_path={settings.POSTGRES_SCHEMA},public"
            }
            host = (settings.POSTGRES_HOST or "").lower()
            if any(cloud in host for cloud in [".azure.com", ".amazonaws.com", ".supabase.co", ".neon.tech", ".aivencloud.com", ".databricks.com"]):
                connect_args["sslmode"] = "require"

            engine = create_engine(
                settings.get_postgres_metadata_url(),
                connect_args=connect_args,
                pool_size=5,
                max_overflow=10,
                pool_recycle=300,
                pool_pre_ping=True
            )
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            _GLOBAL_ENGINE = engine
            _GLOBAL_ENGINE_TYPE = "postgres"
            return "postgres", _GLOBAL_ENGINE
        except Exception as e:
            print(f"[ERROR] Failed to connect to PostgreSQL metadata database: {e}")
            return "postgres", None

    # Default: MySQL
    try:
        connect_args = {
            "connect_timeout": 4,
            "read_timeout": 6,
            "write_timeout": 6,
            "charset": "utf8mb4"
        }
        host = (settings.MYSQL_HOST or "").lower()
        if any(cloud in host for cloud in [".azure.com", ".amazonaws.com", ".psdb.cloud", ".aivencloud.com", ".digitalocean.com"]):
            connect_args["ssl"] = {"ssl_disabled": False}

        # 1. Ensure target MySQL database exists
        try:
            import urllib.parse
            user = urllib.parse.quote_plus(settings.MYSQL_USER)
            pwd = f":{urllib.parse.quote_plus(settings.MYSQL_PASSWORD)}" if settings.MYSQL_PASSWORD else ""
            admin_url = f"mysql+pymysql://{user}{pwd}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/"
            admin_engine = create_engine(admin_url, connect_args=connect_args, pool_pre_ping=True)
            with admin_engine.connect() as aconn:
                aconn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{settings.MYSQL_DATABASE}` DEFAULT CHARACTER SET utf8mb4;"))
                aconn.commit()
            admin_engine.dispose()
        except Exception:
            pass

        # 2. Connect to the specific metadata database
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
        
        _GLOBAL_ENGINE = engine
        _GLOBAL_ENGINE_TYPE = "mysql"
        return "mysql", _GLOBAL_ENGINE
    except Exception as e:
        print(f"[ERROR] Failed to connect to MySQL metadata database: {e}")
        return "mysql", None

def init_db():
    """Initializes metadata tables in the active metadata database (MySQL or PostgreSQL)."""
    db_type, engine = get_db_connection()
    if engine is None:
        print(f"[WARN] Cannot initialize tables: {db_type} database is offline or unreachable.")
        return

    try:
        with engine.connect() as conn:
            if db_type == "postgres":
                # Ensure PostgreSQL schema exists
                try:
                    conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{settings.POSTGRES_SCHEMA}";'))
                    conn.commit()
                except Exception:
                    pass

                conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_flows (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    category VARCHAR(64) DEFAULT 'General',
                    status VARCHAR(32) DEFAULT 'active',
                    sync_mode VARCHAR(32) DEFAULT 'full',
                    watermark_column VARCHAR(128) DEFAULT 'aud_last_update',
                    last_watermark_value VARCHAR(255) NULL,
                    last_synced_at TIMESTAMP NULL,
                    primary_key VARCHAR(255) NULL,
                    source_request_json TEXT NULL,
                    rules_json TEXT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NULL
                );
                CREATE INDEX IF NOT EXISTS idx_df_flows_created ON dataflow_flows (created_at);

                CREATE TABLE IF NOT EXISTS dataflow_staged_datasets (
                    id VARCHAR(64) PRIMARY KEY,
                    flow_id VARCHAR(64) NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    source_type VARCHAR(64) NOT NULL,
                    source_summary VARCHAR(255),
                    sync_mode VARCHAR(32) DEFAULT 'full',
                    watermark_column VARCHAR(128) DEFAULT 'aud_last_update',
                    last_watermark_value VARCHAR(255) NULL,
                    last_synced_at TIMESTAMP NULL,
                    primary_key VARCHAR(255) NULL,
                    row_count INT,
                    column_count INT,
                    storage_path TEXT NOT NULL,
                    storage_format VARCHAR(32) NOT NULL,
                    columns_json TEXT NOT NULL,
                    file_size_bytes BIGINT DEFAULT 0,
                    created_at TIMESTAMP NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_df_ds_flow ON dataflow_staged_datasets (flow_id);
                CREATE INDEX IF NOT EXISTS idx_df_ds_created ON dataflow_staged_datasets (created_at);

                CREATE TABLE IF NOT EXISTS dataflow_staged_records (
                    id BIGSERIAL PRIMARY KEY,
                    dataset_id VARCHAR(64) NOT NULL,
                    flow_id VARCHAR(64) NULL,
                    row_index INT NOT NULL,
                    data_json TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    UNIQUE (dataset_id, row_index)
                );
                CREATE INDEX IF NOT EXISTS idx_df_stg_rec_ds ON dataflow_staged_records (dataset_id);
                CREATE INDEX IF NOT EXISTS idx_df_stg_rec_flow ON dataflow_staged_records (flow_id);

                CREATE TABLE IF NOT EXISTS dataflow_pipeline_jobs (
                    id VARCHAR(64) PRIMARY KEY,
                    flow_id VARCHAR(64) NULL,
                    name VARCHAR(255) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    progress REAL DEFAULT 0.0,
                    message TEXT,
                    input_rows INT DEFAULT 0,
                    output_rows INT DEFAULT 0,
                    created_at TIMESTAMP NOT NULL,
                    completed_at TIMESTAMP NULL,
                    output_dataset_id VARCHAR(64) NULL,
                    output_file_path TEXT NULL,
                    logs_json TEXT NOT NULL,
                    error TEXT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_df_jobs_flow ON dataflow_pipeline_jobs (flow_id);
                CREATE INDEX IF NOT EXISTS idx_df_jobs_created ON dataflow_pipeline_jobs (created_at);

                CREATE TABLE IF NOT EXISTS dataflow_audit_logs (
                    id VARCHAR(64) PRIMARY KEY,
                    event_type VARCHAR(64) NOT NULL,
                    entity_id VARCHAR(64) NULL,
                    entity_type VARCHAR(64) NULL,
                    summary VARCHAR(255) NOT NULL,
                    details_json TEXT NULL,
                    created_at TIMESTAMP NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_df_audit_created ON dataflow_audit_logs (created_at);

                CREATE TABLE IF NOT EXISTS dataflow_ingestion_history (
                    id VARCHAR(64) PRIMARY KEY,
                    source_name VARCHAR(255) NOT NULL,
                    source_type VARCHAR(64) NOT NULL,
                    host VARCHAR(255) NULL,
                    database_name VARCHAR(255) NULL,
                    table_query TEXT NULL,
                    row_count INT DEFAULT 0,
                    column_count INT DEFAULT 0,
                    duration_ms REAL DEFAULT 0.0,
                    status VARCHAR(32) DEFAULT 'SUCCESS',
                    error_message TEXT NULL,
                    created_at TIMESTAMP NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_df_ingest_created ON dataflow_ingestion_history (created_at);

                CREATE TABLE IF NOT EXISTS dataflow_transformation_history (
                    id VARCHAR(64) PRIMARY KEY,
                    staging_dataset_id VARCHAR(64) NOT NULL,
                    rule_count INT DEFAULT 0,
                    rules_json TEXT NOT NULL,
                    initial_rows INT DEFAULT 0,
                    transformed_rows INT DEFAULT 0,
                    execution_time_ms REAL DEFAULT 0.0,
                    created_at TIMESTAMP NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_df_trans_created ON dataflow_transformation_history (created_at);

                CREATE TABLE IF NOT EXISTS dataflow_saved_connections (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    source_type VARCHAR(64) NOT NULL,
                    summary TEXT NULL,
                    config_json TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NULL
                );
                CREATE INDEX IF NOT EXISTS idx_df_conn_created ON dataflow_saved_connections (created_at);

                CREATE TABLE IF NOT EXISTS dataflow_flow_schedules (
                    id VARCHAR(64) PRIMARY KEY,
                    flow_id VARCHAR(64) NOT NULL,
                    flow_name VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    cron_expression VARCHAR(128) NOT NULL,
                    cron_human VARCHAR(255),
                    enabled SMALLINT DEFAULT 1,
                    staging_dataset_id VARCHAR(64) NOT NULL,
                    destination_config_json TEXT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NULL,
                    last_run_at TIMESTAMP NULL,
                    last_run_status VARCHAR(32) NULL,
                    last_run_job_id VARCHAR(64) NULL,
                    last_run_message TEXT NULL,
                    next_run_at TIMESTAMP NULL,
                    run_count INT DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_df_sched_flow ON dataflow_flow_schedules (flow_id);
                CREATE INDEX IF NOT EXISTS idx_df_sched_enabled ON dataflow_flow_schedules (enabled);
                """))
                conn.commit()
            else:
                # MySQL Table Definitions
                conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_flows (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    category VARCHAR(64) DEFAULT 'General',
                    status VARCHAR(32) DEFAULT 'active',
                    sync_mode VARCHAR(32) DEFAULT 'full',
                    watermark_column VARCHAR(128) DEFAULT 'aud_last_update',
                    last_watermark_value VARCHAR(255) NULL,
                    last_synced_at DATETIME NULL,
                    primary_key VARCHAR(255) NULL,
                    source_request_json JSON NULL,
                    rules_json JSON NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NULL,
                    INDEX idx_flows_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))

                for col_sql in [
                    "ALTER TABLE dataflow_flows ADD COLUMN rules_json JSON NULL",
                    "ALTER TABLE dataflow_flows ADD COLUMN sync_mode VARCHAR(32) DEFAULT 'full'",
                    "ALTER TABLE dataflow_flows ADD COLUMN watermark_column VARCHAR(128) DEFAULT 'aud_last_update'",
                    "ALTER TABLE dataflow_flows ADD COLUMN last_watermark_value VARCHAR(255) NULL",
                    "ALTER TABLE dataflow_flows ADD COLUMN last_synced_at DATETIME NULL",
                    "ALTER TABLE dataflow_flows ADD COLUMN primary_key VARCHAR(255) NULL",
                    "ALTER TABLE dataflow_flows ADD COLUMN source_request_json JSON NULL"
                ]:
                    try:
                        conn.execute(text(col_sql))
                    except Exception:
                        pass

                conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_staged_datasets (
                    id VARCHAR(64) PRIMARY KEY,
                    flow_id VARCHAR(64) NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    source_type VARCHAR(64) NOT NULL,
                    source_summary VARCHAR(255),
                    sync_mode VARCHAR(32) DEFAULT 'full',
                    watermark_column VARCHAR(128) DEFAULT 'aud_last_update',
                    last_watermark_value VARCHAR(255) NULL,
                    last_synced_at DATETIME NULL,
                    primary_key VARCHAR(255) NULL,
                    row_count INT,
                    column_count INT,
                    storage_path TEXT NOT NULL,
                    storage_format VARCHAR(32) NOT NULL,
                    columns_json JSON NOT NULL,
                    file_size_bytes BIGINT DEFAULT 0,
                    created_at DATETIME NOT NULL,
                    INDEX idx_ds_flow (flow_id),
                    INDEX idx_ds_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))

                for col_sql in [
                    "ALTER TABLE dataflow_staged_datasets ADD COLUMN sync_mode VARCHAR(32) DEFAULT 'full'",
                    "ALTER TABLE dataflow_staged_datasets ADD COLUMN watermark_column VARCHAR(128) DEFAULT 'aud_last_update'",
                    "ALTER TABLE dataflow_staged_datasets ADD COLUMN last_watermark_value VARCHAR(255) NULL",
                    "ALTER TABLE dataflow_staged_datasets ADD COLUMN last_synced_at DATETIME NULL",
                    "ALTER TABLE dataflow_staged_datasets ADD COLUMN primary_key VARCHAR(255) NULL"
                ]:
                    try:
                        conn.execute(text(col_sql))
                    except Exception:
                        pass

                conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_staged_records (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    dataset_id VARCHAR(64) NOT NULL,
                    flow_id VARCHAR(64) NULL,
                    row_index INT NOT NULL,
                    data_json LONGTEXT NOT NULL,
                    created_at DATETIME NOT NULL,
                    INDEX idx_stg_rec_ds (dataset_id),
                    INDEX idx_stg_rec_flow (flow_id),
                    UNIQUE KEY uk_dataset_row (dataset_id, row_index)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))

                conn.execute(text("""
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

                conn.execute(text("""
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

                conn.execute(text("""
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
                    status VARCHAR(32) DEFAULT 'SUCCESS',
                    error_message TEXT NULL,
                    created_at DATETIME NOT NULL,
                    INDEX idx_ingest_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))

                conn.execute(text("""
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

                conn.execute(text("""
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

                conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dataflow_flow_schedules (
                    id VARCHAR(64) PRIMARY KEY,
                    flow_id VARCHAR(64) NOT NULL,
                    flow_name VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    cron_expression VARCHAR(128) NOT NULL,
                    cron_human VARCHAR(255),
                    enabled TINYINT(1) DEFAULT 1,
                    staging_dataset_id VARCHAR(64) NOT NULL,
                    destination_config_json JSON NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NULL,
                    last_run_at DATETIME NULL,
                    last_run_status VARCHAR(32) NULL,
                    last_run_job_id VARCHAR(64) NULL,
                    last_run_message TEXT NULL,
                    next_run_at DATETIME NULL,
                    run_count INT DEFAULT 0,
                    INDEX idx_sched_flow (flow_id),
                    INDEX idx_sched_enabled (enabled)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
                conn.commit()

            # Clean static default flow if present
            try:
                conn.execute(text("DELETE FROM dataflow_flows WHERE id = 'flow_default_01'"))
                conn.commit()
            except Exception:
                pass
    except Exception as e:
        print(f"[WARN] Table initialization warning on {db_type}: {e}")

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

def _enrich_flow_with_stages(f: Dict[str, Any], conn) -> Dict[str, Any]:
    flow_id = f["id"]
    dataset_count = f.get("dataset_count", 0)
    total_rows = f.get("total_rows", 0)
    rules_count = len(f.get("rules", []))
    
    latest_job = None
    try:
        j_res = conn.execute(
            text("SELECT * FROM dataflow_pipeline_jobs WHERE flow_id = :fid ORDER BY created_at DESC LIMIT 1"),
            {"fid": flow_id}
        )
        j_row = j_res.fetchone()
        if j_row:
            latest_job = _format_row(dict(j_row._mapping))
    except Exception:
        pass

    job_completed = latest_job is not None and str(latest_job.get("status", "")).lower() == "completed"

    stages = {
        "ingestion": {
            "id": "ingestion",
            "name": "Data Ingestion",
            "completed": dataset_count > 0,
            "status": "COMPLETED" if dataset_count > 0 else "PENDING",
            "count": dataset_count,
            "summary": f"{dataset_count} Source Set{'s' if dataset_count != 1 else ''} Connected" if dataset_count > 0 else "No sources connected"
        },
        "schema": {
            "id": "schema",
            "name": "Schema Profiling & Types",
            "completed": dataset_count > 0,
            "status": "COMPLETED" if dataset_count > 0 else "PENDING",
            "count": dataset_count,
            "summary": "Spark Types Profiled & Casted" if dataset_count > 0 else "Pending Schema Profiling"
        },
        "staging": {
            "id": "staging",
            "name": "Lakehouse Staging",
            "completed": dataset_count > 0 and total_rows > 0,
            "status": "COMPLETED" if dataset_count > 0 else "PENDING",
            "count": total_rows,
            "summary": f"{total_rows:,} Staged Rows Ready" if total_rows > 0 else "Staging storage empty"
        },
        "transformation": {
            "id": "transformation",
            "name": "Transform Studio",
            "completed": rules_count > 0,
            "status": "COMPLETED" if rules_count > 0 else "PENDING",
            "count": rules_count,
            "summary": f"{rules_count} Active Spark Rules Configured" if rules_count > 0 else "No Transformation Rules"
        },
        "execution": {
            "id": "execution",
            "name": "Pipeline Runner & Export",
            "completed": job_completed,
            "status": "COMPLETED" if job_completed else ("FAILED" if latest_job and str(latest_job.get("status")).lower() == "failed" else "PENDING"),
            "count": 1 if latest_job else 0,
            "summary": f"Last Run: {str(latest_job.get('status')).upper()} ({latest_job.get('output_rows', 0):,} rows)" if latest_job else "Pipeline execution pending"
        }
    }

    completed_count = sum(1 for s in stages.values() if s["completed"])
    f["stages"] = stages
    f["completed_stages_count"] = completed_count
    f["total_stages_count"] = 5
    f["progress_percentage"] = int((completed_count / 5) * 100)
    f["latest_job"] = latest_job
    return f

class CatalogDB:
    # --- SAVED SOURCE CONNECTIONS ---
    @staticmethod
    def save_connection(conn_dict: Dict[str, Any]) -> Dict[str, Any]:
        conn_id = conn_dict.get("id") or f"conn_{uuid.uuid4().hex[:8]}"
        config_json_str = json.dumps(conn_dict.get("config", {}))

        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Database error: {db_type} metadata database is not connected.")

        with engine.connect() as conn:
            check = conn.execute(text("SELECT 1 FROM dataflow_saved_connections WHERE id = :id"), {"id": conn_id}).fetchone()
            if check:
                conn.execute(text("""
                UPDATE dataflow_saved_connections 
                SET name = :name, source_type = :source_type, summary = :summary, config_json = :config_json, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                """), {
                    "id": conn_id,
                    "name": conn_dict["name"],
                    "source_type": conn_dict["source_type"],
                    "summary": conn_dict.get("summary", ""),
                    "config_json": config_json_str
                })
            else:
                conn.execute(text("""
                INSERT INTO dataflow_saved_connections (id, name, source_type, summary, config_json, created_at, updated_at)
                VALUES (:id, :name, :source_type, :summary, :config_json, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """), {
                    "id": conn_id,
                    "name": conn_dict["name"],
                    "source_type": conn_dict["source_type"],
                    "summary": conn_dict.get("summary", ""),
                    "config_json": config_json_str
                })
            conn.commit()

        CatalogDB.record_audit_log(
            event_type="CONNECTION_SAVED",
            entity_id=conn_id,
            entity_type="DATA_SOURCE",
            summary=f"Saved source connection '{conn_dict['name']}' ({conn_dict['source_type']})"
        )
        return CatalogDB.get_saved_connection(conn_id)

    @staticmethod
    def get_saved_connection(conn_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return None

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_saved_connections WHERE id = :id"), {"id": conn_id})
                row = res.fetchone()
                if row:
                    d = _format_row(dict(row._mapping))
                    d["config"] = json.loads(d["config_json"]) if isinstance(d.get("config_json"), str) else (d.get("config_json") or {})
                    d.pop("config_json", None)
                    return d
        except Exception:
            pass
        return None

    @staticmethod
    def list_saved_connections(source_type: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                if source_type:
                    res = conn.execute(text("SELECT * FROM dataflow_saved_connections WHERE source_type = :st ORDER BY created_at DESC"), {"st": source_type})
                else:
                    res = conn.execute(text("SELECT * FROM dataflow_saved_connections ORDER BY created_at DESC"))
                rows = res.fetchall()
                results = []
                for r in rows:
                    d = _format_row(dict(r._mapping))
                    d["config"] = json.loads(d["config_json"]) if isinstance(d.get("config_json"), str) else (d.get("config_json") or {})
                    d.pop("config_json", None)
                    results.append(d)
                return results
        except Exception:
            return []

    @staticmethod
    def delete_saved_connection(conn_id: str) -> bool:
        db_type, engine = get_db_connection()
        if engine is None:
            return False

        try:
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM dataflow_saved_connections WHERE id = :id"), {"id": conn_id})
                conn.commit()
            CatalogDB.record_audit_log(
                event_type="CONNECTION_DELETED",
                entity_id=conn_id,
                entity_type="DATA_SOURCE",
                summary=f"Deleted source connection {conn_id}"
            )
            return True
        except Exception:
            return False

    # --- FLOWS ---
    @staticmethod
    def create_flow(flow_dict: Dict[str, Any]) -> Dict[str, Any]:
        flow_id = flow_dict.get("id") or f"flow_{uuid.uuid4().hex[:8]}"
        rules_json_str = json.dumps(flow_dict.get("rules", []))
        src_req_str = json.dumps(flow_dict.get("source_request")) if flow_dict.get("source_request") else None

        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Database error: {db_type} metadata database is not connected.")

        with engine.connect() as conn:
            conn.execute(text("""
            INSERT INTO dataflow_flows 
            (id, name, description, category, status, sync_mode, watermark_column, last_watermark_value, last_synced_at, primary_key, source_request_json, rules_json, created_at, updated_at)
            VALUES 
            (:id, :name, :description, :category, :status, :sync_mode, :watermark_column, :last_watermark_value, :last_synced_at, :primary_key, :source_request_json, :rules_json, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """), {
                "id": flow_id,
                "name": flow_dict["name"],
                "description": flow_dict.get("description", ""),
                "category": flow_dict.get("category", "General"),
                "status": flow_dict.get("status", "active"),
                "sync_mode": flow_dict.get("sync_mode", "full"),
                "watermark_column": flow_dict.get("watermark_column", "aud_last_update"),
                "last_watermark_value": flow_dict.get("last_watermark_value"),
                "last_synced_at": flow_dict.get("last_synced_at"),
                "primary_key": flow_dict.get("primary_key"),
                "source_request_json": src_req_str,
                "rules_json": rules_json_str
            })
            conn.commit()

        CatalogDB.record_audit_log(
            event_type="FLOW_CREATED",
            entity_id=flow_id,
            entity_type="FLOW",
            summary=f"Created Data Flow '{flow_dict['name']}' in category '{flow_dict.get('category', 'General')}'"
        )
        return CatalogDB.get_flow(flow_id)

    @staticmethod
    def update_flow(flow_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        existing = CatalogDB.get_flow(flow_id)
        if not existing:
            return None

        set_clauses = ["updated_at = CURRENT_TIMESTAMP"]
        params = {"id": flow_id}

        for k, v in updates.items():
            if k in ["name", "description", "category", "status", "sync_mode", "watermark_column", "last_watermark_value", "last_synced_at", "primary_key"]:
                set_clauses.append(f"{k} = :{k}")
                params[k] = v
            elif k == "rules":
                set_clauses.append("rules_json = :rules_json")
                params["rules_json"] = json.dumps(v)
            elif k == "source_request":
                set_clauses.append("source_request_json = :source_request_json")
                params["source_request_json"] = json.dumps(v) if v else None

        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Database error: {db_type} metadata database is not connected.")

        with engine.connect() as conn:
            conn.execute(text(f"UPDATE dataflow_flows SET {', '.join(set_clauses)} WHERE id = :id"), params)
            conn.commit()

        CatalogDB.record_audit_log(
            event_type="FLOW_UPDATED",
            entity_id=flow_id,
            entity_type="FLOW",
            summary=f"Updated Data Flow '{existing.get('name')}' fields: {', '.join(updates.keys())}"
        )
        return CatalogDB.get_flow(flow_id)

    @staticmethod
    def reset_flow_watermark(flow_id: str, watermark_value: Optional[str] = None) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return None

        with engine.connect() as conn:
            conn.execute(text("""
            UPDATE dataflow_flows 
            SET last_watermark_value = :val, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
            """), {"id": flow_id, "val": watermark_value})
            conn.commit()

        return CatalogDB.get_flow(flow_id)

    @staticmethod
    def save_flow_rules(flow_id: str, rules: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        rules_json_str = json.dumps(rules)
        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Database error: {db_type} metadata database is not connected.")

        with engine.connect() as conn:
            conn.execute(text("""
            UPDATE dataflow_flows 
            SET rules_json = :rules_json, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
            """), {"id": flow_id, "rules_json": rules_json_str})
            conn.commit()

        CatalogDB.record_audit_log(
            event_type="FLOW_RULES_SAVED",
            entity_id=flow_id,
            entity_type="FLOW",
            summary=f"Saved {len(rules)} transformation rule(s) to Flow {flow_id}"
        )
        return CatalogDB.get_flow(flow_id)

    @staticmethod
    def get_flow(flow_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return None

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_flows WHERE id = :id"), {"id": flow_id})
                row = res.fetchone()
                if not row:
                    return None
                f = _format_row(dict(row._mapping))
                f["rules"] = json.loads(f["rules_json"]) if isinstance(f.get("rules_json"), str) else (f.get("rules_json") or [])
                f.pop("rules_json", None)
                if f.get("source_request_json"):
                    f["source_request"] = json.loads(f["source_request_json"]) if isinstance(f.get("source_request_json"), str) else f.get("source_request_json")
                f.pop("source_request_json", None)

                # Aggregate metrics for flow
                agg_res = conn.execute(text("SELECT COUNT(*) AS ds_cnt, COALESCE(SUM(row_count), 0) AS total_rows FROM dataflow_staged_datasets WHERE flow_id = :fid"), {"fid": flow_id})
                agg_row = agg_res.fetchone()
                f["dataset_count"] = agg_row[0] if agg_row else 0
                f["total_rows"] = int(agg_row[1]) if agg_row else 0

                return _enrich_flow_with_stages(f, conn)
        except Exception:
            return None

    @staticmethod
    def list_flows(limit: int = 100, category: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                if category:
                    res = conn.execute(text("SELECT * FROM dataflow_flows WHERE category = :cat ORDER BY created_at DESC LIMIT :lim"), {"cat": category, "lim": limit})
                else:
                    res = conn.execute(text("SELECT * FROM dataflow_flows ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                rows = res.fetchall()

                # Get dataset count and total rows grouped by flow_id
                ds_agg_res = conn.execute(text("SELECT flow_id, COUNT(*) AS ds_cnt, COALESCE(SUM(row_count), 0) AS total_rows FROM dataflow_staged_datasets WHERE flow_id IS NOT NULL GROUP BY flow_id"))
                ds_map = {r[0]: (r[1], int(r[2])) for r in ds_agg_res.fetchall()}

                flows = []
                for r in rows:
                    f = _format_row(dict(r._mapping))
                    f["rules"] = json.loads(f["rules_json"]) if isinstance(f.get("rules_json"), str) else (f.get("rules_json") or [])
                    f.pop("rules_json", None)
                    if f.get("source_request_json"):
                        f["source_request"] = json.loads(f["source_request_json"]) if isinstance(f.get("source_request_json"), str) else f.get("source_request_json")
                    f.pop("source_request_json", None)

                    fid = f["id"]
                    f["dataset_count"] = ds_map.get(fid, (0, 0))[0]
                    f["total_rows"] = ds_map.get(fid, (0, 0))[1]
                    flows.append(_enrich_flow_with_stages(f, conn))
                return flows
        except Exception:
            return []

    @staticmethod
    def delete_flow(flow_id: str) -> bool:
        db_type, engine = get_db_connection()
        if engine is None:
            return False

        try:
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM dataflow_staged_records WHERE flow_id = :id"), {"id": flow_id})
                conn.execute(text("DELETE FROM dataflow_staged_datasets WHERE flow_id = :id"), {"id": flow_id})
                conn.execute(text("DELETE FROM dataflow_pipeline_jobs WHERE flow_id = :id"), {"id": flow_id})
                conn.execute(text("DELETE FROM dataflow_flow_schedules WHERE flow_id = :id"), {"id": flow_id})
                conn.execute(text("DELETE FROM dataflow_flows WHERE id = :id"), {"id": flow_id})
                conn.commit()

            CatalogDB.record_audit_log(
                event_type="FLOW_DELETED",
                entity_id=flow_id,
                entity_type="FLOW",
                summary=f"Deleted flow {flow_id} and all associated staged tables, jobs, and schedules"
            )
            return True
        except Exception:
            return False

    @staticmethod
    def get_flow_rules(flow_id: str) -> Dict[str, Any]:
        f = CatalogDB.get_flow(flow_id)
        if f:
            return {"flow_id": flow_id, "rules": f.get("rules", [])}
        return {"flow_id": flow_id, "rules": []}

    # --- STAGED DATASETS ---
    @staticmethod
    def save_staged_dataset(dataset_dict: Dict[str, Any]):
        dataset_id = dataset_dict["id"]
        columns_json_str = json.dumps([c.dict() if hasattr(c, "dict") else c for c in dataset_dict.get("columns", [])])
        sync_mode = dataset_dict.get("sync_mode") or "full"
        watermark_column = dataset_dict.get("watermark_column") or "aud_last_update"
        last_watermark_value = dataset_dict.get("last_watermark_value")
        last_synced_at = dataset_dict.get("last_synced_at")
        primary_key = dataset_dict.get("primary_key")
        source_type = dataset_dict["source_type"] if isinstance(dataset_dict["source_type"], str) else dataset_dict["source_type"].value

        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Database error: {db_type} metadata database is not connected.")

        with engine.connect() as conn:
            check = conn.execute(text("SELECT 1 FROM dataflow_staged_datasets WHERE id = :id"), {"id": dataset_id}).fetchone()
            params = {
                "id": dataset_id,
                "flow_id": dataset_dict.get("flow_id"),
                "name": dataset_dict["name"],
                "description": dataset_dict.get("description", ""),
                "source_type": source_type,
                "source_summary": dataset_dict.get("source_summary", ""),
                "sync_mode": sync_mode,
                "watermark_column": watermark_column,
                "last_watermark_value": last_watermark_value,
                "last_synced_at": last_synced_at,
                "primary_key": primary_key,
                "row_count": dataset_dict["row_count"],
                "column_count": dataset_dict["column_count"],
                "storage_path": dataset_dict["storage_path"],
                "storage_format": dataset_dict.get("storage_format", f"{db_type}_table"),
                "columns_json": columns_json_str,
                "file_size_bytes": dataset_dict.get("file_size_bytes", 0)
            }
            if check:
                conn.execute(text("""
                UPDATE dataflow_staged_datasets SET
                    flow_id = :flow_id, name = :name, description = :description, source_type = :source_type,
                    source_summary = :source_summary, sync_mode = :sync_mode, watermark_column = :watermark_column,
                    last_watermark_value = :last_watermark_value, last_synced_at = :last_synced_at, primary_key = :primary_key,
                    row_count = :row_count, column_count = :column_count, storage_path = :storage_path, storage_format = :storage_format,
                    columns_json = :columns_json, file_size_bytes = :file_size_bytes
                WHERE id = :id
                """), params)
            else:
                conn.execute(text("""
                INSERT INTO dataflow_staged_datasets
                (id, flow_id, name, description, source_type, source_summary, sync_mode, watermark_column, last_watermark_value, last_synced_at, primary_key, row_count, column_count, storage_path, storage_format, columns_json, file_size_bytes, created_at)
                VALUES
                (:id, :flow_id, :name, :description, :source_type, :source_summary, :sync_mode, :watermark_column, :last_watermark_value, :last_synced_at, :primary_key, :row_count, :column_count, :storage_path, :storage_format, :columns_json, :file_size_bytes, CURRENT_TIMESTAMP)
                """), params)
            conn.commit()

        CatalogDB.record_audit_log(
            event_type="DATASET_STAGED",
            entity_id=dataset_id,
            entity_type="STAGED_DATASET",
            summary=f"Staged dataset '{dataset_dict['name']}' ({dataset_dict['row_count']} rows, {dataset_dict['column_count']} cols) [{sync_mode.upper()}] to Lakehouse Database",
            details={"id": dataset_id, "flow_id": dataset_dict.get("flow_id"), "format": dataset_dict.get("storage_format", f"{db_type}_table"), "sync_mode": sync_mode}
        )

    @staticmethod
    def get_staged_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return None

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_staged_datasets WHERE id = :id"), {"id": dataset_id})
                row = res.fetchone()
                if row:
                    d = _format_row(dict(row._mapping))
                    d["columns"] = json.loads(d["columns_json"]) if isinstance(d.get("columns_json"), str) else (d.get("columns_json") or [])
                    d.pop("columns_json", None)
                    d["sync_mode"] = d.get("sync_mode") or "full"
                    d["watermark_column"] = d.get("watermark_column") or "aud_last_update"
                    return d
        except Exception:
            pass
        return None

    @staticmethod
    def list_staged_datasets(flow_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                if flow_id:
                    res = conn.execute(text("SELECT * FROM dataflow_staged_datasets WHERE flow_id = :fid ORDER BY created_at DESC"), {"fid": flow_id})
                else:
                    res = conn.execute(text("SELECT * FROM dataflow_staged_datasets ORDER BY created_at DESC"))
                rows = res.fetchall()
                results = []
                for r in rows:
                    d = _format_row(dict(r._mapping))
                    d["columns"] = json.loads(d["columns_json"]) if isinstance(d.get("columns_json"), str) else (d.get("columns_json") or [])
                    d.pop("columns_json", None)
                    d["sync_mode"] = d.get("sync_mode") or "full"
                    d["watermark_column"] = d.get("watermark_column") or "aud_last_update"
                    results.append(d)
                return results
        except Exception:
            return []

    @staticmethod
    def delete_staged_dataset(dataset_id: str) -> bool:
        db_type, engine = get_db_connection()
        if engine is None:
            return False

        try:
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM dataflow_staged_records WHERE dataset_id = :id"), {"id": dataset_id})
                conn.execute(text("DELETE FROM dataflow_staged_datasets WHERE id = :id"), {"id": dataset_id})
                conn.commit()

            CatalogDB.record_audit_log(
                event_type="DATASET_DELETED",
                entity_id=dataset_id,
                entity_type="STAGED_DATASET",
                summary=f"Deleted staged dataset {dataset_id}"
            )
            return True
        except Exception:
            return False

    # --- PIPELINE JOBS ---
    @staticmethod
    def save_job(job_dict: Dict[str, Any]):
        logs_json_str = json.dumps(job_dict.get("logs", []))

        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Database error: {db_type} metadata database is not connected.")

        with engine.connect() as conn:
            check = conn.execute(text("SELECT 1 FROM dataflow_pipeline_jobs WHERE id = :id"), {"id": job_dict["id"]}).fetchone()
            params = {
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
            }
            if check:
                conn.execute(text("""
                UPDATE dataflow_pipeline_jobs SET
                    status = :status, progress = :progress, message = :message, output_rows = :output_rows,
                    completed_at = CURRENT_TIMESTAMP, output_dataset_id = :output_dataset_id,
                    output_file_path = :output_file_path, logs_json = :logs_json, error = :error
                WHERE id = :id
                """), params)
            else:
                conn.execute(text("""
                INSERT INTO dataflow_pipeline_jobs 
                (id, flow_id, name, status, progress, message, input_rows, output_rows, created_at, completed_at, output_dataset_id, output_file_path, logs_json, error)
                VALUES 
                (:id, :flow_id, :name, :status, :progress, :message, :input_rows, :output_rows, CURRENT_TIMESTAMP, NULL, :output_dataset_id, :output_file_path, :logs_json, :error)
                """), params)
            conn.commit()

    @staticmethod
    def get_job(job_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return None

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_pipeline_jobs WHERE id = :id"), {"id": job_id})
                row = res.fetchone()
                if row:
                    d = _format_row(dict(row._mapping))
                    d["logs"] = json.loads(d["logs_json"]) if isinstance(d.get("logs_json"), str) else (d.get("logs_json") or [])
                    d.pop("logs_json", None)
                    return d
        except Exception:
            pass
        return None

    @staticmethod
    def list_jobs(limit: int = 50, flow_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                if flow_id:
                    res = conn.execute(text("SELECT * FROM dataflow_pipeline_jobs WHERE flow_id = :fid ORDER BY created_at DESC LIMIT :lim"), {"fid": flow_id, "lim": limit})
                else:
                    res = conn.execute(text("SELECT * FROM dataflow_pipeline_jobs ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                rows = res.fetchall()
                results = []
                for r in rows:
                    d = _format_row(dict(r._mapping))
                    d["logs"] = json.loads(d["logs_json"]) if isinstance(d.get("logs_json"), str) else (d.get("logs_json") or [])
                    d.pop("logs_json", None)
                    results.append(d)
                return results
        except Exception:
            return []

    # --- AUDIT LOGS ---
    @staticmethod
    def record_audit_log(event_type: str, entity_id: Optional[str] = None, entity_type: Optional[str] = None, summary: str = "", details: Optional[Dict[str, Any]] = None):
        log_id = f"aud_{uuid.uuid4().hex[:12]}"
        details_str = json.dumps(details) if details else None

        db_type, engine = get_db_connection()
        if engine is None:
            return

        try:
            with engine.connect() as conn:
                conn.execute(text("""
                INSERT INTO dataflow_audit_logs (id, event_type, entity_id, entity_type, summary, details_json, created_at)
                VALUES (:id, :event_type, :entity_id, :entity_type, :summary, :details_json, CURRENT_TIMESTAMP)
                """), {
                    "id": log_id,
                    "event_type": event_type,
                    "entity_id": entity_id,
                    "entity_type": entity_type,
                    "summary": summary,
                    "details_json": details_str
                })
                conn.commit()
        except Exception:
            pass

    @staticmethod
    def list_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_audit_logs ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                rows = res.fetchall()
                results = []
                for r in rows:
                    d = _format_row(dict(r._mapping))
                    d["details"] = json.loads(d["details_json"]) if isinstance(d.get("details_json"), str) else (d.get("details_json") or {})
                    d.pop("details_json", None)
                    results.append(d)
                return results
        except Exception:
            return []

    # --- INGESTION HISTORY ---
    @staticmethod
    def record_ingestion(source_name: str, source_type: str, host: Optional[str] = None, database_name: Optional[str] = None, table_query: Optional[str] = None, row_count: int = 0, column_count: int = 0, duration_ms: float = 0.0, status: str = "SUCCESS", error_message: Optional[str] = None):
        ing_id = f"ing_{uuid.uuid4().hex[:12]}"

        db_type, engine = get_db_connection()
        if engine is None:
            return

        try:
            with engine.connect() as conn:
                conn.execute(text("""
                INSERT INTO dataflow_ingestion_history
                (id, source_name, source_type, host, database_name, table_query, row_count, column_count, duration_ms, status, error_message, created_at)
                VALUES
                (:id, :source_name, :source_type, :host, :database_name, :table_query, :row_count, :column_count, :duration_ms, :status, :error_message, CURRENT_TIMESTAMP)
                """), {
                    "id": ing_id,
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
                conn.commit()
        except Exception:
            pass

    @staticmethod
    def list_ingestion_history(limit: int = 50) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_ingestion_history ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                rows = res.fetchall()
                return [_format_row(dict(r._mapping)) for r in rows]
        except Exception:
            return []

    # --- TRANSFORMATION HISTORY ---
    @staticmethod
    def record_transformation(staging_dataset_id: str, rule_count: int, rules: List[Dict[str, Any]], initial_rows: int, transformed_rows: int, execution_time_ms: float):
        tx_id = f"tx_{uuid.uuid4().hex[:12]}"
        rules_json_str = json.dumps(rules)

        db_type, engine = get_db_connection()
        if engine is None:
            return

        try:
            with engine.connect() as conn:
                conn.execute(text("""
                INSERT INTO dataflow_transformation_history
                (id, staging_dataset_id, rule_count, rules_json, initial_rows, transformed_rows, execution_time_ms, created_at)
                VALUES
                (:id, :staging_dataset_id, :rule_count, :rules_json, :initial_rows, :transformed_rows, :execution_time_ms, CURRENT_TIMESTAMP)
                """), {
                    "id": tx_id,
                    "staging_dataset_id": staging_dataset_id,
                    "rule_count": rule_count,
                    "rules_json": rules_json_str,
                    "initial_rows": initial_rows,
                    "transformed_rows": transformed_rows,
                    "execution_time_ms": execution_time_ms
                })
                conn.commit()
        except Exception:
            pass

    @staticmethod
    def list_transformation_history(limit: int = 50) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_transformation_history ORDER BY created_at DESC LIMIT :lim"), {"lim": limit})
                rows = res.fetchall()
                results = []
                for r in rows:
                    d = _format_row(dict(r._mapping))
                    d["rules"] = json.loads(d["rules_json"]) if isinstance(d.get("rules_json"), str) else (d.get("rules_json") or [])
                    d.pop("rules_json", None)
                    results.append(d)
                return results
        except Exception:
            return []

    # --- CRON SCHEDULES ---
    @staticmethod
    def save_schedule(schedule_data: Dict[str, Any]):
        dest_cfg = schedule_data.get("destination_config")
        dest_json = json.dumps(dest_cfg.dict() if hasattr(dest_cfg, "dict") else dest_cfg) if dest_cfg else None

        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Database error: {db_type} metadata database is not connected.")

        with engine.connect() as conn:
            check = conn.execute(text("SELECT 1 FROM dataflow_flow_schedules WHERE id = :id"), {"id": schedule_data["id"]}).fetchone()
            params = {
                "id": schedule_data["id"],
                "flow_id": schedule_data["flow_id"],
                "flow_name": schedule_data.get("flow_name", "Flow"),
                "name": schedule_data["name"],
                "description": schedule_data.get("description", ""),
                "cron_expression": schedule_data["cron_expression"],
                "cron_human": schedule_data.get("cron_human", ""),
                "enabled": 1 if schedule_data.get("enabled", True) else 0,
                "staging_dataset_id": schedule_data["staging_dataset_id"],
                "dest_json": dest_json,
                "next_run_at": schedule_data.get("next_run_at"),
                "run_count": schedule_data.get("run_count", 0)
            }
            if check:
                conn.execute(text("""
                UPDATE dataflow_flow_schedules SET
                    name = :name, description = :description, cron_expression = :cron_expression,
                    cron_human = :cron_human, enabled = :enabled, staging_dataset_id = :staging_dataset_id,
                    destination_config_json = :dest_json, updated_at = CURRENT_TIMESTAMP, next_run_at = :next_run_at
                WHERE id = :id
                """), params)
            else:
                conn.execute(text("""
                INSERT INTO dataflow_flow_schedules (
                    id, flow_id, flow_name, name, description, cron_expression, cron_human,
                    enabled, staging_dataset_id, destination_config_json, created_at, updated_at, next_run_at, run_count
                ) VALUES (
                    :id, :flow_id, :flow_name, :name, :description, :cron_expression, :cron_human,
                    :enabled, :staging_dataset_id, :dest_json, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, :next_run_at, :run_count
                )
                """), params)
            conn.commit()

    @staticmethod
    def get_schedule(schedule_id: str) -> Optional[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return None

        try:
            with engine.connect() as conn:
                res = conn.execute(text("SELECT * FROM dataflow_flow_schedules WHERE id = :id"), {"id": schedule_id})
                row = res.fetchone()
                if row:
                    d = _format_row(dict(row._mapping))
                    dest_json = d.get("destination_config_json")
                    d["destination_config"] = json.loads(dest_json) if dest_json else None
                    d["enabled"] = bool(d.get("enabled", 1))
                    return d
        except Exception:
            pass
        return None

    @staticmethod
    def get_schedules(flow_id: Optional[str] = None) -> List[Dict[str, Any]]:
        db_type, engine = get_db_connection()
        if engine is None:
            return []

        try:
            with engine.connect() as conn:
                if flow_id:
                    res = conn.execute(text("SELECT * FROM dataflow_flow_schedules WHERE flow_id = :fid ORDER BY created_at DESC"), {"fid": flow_id})
                else:
                    res = conn.execute(text("SELECT * FROM dataflow_flow_schedules ORDER BY created_at DESC"))
                rows = res.fetchall()
                results = []
                for r in rows:
                    d = _format_row(dict(r._mapping))
                    dest_json = d.get("destination_config_json")
                    d["destination_config"] = json.loads(dest_json) if dest_json else None
                    d["enabled"] = bool(d.get("enabled", 1))
                    results.append(d)
                return results
        except Exception:
            return []

    @staticmethod
    def update_schedule(schedule_id: str, updates: Dict[str, Any]):
        sched = CatalogDB.get_schedule(schedule_id)
        if not sched:
            raise FileNotFoundError(f"Schedule '{schedule_id}' not found.")
        
        sched.update(updates)
        CatalogDB.save_schedule(sched)

    @staticmethod
    def delete_schedule(schedule_id: str):
        db_type, engine = get_db_connection()
        if engine is None:
            return

        try:
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM dataflow_flow_schedules WHERE id = :id"), {"id": schedule_id})
                conn.commit()
        except Exception:
            pass

    @staticmethod
    def record_schedule_run(schedule_id: str, job_id: str, status: str, message: str = "", next_run_at: Optional[datetime] = None):
        db_type, engine = get_db_connection()
        if engine is None:
            return

        try:
            with engine.connect() as conn:
                conn.execute(text("""
                UPDATE dataflow_flow_schedules SET
                    last_run_at = CURRENT_TIMESTAMP,
                    last_run_status = :status,
                    last_run_job_id = :job_id,
                    last_run_message = :message,
                    next_run_at = :next_run_at,
                    run_count = run_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                """), {
                    "id": schedule_id,
                    "status": status,
                    "job_id": job_id,
                    "message": message,
                    "next_run_at": next_run_at
                })
                conn.commit()
        except Exception:
            pass

    # --- METADATA SUMMARY & PURGE ---
    @staticmethod
    def get_metadata_summary() -> Dict[str, Any]:
        db_type, engine = get_db_connection()
        if engine is None:
            return {
                "active_engine": db_type,
                "status": "disconnected",
                "flows_count": 0,
                "staged_datasets_count": 0,
                "pipeline_jobs_count": 0,
                "audit_logs_count": 0,
                "ingestion_history_count": 0,
                "transformation_history_count": 0,
                "total_staged_rows": 0,
                "total_staged_bytes": 0,
            }

        try:
            with engine.connect() as conn:
                fl_cnt = conn.execute(text("SELECT COUNT(*) FROM dataflow_flows")).scalar() or 0
                ds_res = conn.execute(text("SELECT COUNT(*), COALESCE(SUM(row_count), 0), COALESCE(SUM(file_size_bytes), 0) FROM dataflow_staged_datasets")).fetchone()
                ds_cnt = ds_res[0] if ds_res else 0
                tot_rows = int(ds_res[1]) if ds_res else 0
                tot_bytes = int(ds_res[2]) if ds_res else 0

                jobs_cnt = conn.execute(text("SELECT COUNT(*) FROM dataflow_pipeline_jobs")).scalar() or 0
                aud_cnt = conn.execute(text("SELECT COUNT(*) FROM dataflow_audit_logs")).scalar() or 0
                ing_cnt = conn.execute(text("SELECT COUNT(*) FROM dataflow_ingestion_history")).scalar() or 0
                tx_cnt = conn.execute(text("SELECT COUNT(*) FROM dataflow_transformation_history")).scalar() or 0

                return {
                    "active_engine": db_type,
                    "metadata_storage_engine": "MySQL Enterprise Database" if db_type == "mysql" else "PostgreSQL Relational Database",
                    "active_database": settings.MYSQL_DATABASE if db_type == "mysql" else settings.POSTGRES_DATABASE,
                    "active_host": f"{settings.MYSQL_HOST}:{settings.MYSQL_PORT}" if db_type == "mysql" else f"{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}",
                    "status": "connected",
                    "flows_count": fl_cnt,
                    "staged_datasets_count": ds_cnt,
                    "pipeline_jobs_count": jobs_cnt,
                    "audit_logs_count": aud_cnt,
                    "ingestion_history_count": ing_cnt,
                    "transformation_history_count": tx_cnt,
                    "total_staged_rows": tot_rows,
                    "total_staged_bytes": tot_bytes,
                }
        except Exception as e:
            return {
                "active_engine": db_type,
                "metadata_storage_engine": "MySQL Enterprise Database" if db_type == "mysql" else "PostgreSQL Relational Database",
                "active_database": settings.MYSQL_DATABASE if db_type == "mysql" else settings.POSTGRES_DATABASE,
                "active_host": f"{settings.MYSQL_HOST}:{settings.MYSQL_PORT}" if db_type == "mysql" else f"{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}",
                "status": f"error: {e}",
                "flows_count": 0,
                "staged_datasets_count": 0,
                "pipeline_jobs_count": 0,
                "audit_logs_count": 0,
                "ingestion_history_count": 0,
                "transformation_history_count": 0,
                "total_staged_rows": 0,
                "total_staged_bytes": 0,
            }

    @staticmethod
    def clear_all_metadata():
        db_type, engine = get_db_connection()
        if engine is None:
            return

        with engine.connect() as conn:
            conn.execute(text("DELETE FROM dataflow_staged_records"))
            conn.execute(text("DELETE FROM dataflow_staged_datasets"))
            conn.execute(text("DELETE FROM dataflow_pipeline_jobs"))
            conn.execute(text("DELETE FROM dataflow_audit_logs"))
            conn.execute(text("DELETE FROM dataflow_ingestion_history"))
            conn.execute(text("DELETE FROM dataflow_transformation_history"))
            conn.execute(text("DELETE FROM dataflow_flow_schedules"))
            conn.execute(text("DELETE FROM dataflow_flows"))
            conn.commit()

        CatalogDB.record_audit_log(
            event_type="METADATA_PURGED",
            summary="All application metadata, staged datasets, and history records cleared"
        )
