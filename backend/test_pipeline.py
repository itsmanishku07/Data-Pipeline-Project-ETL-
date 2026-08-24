import sys
import os
import json
import sqlite3
import pandas as pd
from pathlib import Path

# Fix Windows console encoding for UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.models.schemas import (
    SourceConnectionRequest,
    SourceType,
    LocalSourceConfig,
    DatabaseSourceConfig,
    DatabaseType,
    CastColumnRule,
    StageDatasetRequest,
    TransformationRule,
    PipelineExecutionRequest,
    FileFormat
)
from app.connectors import get_connector
from app.connectors.database_connector import DatabaseConnector
from app.engine.schema_engine import profile_dataframe, apply_type_casting
from app.services.staging_service import StagingService
from app.services.job_service import JobService
from app.engine.transform_engine import TransformationEngine

def run_e2e_tests():
    print("==================================================")
    print("[STARTING] DATAFLOW STUDIO END-TO-END TESTS")
    print("==================================================")

    # Setup isolated test database for connector testing
    import tempfile
    test_db_path = Path(tempfile.gettempdir()) / "test_transient.db"
    test_conn = sqlite3.connect(test_db_path)
    df_test_data = pd.DataFrame([
        {"order_id": f"ORD-{i}", "customer_id": f"CUST-{i%10}", "unit_price": 50.0 + i * 2.5, "quantity": (i % 5) + 1, "status": "COMPLETED" if i % 2 == 0 else "PENDING"}
        for i in range(1, 101)
    ])
    df_test_data.to_sql("orders", test_conn, if_exists="replace", index=False)
    test_conn.close()

    # 1. Test Database Connectors (PostgreSQL, MySQL, SQLite)
    print("\n[TEST 1] Testing Database Connectors (PostgreSQL, MySQL, SQLite)...")
    
    # Test MySQL connection argument handling (ensure no 'timeout' kwarg error)
    mysql_req = SourceConnectionRequest(
        source_type=SourceType.DATABASE,
        name="MySQL Live Test",
        database_config=DatabaseSourceConfig(
            db_type=DatabaseType.MYSQL,
            host="localhost",
            port=3306,
            database="testdb",
            username="root",
            password="pwd"
        )
    )
    mysql_conn = get_connector(mysql_req)
    ok, msg = mysql_conn.test_connection()
    assert "unexpected keyword argument" not in msg, f"MySQL failed with kwarg error: {msg}"
    print(f"  [OK] MySQL Driver Connection Check: {msg[:80]}...")

    # Test SQLite test database connection
    db_req = SourceConnectionRequest(
        source_type=SourceType.DATABASE,
        name="Transient Test Database",
        database_config=DatabaseSourceConfig(
            db_type=DatabaseType.SQLITE,
            sqlite_path=str(test_db_path),
            table_name="orders"
        )
    )
    db_conn = get_connector(db_req)
    ok, msg = db_conn.test_connection()
    assert ok, f"Database Connection failed: {msg}"
    print(f"  [OK] Database Connection Test: {msg}")

    # Test Table listing
    tables = db_conn.get_tables()
    table_names = [t["table_name"] for t in tables]
    assert "orders" in table_names
    print(f"  [OK] Database Tables Found: {table_names}")

    # Test Extraction with custom SQL query
    query_req = SourceConnectionRequest(
        source_type=SourceType.DATABASE,
        name="Dynamic Query Extraction",
        database_config=DatabaseSourceConfig(
            db_type=DatabaseType.SQLITE,
            sqlite_path=str(test_db_path),
            query="SELECT order_id, customer_id, unit_price, quantity, status FROM orders WHERE status = 'COMPLETED'"
        )
    )
    query_conn = get_connector(query_req)
    df_sql = query_conn.extract_data(limit=50)
    assert len(df_sql) == 50
    assert "unit_price" in df_sql.columns
    print(f"  [OK] SQL Query Extraction Succeeded: Ingested {len(df_sql)} rows ({len(df_sql.columns)} cols)")

    # 2. Test Schema Profiling & Inferred Types
    print("\n[TEST 2] Testing Schema Profiling & Inferred Types...")
    profiles = profile_dataframe(df_sql)
    for p in profiles:
        print(f"    - Column '{p.name}': Spark Type '{p.spark_type}' | Nulls: {p.null_count} | Distinct: {p.distinct_count}")
    print(f"  [OK] Profiled {len(profiles)} columns successfully.")

    # 3. Test Type Casting Engine
    print("\n[TEST 3] Testing Spark Data Type Casting Engine...")
    cast_rules = [
        CastColumnRule(column_name="quantity", target_spark_type="IntegerType"),
        CastColumnRule(column_name="unit_price", target_spark_type="DoubleType"),
    ]
    df_cast, logs = apply_type_casting(df_sql, cast_rules)
    for l in logs:
        print(f"    {l}")
    print(f"  [OK] Applied {len(cast_rules)} type casting rules.")

    # 4. Test Lakehouse Staging Area
    print("\n[TEST 4] Testing Lakehouse Staging Layer & Persistence...")
    stage_req = StageDatasetRequest(
        source_request=db_req,
        dataset_name="dynamic_orders_staged",
        description="Staged Orders from Database",
        cast_rules=cast_rules
    )
    staged_info = StagingService.stage_dataset(stage_req)
    assert staged_info.id.startswith("stg_")
    print(f"  [OK] Staged Dataset Saved: ID='{staged_info.id}', Name='{staged_info.name}', Rows={staged_info.row_count}")

    # 5. Test Transformation Rules Engine
    print("\n[TEST 5] Testing Apache Spark Transformation Rules Engine...")
    transform_rules = [
        TransformationRule(
            id="r1",
            rule_type="filter",
            params={"condition": "unit_price > 60.0"},
            description="Filter orders where unit_price > $60",
            enabled=True
        ),
        TransformationRule(
            id="r2",
            rule_type="derived_column",
            params={
                "column_name": "estimated_total",
                "expression": "CAST(unit_price AS DOUBLE) * CAST(quantity AS INT)"
            },
            description="Calculate estimated_total",
            enabled=True
        ),
        TransformationRule(
            id="r3",
            rule_type="aggregate",
            params={
                "group_by": ["status"],
                "aggregations": [
                    {"column": "estimated_total", "op": "SUM", "alias": "total_sales_value"},
                    {"column": "order_id", "op": "COUNT", "alias": "order_count"}
                ]
            },
            description="Aggregate by Status",
            enabled=True
        )
    ]

    df_staged_data = db_conn.extract_data()
    df_transformed, summaries, exec_ms = TransformationEngine.execute_rules(df_staged_data, transform_rules)
    print(f"  [OK] Transformation Engine Executed in {exec_ms} ms:")
    for s in summaries:
        print(f"    - Step {s['step_index']}: {s['description']} -> {s['output_rows']} rows ({s['status']})")
    assert len(df_transformed) > 0

    # 6. Test Pipeline Job Service & Export
    print("\n[TEST 6] Testing Pipeline Execution Job Runner & Export...")
    pipe_req = PipelineExecutionRequest(
        name="Dynamic Orders Processing Pipeline",
        staging_dataset_id=staged_info.id,
        rules=transform_rules[:2],
        output_dataset_name="golden_orders_processed",
        output_description="Curated Golden Dataset from Database",
        stage_output=True,
        export_format=FileFormat.CSV
    )
    job = JobService.execute_pipeline(pipe_req)
    assert job.status.value == "completed", f"Job failed: {job.error}"
    print(f"  [OK] Spark Job Completed: ID={job.id}, Processed {job.input_rows} -> {job.output_rows} rows")
    print(f"  [OK] Curated Dataset Staged: ID={job.output_dataset_id}")
    print(f"  [OK] Export Generated: {job.output_file_path}")

    # Clean transient test file
    try:
        test_db_path.unlink(missing_ok=True)
    except Exception:
        pass

    print("\n==================================================")
    print("[SUCCESS] ALL DATAFLOW STUDIO E2E TESTS PASSED 100%!")
    print("==================================================")

if __name__ == "__main__":
    run_e2e_tests()
