from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from ..models.schemas import (
    StageDatasetRequest, 
    StagedDatasetInfo, 
    StagedDataPreview
)
from ..services.staging_service import StagingService

router = APIRouter(prefix="/staging", tags=["Staging Area"])

@router.post("/stage", response_model=StagedDatasetInfo)
def stage_dataset(request: StageDatasetRequest):
    try:
        dataset_info = StagingService.stage_dataset(request)
        return dataset_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to stage dataset: {str(e)}")

@router.get("/datasets", response_model=List[StagedDatasetInfo])
def list_staged_datasets(flow_id: Optional[str] = Query(None)):
    try:
        return StagingService.list_staged_datasets(flow_id=flow_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list staged datasets: {str(e)}")

@router.get("/datasets/{dataset_id}", response_model=StagedDatasetInfo)
def get_staged_dataset(dataset_id: str):
    info = StagingService.get_staged_dataset(dataset_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"Staged dataset {dataset_id} not found.")
    return info

@router.get("/datasets/{dataset_id}/preview", response_model=StagedDataPreview)
def get_dataset_preview(
    dataset_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = None
):
    try:
        return StagingService.get_dataset_preview(dataset_id, page=page, page_size=page_size, search=search)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview staged dataset: {str(e)}")

@router.delete("/datasets/{dataset_id}")
def delete_staged_dataset(dataset_id: str):
    success = StagingService.delete_dataset(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Staged dataset {dataset_id} not found.")
    return {"success": True, "message": f"Dataset {dataset_id} deleted successfully."}
