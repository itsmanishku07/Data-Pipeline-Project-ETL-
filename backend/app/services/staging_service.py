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
        # 1. Extract raw data
        connector = get_connector(request.source_request)
        df_raw = connector.extract_data()
        
        # 2. Apply user-defined type casting rules if specified
        if request.cast_rules:
            df_staged, cast_logs = apply_type_casting(df_raw, request.cast_rules)
        else:
            df_staged = df_raw.copy()

        # 3. Generate unique dataset ID
        dataset_id = f"stg_{uuid.uuid4().hex[:10]}"
        
        # 4. Save directly into MySQL database staging table (zero parquet disk files)
        storage_path, storage_format, file_size = DataStoreEngine.save_staged_dataframe(dataset_id, df_staged)

        # 5. Profile staged data schema
        column_profiles = profile_dataframe(df_staged)

        # 6. Save metadata to catalog DB
        created_dt = datetime.utcnow()
        dataset_info = {
            "id": dataset_id,
            "flow_id": request.flow_id,
            "name": request.dataset_name,
            "description": request.description or "",
            "source_type": request.source_request.source_type.value if hasattr(request.source_request.source_type, "value") else str(request.source_request.source_type),
            "source_summary": connector.get_source_summary(),
            "row_count": len(df_staged),
            "column_count": len(df_staged.columns),
            "storage_path": storage_path,
            "storage_format": storage_format,
            "created_at": created_dt,
            "columns": column_profiles,
            "file_size_bytes": file_size
        }
        CatalogDB.save_staged_dataset(dataset_info)

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
