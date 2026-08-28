import time
import re
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
import duckdb
from ..models.schemas import TransformationRule, RuleType, ColumnProfile
from .schema_engine import profile_dataframe, apply_type_casting, CastColumnRule
from ..models.db_models import CatalogDB
from ..services.data_store import DataStoreEngine

class TransformationEngine:
    @staticmethod
    def execute_rules(
        df_initial: pd.DataFrame, 
        rules: List[TransformationRule], 
        limit_preview: Optional[int] = None
    ) -> Tuple[pd.DataFrame, List[Dict[str, Any]], float]:
        start_time = time.time()
        current_df = df_initial.copy()
        step_summaries = []

        for idx, rule in enumerate(rules):
            if not rule.enabled:
                continue

            step_name = f"Step {idx+1}: {rule.rule_type.value}"
            initial_count = len(current_df)
            initial_cols = len(current_df.columns)
            error_msg = None
            
            try:
                current_df = TransformationEngine._apply_rule(current_df, rule)
            except Exception as e:
                error_msg = str(e)
                # Keep current_df to prevent full crash and show error on step
                
            step_summaries.append({
                "step_index": idx + 1,
                "rule_id": rule.id,
                "rule_type": rule.rule_type.value,
                "description": rule.description or f"Applied {rule.rule_type.value}",
                "input_rows": initial_count,
                "output_rows": len(current_df),
                "columns_count": len(current_df.columns),
                "status": "FAILED" if error_msg else "SUCCESS",
                "error": error_msg
            })

        exec_time_ms = round((time.time() - start_time) * 1000, 2)
        return current_df, step_summaries, exec_time_ms

    @staticmethod
    def _apply_rule(df: pd.DataFrame, rule: TransformationRule) -> pd.DataFrame:
        rtype = rule.rule_type
        params = rule.params

        if rtype == RuleType.FILTER:
            condition = params.get("condition", "")
            if condition:
                # Use DuckDB for SQL WHERE filtering
                con = duckdb.connect(":memory:")
                con.register("current_df", df)
                query = f"SELECT * FROM current_df WHERE {condition}"
                df = con.execute(query).df()
                con.close()

        elif rtype == RuleType.DROP_COLUMNS:
            cols_to_drop = params.get("columns", [])
            cols_exist = [c for c in cols_to_drop if c in df.columns]
            if cols_exist:
                df = df.drop(columns=cols_exist)

        elif rtype == RuleType.SELECT_COLUMNS:
            cols_to_keep = params.get("columns", [])
            cols_exist = [c for c in cols_to_keep if c in df.columns]
            if cols_exist:
                df = df[cols_exist]

        elif rtype == RuleType.RENAME_COLUMN:
            old_name = params.get("old_name")
            new_name = params.get("new_name")
            if old_name and new_name and old_name in df.columns:
                df = df.rename(columns={old_name: new_name})

        elif rtype == RuleType.FILL_NA:
            col = params.get("column")
            fill_value = params.get("value")
            strategy = params.get("strategy", "constant") # constant, mean, mode, ffill

            if col and col in df.columns:
                if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].mean())
                elif strategy == "mode":
                    mode_val = df[col].mode()
                    if not mode_val.empty:
                        df[col] = df[col].fillna(mode_val[0])
                elif strategy == "ffill":
                    df[col] = df[col].ffill()
                else:
                    df[col] = df[col].fillna(fill_value)
            elif not col and fill_value is not None:
                df = df.fillna(fill_value)

        elif rtype == RuleType.DROP_NA:
            cols = params.get("columns", [])
            how = params.get("how", "any") # any, all
            if cols:
                cols_exist = [c for c in cols if c in df.columns]
                df = df.dropna(subset=cols_exist, how=how)
            else:
                df = df.dropna(how=how)

        elif rtype == RuleType.STRING_TRANSFORM:
            col = params.get("column")
            op = params.get("operation") # trim, upper, lower, title, regex_replace
            if col and col in df.columns:
                s = df[col].astype(str)
                if op == "trim":
                    df[col] = s.str.strip()
                elif op == "upper":
                    df[col] = s.str.upper()
                elif op == "lower":
                    df[col] = s.str.lower()
                elif op == "title":
                    df[col] = s.str.title()
                elif op == "regex_replace":
                    pattern = params.get("pattern", "")
                    replacement = params.get("replacement", "")
                    df[col] = s.str.replace(pattern, replacement, regex=True)

        elif rtype == RuleType.CAST_TYPE:
            col = params.get("column")
            target_type = params.get("target_type")
            fmt = params.get("format")
            if col and target_type:
                cast_rule = CastColumnRule(column_name=col, target_spark_type=target_type, format=fmt)
                df, _ = apply_type_casting(df, [cast_rule])

        elif rtype == RuleType.DERIVED_COLUMN:
            col_name = params.get("column_name")
            expression = params.get("expression") # e.g. "unit_price * quantity", "ROUND(amount * 0.1, 2)"
            if col_name and expression:
                con = duckdb.connect(":memory:")
                con.register("current_df", df)
                query = f"SELECT *, ({expression}) AS \"{col_name}\" FROM current_df"
                df = con.execute(query).df()
                con.close()

        elif rtype == RuleType.AGGREGATE:
            group_by_cols = params.get("group_by", [])
            aggs = params.get("aggregations", []) # list of {column, op, alias}
            
            if aggs:
                select_parts = [f"\"{c}\"" for c in group_by_cols]
                for agg in aggs:
                    col = agg.get("column")
                    op = agg.get("op", "sum").upper() # SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT
                    alias = agg.get("alias") or f"{op.lower()}_{col}"
                    if op == "COUNT_DISTINCT":
                        select_parts.append(f"COUNT(DISTINCT \"{col}\") AS \"{alias}\"")
                    else:
                        select_parts.append(f"{op}(\"{col}\") AS \"{alias}\"")
                
                group_clause = f"GROUP BY {', '.join([f'\"{c}\"' for c in group_by_cols])}" if group_by_cols else ""
                query = f"SELECT {', '.join(select_parts)} FROM current_df {group_clause}"
                
                con = duckdb.connect(":memory:")
                con.register("current_df", df)
                df = con.execute(query).df()
                con.close()

        elif rtype == RuleType.DEDUPLICATE:
            cols = params.get("columns", [])
            cols_exist = [c for c in cols if c in df.columns] if cols else None
            df = df.drop_duplicates(subset=cols_exist)

        elif rtype == RuleType.SPARK_SQL:
            sql_query = params.get("query", "")
            if sql_query:
                # Normalize table aliases
                sql_query = re.sub(r"\bdf\b", "current_df", sql_query, flags=re.IGNORECASE)
                sql_query = re.sub(r"\bstaged_data\b", "current_df", sql_query, flags=re.IGNORECASE)
                con = duckdb.connect(":memory:")
                con.register("current_df", df)
                df = con.execute(sql_query).df()
                con.close()

        elif rtype == RuleType.JOIN:
            target_ds_id = params.get("target_dataset_id")
            left_on = params.get("left_on")
            right_on = params.get("right_on")
            how = (params.get("how") or "inner").lower()
            suffix_left = params.get("suffix_left", "")
            suffix_right = params.get("suffix_right", "_joined")
            selected_columns = params.get("selected_columns", None)

            if target_ds_id and left_on and right_on:
                target_ds_info = CatalogDB.get_staged_dataset(target_ds_id)
                if not target_ds_info:
                    raise FileNotFoundError(f"Joined target dataset '{target_ds_id}' not found in catalog.")

                df_target = DataStoreEngine.load_staged_dataframe(target_ds_info)

                if left_on not in df.columns:
                    raise KeyError(f"Left join column '{left_on}' not found in working dataset columns: {list(df.columns)}")

                if right_on not in df_target.columns:
                    raise KeyError(f"Right join column '{right_on}' not found in '{target_ds_info.get('name', target_ds_id)}' columns: {list(df_target.columns)}")

                # Filter target columns if specified
                if selected_columns and isinstance(selected_columns, list):
                    cols_to_keep = list(set([right_on] + [c for c in selected_columns if c in df_target.columns]))
                    df_target = df_target[cols_to_keep]

                # Harmonize key types to prevent merge type mismatch
                if df[left_on].dtype != df_target[right_on].dtype:
                    try:
                        df_target[right_on] = df_target[right_on].astype(df[left_on].dtype)
                    except Exception:
                        df[left_on] = df[left_on].astype(str)
                        df_target[right_on] = df_target[right_on].astype(str)

                # Merge DataFrames
                df = df.merge(
                    df_target,
                    left_on=left_on,
                    right_on=right_on,
                    how=how,
                    suffixes=(suffix_left, suffix_right)
                )

        return df

    @staticmethod
    def generate_pyspark_code(dataset_name: str, rules: List[TransformationRule]) -> str:
        """
        Generates production-ready, clean Apache PySpark script equivalent to the transformation DAG.
        """
        lines = [
            "# ====================================================================",
            f"# Apache PySpark Transformation Pipeline — Lakehouse Dataset: {dataset_name}",
            "# Generated by DataFlow SparkLake Studio",
            "# ====================================================================",
            "from pyspark.sql import SparkSession",
            "from pyspark.sql import functions as F",
            "from pyspark.sql.types import *",
            "",
            "# 1. Initialize High-Performance Spark Session",
            "spark = SparkSession.builder \\",
            "    .appName('DataFlow_Transformation_DAG') \\",
            "    .config('spark.sql.adaptive.enabled', 'true') \\",
            "    .config('spark.sql.shuffle.partitions', '200') \\",
            "    .getOrCreate()",
            "",
            f"# 2. Read Source Dataset: {dataset_name}",
            f"df = spark.read.table('lakehouse_staging.{dataset_name}')",
            ""
        ]

        active_rules = [r for r in rules if r.enabled]
        if not active_rules:
            lines.append("# No active transformation rules configured.")
            lines.append("df_transformed = df")
        else:
            lines.append("# 3. Apply Configured Transformation Steps")
            for idx, r in enumerate(active_rules):
                rtype = r.rule_type
                p = r.params
                step_num = idx + 1
                lines.append(f"# Step {step_num}: {r.description or rtype.value}")

                if rtype == RuleType.FILTER:
                    cond = p.get("condition", "1=1")
                    lines.append(f"df = df.filter(\"{cond}\")")
                elif rtype == RuleType.DERIVED_COLUMN:
                    col = p.get("column_name", "derived_metric")
                    expr = p.get("expression", "1")
                    lines.append(f"df = df.withColumn('{col}', F.expr(\"{expr}\"))")
                elif rtype == RuleType.STRING_TRANSFORM:
                    col = p.get("column")
                    op = p.get("operation", "upper")
                    if op == "upper":
                        lines.append(f"df = df.withColumn('{col}', F.upper(F.col('{col}')))")
                    elif op == "lower":
                        lines.append(f"df = df.withColumn('{col}', F.lower(F.col('{col}')))")
                    elif op == "trim":
                        lines.append(f"df = df.withColumn('{col}', F.trim(F.col('{col}')))")
                elif rtype == RuleType.RENAME_COLUMN:
                    old_c = p.get("old_name")
                    new_c = p.get("new_name")
                    lines.append(f"df = df.withColumnRenamed('{old_c}', '{new_c}')")
                elif rtype == RuleType.DROP_COLUMNS:
                    cols = p.get("columns", [])
                    lines.append(f"df = df.drop({', '.join([repr(c) for c in cols])})")
                elif rtype == RuleType.SELECT_COLUMNS:
                    cols = p.get("columns", [])
                    lines.append(f"df = df.select({', '.join([repr(c) for c in cols])})")
                elif rtype == RuleType.JOIN:
                    target_id = p.get("target_dataset_id", "target_table")
                    left_on = p.get("left_on", "key")
                    right_on = p.get("right_on", "key")
                    how = p.get("how", "inner")
                    lines.append(f"df_target_{step_num} = spark.read.table('lakehouse_staging.{target_id}')")
                    lines.append(f"df = df.join(df_target_{step_num}, df['{left_on}'] == df_target_{step_num}['{right_on}'], how='{how}')")
                elif rtype == RuleType.SPARK_SQL:
                    q = p.get("query", "SELECT * FROM df")
                    lines.append(f"df.createOrReplaceTempView('source_view_{step_num}')")
                    lines.append(f"df = spark.sql(\"\"\"{q}\"\"\")")
                lines.append("")

            lines.append("df_transformed = df")

        lines.extend([
            "",
            "# 4. Display / Materialize Result",
            "df_transformed.printSchema()",
            "df_transformed.show(50, truncate=False)",
            "print(f'Transformed Row Count: {df_transformed.count()}')"
        ])
        return "\n".join(lines)

    @staticmethod
    def generate_sql_code(dataset_name: str, rules: List[TransformationRule]) -> str:
        """
        Generates declarative ANSI / Spark SQL query with CTEs representing the pipeline.
        """
        active_rules = [r for r in rules if r.enabled]
        if not active_rules:
            return f"-- SparkLake Transformation SQL\nSELECT * FROM lakehouse_staging.{dataset_name};"

        ctes = [f"source_data AS (\n    SELECT * FROM lakehouse_staging.{dataset_name}\n)"]
        prev_table = "source_data"

        for idx, r in enumerate(active_rules):
            step_num = idx + 1
            cte_name = f"step_{step_num}_{r.rule_type.value}"
            rtype = r.rule_type
            p = r.params

            if rtype == RuleType.FILTER:
                cond = p.get("condition", "1=1")
                ctes.append(f"{cte_name} AS (\n    SELECT * FROM {prev_table}\n    WHERE {cond}\n)")
            elif rtype == RuleType.DERIVED_COLUMN:
                col = p.get("column_name", "derived_col")
                expr = p.get("expression", "1")
                ctes.append(f"{cte_name} AS (\n    SELECT *, ({expr}) AS {col}\n    FROM {prev_table}\n)")
            elif rtype == RuleType.STRING_TRANSFORM:
                col = p.get("column", "col")
                op = p.get("operation", "upper").upper()
                ctes.append(f"{cte_name} AS (\n    SELECT *, {op}({col}) AS {col}\n    FROM {prev_table}\n)")
            elif rtype == RuleType.RENAME_COLUMN:
                old_c = p.get("old_name", "old_col")
                new_c = p.get("new_name", "new_col")
                ctes.append(f"{cte_name} AS (\n    SELECT *, {old_c} AS {new_c}\n    FROM {prev_table}\n)")
            elif rtype == RuleType.JOIN:
                target_id = p.get("target_dataset_id", "target_table")
                left_on = p.get("left_on", "key")
                right_on = p.get("right_on", "key")
                how = (p.get("how", "inner")).upper()
                ctes.append(f"{cte_name} AS (\n    SELECT l.*, r.*\n    FROM {prev_table} l\n    {how} JOIN lakehouse_staging.{target_id} r\n        ON l.{left_on} = r.{right_on}\n)")
            elif rtype == RuleType.SPARK_SQL:
                q = p.get("query", f"SELECT * FROM {prev_table}")
                ctes.append(f"{cte_name} AS (\n    {q}\n)")
            else:
                ctes.append(f"{cte_name} AS (\n    SELECT * FROM {prev_table}\n)")

            prev_table = cte_name

        query = f"-- ====================================================================\n-- SparkLake SQL Transformation Query — Lakehouse Dataset: {dataset_name}\n-- ====================================================================\nWITH " + ",\n".join(ctes) + f"\nSELECT * FROM {prev_table};"
        return query
