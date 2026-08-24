from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..models.db_models import CatalogDB, init_db, get_db_connection
from ..config import settings

router = APIRouter(prefix="/history", tags=["Metadata & Audit History"])

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
    """Returns the current MySQL metadata store connection configuration."""
    db_type, _ = get_db_connection()
    return {
        "status": "connected" if db_type == "mysql" else "fallback_sqlite",
        "engine": "MySQL" if db_type == "mysql" else "SQLite Catalog",
        "host": settings.MYSQL_HOST,
        "port": settings.MYSQL_PORT,
        "user": settings.MYSQL_USER,
        "database": settings.MYSQL_DATABASE,
        "has_password": bool(settings.MYSQL_PASSWORD),
    }

@router.post("/credentials")
def update_metadata_credentials(creds: MySQLCredentialsRequest):
    """Updates the MySQL metadata store connection parameters live."""
    settings.MYSQL_HOST = creds.host
    settings.MYSQL_PORT = creds.port
    settings.MYSQL_USER = creds.user
    settings.MYSQL_PASSWORD = creds.password or ""
    settings.MYSQL_DATABASE = creds.database

    init_db()
    db_type, _ = get_db_connection()

    return {
        "success": db_type == "mysql",
        "engine": "MySQL Active" if db_type == "mysql" else "SQLite Catalog (Local Fallback)",
        "message": "Connected to MySQL metadata database successfully!" if db_type == "mysql" else "Could not connect to MySQL with provided credentials. Using SQLite catalog fallback."
    }
