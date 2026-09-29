from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..models.db_models import CatalogDB, init_db, get_db_connection, _GLOBAL_MYSQL_ENGINE
from ..config import settings
from sqlalchemy import create_engine, text
import urllib.parse

router = APIRouter(prefix="/history", tags=["Metadata & Audit History"])

class StorageConfigRequest(BaseModel):
    active_engine: str = "mysql"  # 'mysql' or 'sqlite'
    host: Optional[str] = "localhost"
    port: Optional[int] = 3306
    user: Optional[str] = "root"
    password: Optional[str] = ""
    database: Optional[str] = "dataflow_metadata"

class MySQLCredentialsRequest(BaseModel):
    host: str = "localhost"
    port: int = 3306
    user: str = "root"
    password: Optional[str] = ""
    database: str = "dataflow_metadata"

@router.get("/summary")
def get_metadata_summary():
    """Returns high-level statistics across all stored application metadata."""
    return CatalogDB.get_metadata_summary()

@router.get("/audit-logs")
def get_audit_logs(limit: int = Query(100, ge=1, le=500)):
    """Returns chronologically ordered audit trail events."""
    return CatalogDB.list_audit_logs(limit=limit)

@router.get("/ingestions")
def get_ingestion_history(limit: int = Query(50, ge=1, le=500)):
    """Returns source ingestion and extraction execution logs."""
    return CatalogDB.list_ingestion_history(limit=limit)

@router.get("/transformations")
def get_transformation_history(limit: int = Query(50, ge=1, le=500)):
    """Returns Apache Spark transformation rule execution logs."""
    return CatalogDB.list_transformation_history(limit=limit)

@router.post("/clear")
def clear_all_history():
    """Wipes all historical staged datasets, jobs, flows, and audit logs."""
    CatalogDB.clear_all_metadata()
    return {"success": True, "message": "All metadata, staged datasets, and history records cleared successfully."}

@router.get("/credentials")
def get_metadata_credentials():
    """Returns the current metadata store connection configuration and active engine."""
    db_type, _ = get_db_connection()
    return {
        "status": "connected" if db_type == "mysql" else "fallback_sqlite" if settings.USE_MYSQL_METADATA else "sqlite_active",
        "active_engine": "mysql" if db_type == "mysql" else "sqlite",
        "use_mysql": settings.USE_MYSQL_METADATA,
        "engine_label": "MySQL Enterprise Database" if db_type == "mysql" else "SQLite Embedded Database",
        "host": settings.MYSQL_HOST,
        "port": settings.MYSQL_PORT,
        "user": settings.MYSQL_USER,
        "database": settings.MYSQL_DATABASE,
        "has_password": bool(settings.MYSQL_PASSWORD),
        "sqlite_path": str(settings.CATALOG_DB_PATH)
    }

@router.post("/test-mysql")
def test_mysql_connection(creds: MySQLCredentialsRequest):
    """Tests connectivity to MySQL with provided parameters before saving."""
    try:
        user = urllib.parse.quote_plus(creds.user)
        pwd = f":{urllib.parse.quote_plus(creds.password)}" if creds.password else ""
        conn_url = f"mysql+pymysql://{user}{pwd}@{creds.host}:{creds.port}/"
        engine = create_engine(conn_url, connect_args={"connect_timeout": 4}, pool_pre_ping=True)
        with engine.connect() as conn:
            res = conn.execute(text("SELECT VERSION()"))
            ver = res.scalar() or "Unknown"
            
            # Check database exists
            res_db = conn.execute(text("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = :db"), {"db": creds.database})
            db_exists = res_db.fetchone() is not None
        
        engine.dispose()
        return {
            "success": True,
            "version": ver,
            "database_exists": db_exists,
            "message": f"Successfully connected to MySQL Server v{ver} on {creds.host}:{creds.port}. Database '{creds.database}' {'exists' if db_exists else 'will be created upon saving'}."
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"MySQL Connection Failed: {str(e)}"
        }

@router.post("/credentials")
def update_metadata_credentials(cfg: StorageConfigRequest):
    """Updates the active storage engine (MySQL or SQLite) and connection parameters live."""
    from ..models import db_models as db_mod

    if cfg.active_engine == "sqlite":
        settings.USE_MYSQL_METADATA = False
        db_mod._GLOBAL_MYSQL_ENGINE = None
        init_db()
        return {
            "success": True,
            "active_engine": "sqlite",
            "engine_label": "SQLite Embedded Database",
            "message": f"Switched metadata storage to SQLite catalog ({settings.CATALOG_DB_PATH.name})."
        }

    # Otherwise configure and activate MySQL
    settings.USE_MYSQL_METADATA = True
    settings.MYSQL_HOST = cfg.host or "localhost"
    settings.MYSQL_PORT = cfg.port or 3306
    settings.MYSQL_USER = cfg.user or "root"
    settings.MYSQL_PASSWORD = cfg.password or ""
    settings.MYSQL_DATABASE = cfg.database or "dataflow_metadata"

    db_mod._GLOBAL_MYSQL_ENGINE = None
    init_db()
    db_type, _ = get_db_connection()

    return {
        "success": db_type == "mysql",
        "active_engine": db_type,
        "engine_label": "MySQL Enterprise Database" if db_type == "mysql" else "SQLite Embedded Database (Fallback)",
        "message": f"Connected to MySQL metadata database `{settings.MYSQL_DATABASE}` on {settings.MYSQL_HOST}:{settings.MYSQL_PORT}!" if db_type == "mysql" else "Could not connect to MySQL with provided credentials. Using SQLite catalog fallback."
    }
