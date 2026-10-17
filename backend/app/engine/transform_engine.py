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
                next_df = TransformationEngine._apply_rule(current_df.copy(), rule)
                current_df = next_df
            except Exception as e:
                error_msg = str(e)
                
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
        failed_steps = [step for step in step_summaries if step["status"] == "FAILED"]
        if failed_steps:
            details = "; ".join(
                f"Step {step['step_index']} ({step['rule_type']}): {step['error']}"
                for step in failed_steps
            )
            raise ValueError(f"Transformation execution failed: {details}")
        return current_df, step_summaries, exec_time_ms

    @staticmethod
    def _apply_rule(df: pd.DataFrame, rule: TransformationRule) -> pd.DataFrame:
        rtype = rule.rule_type
        params = rule.params

        if rtype == RuleType.FILTER:
            condition = params.get("condition", "")
            if not condition or not condition.strip():
                raise ValueError("Filter condition is required.")
            with duckdb.connect(":memory:") as con:
                con.register("current_df", df)
                df = con.execute(f"SELECT * FROM current_df WHERE {condition}").df()

        elif rtype == RuleType.DROP_COLUMNS:
            cols_to_drop = params.get("columns", [])
            missing = [c for c in cols_to_drop if c not in df.columns]
            if missing:
                raise KeyError(f"Column(s) to drop not found: {', '.join(missing)}")
            if cols_to_drop:
                df = df.drop(columns=cols_to_drop)

        elif rtype == RuleType.SELECT_COLUMNS:
            cols_to_keep = params.get("columns", [])
            if not cols_to_keep:
                raise ValueError("Select Columns requires at least one column.")
            missing = [c for c in cols_to_keep if c not in df.columns]
            if missing:
                raise KeyError(f"Selected column(s) not found: {', '.join(missing)}")
            df = df[cols_to_keep]

        elif rtype == RuleType.RENAME_COLUMN:
            old_name = params.get("old_name")
            new_name = params.get("new_name")
            if not old_name or not new_name:
                raise ValueError("Both old_name and new_name are required.")
            if old_name not in df.columns:
                raise KeyError(f"Column '{old_name}' not found.")
            if new_name in df.columns and new_name != old_name:
                raise ValueError(f"Column '{new_name}' already exists.")
            df = df.rename(columns={old_name: new_name})

        elif rtype == RuleType.FILL_NA:
            col = params.get("column")
            fill_value = params.get("value")
            strategy = params.get("strategy", "constant") # constant, mean, mode, ffill

            if col and col in df.columns:
                if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].mean())
                elif strategy == "mean":
                    raise ValueError("Mean fill strategy requires a numeric column.")
                elif strategy == "mode":
                    mode_val = df[col].mode()
                    if not mode_val.empty:
                        df[col] = df[col].fillna(mode_val[0])
                elif strategy == "ffill":
                    df[col] = df[col].ffill()
                elif strategy == "constant":
                    if fill_value is None:
                        raise ValueError("Constant fill strategy requires a fill value.")
                    df[col] = df[col].fillna(fill_value)
                else:
                    raise ValueError(f"Unsupported fill strategy '{strategy}'.")
            elif col:
                raise KeyError(f"Column '{col}' not found.")
            elif not col and fill_value is not None:
                df = df.fillna(fill_value)
            else:
                raise ValueError("Fill Nulls requires a column or a fill value for all columns.")

        elif rtype == RuleType.DROP_NA:
            cols = params.get("columns", [])
            how = params.get("how", "any") # any, all
            if how not in ("any", "all"):
                raise ValueError("Drop Nulls 'how' must be 'any' or 'all'.")
            if cols:
                missing = [c for c in cols if c not in df.columns]
                if missing:
                    raise KeyError(f"Column(s) not found: {', '.join(missing)}")
                df = df.dropna(subset=cols, how=how)
            else:
                df = df.dropna(how=how)

        elif rtype == RuleType.STRING_TRANSFORM:
            col = params.get("column")
            op = params.get("operation") # trim, upper, lower, title, regex_replace
            if col and col in df.columns:
                s = df[col].astype("string")
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
                else:
                    raise ValueError(f"Unsupported string operation '{op}'.")
            else:
                raise KeyError(f"Column '{col}' not found." if col else "String transform requires a column.")

        elif rtype == RuleType.CAST_TYPE:
            col = params.get("column")
            target_type = params.get("target_type")
            fmt = params.get("format")
            if col and target_type:
                cast_rule = CastColumnRule(column_name=col, target_spark_type=target_type, format=fmt)
                df, cast_logs = apply_type_casting(df, [cast_rule])
                errors = [message for message in cast_logs if message.startswith("Error casting")]
                if errors:
                    raise ValueError("; ".join(errors))
            else:
                raise ValueError("Cast Type requires a column and target type.")

        elif rtype == RuleType.DERIVED_COLUMN:
            col_name = params.get("column_name")
            expression = params.get("expression") # e.g. "unit_price * quantity", "ROUND(amount * 0.1, 2)"
            if col_name and expression:
                with duckdb.connect(":memory:") as con:
                    con.register("current_df", df)
                    query = f"SELECT * EXCLUDE (\"{col_name}\"), ({expression}) AS \"{col_name}\" FROM current_df" if col_name in df.columns else f"SELECT *, ({expression}) AS \"{col_name}\" FROM current_df"
                    df = con.execute(query).df()
            else:
                raise ValueError("Derived Column requires a name and expression.")

        elif rtype == RuleType.AGGREGATE:
            group_by_cols = params.get("group_by", [])
            aggs = params.get("aggregations", []) # list of {column, op, alias}
            
            if aggs:
                missing = [c for c in group_by_cols if c not in df.columns]
                missing.extend(a.get("column") for a in aggs if a.get("op", "sum").upper() != "COUNT" and a.get("column") not in df.columns)
                if missing:
                    raise KeyError(f"Aggregation column(s) not found: {', '.join(str(c) for c in missing)}")
                supported_ops = {"SUM", "AVG", "MEAN", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"}
                invalid_ops = [a.get("op", "sum").upper() for a in aggs if a.get("op", "sum").upper() not in supported_ops]
                if invalid_ops:
                    raise ValueError(f"Unsupported aggregation operation(s): {', '.join(invalid_ops)}")
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
                
                with duckdb.connect(":memory:") as con:
                    con.register("current_df", df)
                    df = con.execute(query).df()
            else:
                raise ValueError("Aggregate requires at least one aggregation.")

        elif rtype == RuleType.WINDOW_FUNCTION:
            func_type = (params.get("function_type") or "row_number").upper()
            target_col = params.get("target_column") or f"{func_type.lower()}_col"
            val_col = params.get("value_column")
            partition_by = params.get("partition_by", [])
            order_by = params.get("order_by", "")
            order_dir = (params.get("order_direction") or "ASC").upper()
            offset = params.get("offset", 1)

            allowed_functions = {"ROW_NUMBER", "RANK", "DENSE_RANK", "LEAD", "LAG", "SUM", "AVG", "MIN", "MAX", "FIRST_VALUE", "LAST_VALUE"}
            if func_type not in allowed_functions:
                raise ValueError(f"Unsupported window function '{func_type}'.")
            needed_cols = list(partition_by)
            if order_by:
                needed_cols.append(order_by)
            if val_col and func_type not in {"ROW_NUMBER", "RANK", "DENSE_RANK"}:
                needed_cols.append(val_col)
            missing = [c for c in needed_cols if c not in df.columns]
            if missing:
                raise KeyError(f"Window function column(s) not found: {', '.join(missing)}")
            if order_dir not in {"ASC", "DESC"}:
                raise ValueError("Window order_direction must be ASC or DESC.")
            try:
                offset = int(offset)
            except (TypeError, ValueError) as exc:
                raise ValueError("Window offset must be an integer.") from exc
            if offset < 0:
                raise ValueError("Window offset must be non-negative.")

            if func_type in ["ROW_NUMBER", "RANK", "DENSE_RANK"]:
                func_expr = f"{func_type}()"
            elif func_type in ["LEAD", "LAG"]:
                func_expr = f"{func_type}(\"{val_col}\", {offset})" if val_col else f"{func_type}(1)"
            elif func_type in ["SUM", "AVG", "MIN", "MAX", "FIRST_VALUE", "LAST_VALUE"]:
                func_expr = f"{func_type}(\"{val_col}\")" if val_col else "COUNT(*)"
            else:
                func_expr = "ROW_NUMBER()"

            over_parts = []
            if partition_by:
                over_parts.append(f"PARTITION BY {', '.join([f'\"{c}\"' for c in partition_by])}")
            if order_by:
                over_parts.append(f"ORDER BY \"{order_by}\" {order_dir}")

            over_clause = f"OVER ({' '.join(over_parts)})"
            query = f"SELECT *, {func_expr} {over_clause} AS \"{target_col}\" FROM current_df"

            with duckdb.connect(":memory:") as con:
                con.register("current_df", df)
                df = con.execute(query).df()

        elif rtype == RuleType.DEDUPLICATE:
            cols = params.get("columns", [])
            missing = [c for c in cols if c not in df.columns]
            if missing:
                raise KeyError(f"Deduplication column(s) not found: {', '.join(missing)}")
            keep = params.get("keep", "first")
            if keep == "none":
                keep = False
            if keep not in ("first", "last", False):
                raise ValueError("Deduplicate keep must be 'first', 'last', or 'none'.")
            df = df.drop_duplicates(subset=cols or None, keep=keep)

        elif rtype == RuleType.SPARK_SQL:
            sql_query = params.get("query", "")
            if sql_query:
                # Normalize table aliases
                sql_query = re.sub(r"\bdf\b", "current_df", sql_query, flags=re.IGNORECASE)
                sql_query = re.sub(r"\bstaged_data\b", "current_df", sql_query, flags=re.IGNORECASE)
                with duckdb.connect(":memory:") as con:
                    con.register("current_df", df)
                    df = con.execute(sql_query).df()
            else:
                raise ValueError("Custom SQL query is required.")

        elif rtype == RuleType.JOIN:
            target_ds_id = params.get("target_dataset_id")
            left_on = params.get("left_on")
            right_on = params.get("right_on")
            how = (params.get("how") or "inner").lower()
            suffix_left = params.get("suffix_left", "")
            suffix_right = params.get("suffix_right", "_joined")
            selected_columns = params.get("selected_columns", None)

            if how not in {"inner", "left", "right", "outer", "cross"}:
                raise ValueError(f"Unsupported join type '{how}'.")
            if not target_ds_id or (how != "cross" and (not left_on or not right_on)):
                raise ValueError("Join requires a target dataset and join keys (except for cross joins).")
            if target_ds_id:
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
                    missing_selected = [c for c in selected_columns if c not in df_target.columns]
                    if missing_selected:
                        raise KeyError(f"Selected target column(s) not found: {', '.join(missing_selected)}")
                    cols_to_keep = list(dict.fromkeys(([right_on] if right_on else []) + selected_columns))
                    df_target = df_target[cols_to_keep]

                # Harmonize key types to prevent merge type mismatch
                if how != "cross" and df[left_on].dtype != df_target[right_on].dtype:
                    try:
                        df_target[right_on] = df_target[right_on].astype(df[left_on].dtype)
                    except Exception:
                        df[left_on] = df[left_on].astype(str)
                        df_target[right_on] = df_target[right_on].astype(str)

                # Merge DataFrames cleanly
                if how == "cross":
                    df = df.merge(df_target, how="cross", suffixes=(suffix_left, suffix_right))
                elif left_on == right_on:
                    df = df.merge(
                        df_target,
                        on=left_on,
                        how=how,
                        suffixes=(suffix_left, suffix_right)
                    )
                else:
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
                elif rtype == RuleType.AGGREGATE:
                    group_by = p.get("group_by", [])
                    aggs = p.get("aggregations", [])
                    grp_str = ", ".join([f"'{c}'" for c in group_by])
                    agg_calls = []
                    for a in aggs:
                        col = a.get("column", "col")
                        op = (a.get("op") or "sum").lower()
                        alias = a.get("alias") or f"{op}_{col}"
                        if op == "count_distinct":
                            agg_calls.append(f"F.countDistinct('{col}').alias('{alias}')")
                        elif op == "stddev":
                            agg_calls.append(f"F.stddev('{col}').alias('{alias}')")
                        else:
                            agg_calls.append(f"F.{op}('{col}').alias('{alias}')")
                    if grp_str:
                        lines.append(f"df = df.groupBy({grp_str}).agg({', '.join(agg_calls)})")
                    else:
                        lines.append(f"df = df.agg({', '.join(agg_calls)})")
                elif rtype == RuleType.WINDOW_FUNCTION:
                    func_type = (p.get("function_type") or "row_number").lower()
                    target_col = p.get("target_column") or f"{func_type}_col"
                    val_col = p.get("value_column")
                    partition_by = p.get("partition_by", [])
                    order_by = p.get("order_by", "")
                    order_dir = (p.get("order_direction") or "asc").lower()
                    offset = p.get("offset", 1)

                    win_parts = []
                    if partition_by:
                        part_cols = ", ".join([f"'{c}'" for c in partition_by])
                        win_parts.append(f"Window.partitionBy({part_cols})")
                    else:
                        win_parts.append("Window")
                    if order_by:
                        win_parts.append(f"orderBy(F.col('{order_by}').{order_dir}())")

                    win_spec = ".".join(win_parts)
                    if not partition_by and not order_by:
                        win_spec = "Window.partitionBy()"

                    if func_type == "row_number":
                        call_expr = f"F.row_number().over({win_spec})"
                    elif func_type == "rank":
                        call_expr = f"F.rank().over({win_spec})"
                    elif func_type == "dense_rank":
                        call_expr = f"F.dense_rank().over({win_spec})"
                    elif func_type in ["lead", "lag"]:
                        call_expr = f"F.{func_type}('{val_col}', {offset}).over({win_spec})"
                    else:
                        call_expr = f"F.{func_type}('{val_col}').over({win_spec})"

                    lines.append("from pyspark.sql.window import Window")
                    lines.append(f"df = df.withColumn('{target_col}', {call_expr})")
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
            elif rtype == RuleType.SELECT_COLUMNS:
                cols = p.get("columns", [])
                cols_str = ", ".join([f'"{c}"' for c in cols]) if cols else "*"
                ctes.append(f"{cte_name} AS (\n    SELECT {cols_str}\n    FROM {prev_table}\n)")
            elif rtype == RuleType.DROP_COLUMNS:
                cols = p.get("columns", [])
                exclude_str = f" EXCLUDE ({', '.join([f'\"{c}\"' for c in cols])})" if cols else ""
                ctes.append(f"{cte_name} AS (\n    SELECT *{exclude_str}\n    FROM {prev_table}\n)")
            elif rtype == RuleType.AGGREGATE:
                group_by = p.get("group_by", [])
                aggs = p.get("aggregations", [])
                select_parts = [f'"{c}"' for c in group_by]
                for a in aggs:
                    col = a.get("column", "col")
                    op = (a.get("op") or "SUM").upper()
                    alias = a.get("alias") or f"{op.lower()}_{col}"
                    if op == "COUNT_DISTINCT":
                        select_parts.append(f'COUNT(DISTINCT "{col}") AS "{alias}"')
                    else:
                        select_parts.append(f'{op}("{col}") AS "{alias}"')
                grp_clause = f" GROUP BY {', '.join([f'\"{c}\"' for c in group_by])}" if group_by else ""
                ctes.append(f"{cte_name} AS (\n    SELECT {', '.join(select_parts)} FROM {prev_table}{grp_clause}\n)")
            elif rtype == RuleType.WINDOW_FUNCTION:
                func_type = (p.get("function_type") or "ROW_NUMBER").upper()
                target_col = p.get("target_column") or f"{func_type.lower()}_col"
                val_col = p.get("value_column")
                partition_by = p.get("partition_by", [])
                order_by = p.get("order_by", "")
                order_dir = (p.get("order_direction") or "ASC").upper()
                offset = p.get("offset", 1)

                if func_type in ["ROW_NUMBER", "RANK", "DENSE_RANK"]:
                    f_expr = f"{func_type}()"
                elif func_type in ["LEAD", "LAG"]:
                    f_expr = f'{func_type}("{val_col}", {offset})' if val_col else f"{func_type}(1)"
                else:
                    f_expr = f'{func_type}("{val_col}")' if val_col else "COUNT(*)"

                over_parts = []
                if partition_by:
                    over_parts.append(f"PARTITION BY {', '.join([f'\"{c}\"' for c in partition_by])}")
                if order_by:
                    over_parts.append(f"ORDER BY \"{order_by}\" {order_dir}")

                over_clause = f"OVER ({' '.join(over_parts)})"
                ctes.append(f"{cte_name} AS (\n    SELECT *, {f_expr} {over_clause} AS \"{target_col}\"\n    FROM {prev_table}\n)")
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
