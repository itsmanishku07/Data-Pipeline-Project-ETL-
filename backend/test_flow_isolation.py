import unittest
import tempfile
import sqlite3
from pathlib import Path
import pandas as pd
from app.models.db_models import CatalogDB, init_db
from app.services.staging_service import StagingService
from app.services.job_service import JobService
from app.models.schemas import (
    SourceConnectionRequest,
    SourceType,
    DatabaseSourceConfig,
    DatabaseType,
    StageDatasetRequest,
    PipelineExecutionRequest,
    TransformationRule,
    RuleType
)

class TestStrictFlowIsolation(unittest.TestCase):
    def setUp(self):
        init_db()
        self.test_db_path = Path(tempfile.gettempdir()) / "test_flow_iso.db"
        conn = sqlite3.connect(self.test_db_path)
        pd.DataFrame([
            {"order_id": f"ORD-{i}", "unit_price": 40.0 + i, "status": "COMPLETED"}
            for i in range(1, 51)
        ]).to_sql("orders_alpha", conn, if_exists="replace", index=False)

        pd.DataFrame([
            {"cust_id": f"CUST-{i}", "spend": 100.0 + i * 5, "status": "ACTIVE"}
            for i in range(1, 31)
        ]).to_sql("customers_beta", conn, if_exists="replace", index=False)
        conn.close()

    def test_flow_isolation_end_to_end(self):
        print("\n[TEST] Running Strict Flow-Wise Isolation Test...")

        # 1. Create Flow Alpha (e.g. Finance Flow)
        flow_alpha = CatalogDB.create_flow({
            "name": "Finance Alpha Flow",
            "category": "Finance",
            "description": "Flow for finance reconciliation",
            "rules": [
                {
                    "id": "rule_alpha_1",
                    "rule_type": "filter",
                    "description": "Filter unit_price > 50",
                    "params": {"condition": "unit_price > 50"},
                    "enabled": True
                }
            ]
        })
        alpha_id = flow_alpha["id"]
        print(f"  Created Flow Alpha: {alpha_id}")

        # 2. Create Flow Beta (e.g. Marketing Flow)
        flow_beta = CatalogDB.create_flow({
            "name": "Marketing Beta Flow",
            "category": "Marketing",
            "description": "Flow for marketing campaign metrics",
            "rules": [
                {
                    "id": "rule_beta_1",
                    "rule_type": "filter",
                    "description": "Filter spend > 150",
                    "params": {"condition": "spend > 150"},
                    "enabled": True
                }
            ]
        })
        beta_id = flow_beta["id"]
        print(f"  Created Flow Beta: {beta_id}")

        # 3. Stage Dataset A strictly into Flow Alpha
        req_a = StageDatasetRequest(
            source_request=SourceConnectionRequest(
                source_type=SourceType.DATABASE,
                name="finance_orders_source",
                database_config=DatabaseSourceConfig(
                    db_type=DatabaseType.SQLITE,
                    sqlite_path=str(self.test_db_path),
                    table_name="orders_alpha"
                )
            ),
            dataset_name="alpha_finance_staged",
            flow_id=alpha_id,
            cast_rules=[]
        )
        ds_a = StagingService.stage_dataset(req_a)
        print(f"  Staged Dataset A into Alpha: {ds_a.id}")

        # 4. Stage Dataset B strictly into Flow Beta
        req_b = StageDatasetRequest(
            source_request=SourceConnectionRequest(
                source_type=SourceType.DATABASE,
                name="marketing_customers_source",
                database_config=DatabaseSourceConfig(
                    db_type=DatabaseType.SQLITE,
                    sqlite_path=str(self.test_db_path),
                    table_name="customers_beta"
                )
            ),
            dataset_name="beta_marketing_staged",
            flow_id=beta_id,
            cast_rules=[]
        )
        ds_b = StagingService.stage_dataset(req_b)
        print(f"  Staged Dataset B into Beta: {ds_b.id}")

        # 5. Verify Dataset Isolation
        alpha_datasets = CatalogDB.list_staged_datasets(flow_id=alpha_id)
        beta_datasets = CatalogDB.list_staged_datasets(flow_id=beta_id)

        alpha_ds_ids = [d["id"] for d in alpha_datasets]
        beta_ds_ids = [d["id"] for d in beta_datasets]

        self.assertIn(ds_a.id, alpha_ds_ids, "Dataset A must be present in Flow Alpha")
        self.assertNotIn(ds_b.id, alpha_ds_ids, "Dataset B MUST NOT leak into Flow Alpha!")

        self.assertIn(ds_b.id, beta_ds_ids, "Dataset B must be present in Flow Beta")
        self.assertNotIn(ds_a.id, beta_ds_ids, "Dataset A MUST NOT leak into Flow Beta!")
        print("  [OK] Dataset Isolation between Flow Alpha and Flow Beta verified!")

        # 6. Verify Rules Isolation
        alpha_rules = CatalogDB.get_flow_rules(alpha_id)
        beta_rules = CatalogDB.get_flow_rules(beta_id)

        self.assertEqual(len(alpha_rules), 1)
        self.assertEqual(alpha_rules[0]["id"], "rule_alpha_1")
        self.assertEqual(len(beta_rules), 1)
        self.assertEqual(beta_rules[0]["id"], "rule_beta_1")
        print("  [OK] Transformation Rules Isolation verified!")

        # 7. Execute Pipeline in Flow Alpha and verify Job Scoping
        job_req = PipelineExecutionRequest(
            name="alpha_test_job",
            staging_dataset_id=ds_a.id,
            rules=[TransformationRule(id="rule_alpha_1", rule_type=RuleType.FILTER, description="test", params={"condition": "unit_price > 50"})],
            output_dataset_name="alpha_output_curated",
            flow_id=alpha_id
        )
        job_res = JobService.execute_pipeline(job_req)
        self.assertEqual(job_res.status, "completed")

        # Query jobs for Alpha vs Beta
        alpha_jobs = CatalogDB.list_jobs(flow_id=alpha_id)
        beta_jobs = CatalogDB.list_jobs(flow_id=beta_id)

        alpha_job_ids = [j["id"] for j in alpha_jobs]
        beta_job_ids = [j["id"] for j in beta_jobs]

        self.assertIn(job_res.id, alpha_job_ids, "Executed job must be attached to Flow Alpha")
        self.assertNotIn(job_res.id, beta_job_ids, "Executed job MUST NOT appear in Flow Beta")
        print("  [OK] Pipeline Execution Job Scoping verified!")

        # 8. Check Flow 360 Progression Calculation
        flow_alpha_enriched = CatalogDB.get_flow(alpha_id)
        self.assertEqual(flow_alpha_enriched["progress_percentage"], 100)
        self.assertEqual(flow_alpha_enriched["dataset_count"], 2) # initial + curated output
        print(f"  [OK] Flow Alpha Progress: {flow_alpha_enriched['progress_percentage']}% (All 5 stages completed)")

        print("[SUCCESS] STRICT FLOW-WISE ISOLATION TEST PASSED 100%!\n")

if __name__ == "__main__":
    unittest.main()
