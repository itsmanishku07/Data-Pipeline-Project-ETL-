import uuid
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
from fastapi import APIRouter, HTTPException
from ..models.schemas import DataFlow, CreateFlowRequest, UpdateFlowRequest, FlowSummary, SourceConnectionRequest
from ..models.db_models import CatalogDB
from ..connectors import get_connector
from ..engine.schema_engine import profile_dataframe
from ..services.data_store import DataStoreEngine

router = APIRouter(prefix="/flows", tags=["Data Flows"])

@router.get("", response_model=List[Dict[str, Any]])
def list_flows():
    """List all created data flows with metadata and dataset counts."""
    return CatalogDB.list_flows()

@router.post("", response_model=Dict[str, Any])
def create_flow(request: CreateFlowRequest):
    """Create a new isolated data flow."""
    try:
        flow_dict = request.dict()
        return CatalogDB.create_flow(flow_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create data flow: {str(e)}")

@router.get("/{flow_id}", response_model=Dict[str, Any])
def get_flow(flow_id: str):
    """Get details of a specific flow including attached datasets."""
    flow = CatalogDB.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found.")
    
    # Attach staged datasets linked to this flow
    flow["staged_datasets"] = CatalogDB.list_staged_datasets(flow_id=flow_id)
    flow["pipeline_jobs"] = CatalogDB.list_jobs(limit=10, flow_id=flow_id)
    return flow

@router.put("/{flow_id}", response_model=Dict[str, Any])
def update_flow(flow_id: str, request: UpdateFlowRequest):
    """Update data flow settings (name, description, sync strategy, watermark column, primary key, etc.)."""
    flow = CatalogDB.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found.")
    updates = {k: v for k, v in request.dict().items() if v is not None}
    updated = CatalogDB.update_flow(flow_id, updates)
    return updated

@router.post("/{flow_id}/sync")
def sync_flow(flow_id: str, force_full: bool = False):
    """
    Triggers a live data synchronization for the flow.
    - If sync_mode is incremental (append or merge), extracts records where watermark_column > last_watermark_value.
    - Stamps aud_last_update ISO-8601 UTC timestamp on all extracted rows.
    - Merges / appends / refreshes stage storage accordingly.
    - Advances the high-watermark to the latest timestamp.
    """
    flow = CatalogDB.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found.")

    source_req_dict = flow.get("source_request")
    staged_datasets = CatalogDB.list_staged_datasets(flow_id=flow_id)

    if not source_req_dict and not staged_datasets:
        raise HTTPException(
            status_code=400,
            detail="No source dataset or connection configuration is attached to this flow. Ingest or stage a dataset first."
        )

    sync_mode = "full" if force_full else (flow.get("sync_mode") or "full")
    watermark_col = flow.get("watermark_column") or "aud_last_update"
    last_watermark = None if force_full else flow.get("last_watermark_value")
    primary_key = flow.get("primary_key")

    # If source_req_dict is present, extract directly via connector
    if source_req_dict:
        t0 = time.time()
        source_req = SourceConnectionRequest(**source_req_dict)
        connector = get_connector(source_req)

        if sync_mode in ("incremental_append", "incremental_merge") and last_watermark:
            df_raw = connector.extract_data(watermark_col=watermark_col, last_watermark=last_watermark)
        else:
            df_raw = connector.extract_data(watermark_col=watermark_col)

        duration_ms = round((time.time() - t0) * 1000, 2)
        extracted_count = len(df_raw)

        # Find or create target staging dataset ID
        if staged_datasets:
            target_dataset = staged_datasets[0]
            dataset_id = target_dataset.id if hasattr(target_dataset, "id") else target_dataset["id"]
            dataset_name = target_dataset.name if hasattr(target_dataset, "name") else target_dataset["name"]
        else:
            dataset_id = f"stg_{uuid.uuid4().hex[:10]}"
            dataset_name = f"{flow['name']} Staged"

        # Save to lakehouse data store with chosen sync strategy
        storage_path, storage_format, file_size, total_rows, new_watermark = DataStoreEngine.save_staged_dataframe(
            dataset_id=dataset_id,
            df=df_raw,
            flow_id=flow_id,
            sync_mode=sync_mode,
            primary_key=primary_key,
            watermark_col=watermark_col
        )

        # Profile schema
        column_profiles = profile_dataframe(df_raw)
        now = datetime.utcnow()

        wm_to_save = new_watermark or last_watermark
        if wm_to_save is not None and (pd.isna(wm_to_save) or str(wm_to_save).strip().lower() in ("nat", "nan", "none", "<na>", "null", "")):
            wm_to_save = None
        elif wm_to_save is not None:
            wm_to_save = str(wm_to_save)

        dataset_info = {
            "id": dataset_id,
            "flow_id": flow_id,
            "name": dataset_name,
            "description": f"Synced via {sync_mode.upper()} flow runner",
            "source_type": source_req.source_type.value if hasattr(source_req.source_type, "value") else str(source_req.source_type),
            "source_summary": connector.get_source_summary(),
            "sync_mode": sync_mode,
            "watermark_column": watermark_col,
            "last_watermark_value": wm_to_save,
            "last_synced_at": now,
            "primary_key": primary_key,
            "row_count": total_rows,
            "column_count": len(df_raw.columns) if not df_raw.empty else (len(column_profiles) if column_profiles else 0),
            "storage_path": storage_path,
            "storage_format": storage_format,
            "created_at": now,
            "columns": column_profiles,
            "file_size_bytes": file_size
        }
        CatalogDB.save_staged_dataset(dataset_info)

        if wm_to_save:
            CatalogDB.update_flow_watermark(flow_id, wm_to_save, now)

        CatalogDB.record_audit_log(
            event_type="FLOW_SYNC_EXECUTED",
            entity_id=flow_id,
            entity_type="DATA_FLOW",
            summary=f"Flow '{flow['name']}' synced ({sync_mode.upper()}): {extracted_count} extracted, {total_rows} staged, new watermark '{new_watermark or last_watermark}'",
            details={
                "flow_id": flow_id,
                "sync_mode": sync_mode,
                "extracted_rows": extracted_count,
                "total_staged_rows": total_rows,
                "watermark_column": watermark_col,
                "new_watermark": new_watermark,
                "duration_ms": duration_ms
            }
        )

        return {
            "success": True,
            "flow_id": flow_id,
            "sync_mode": sync_mode,
            "extracted_rows": extracted_count,
            "total_staged_rows": total_rows,
            "watermark_column": watermark_col,
            "previous_watermark": last_watermark,
            "new_watermark": new_watermark or last_watermark,
            "duration_ms": duration_ms,
            "synced_at": now.isoformat(),
            "message": f"Successfully performed {sync_mode.upper()} sync. Processed {extracted_count} records."
        }
    else:
        # If only staged dataset exists without source connection request
        now = datetime.utcnow()
        ds = staged_datasets[0]
        ds_dict = ds if isinstance(ds, dict) else ds.dict()
        if new_watermark := ds_dict.get("last_watermark_value"):
            CatalogDB.update_flow_watermark(flow_id, new_watermark, now)
        return {
            "success": True,
            "flow_id": flow_id,
            "sync_mode": sync_mode,
            "extracted_rows": ds_dict.get("row_count", 0),
            "total_staged_rows": ds_dict.get("row_count", 0),
            "watermark_column": watermark_col,
            "new_watermark": ds_dict.get("last_watermark_value"),
            "synced_at": now.isoformat(),
            "message": f"Staged dataset {ds_dict.get('name')} refreshed."
        }

@router.post("/{flow_id}/reset-watermark")
def reset_flow_watermark(flow_id: str, watermark_value: Optional[str] = None):
    """Resets the watermark timestamp for a flow, allowing full backfill or replay from a specific timestamp."""
    flow = CatalogDB.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found.")
    updated = CatalogDB.reset_flow_watermark(flow_id, watermark_value)
    return {
        "success": True,
        "flow_id": flow_id,
        "last_watermark_value": updated.get("last_watermark_value"),
        "message": f"Watermark reset to {watermark_value or 'None (initial)'}"
    }

@router.get("/{flow_id}/rules")
def get_flow_rules(flow_id: str):
    """Get the saved transformation rules for a specific flow."""
    flow = CatalogDB.get_flow(flow_id)
    if not flow:
        flow = CatalogDB.create_flow({
            "id": flow_id,
            "name": f"Flow {flow_id}",
            "category": "General",
            "rules": []
        })
    return {"flow_id": flow_id, "rules": flow.get("rules", [])}

@router.put("/{flow_id}/rules")
def save_flow_rules(flow_id: str, payload: Dict[str, Any]):
    """Save or update transformation rules for a specific flow."""
    rules = payload.get("rules", [])
    updated_flow = CatalogDB.save_flow_rules(flow_id, rules)
    return {"success": True, "message": f"Saved {len(rules)} rules to flow {flow_id}", "flow": updated_flow}

@router.delete("/{flow_id}")
def delete_flow(flow_id: str):
    """Delete a data flow."""
    success = CatalogDB.delete_flow(flow_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found.")
    return {"success": True, "message": f"Data flow {flow_id} deleted successfully."}
