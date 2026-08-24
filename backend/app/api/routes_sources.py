import time
import shutil
import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict, Any, Optional
from ..models.schemas import SourceConnectionRequest, SchemaInspectionResult
from ..connectors import get_connector
from ..engine.schema_engine import profile_dataframe
from ..config import settings
from ..models.db_models import CatalogDB

router = APIRouter(prefix="/sources", tags=["Data Sources"])

@router.get("/connections")
def list_saved_connections(source_type: Optional[str] = None):
    """List all saved data source connection credentials."""
    return CatalogDB.list_saved_connections(source_type=source_type)

@router.post("/connections")
def save_connection(conn_dict: Dict[str, Any]):
    """Save or update a data source connection."""
    try:
        return CatalogDB.save_connection(conn_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save connection: {str(e)}")

@router.delete("/connections/{conn_id}")
def delete_saved_connection(conn_id: str):
    """Delete a saved data source connection."""
    success = CatalogDB.delete_saved_connection(conn_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Connection {conn_id} not found.")
    return {"success": True, "message": "Connection deleted successfully."}

@router.post("/test")
def test_connection(request: SourceConnectionRequest):
    try:
        connector = get_connector(request)
        success, message = connector.test_connection()
        CatalogDB.record_audit_log(
            event_type="CONNECTION_TEST",
            summary=f"Connection test for {request.name} ({request.source_type.value}): {'SUCCESS' if success else 'FAILED'}",
            details={"source_name": request.name, "success": success, "message": message}
        )
        return {"success": success, "message": message}
    except Exception as e:
        CatalogDB.record_audit_log(
            event_type="CONNECTION_TEST_ERROR",
            summary=f"Connection test failed for {request.name}: {str(e)}"
        )
        return {"success": False, "message": f"Connection test failed: {str(e)}"}

@router.post("/db/tables")
def list_database_tables(request: SourceConnectionRequest):
    try:
        if request.source_type != "database":
            return {"tables": []}
        from ..connectors.database_connector import DatabaseConnector
        conn = DatabaseConnector(request.database_config)
        tables = conn.get_tables()
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch database tables: {str(e)}")

@router.post("/inspect", response_model=SchemaInspectionResult)
def inspect_source(request: SourceConnectionRequest, limit: int = 100):
    start_t = time.time()
    try:
        connector = get_connector(request)
        df = connector.extract_data(limit=limit)
        duration_ms = (time.time() - start_t) * 1000.0
        
        columns = profile_dataframe(df)
        
        # Clean preview rows
        preview_rows = df.head(50).to_dict(orient="records")
        for r in preview_rows:
            for k, v in r.items():
                if pd.isna(v):
                    r[k] = None
                elif hasattr(v, "isoformat"):
                    r[k] = v.isoformat()

        # Record Ingestion History in MySQL Metadata store
        db_cfg = request.database_config
        CatalogDB.record_ingestion(
            source_name=request.name,
            source_type=request.source_type.value,
            host=db_cfg.host if db_cfg else None,
            database_name=db_cfg.database if db_cfg else None,
            table_query=db_cfg.query or db_cfg.table_name if db_cfg else None,
            row_count=len(df),
            column_count=len(df.columns),
            duration_ms=duration_ms,
            status="SUCCESS"
        )

        return SchemaInspectionResult(
            source_name=request.name,
            source_type=request.source_type,
            row_count=len(df),
            column_count=len(df.columns),
            columns=columns,
            preview_rows=preview_rows
        )
    except Exception as e:
        duration_ms = (time.time() - start_t) * 1000.0
        CatalogDB.record_ingestion(
            source_name=request.name,
            source_type=request.source_type.value if hasattr(request.source_type, "value") else str(request.source_type),
            status="FAILED",
            duration_ms=duration_ms,
            error_message=str(e)
        )
        raise HTTPException(status_code=400, detail=f"Source inspection failed: {str(e)}")

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        import tempfile
        from pathlib import Path
        temp_dir = Path(tempfile.gettempdir()) / "dataflow_uploads"
        temp_dir.mkdir(parents=True, exist_ok=True)
        dest_path = temp_dir / file.filename
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        CatalogDB.record_audit_log(
            event_type="FILE_UPLOADED",
            entity_id=file.filename,
            entity_type="FILE",
            summary=f"Uploaded raw dataset file: {file.filename} ({dest_path.stat().st_size} bytes)"
        )
        return {
            "success": True, 
            "filename": file.filename, 
            "file_path": str(dest_path),
            "size_bytes": dest_path.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
