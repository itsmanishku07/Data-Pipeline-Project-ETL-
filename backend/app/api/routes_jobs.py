from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from ..models.schemas import JobStatus
from ..services.job_service import JobService
from ..config import settings

router = APIRouter(prefix="/jobs", tags=["Jobs & Lineage"])

@router.get("", response_model=List[JobStatus])
def list_jobs(flow_id: Optional[str] = Query(None)):
    return JobService.list_jobs(flow_id=flow_id)

@router.get("/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    job = JobService.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return job

@router.get("/download/{filename}")
def download_export_file(filename: str):
    import tempfile
    from pathlib import Path
    file_path = Path(tempfile.gettempdir()) / "dataflow_outputs" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {filename} not found.")
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream"
    )
