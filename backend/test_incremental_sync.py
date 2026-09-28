import os
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
import pytest
import pandas as pd

from app.config import settings
from app.models.schemas import (
    SourceType,
    DatabaseType,
    DatabaseSourceConfig,
    SourceConnectionRequest,
    StageDatasetRequest,
    CreateFlowRequest,
    UpdateFlowRequest,
    SyncMode
)
from app.models.db_models import CatalogDB, init_db
from app.services.staging_service import StagingService
from app.api.routes_flows import sync_flow, reset_flow_watermark, update_flow

class TestIncrementalSyncAndWatermarking:
    @pytest.fixture(autouse=True)
    def setup_test_env(self, tmp_path):
        # Point catalog DB to temp file
        test_catalog = tmp_path / "test_catalog.db"
        settings.CATALOG_DB_PATH = test_catalog
        settings.USE_MYSQL_METADATA = False
        init_db()

        # Create source database with orders table
        self.source_db_path = tmp_path / "source_erp.db"
        conn = sqlite3.connect(self.source_db_path)
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE erp_orders (
            order_id TEXT PRIMARY KEY,
            customer_name TEXT,
            amount REAL,
            status TEXT,
            updated_at TEXT
        )
        """)
        # Insert initial 3 records
        cursor.executemany("""
        INSERT INTO erp_orders (order_id, customer_name, amount, status, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """, [
            ("ORD_001", "Alice Corp", 120.50, "CONFIRMED", "2026-01-01T10:00:00.000Z"),
            ("ORD_002", "Bob Ltd", 450.00, "PENDING", "2026-01-01T11:00:00.000Z"),
            ("ORD_003", "Charlie Inc", 89.90, "SHIPPED", "2026-01-01T12:00:00.000Z"),
        ])
        conn.commit()
        conn.close()

    def test_full_then_incremental_append_and_merge(self):
        # 1. Create Data Flow with Incremental Merge strategy
        flow = CatalogDB.create_flow({
            "name": "ERP Ingestion Flow",
            "category": "Finance",
            "description": "Incremental order ingestion",
            "sync_mode": "incremental_merge",
            "watermark_column": "updated_at",
            "primary_key": "order_id"
        })
        flow_id = flow["id"]
        assert flow["sync_mode"] == "incremental_merge"
        assert flow["watermark_column"] == "updated_at"
        assert flow["primary_key"] == "order_id"
        assert flow["last_watermark_value"] is None

        # 2. Stage Initial Dataset (Full extraction)
        req = StageDatasetRequest(
            source_request=SourceConnectionRequest(
                source_type=SourceType.DATABASE,
                name="erp_orders_src",
                database_config=DatabaseSourceConfig(
                    db_type=DatabaseType.SQLITE,
                    sqlite_path=str(self.source_db_path),
                    table_name="erp_orders"
                )
            ),
            dataset_name="staged_erp_orders",
            flow_id=flow_id,
            sync_mode="incremental_merge",
            watermark_column="updated_at",
            primary_key="order_id"
        )
        staged_ds = StagingService.stage_dataset(req)
        assert staged_ds.row_count == 3
        # Ensure aud_last_update is present in column profiles
        col_names = [c.name for c in staged_ds.columns]
        assert "aud_last_update" in col_names

        # Verify flow watermark advanced to max updated_at ("2026-01-01T12:00:00.000Z")
        flow_after_initial = CatalogDB.get_flow(flow_id)
        assert flow_after_initial["last_watermark_value"] == "2026-01-01T12:00:00.000Z"
        assert flow_after_initial["total_rows"] == 3

        # 3. Simulate Source Database Updates: 1 updated order (ORD_002) and 1 new order (ORD_004)
        conn = sqlite3.connect(self.source_db_path)
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE erp_orders 
        SET amount = 500.00, status = 'COMPLETED', updated_at = '2026-01-02T14:00:00.000Z'
        WHERE order_id = 'ORD_002'
        """)
        cursor.execute("""
        INSERT INTO erp_orders (order_id, customer_name, amount, status, updated_at)
        VALUES ('ORD_004', 'Diana LLC', 999.00, 'CONFIRMED', '2026-01-02T15:30:00.000Z')
        """)
        conn.commit()
        conn.close()

        # 4. Trigger Incremental Flow Sync via sync_flow API
        sync_result = sync_flow(flow_id)
        assert sync_result["success"] is True
        assert sync_result["extracted_rows"] == 2  # Only ORD_002 and ORD_004 extracted!
        assert sync_result["total_staged_rows"] == 4  # 3 original + 1 new (ORD_002 was merged/upserted)
        assert sync_result["new_watermark"] == "2026-01-02T15:30:00.000Z"

        # Verify Flow Watermark Updated
        flow_after_sync = CatalogDB.get_flow(flow_id)
        assert flow_after_sync["last_watermark_value"] == "2026-01-02T15:30:00.000Z"
        assert flow_after_sync["total_rows"] == 4

        # 5. Check dataset preview to verify ORD_002 was updated and ORD_004 was added
        preview = StagingService.get_dataset_preview(staged_ds.id)
        rows_by_id = {r["order_id"]: r for r in preview.rows}
        assert rows_by_id["ORD_002"]["amount"] == 500.00
        assert rows_by_id["ORD_002"]["status"] == "COMPLETED"
        assert "ORD_004" in rows_by_id
        assert rows_by_id["ORD_004"]["customer_name"] == "Diana LLC"

        # 6. Test Watermark Reset API
        reset_res = reset_flow_watermark(flow_id, watermark_value=None)
        assert reset_res["success"] is True
        assert reset_res["last_watermark_value"] is None

        flow_after_reset = CatalogDB.get_flow(flow_id)
        assert flow_after_reset["last_watermark_value"] is None
