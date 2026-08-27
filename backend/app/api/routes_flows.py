from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from ..models.schemas import DataFlow, CreateFlowRequest, FlowSummary
from ..models.db_models import CatalogDB

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
