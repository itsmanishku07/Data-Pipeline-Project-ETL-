from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..models.db_models import CatalogDB, init_db, get_db_connection, reset_db_connection
from ..config import settings, BASE_DIR
from sqlalchemy import create_engine, text
import urllib.parse
from pathlib import Path

router = APIRouter(prefix="/history", tags=["Metadata & Audit History"])

class TestConnectionRequest(BaseModel):
    engine: str = "mysql"  # 'mysql' or 'postgres'
    host: str = "localhost"
    port: int = 3306
    user: str = "root"
    password: Optional[str] = ""
    database: str = "dataflow_metadata"
    schema_name: Optional[str] = "public"

class MySQLCredentialsRequest(BaseModel):
    host: str = "localhost"
    port: int = 3306
    user: str = "root"
    password: Optional[str] = ""
    database: str = "dataflow_metadata"

class PostgresCredentialsRequest(BaseModel):
    host: str = "localhost"
    port: int = 5432
    user: str = "postgres"
    password: Optional[str] = ""
    database: str = "dataflow_metadata"
    schema_name: str = "public"

class StorageConfigRequest(BaseModel):
    active_engine: str = "mysql"  # 'mysql' or 'postgres'
    # Generic fields
    host: Optional[str] = None
    port: Optional[int] = None
    user: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    schema_name: Optional[str] = "public"
    # Specific MySQL fields
    mysql_host: Optional[str] = None
    mysql_port: Optional[int] = None
    mysql_user: Optional[str] = None
    mysql_password: Optional[str] = None
    mysql_database: Optional[str] = None
    # Specific PostgreSQL fields
    postgres_host: Optional[str] = None
    postgres_port: Optional[int] = None
    postgres_user: Optional[str] = None
    postgres_password: Optional[str] = None
    postgres_database: Optional[str] = None
    postgres_schema: Optional[str] = None

def _save_env_file():
    """Persists current database credentials to backend/.env file."""
    try:
        env_path = BASE_DIR / ".env"
        lines = [
            f"METADATA_ENGINE={settings.METADATA_ENGINE}",
            f"MYSQL_HOST={settings.MYSQL_HOST}",
            f"MYSQL_PORT={settings.MYSQL_PORT}",
            f"MYSQL_USER={settings.MYSQL_USER}",
            f"MYSQL_PASSWORD={settings.MYSQL_PASSWORD}",
            f"MYSQL_DATABASE={settings.MYSQL_DATABASE}",
            f"POSTGRES_HOST={settings.POSTGRES_HOST}",
            f"POSTGRES_PORT={settings.POSTGRES_PORT}",
            f"POSTGRES_USER={settings.POSTGRES_USER}",
            f"POSTGRES_PASSWORD={settings.POSTGRES_PASSWORD}",
            f"POSTGRES_DATABASE={settings.POSTGRES_DATABASE}",
            f"POSTGRES_SCHEMA={settings.POSTGRES_SCHEMA}",
        ]
        with open(env_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    except Exception as e:
        print(f"[WARN] Failed to write .env file: {e}")

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
    """Returns current active metadata engine and connection settings for MySQL & PostgreSQL."""
    db_type, engine = get_db_connection()
    is_connected = engine is not None

    pg_configured = bool(settings.POSTGRES_HOST and settings.POSTGRES_USER and settings.POSTGRES_DATABASE)
    mysql_configured = bool(settings.MYSQL_HOST and settings.MYSQL_USER and settings.MYSQL_DATABASE)

    summary_data = CatalogDB.get_metadata_summary() if is_connected else None

    return {
        "status": "connected" if is_connected else "disconnected",
        "active_engine": settings.METADATA_ENGINE,
        "engine_label": "MySQL Enterprise Database" if settings.METADATA_ENGINE == "mysql" else "PostgreSQL Relational Database",
        "summary": summary_data,
        "mysql": {
            "host": settings.MYSQL_HOST,
            "port": settings.MYSQL_PORT,
            "user": settings.MYSQL_USER,
            "database": settings.MYSQL_DATABASE,
            "has_password": bool(settings.MYSQL_PASSWORD),
            "configured": mysql_configured,
            "is_active": settings.METADATA_ENGINE == "mysql"
        },
        "postgres": {
            "host": settings.POSTGRES_HOST,
            "port": settings.POSTGRES_PORT,
            "user": settings.POSTGRES_USER,
            "database": settings.POSTGRES_DATABASE,
            "schema": settings.POSTGRES_SCHEMA,
            "has_password": bool(settings.POSTGRES_PASSWORD),
            "configured": pg_configured,
            "is_active": settings.METADATA_ENGINE == "postgres"
        },
        # Flattened fields for backwards compatibility
        "host": settings.MYSQL_HOST if settings.METADATA_ENGINE == "mysql" else settings.POSTGRES_HOST,
        "port": settings.MYSQL_PORT if settings.METADATA_ENGINE == "mysql" else settings.POSTGRES_PORT,
        "user": settings.MYSQL_USER if settings.METADATA_ENGINE == "mysql" else settings.POSTGRES_USER,
        "database": settings.MYSQL_DATABASE if settings.METADATA_ENGINE == "mysql" else settings.POSTGRES_DATABASE,
        "schema": settings.POSTGRES_SCHEMA if settings.METADATA_ENGINE == "postgres" else "public",
        "has_password": bool(settings.MYSQL_PASSWORD if settings.METADATA_ENGINE == "mysql" else settings.POSTGRES_PASSWORD)
    }

@router.post("/test-connection")
def test_database_connection(req: TestConnectionRequest):
    """Tests connectivity to MySQL or PostgreSQL before saving."""
    engine_type = req.engine.lower()
    
    if engine_type == "postgres":
        try:
            user = urllib.parse.quote_plus(req.user)
            pwd = f":{urllib.parse.quote_plus(req.password)}" if req.password else ""
            
            # 1. Connect to server
            conn_url = f"postgresql+psycopg2://{user}{pwd}@{req.host}:{req.port}/postgres"
            engine = create_engine(conn_url, connect_args={"connect_timeout": 4}, pool_pre_ping=True)
            with engine.connect() as conn:
                res = conn.execute(text("SELECT version()"))
                raw_ver = res.scalar() or "PostgreSQL"
                ver = raw_ver.split(",")[0] if "," in raw_ver else raw_ver[:35]

                # Check if target database exists
                res_db = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :db"), {"db": req.database})
                db_exists = res_db.fetchone() is not None
            engine.dispose()

            return {
                "success": True,
                "engine": "postgres",
                "version": ver,
                "database_exists": db_exists,
                "message": f"Successfully connected to PostgreSQL ({ver}) on {req.host}:{req.port}. Database '{req.database}' {'exists' if db_exists else 'will be created upon activation'}."
            }
        except Exception as e:
            # Attempt direct target database connection if connecting to 'postgres' admin db was denied
            try:
                user = urllib.parse.quote_plus(req.user)
                pwd = f":{urllib.parse.quote_plus(req.password)}" if req.password else ""
                conn_url = f"postgresql+psycopg2://{user}{pwd}@{req.host}:{req.port}/{req.database}"
                engine = create_engine(conn_url, connect_args={"connect_timeout": 4}, pool_pre_ping=True)
                with engine.connect() as conn:
                    res = conn.execute(text("SELECT version()"))
                    raw_ver = res.scalar() or "PostgreSQL"
                    ver = raw_ver.split(",")[0] if "," in raw_ver else raw_ver[:35]
                engine.dispose()
                return {
                    "success": True,
                    "engine": "postgres",
                    "version": ver,
                    "database_exists": True,
                    "message": f"Successfully connected to PostgreSQL ({ver}) on {req.host}:{req.port}/{req.database}."
                }
            except Exception as e2:
                return {
                    "success": False,
                    "engine": "postgres",
                    "message": f"PostgreSQL Connection Failed: {str(e2)}"
                }

    # Default: MySQL
    try:
        user = urllib.parse.quote_plus(req.user)
        pwd = f":{urllib.parse.quote_plus(req.password)}" if req.password else ""
        conn_url = f"mysql+pymysql://{user}{pwd}@{req.host}:{req.port}/"
        engine = create_engine(conn_url, connect_args={"connect_timeout": 4}, pool_pre_ping=True)
        with engine.connect() as conn:
            res = conn.execute(text("SELECT VERSION()"))
            ver = res.scalar() or "Unknown"
            
            # Check database exists
            res_db = conn.execute(text("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = :db"), {"db": req.database})
            db_exists = res_db.fetchone() is not None
        
        engine.dispose()
        return {
            "success": True,
            "engine": "mysql",
            "version": ver,
            "database_exists": db_exists,
            "message": f"Successfully connected to MySQL Server v{ver} on {req.host}:{req.port}. Database '{req.database}' {'exists' if db_exists else 'will be created upon saving'}."
        }
    except Exception as e:
        return {
            "success": False,
            "engine": "mysql",
            "message": f"MySQL Connection Failed: {str(e)}"
        }

@router.post("/test-mysql")
def test_mysql_connection(creds: MySQLCredentialsRequest):
    """Backwards-compatible endpoint for testing MySQL."""
    return test_database_connection(TestConnectionRequest(
        engine="mysql",
        host=creds.host,
        port=creds.port,
        user=creds.user,
        password=creds.password,
        database=creds.database
    ))

@router.post("/test-postgres")
def test_postgres_connection(creds: PostgresCredentialsRequest):
    """Endpoint for testing PostgreSQL connection."""
    return test_database_connection(TestConnectionRequest(
        engine="postgres",
        host=creds.host,
        port=creds.port,
        user=creds.user,
        password=creds.password,
        database=creds.database,
        schema_name=creds.schema_name
    ))

@router.post("/credentials")
def update_metadata_credentials(cfg: StorageConfigRequest):
    """Updates the active storage engine (MySQL or PostgreSQL). Verifies target connection before activating."""
    target_engine = cfg.active_engine.lower()
    if target_engine not in ("mysql", "postgres"):
        target_engine = "mysql"

    previous_engine = settings.METADATA_ENGINE

    # Update MySQL settings if provided
    if cfg.mysql_host is not None: settings.MYSQL_HOST = cfg.mysql_host
    elif target_engine == "mysql" and cfg.host is not None: settings.MYSQL_HOST = cfg.host

    if cfg.mysql_port is not None: settings.MYSQL_PORT = cfg.mysql_port
    elif target_engine == "mysql" and cfg.port is not None: settings.MYSQL_PORT = cfg.port

    if cfg.mysql_user is not None: settings.MYSQL_USER = cfg.mysql_user
    elif target_engine == "mysql" and cfg.user is not None: settings.MYSQL_USER = cfg.user

    if cfg.mysql_password is not None: settings.MYSQL_PASSWORD = cfg.mysql_password
    elif target_engine == "mysql" and cfg.password is not None: settings.MYSQL_PASSWORD = cfg.password

    if cfg.mysql_database is not None: settings.MYSQL_DATABASE = cfg.mysql_database
    elif target_engine == "mysql" and cfg.database is not None: settings.MYSQL_DATABASE = cfg.database

    # Update PostgreSQL settings if provided
    if cfg.postgres_host is not None: settings.POSTGRES_HOST = cfg.postgres_host
    elif target_engine == "postgres" and cfg.host is not None: settings.POSTGRES_HOST = cfg.host

    if cfg.postgres_port is not None: settings.POSTGRES_PORT = cfg.postgres_port
    elif target_engine == "postgres" and cfg.port is not None: settings.POSTGRES_PORT = cfg.port

    if cfg.postgres_user is not None: settings.POSTGRES_USER = cfg.postgres_user
    elif target_engine == "postgres" and cfg.user is not None: settings.POSTGRES_USER = cfg.user

    if cfg.postgres_password is not None: settings.POSTGRES_PASSWORD = cfg.postgres_password
    elif target_engine == "postgres" and cfg.password is not None: settings.POSTGRES_PASSWORD = cfg.password

    if cfg.postgres_database is not None: settings.POSTGRES_DATABASE = cfg.postgres_database
    elif target_engine == "postgres" and cfg.database is not None: settings.POSTGRES_DATABASE = cfg.database

    if cfg.postgres_schema is not None: settings.POSTGRES_SCHEMA = cfg.postgres_schema
    elif target_engine == "postgres" and cfg.schema_name is not None: settings.POSTGRES_SCHEMA = cfg.schema_name

    # 1. Pre-flight verification: Check if target credentials exist & connection succeeds
    if target_engine == "postgres":
        if not settings.POSTGRES_HOST or not settings.POSTGRES_USER or not settings.POSTGRES_DATABASE:
            return {
                "success": False,
                "active_engine": previous_engine,
                "engine_label": "PostgreSQL Relational Database",
                "status": "disconnected",
                "message": "PostgreSQL credentials are not configured in backend/.env. Please configure POSTGRES_HOST, POSTGRES_USER, and POSTGRES_DATABASE. DataFlow Studio remains safely on MySQL."
            }
        try:
            user = urllib.parse.quote_plus(settings.POSTGRES_USER)
            pwd = f":{urllib.parse.quote_plus(settings.POSTGRES_PASSWORD)}" if settings.POSTGRES_PASSWORD else ""
            test_url = f"postgresql+psycopg2://{user}{pwd}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DATABASE}"
            test_eng = create_engine(test_url, connect_args={"connect_timeout": 3}, pool_pre_ping=True)
            with test_eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            test_eng.dispose()
        except Exception as e:
            return {
                "success": False,
                "active_engine": previous_engine,
                "engine_label": "PostgreSQL Relational Database",
                "status": "disconnected",
                "message": f"Cannot connect to PostgreSQL ({str(e)}). Studio remains safely on {previous_engine.upper()}."
            }
    elif target_engine == "mysql":
        if not settings.MYSQL_HOST or not settings.MYSQL_USER or not settings.MYSQL_DATABASE:
            return {
                "success": False,
                "active_engine": previous_engine,
                "engine_label": "MySQL Enterprise Database",
                "status": "disconnected",
                "message": "MySQL credentials are not configured in backend/.env. Studio remains on previous database."
            }
        try:
            user = urllib.parse.quote_plus(settings.MYSQL_USER)
            pwd = f":{urllib.parse.quote_plus(settings.MYSQL_PASSWORD)}" if settings.MYSQL_PASSWORD else ""
            test_url = f"mysql+pymysql://{user}{pwd}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}"
            test_eng = create_engine(test_url, connect_args={"connect_timeout": 3}, pool_pre_ping=True)
            with test_eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            test_eng.dispose()
        except Exception as e:
            return {
                "success": False,
                "active_engine": previous_engine,
                "engine_label": "MySQL Enterprise Database",
                "status": "disconnected",
                "message": f"Cannot connect to MySQL ({str(e)}). Studio remains safely on {previous_engine.upper()}."
            }

    # 2. Pre-flight passed: Commit switch to target engine
    settings.METADATA_ENGINE = target_engine
    _save_env_file()

    # Re-initialize database engine
    reset_db_connection()
    init_db()
    db_type, engine = get_db_connection()

    is_connected = (engine is not None and db_type == target_engine)
    engine_label = "MySQL Enterprise Database" if target_engine == "mysql" else "PostgreSQL Relational Database"
    host = settings.MYSQL_HOST if target_engine == "mysql" else settings.POSTGRES_HOST
    port = settings.MYSQL_PORT if target_engine == "mysql" else settings.POSTGRES_PORT
    database = settings.MYSQL_DATABASE if target_engine == "mysql" else settings.POSTGRES_DATABASE

    summary = CatalogDB.get_metadata_summary() if is_connected else None

    return {
        "success": is_connected,
        "active_engine": target_engine,
        "engine_label": engine_label,
        "status": "connected" if is_connected else "disconnected",
        "summary": summary,
        "message": f"Successfully activated {engine_label} `{database}` on {host}:{port}. All metadata loaded from {target_engine.upper()}!" if is_connected else f"Could not connect to {engine_label}. Studio reverted to {previous_engine}."
    }
