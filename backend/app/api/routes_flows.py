import uuid
import time
import hashlib
import json
import math
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
from fastapi import APIRouter, HTTPException
from ..models.schemas import DataFlow, CreateFlowRequest, UpdateFlowRequest, FlowSummary, SourceConnectionRequest, SourceType, DestinationTypeEnum
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

def _json_safe_value(value):
    if value is None or pd.isna(value):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    return str(value)


def _stable_row_hash(row: Dict[str, Any], excluded_keys: List[str]) -> str:
    payload = {key: _json_safe_value(value) for key, value in row.items() if key not in excluded_keys and key != "aud_last_update"}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _compare_snapshots(previous_rows, current_rows, primary_keys):
    if primary_keys:
        def key_for(row):
            values = [_json_safe_value(row.get(column)) for column in primary_keys]
            if any(value is None for value in values):
                raise ValueError(f"Primary key column(s) {primary_keys} contain null values; change detection requires non-null keys.")
            return json.dumps(values, sort_keys=True, separators=(",", ":"))

        previous_by_key = {key_for(row): row for row in previous_rows}
        current_by_key = {key_for(row): row for row in current_rows}
        if len(previous_by_key) != len(previous_rows) or len(current_by_key) != len(current_rows):
            raise ValueError("Primary key values must be unique for reliable change detection.")

        added_keys = current_by_key.keys() - previous_by_key.keys()
        deleted_keys = previous_by_key.keys() - current_by_key.keys()
        common_keys = current_by_key.keys() & previous_by_key.keys()
        changed, unchanged = [], 0
        excluded = set(primary_keys)
        for key in common_keys:
            old_row, new_row = previous_by_key[key], current_by_key[key]
            if _stable_row_hash(old_row, excluded) != _stable_row_hash(new_row, excluded):
                changed_columns = [column for column in (set(old_row) | set(new_row)) - excluded
                                   if _json_safe_value(old_row.get(column)) != _json_safe_value(new_row.get(column))]
                changed.append({"key": json.loads(key), "changed_columns": sorted(changed_columns), "before": old_row, "after": new_row})
            else:
                unchanged += 1
        return {
            "added_rows": len(added_keys), "changed_rows": len(changed), "deleted_rows": len(deleted_keys),
            "unchanged_rows": unchanged, "added_sample": [current_by_key[k] for k in list(added_keys)[:20]],
            "changed_sample": changed[:20], "deleted_sample": [previous_by_key[k] for k in list(deleted_keys)[:20]],
            "primary_keys": primary_keys, "comparison_mode": "primary_key",
        }

    previous_counts, current_counts = {}, {}
    for row in previous_rows:
        fingerprint = _stable_row_hash(row, [])
        previous_counts[fingerprint] = previous_counts.get(fingerprint, 0) + 1
    for row in current_rows:
        fingerprint = _stable_row_hash(row, [])
        current_counts[fingerprint] = current_counts.get(fingerprint, 0) + 1
    added = sum(max(0, count - previous_counts.get(key, 0)) for key, count in current_counts.items())
    deleted = sum(max(0, count - current_counts.get(key, 0)) for key, count in previous_counts.items())
    return {
        "added_rows": added, "changed_rows": 0, "deleted_rows": deleted,
        "unchanged_rows": sum(min(count, current_counts.get(key, 0)) for key, count in previous_counts.items()),
        "added_sample": [], "changed_sample": [], "deleted_sample": [], "primary_keys": [],
        "comparison_mode": "whole_row",
    }


@router.post("/{flow_id}/detect-changes")
def detect_flow_changes(flow_id: str):
    """Read the attached source snapshot and compare it to the last committed baseline."""
    flow = CatalogDB.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found.")
    source_config = flow.get("source_request")
    if not source_config:
        raise HTTPException(status_code=400, detail="No source connection is attached to this flow.")
    try:
        source_request = SourceConnectionRequest(**source_config)
        if source_request.source_type == SourceType.DATABASE and not source_request.database_config:
            raise HTTPException(status_code=400, detail="Database source details are missing from this flow connection.")
        previous = CatalogDB.get_flow_snapshot(flow_id)
        connector = get_connector(source_request)
        current_df = connector.extract_data()
        if current_df.empty:
            raise HTTPException(status_code=422, detail="Source returned no rows; refusing to treat this as a deletion of all baseline data.")
        if len(current_df) >= 100_000:
            raise HTTPException(status_code=413, detail="Snapshot change detection is limited to fewer than 100,000 source rows for safe metadata storage.")

        rows = [{key: _json_safe_value(value) for key, value in row.items()} for row in current_df.to_dict(orient="records")]
        keys = [flow["primary_key"]] if flow.get("primary_key") else []
        missing_key_columns = [key for key in keys if key not in current_df.columns]
        if missing_key_columns:
            raise HTTPException(status_code=422, detail=f"Configured primary key column(s) not found in source: {', '.join(missing_key_columns)}")
        if previous:
            CatalogDB.clear_pending_flow_snapshot(flow_id)
        try:
            _compare_snapshots([], rows, keys)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if not previous:
            result = {
                "added_rows": len(rows), "changed_rows": 0, "deleted_rows": 0, "unchanged_rows": 0,
                "added_sample": rows[:20], "changed_sample": [], "deleted_sample": [], "primary_keys": keys,
                "comparison_mode": "primary_key" if keys else "whole_row", "baseline_exists": False,
            }
        else:
            try:
                result = _compare_snapshots(previous["rows"], rows, keys)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            result["baseline_exists"] = True

        CatalogDB.save_pending_flow_snapshot(flow_id, list(current_df.columns), rows)
        result.update({"flow_id": flow_id, "source_rows": len(rows), "columns": list(current_df.columns), "detected_at": datetime.utcnow().isoformat(), "source_summary": connector.get_source_summary()})
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Change detection failed: {exc}") from exc


@router.post("/{flow_id}/run-detected-snapshot")
def run_detected_snapshot(flow_id: str):
    """Run saved flow rules against the latest detected source snapshot and commit its baseline only on success."""
    pending = CatalogDB.get_flow_snapshot(flow_id)
    if not pending or pending.get("pending_rows") is None:
        raise HTTPException(status_code=409, detail="No detected source snapshot is ready. Detect changes first.")
    flow = CatalogDB.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found.")
    
    if not flow.get("source_request"):
        raise HTTPException(status_code=400, detail="No source connection is attached to this flow.")
    source_request = SourceConnectionRequest(**flow["source_request"])
    keys = [flow["primary_key"]] if flow.get("primary_key") else []
    previous = CatalogDB.get_flow_snapshot(flow_id)
    if previous:
        try:
            change_summary = _compare_snapshots(previous.get("rows", []), pending["pending_rows"], keys)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if not any(change_summary.get(name, 0) for name in ("added_rows", "changed_rows", "deleted_rows")):
            raise HTTPException(status_code=409, detail="No source changes detected. The destination was not modified.")
    else:
        try:
            _compare_snapshots([], pending["pending_rows"], keys)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    df = pd.DataFrame(pending["pending_rows"], columns=pending["pending_columns"] or None)
    dataset_id = f"stg_detect_{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow()
    storage_path, storage_format, file_size, row_count, watermark = DataStoreEngine.save_staged_dataframe(
        dataset_id=dataset_id, df=df, flow_id=flow_id, sync_mode="full"
    )
    dataset_info = {
        "id": dataset_id, "flow_id": flow_id, "name": f"{flow['name']} Detected Snapshot",
        "description": "Latest source snapshot loaded by change detection.",
        "source_type": source_request.source_type.value if hasattr(source_request.source_type, "value") else str(source_request.source_type),
        "source_summary": source_request.name, "sync_mode": "full", "watermark_column": "aud_last_update",
        "last_watermark_value": watermark, "last_synced_at": now, "primary_key": flow.get("primary_key"),
        "row_count": row_count, "column_count": len(df.columns), "storage_path": storage_path,
        "storage_format": storage_format, "created_at": now, "columns": profile_dataframe(df), "file_size_bytes": file_size,
    }
    CatalogDB.save_staged_dataset(dataset_info)

    from ..models.schemas import PipelineExecutionRequest, TransformationRule, ExportDestinationRequest
    from ..services.job_service import JobService
    destination = ExportDestinationRequest(**flow["destination_config"]) if flow.get("destination_config") else None
    rules = [TransformationRule(**rule) for rule in CatalogDB.get_flow_rules(flow_id)]
    job = JobService.execute_pipeline(PipelineExecutionRequest(
        name=f"Detected Changes: {flow['name']}", staging_dataset_id=dataset_id, rules=rules,
        output_dataset_name=f"curated_{flow_id}", output_description="Output generated from detected source snapshot.",
        flow_id=flow_id, stage_output=True, destination_config=destination, promote_snapshot_flow_id=flow_id,
        source_snapshot=pending["pending_rows"], source_snapshot_columns=pending["pending_columns"],
    ))
    if job.status.value != "completed":
        raise HTTPException(status_code=500, detail=f"Pipeline failed; saved snapshot remains unchanged. Job {job.id}: {job.message}")
    CatalogDB.record_audit_log(event_type="FLOW_SNAPSHOT_PIPELINE_COMPLETED", entity_id=flow_id, entity_type="DATA_FLOW", summary=f"Detected snapshot transformed and loaded ({row_count} rows)")
    return {"success": True, "flow_id": flow_id, "job": job.dict(), "staging_dataset_id": dataset_id, "source_rows": row_count}


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
