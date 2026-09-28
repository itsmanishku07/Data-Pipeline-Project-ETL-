import json
import re
import time
from typing import Optional, Tuple, List, Dict, Any
import pandas as pd
import httpx
from .base import BaseConnector
from ..models.schemas import DatabricksSourceConfig

class DatabricksConnector(BaseConnector):
    """
    Connector for Databricks Unity Catalog & SQL Warehouses.
    Extracts live metadata and data from Databricks Unity Catalog tables and schemas.
    """

    def __init__(self, config: DatabricksSourceConfig):
        self.config = config

    def _get_clean_host(self) -> str:
        host = (self.config.server_hostname or "").strip()
        host = re.sub(r"^https?://", "", host).rstrip("/")
        return host

    def _get_warehouse_id(self) -> str:
        path = (self.config.http_path or "").strip()
        parts = path.strip("/").split("/")
        if "warehouses" in parts:
            idx = parts.index("warehouses")
            if idx + 1 < len(parts):
                return parts[idx + 1]
        elif len(parts) > 0 and not parts[0].startswith("sql"):
            return parts[-1]
        return ""

    def _execute_sql_via_rest(self, sql_query: str) -> Tuple[List[str], List[List[Any]]]:
        """
        Executes a SQL query on Databricks SQL Warehouse using the 2.0 Statement Execution REST API.
        """
        host = self._get_clean_host()
        token = (self.config.access_token or "").strip()
        warehouse_id = self._get_warehouse_id()
        catalog = (self.config.catalog or "").strip()
        schema = (self.config.schema_name or "").strip()

        if not host:
            raise ValueError("Databricks Server Hostname is required (e.g. adb-xxxx.azuredatabricks.net).")
        if not token:
            raise ValueError("Databricks Personal Access Token (PAT) is required.")

        url = f"https://{host}/api/2.0/sql/statements"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        body: Dict[str, Any] = {
            "statement": sql_query,
            "wait_timeout": "30s",
            "disposition": "INLINE",
            "format": "JSON_ARRAY"
        }
        if warehouse_id:
            body["warehouse_id"] = warehouse_id
        if catalog:
            body["catalog"] = catalog
        if schema:
            body["schema"] = schema

        with httpx.Client(timeout=45.0) as client:
            resp = client.post(url, headers=headers, json=body)
            if resp.status_code in (401, 403):
                raise PermissionError(f"Databricks Authentication Failed ({resp.status_code}): Invalid or expired access token.")
            if resp.status_code not in (200, 201):
                err_text = resp.text
                try:
                    err_json = resp.json()
                    err_text = err_json.get("message") or err_json.get("error") or err_text
                except Exception:
                    pass
                raise RuntimeError(f"Databricks SQL API Error ({resp.status_code}): {err_text}")

            result = resp.json()
            status = result.get("status", {}).get("state", "")
            
            # If statement is executing, poll until completion
            statement_id = result.get("statement_id")
            max_polls = 15
            while status in ["PENDING", "RUNNING"] and statement_id and max_polls > 0:
                time.sleep(1.5)
                poll_resp = client.get(f"https://{host}/api/2.0/sql/statements/{statement_id}", headers=headers)
                if poll_resp.status_code == 200:
                    result = poll_resp.json()
                    status = result.get("status", {}).get("state", "")
                max_polls -= 1

            if status == "FAILED":
                err_msg = result.get("status", {}).get("error", {}).get("message", "SQL Execution failed")
                raise RuntimeError(f"Databricks SQL Error: {err_msg}")

            manifest = result.get("manifest", {})
            columns = [col.get("name") for col in manifest.get("schema", {}).get("columns", [])]
            data_array = result.get("result", {}).get("data_array", [])
            return columns, data_array

    def test_connection(self) -> Tuple[bool, str]:
        """
        Tests connectivity to Databricks workspace and verifies access token & SQL warehouse.
        """
        host = self._get_clean_host()
        token = (self.config.access_token or "").strip()
        catalog = (self.config.catalog or "").strip()
        schema = (self.config.schema_name or "").strip()

        if not host:
            return False, "Databricks Server Hostname is required."
        if not token:
            return False, "Databricks Personal Access Token (PAT) is required."

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # 1. Try Unity Catalog 2.1 REST API test first (fastest, does not need running warehouse)
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(f"https://{host}/api/2.1/unity-catalog/catalogs", headers=headers)
                if resp.status_code == 200:
                    return True, f"Successfully authenticated to Databricks Unity Catalog on '{host}'."
                elif resp.status_code in (401, 403):
                    return False, f"Databricks Authentication Failed ({resp.status_code}): Invalid or expired access token."
        except Exception:
            pass

        # 2. Try SQL Warehouse test
        try:
            try:
                from databricks import sql
                kwargs: Dict[str, Any] = {
                    "server_hostname": host,
                    "http_path": self.config.http_path,
                    "access_token": token
                }
                if catalog:
                    kwargs["catalog"] = catalog
                if schema:
                    kwargs["schema"] = schema

                with sql.connect(**kwargs) as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("SELECT current_timestamp()")
                return True, f"Successfully connected to Databricks SQL Warehouse on '{host}'."
            except Exception:
                cols, rows = self._execute_sql_via_rest("SELECT current_timestamp()")
                return True, f"Successfully connected to Databricks SQL Warehouse on '{host}'."
        except Exception as e:
            return False, f"Databricks connection test failed: {str(e)}"

    def get_catalogs(self) -> List[str]:
        """List available catalogs in the live Databricks Unity Catalog."""
        host = self._get_clean_host()
        token = (self.config.access_token or "").strip()
        if not host:
            raise ValueError("Databricks Server Hostname is required.")
        if not token:
            raise ValueError("Databricks Personal Access Token (PAT) is required.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # 1. Try Unity Catalog 2.1 REST API first (works even without warehouse)
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.get(f"https://{host}/api/2.1/unity-catalog/catalogs", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    cats = [c.get("name") for c in data.get("catalogs", []) if c.get("name")]
                    if cats:
                        return sorted(cats)
                elif resp.status_code in (401, 403):
                    raise PermissionError(f"Databricks Authentication Failed ({resp.status_code}): Invalid or expired access token.")
        except PermissionError:
            raise
        except Exception:
            pass

        # 2. Try SQL execution if warehouse is running
        try:
            cols, rows = self._execute_sql_via_rest("SHOW CATALOGS")
            catalogs = [r[0] for r in rows if r and r[0]]
            if catalogs:
                return sorted(catalogs)
        except Exception as e:
            raise RuntimeError(f"Failed to fetch Unity Catalogs from {host}: {str(e)}")

        return ["main", "samples", "hive_metastore"]

    def get_schemas(self, catalog: Optional[str] = None) -> List[str]:
        """List available schemas inside the specified live catalog."""
        host = self._get_clean_host()
        token = (self.config.access_token or "").strip()
        cat = (catalog or self.config.catalog or "main").strip()
        if not host or not token:
            raise ValueError("Databricks Hostname and Personal Access Token (PAT) are required.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # 1. Try Unity Catalog 2.1 REST API first
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.get(f"https://{host}/api/2.1/unity-catalog/schemas?catalog_name={cat}", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    schemas = [s.get("name") for s in data.get("schemas", []) if s.get("name")]
                    if schemas:
                        return sorted(schemas)
        except Exception:
            pass

        # 2. Try SQL execution
        try:
            cols, rows = self._execute_sql_via_rest(f"SHOW SCHEMAS IN `{cat}`")
            schemas = [r[0] for r in rows if r and r[0]]
            if schemas:
                return sorted(schemas)
        except Exception as e:
            raise RuntimeError(f"Failed to fetch schemas in catalog '{cat}': {str(e)}")

        return ["default", "information_schema"]

    def get_tables(self, catalog: Optional[str] = None, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """List available tables inside catalog.schema."""
        host = self._get_clean_host()
        token = (self.config.access_token or "").strip()
        cat = (catalog or self.config.catalog or "main").strip()
        sch = (schema or self.config.schema_name or "default").strip()
        if not host or not token:
            raise ValueError("Databricks Hostname and Personal Access Token (PAT) are required.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # 1. Try Unity Catalog 2.1 REST API first
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.get(f"https://{host}/api/2.1/unity-catalog/tables?catalog_name={cat}&schema_name={sch}", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    tables_raw = data.get("tables", [])
                    tables = []
                    for t in tables_raw:
                        tbl_name = t.get("name")
                        if tbl_name:
                            cols = [c.get("name") for c in t.get("columns", []) if c.get("name")]
                            tables.append({
                                "name": tbl_name,
                                "catalog": cat,
                                "schema": sch,
                                "full_name": f"{cat}.{sch}.{tbl_name}",
                                "table_type": t.get("table_type", "DELTA"),
                                "row_count": 0,
                                "columns": cols
                            })
                    if tables:
                        return sorted(tables, key=lambda x: x["name"])
        except Exception:
            pass

        # 2. Try SQL execution
        try:
            cols, rows = self._execute_sql_via_rest(f"SHOW TABLES IN `{cat}`.`{sch}`")
            tables = []
            for r in rows:
                if len(r) >= 2:
                    tbl_name = r[1]
                    tables.append({
                        "name": tbl_name,
                        "catalog": cat,
                        "schema": sch,
                        "full_name": f"{cat}.{sch}.{tbl_name}",
                        "table_type": "DELTA",
                        "row_count": 0,
                        "columns": []
                    })
            return sorted(tables, key=lambda x: x["name"])
        except Exception as e:
            raise RuntimeError(f"Failed to fetch tables in '{cat}.{sch}': {str(e)}")

    def extract_data(
        self, 
        limit: Optional[int] = None,
        watermark_col: Optional[str] = None,
        last_watermark: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Extracts live data from Databricks catalog table or custom SQL query into a pandas DataFrame.
        Supports high-watermark incremental filtering and automatic `aud_last_update` stamping.
        """
        host = self._get_clean_host()
        token = (self.config.access_token or "").strip()
        cat = (self.config.catalog or "").strip()
        sch = (self.config.schema_name or "").strip()
        tbl = (self.config.table_name or "").strip()
        custom_query = (self.config.query or "").strip()

        if not host:
            raise ValueError("Databricks Server Hostname is required.")
        if not token:
            raise ValueError("Databricks Personal Access Token (PAT) is required to extract live data.")

        if custom_query:
            sql_query = custom_query
            if watermark_col and last_watermark:
                clean_wm = str(last_watermark).replace("'", "''")
                if "WHERE" in sql_query.upper():
                    sql_query = f"{sql_query} AND {watermark_col} > '{clean_wm}'"
                else:
                    sql_query = f"{sql_query} WHERE {watermark_col} > '{clean_wm}'"
            if limit and "limit" not in sql_query.lower():
                sql_query = f"{sql_query} LIMIT {limit}"
        elif tbl:
            base_from = f"`{cat}`.`{sch}`.`{tbl}`" if (cat and sch) else (f"`{sch}`.`{tbl}`" if sch else f"`{tbl}`")
            sql_query = f"SELECT * FROM {base_from}"
            if watermark_col and last_watermark:
                clean_wm = str(last_watermark).replace("'", "''")
                sql_query = f"{sql_query} WHERE `{watermark_col}` > '{clean_wm}'"
            if limit:
                sql_query += f" LIMIT {limit}"
        else:
            raise ValueError("Please select a target table or specify a custom SQL query to extract data.")

        # Execute live query on Databricks SQL Warehouse
        try:
            try:
                from databricks import sql
                kwargs: Dict[str, Any] = {
                    "server_hostname": host,
                    "http_path": self.config.http_path,
                    "access_token": token
                }
                if cat:
                    kwargs["catalog"] = cat
                if sch:
                    kwargs["schema"] = sch

                with sql.connect(**kwargs) as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(sql_query)
                        cols = [desc[0] for desc in cursor.description]
                        rows = cursor.fetchall()
                        df = pd.DataFrame(rows, columns=cols)
            except Exception:
                cols, rows = self._execute_sql_via_rest(sql_query)
                df = pd.DataFrame(rows, columns=cols)

            # Stamp standard enterprise audit column
            df = self.append_audit_timestamp(df)
            return df
        except Exception as e:
            raise RuntimeError(f"Databricks SQL Extraction Failed: {str(e)}")

    def write_data(self, df: pd.DataFrame, table_name: Optional[str] = None, write_mode: str = "append") -> Dict[str, Any]:
        """
        Writes/Exports DataFrame rows into a Databricks Unity Catalog Delta table.
        """
        cat = (self.config.catalog or "main").strip()
        sch = (self.config.schema_name or "default").strip()
        tbl = (table_name or self.config.table_name or "curated_output").strip()
        token = (self.config.access_token or "").strip()
        full_table_name = f"`{cat}`.`{sch}`.`{tbl}`"

        if not token:
            raise ValueError("Databricks Personal Access Token (PAT) is required to export data.")

        try:
            # Create schema if not exists
            self._execute_sql_via_rest(f"CREATE SCHEMA IF NOT EXISTS `{cat}`.`{sch}`")

            # In replace/overwrite mode, drop existing table
            if write_mode.lower() in ["replace", "overwrite"]:
                self._execute_sql_via_rest(f"DROP TABLE IF EXISTS {full_table_name}")

            # Create Delta table with matching schema
            col_defs = []
            for col, dtype in zip(df.columns, df.dtypes):
                col_sanitized = re.sub(r"[^\w]", "_", str(col))
                if "int" in str(dtype).lower():
                    sql_type = "BIGINT"
                elif "float" in str(dtype).lower():
                    sql_type = "DOUBLE"
                elif "bool" in str(dtype).lower():
                    sql_type = "BOOLEAN"
                elif "datetime" in str(dtype).lower():
                    sql_type = "TIMESTAMP"
                else:
                    sql_type = "STRING"
                col_defs.append(f"`{col_sanitized}` {sql_type}")

            create_table_sql = f"CREATE TABLE IF NOT EXISTS {full_table_name} ({', '.join(col_defs)}) USING DELTA"
            self._execute_sql_via_rest(create_table_sql)

            # Insert rows in chunks
            chunk_size = 500
            total_rows = len(df)
            for i in range(0, total_rows, chunk_size):
                chunk = df.iloc[i:i + chunk_size]
                rows_sql = []
                for _, row in chunk.iterrows():
                    val_strs = []
                    for val in row:
                        if pd.isna(val) or val is None:
                            val_strs.append("NULL")
                        elif isinstance(val, (int, float)):
                            val_strs.append(str(val))
                        elif isinstance(val, bool):
                            val_strs.append("TRUE" if val else "FALSE")
                        else:
                            clean_val = str(val).replace("'", "''")
                            val_strs.append(f"'{clean_val}'")
                    rows_sql.append(f"({', '.join(val_strs)})")

                if rows_sql:
                    insert_sql = f"INSERT INTO {full_table_name} VALUES {', '.join(rows_sql)}"
                    self._execute_sql_via_rest(insert_sql)

            return {
                "success": True,
                "rows_written": total_rows,
                "table_name": f"{cat}.{sch}.{tbl}",
                "catalog": cat,
                "schema": sch,
                "write_mode": write_mode,
                "message": f"Successfully loaded {total_rows} rows into Databricks Delta table '{cat}.{sch}.{tbl}'!"
            }
        except Exception as e:
            raise RuntimeError(f"Databricks write failed for table '{cat}.{sch}.{tbl}': {str(e)}")

    def get_source_summary(self) -> str:
        host = self._get_clean_host()
        cat = self.config.catalog or "main"
        sch = self.config.schema_name or "default"
        tbl = self.config.table_name or "query"
        return f"Databricks Unity Catalog '{cat}.{sch}.{tbl}' on {host}"
