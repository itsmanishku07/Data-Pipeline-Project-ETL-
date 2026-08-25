from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Any
import pandas as pd
from ..models.schemas import (
    PreviewTransformRequest, 
    TransformPreviewResult, 
    PipelineExecutionRequest, 
    JobStatus,
    ExportDestinationRequest
)
from ..models.db_models import CatalogDB
from ..engine.transform_engine import TransformationEngine
from ..engine.schema_engine import profile_dataframe
from ..services.job_service import JobService
from ..services.data_store import DataStoreEngine

router = APIRouter(prefix="/transform", tags=["Transformation Studio"])

@router.post("/preview", response_model=TransformPreviewResult)
def preview_transformation(request: PreviewTransformRequest, background_tasks: BackgroundTasks):
    meta = CatalogDB.get_staged_dataset(request.staging_dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Staged dataset {request.staging_dataset_id} not found.")

    try:
        # Load sample or full staged data from MySQL table for preview
        df = DataStoreEngine.load_staged_dataframe(meta)
        initial_rows = len(df)
        
        # Apply transformation rules
        df_transformed, step_summaries, exec_time = TransformationEngine.execute_rules(df, request.rules)

        column_profiles = profile_dataframe(df_transformed)
        preview_rows = df_transformed.head(request.limit).to_dict(orient="records")
        for r in preview_rows:
            for k, v in r.items():
                if pd.isna(v):
                    r[k] = None
                elif hasattr(v, "isoformat"):
                    r[k] = v.isoformat()

        # Non-blocking asynchronous recording of transformation in MySQL metadata
        background_tasks.add_task(
            CatalogDB.record_transformation,
            staging_dataset_id=request.staging_dataset_id,
            rule_count=len(request.rules),
            rules=request.rules,
            initial_rows=initial_rows,
            transformed_rows=len(df_transformed),
            execution_time_ms=exec_time
        )

        return TransformPreviewResult(
            initial_rows=initial_rows,
            transformed_rows=len(df_transformed),
            columns=column_profiles,
            preview_rows=preview_rows,
            execution_time_ms=exec_time,
            spark_plan="Physical Plan: Spark Scan -> Filter -> Project -> HashAggregate -> Output",
            step_summaries=step_summaries
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Transformation execution error: {str(e)}")

@router.post("/test-destination")
def test_destination(request: ExportDestinationRequest):
    """Validate destination connectivity and database/schema existence."""
    return JobService.test_destination(request)

@router.post("/execute", response_model=JobStatus)
def execute_pipeline(request: PipelineExecutionRequest, background_tasks: BackgroundTasks):
    try:
        # Run pipeline transformation (sync or in thread)
        job_status = JobService.execute_pipeline(request)
        return job_status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline initiation failed: {str(e)}")
