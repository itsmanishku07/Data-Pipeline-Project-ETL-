import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks

from ..models.db_models import CatalogDB
from ..models.schemas import (
    FlowSchedule,
    CreateScheduleRequest,
    UpdateScheduleRequest,
    ExportDestinationRequest
)
from ..services.scheduler_service import SchedulerService, describe_cron, calculate_next_runs

router = APIRouter(prefix="/schedules", tags=["Cron Schedules"])

@router.get("", response_model=List[FlowSchedule])
def list_schedules(flow_id: Optional[str] = Query(None, description="Filter schedules by Flow ID")):
    """Lists all configured flow cron schedules with calculated next run times."""
    schedules = CatalogDB.get_schedules(flow_id)
    flows = {f["id"]: f["name"] for f in CatalogDB.list_flows()}
    staged_map = {ds["id"]: ds["name"] for ds in CatalogDB.list_staged_datasets()}

    result = []
    for s in schedules:
        cron_expr = s.get("cron_expression", "")
        human_desc = s.get("cron_human") or describe_cron(cron_expr)
        
        # Calculate dynamic next run if not stored or in the past
        next_run = s.get("next_run_at")
        if s.get("enabled", True):
            upcoming = calculate_next_runs(cron_expr, count=1)
            if upcoming:
                next_run = upcoming[0]

        sched_obj = {
            "id": s["id"],
            "flow_id": s["flow_id"],
            "flow_name": flows.get(s["flow_id"], s.get("flow_name", "Flow")),
            "name": s["name"],
            "description": s.get("description", ""),
            "cron_expression": cron_expr,
            "cron_human": human_desc,
            "enabled": bool(s.get("enabled", True)),
            "staging_dataset_id": s["staging_dataset_id"],
            "staging_dataset_name": staged_map.get(s["staging_dataset_id"], s["staging_dataset_id"]),
            "destination_config": s.get("destination_config"),
            "created_at": s.get("created_at") or datetime.utcnow(),
            "updated_at": s.get("updated_at"),
            "last_run_at": s.get("last_run_at"),
            "last_run_status": s.get("last_run_status"),
            "last_run_job_id": s.get("last_run_job_id"),
            "last_run_message": s.get("last_run_message"),
            "next_run_at": next_run,
            "run_count": s.get("run_count", 0)
        }
        result.append(sched_obj)
    return result

@router.get("/preview-cron")
def preview_cron(cron: str = Query(..., description="Cron expression to analyze")):
    """Parses a cron expression, returns human description and next 5 run dates."""
    human = describe_cron(cron)
    next_runs = calculate_next_runs(cron, count=5)
    return {
        "cron_expression": cron,
        "human_description": human,
        "valid": len(next_runs) > 0,
        "next_5_runs": next_runs
    }

@router.get("/{schedule_id}", response_model=FlowSchedule)
def get_schedule(schedule_id: str):
    """Retrieves detailed configuration for a specific schedule."""
    s = CatalogDB.get_schedule(schedule_id)
    if not s:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found.")
    
    flows = {f["id"]: f["name"] for f in CatalogDB.list_flows()}
    staged_map = {ds["id"]: ds["name"] for ds in CatalogDB.list_staged_datasets()}
    
    cron_expr = s.get("cron_expression", "")
    upcoming = calculate_next_runs(cron_expr, count=1)
    
    return {
        "id": s["id"],
        "flow_id": s["flow_id"],
        "flow_name": flows.get(s["flow_id"], s.get("flow_name", "Flow")),
        "name": s["name"],
        "description": s.get("description", ""),
        "cron_expression": cron_expr,
        "cron_human": s.get("cron_human") or describe_cron(cron_expr),
        "enabled": bool(s.get("enabled", True)),
        "staging_dataset_id": s["staging_dataset_id"],
        "staging_dataset_name": staged_map.get(s["staging_dataset_id"], s["staging_dataset_id"]),
        "destination_config": s.get("destination_config"),
        "created_at": s.get("created_at") or datetime.utcnow(),
        "updated_at": s.get("updated_at"),
        "last_run_at": s.get("last_run_at"),
        "last_run_status": s.get("last_run_status"),
        "last_run_job_id": s.get("last_run_job_id"),
        "last_run_message": s.get("last_run_message"),
        "next_run_at": upcoming[0] if upcoming and s.get("enabled", True) else s.get("next_run_at"),
        "run_count": s.get("run_count", 0)
    }

@router.post("", response_model=FlowSchedule)
def create_schedule(req: CreateScheduleRequest):
    """Creates and activates a new automated flow schedule."""
    # 1. Validate Flow existence
    flow = CatalogDB.get_flow(req.flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow '{req.flow_id}' not found.")

    # 2. Validate Cron Expression
    upcoming = calculate_next_runs(req.cron_expression, count=1)
    if not upcoming:
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: '{req.cron_expression}'. Standard format is 5 fields (e.g. '0 2 * * *' or '*/15 * * * *').")

    schedule_id = f"sched_{uuid.uuid4().hex[:8]}"
    human_desc = req.cron_human or describe_cron(req.cron_expression)
    now = datetime.utcnow()

    schedule_data = {
        "id": schedule_id,
        "flow_id": req.flow_id,
        "flow_name": flow["name"],
        "name": req.name.strip(),
        "description": req.description or "",
        "cron_expression": req.cron_expression.strip(),
        "cron_human": human_desc,
        "enabled": req.enabled,
        "staging_dataset_id": req.staging_dataset_id,
        "destination_config": req.destination_config,
        "created_at": now,
        "updated_at": now,
        "next_run_at": upcoming[0] if req.enabled else None,
        "run_count": 0
    }

    CatalogDB.save_schedule(schedule_data)

    # Register in live APScheduler daemon
    if req.enabled:
        SchedulerService.sync_job(schedule_data)

    CatalogDB.record_audit_log(
        event_type="SCHEDULE_CREATED",
        entity_id=schedule_id,
        entity_type="FLOW_SCHEDULE",
        summary=f"Created automated cron schedule '{req.name}' for flow '{flow['name']}' ({human_desc})"
    )

    staged_ds = CatalogDB.get_staged_dataset(req.staging_dataset_id)
    schedule_data["staging_dataset_name"] = staged_ds["name"] if staged_ds else req.staging_dataset_id
    return schedule_data

@router.put("/{schedule_id}", response_model=FlowSchedule)
def update_schedule(schedule_id: str, req: UpdateScheduleRequest):
    """Updates an existing schedule configuration."""
    existing = CatalogDB.get_schedule(schedule_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found.")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name.strip()
    if req.description is not None:
        updates["description"] = req.description
    if req.cron_expression is not None:
        upcoming = calculate_next_runs(req.cron_expression, count=1)
        if not upcoming:
            raise HTTPException(status_code=400, detail=f"Invalid cron expression: '{req.cron_expression}'.")
        updates["cron_expression"] = req.cron_expression.strip()
        updates["cron_human"] = req.cron_human or describe_cron(req.cron_expression)
        updates["next_run_at"] = upcoming[0]
    if req.staging_dataset_id is not None:
        updates["staging_dataset_id"] = req.staging_dataset_id
    if req.destination_config is not None:
        updates["destination_config"] = req.destination_config
    if req.enabled is not None:
        updates["enabled"] = req.enabled

    CatalogDB.update_schedule(schedule_id, updates)
    updated = CatalogDB.get_schedule(schedule_id)

    # Synchronize with live APScheduler daemon
    SchedulerService.sync_job(updated)

    flows = {f["id"]: f["name"] for f in CatalogDB.list_flows()}
    staged_map = {ds["id"]: ds["name"] for ds in CatalogDB.list_staged_datasets()}
    updated["flow_name"] = flows.get(updated["flow_id"], updated.get("flow_name", "Flow"))
    updated["staging_dataset_name"] = staged_map.get(updated["staging_dataset_id"], updated["staging_dataset_id"])
    return updated

@router.post("/{schedule_id}/toggle")
def toggle_schedule(schedule_id: str):
    """Toggles active/paused status for a schedule."""
    existing = CatalogDB.get_schedule(schedule_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found.")

    new_enabled = not existing.get("enabled", True)
    updates = {"enabled": new_enabled}
    
    if new_enabled:
        upcoming = calculate_next_runs(existing["cron_expression"], count=1)
        updates["next_run_at"] = upcoming[0] if upcoming else None

    CatalogDB.update_schedule(schedule_id, updates)
    updated = CatalogDB.get_schedule(schedule_id)
    SchedulerService.sync_job(updated)

    status_str = "ACTIVE" if new_enabled else "PAUSED"
    CatalogDB.record_audit_log(
        event_type="SCHEDULE_STATUS_CHANGED",
        entity_id=schedule_id,
        entity_type="FLOW_SCHEDULE",
        summary=f"Schedule '{existing['name']}' status changed to {status_str}"
    )

    return {
        "success": True,
        "schedule_id": schedule_id,
        "enabled": new_enabled,
        "status": status_str,
        "next_run_at": updated.get("next_run_at")
    }

@router.post("/{schedule_id}/run-now")
def run_schedule_now(schedule_id: str, background_tasks: BackgroundTasks):
    """Manually triggers an immediate asynchronous run for a scheduled flow."""
    existing = CatalogDB.get_schedule(schedule_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found.")

    # Execute in background task to return immediate response to user UI
    background_tasks.add_task(SchedulerService.run_scheduled_job, schedule_id)

    return {
        "success": True,
        "message": f"Triggered immediate execution for schedule '{existing['name']}'. Check job history for results.",
        "schedule_id": schedule_id,
        "flow_id": existing["flow_id"]
    }

@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: str):
    """Deletes a schedule from the database and stops background triggers."""
    existing = CatalogDB.get_schedule(schedule_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' not found.")

    SchedulerService.remove_job(schedule_id)
    CatalogDB.delete_schedule(schedule_id)

    CatalogDB.record_audit_log(
        event_type="SCHEDULE_DELETED",
        entity_id=schedule_id,
        entity_type="FLOW_SCHEDULE",
        summary=f"Deleted automated schedule '{existing['name']}'"
    )

    return {
        "success": True,
        "message": f"Schedule '{existing['name']}' deleted successfully.",
        "schedule_id": schedule_id
    }

