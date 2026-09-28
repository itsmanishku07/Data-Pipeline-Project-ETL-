import uuid
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from ..config import settings
from ..models.schemas import (
    StageDatasetRequest, 
    StagedDatasetInfo, 
    StagedDataPreview, 
    ColumnProfile,
    FileFormat
)
from ..models.db_models import CatalogDB
from ..connectors import get_connector
from ..engine.schema_engine import profile_dataframe, apply_type_casting
from .data_store import DataStoreEngine

class StagingService:
    @staticmethod
    def stage_dataset(request: StageDatasetRequest) -> StagedDatasetInfo:
        flow = CatalogDB.get_flow(request.flow_id) if request.flow_id else None
        last_wm = flow.get("last_watermark_value") if flow else None
        sync_mode = request.sync_mode or (flow.get("sync_mode") if flow else "full") or "full"
        watermark_col = request.watermark_column or (flow.get("watermark_column") if flow else "aud_last_update") or "aud_last_update"
        pk = request.primary_key or (flow.get("primary_key") if flow else None)

        # 1. Extract raw data with watermark filter if incremental
        connector = get_connector(request.source_request)
        if sync_mode in ("incremental_append", "incremental_merge") and last_wm:
            df_raw = connector.extract_data(watermark_col=watermark_col, last_watermark=last_wm)
        else:
            df_raw = connector.extract_data(watermark_col=watermark_col)
        
        # 2. Apply user-defined type casting rules if specified
        if request.cast_rules:
            df_staged, cast_logs = apply_type_casting(df_raw, request.cast_rules)
        else:
            df_staged = df_raw.copy()

        # 3. Generate unique dataset ID
        dataset_id = f"stg_{uuid.uuid4().hex[:10]}"
        
        # 4. Save directly into lakehouse database staging table with sync strategy
        storage_path, storage_format, file_size, total_row_count, new_watermark = DataStoreEngine.save_staged_dataframe(
            dataset_id=dataset_id,
            df=df_staged,
            flow_id=request.flow_id,
            sync_mode=sync_mode,
            primary_key=pk,
            watermark_col=watermark_col
        )

        # 5. Profile staged data schema
        column_profiles = profile_dataframe(df_staged)

        # 6. Save metadata to catalog DB
        created_dt = datetime.utcnow()
        if new_watermark is not None and (pd.isna(new_watermark) or str(new_watermark).strip().lower() in ("nat", "nan", "none", "<na>", "null", "")):
            new_watermark = None
        elif new_watermark is not None:
            new_watermark = str(new_watermark)
        dataset_info = {
            "id": dataset_id,
            "flow_id": request.flow_id,
            "name": request.dataset_name,
            "description": request.description or "",
            "source_type": request.source_request.source_type.value if hasattr(request.source_request.source_type, "value") else str(request.source_request.source_type),
            "source_summary": connector.get_source_summary(),
            "sync_mode": sync_mode,
            "watermark_column": watermark_col,
            "last_watermark_value": new_watermark,
            "last_synced_at": created_dt,
            "primary_key": pk,
            "row_count": total_row_count,
            "column_count": len(df_staged.columns),
            "storage_path": storage_path,
            "storage_format": storage_format,
            "created_at": created_dt,
            "columns": column_profiles,
            "file_size_bytes": file_size
        }
        CatalogDB.save_staged_dataset(dataset_info)

        # 7. Update flow watermark & source_request if linked
        if request.flow_id:
            flow_updates = {
                "sync_mode": sync_mode,
                "watermark_column": watermark_col,
                "primary_key": pk,
                "source_request": request.source_request.dict() if hasattr(request.source_request, "dict") else request.source_request
            }
            if new_watermark:
                flow_updates["last_watermark_value"] = new_watermark
                flow_updates["last_synced_at"] = created_dt
            CatalogDB.update_flow(request.flow_id, flow_updates)

        return StagedDatasetInfo(**dataset_info)

    @staticmethod
    def list_staged_datasets(flow_id: Optional[str] = None) -> List[StagedDatasetInfo]:
        records = CatalogDB.list_staged_datasets(flow_id=flow_id)
        return [
            StagedDatasetInfo(
                id=r["id"],
                flow_id=r.get("flow_id"),
                name=r["name"],
                description=r["description"],
                source_type=r["source_type"],
                source_summary=r["source_summary"],
                sync_mode=r.get("sync_mode", "full"),
                watermark_column=r.get("watermark_column", "aud_last_update"),
                last_watermark_value=r.get("last_watermark_value"),
                last_synced_at=datetime.fromisoformat(r["last_synced_at"]) if isinstance(r.get("last_synced_at"), str) else r.get("last_synced_at"),
                primary_key=r.get("primary_key"),
                row_count=r["row_count"],
                column_count=r["column_count"],
                storage_path=r["storage_path"],
                storage_format=r["storage_format"],
                created_at=datetime.fromisoformat(r["created_at"]) if isinstance(r["created_at"], str) else r["created_at"],
                columns=[ColumnProfile(**c) for c in r["columns"]],
                file_size_bytes=r["file_size_bytes"]
            )
            for r in records
        ]

    @staticmethod
    def get_staged_dataset(dataset_id: str) -> Optional[StagedDatasetInfo]:
        r = CatalogDB.get_staged_dataset(dataset_id)
        if not r:
            return None
        return StagedDatasetInfo(
            id=r["id"],
            flow_id=r.get("flow_id"),
            name=r["name"],
            description=r["description"],
            source_type=r["source_type"],
            source_summary=r["source_summary"],
            sync_mode=r.get("sync_mode", "full"),
            watermark_column=r.get("watermark_column", "aud_last_update"),
            last_watermark_value=r.get("last_watermark_value"),
            last_synced_at=datetime.fromisoformat(r["last_synced_at"]) if isinstance(r.get("last_synced_at"), str) else r.get("last_synced_at"),
            primary_key=r.get("primary_key"),
            row_count=r["row_count"],
            column_count=r["column_count"],
            storage_path=r["storage_path"],
            storage_format=r["storage_format"],
            created_at=datetime.fromisoformat(r["created_at"]) if isinstance(r["created_at"], str) else r["created_at"],
            columns=[ColumnProfile(**c) for c in r["columns"]],
            file_size_bytes=r["file_size_bytes"]
        )

    @staticmethod
    def get_dataset_preview(
        dataset_id: str, 
        page: int = 1, 
        page_size: int = 50, 
        search: Optional[str] = None
    ) -> StagedDataPreview:
        meta = CatalogDB.get_staged_dataset(dataset_id)
        if not meta:
            raise FileNotFoundError(f"Staged dataset {dataset_id} metadata not found.")

        rows, total_rows, columns = DataStoreEngine.get_staged_preview_slice(
            meta=meta,
            page=page,
            page_size=page_size,
            search=search
        )

        return StagedDataPreview(
            dataset_id=dataset_id,
            name=meta["name"],
            total_rows=total_rows,
            page=page,
            page_size=page_size,
            columns=columns,
            schema_profiles=[ColumnProfile(**c) for c in meta["columns"]],
            rows=rows
        )

    @staticmethod
    def delete_dataset(dataset_id: str) -> bool:
        DataStoreEngine.drop_staged_table(dataset_id)
        return CatalogDB.delete_staged_dataset(dataset_id)
