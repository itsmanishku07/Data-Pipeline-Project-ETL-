import re
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from ..models.schemas import ColumnProfile, CastColumnRule, SparkDataTypeEnum

def map_python_pandas_type_to_spark(dtype: str, sample_series: pd.Series) -> Tuple[str, str]:
    dtype_str = str(dtype).lower()
    
    if "int64" in dtype_str or "int32" in dtype_str:
        # Check if numbers are within 32-bit integer range
        non_nulls = sample_series.dropna()
        if not non_nulls.empty and (non_nulls.max() > 2147483647 or non_nulls.min() < -2147483648):
            return "LongType", "Big Integer"
        return "IntegerType", "Integer"
    elif "float" in dtype_str or "double" in dtype_str:
        return "DoubleType", "Double / Float"
    elif "bool" in dtype_str:
        return "BooleanType", "Boolean"
    elif "datetime" in dtype_str or "timestamp" in dtype_str:
        return "TimestampType", "Timestamp"
    elif "date" in dtype_str:
        return "DateType", "Date"
    else:
        # String / Object analysis - inspect contents
        non_nulls = sample_series.dropna().astype(str).tolist()
        if not non_nulls:
            return "StringType", "String"
        
        # Check if all non-nulls match integer
        if all(re.match(r"^-?\d+$", s.strip()) for s in non_nulls[:100]):
            return "IntegerType", "Integer (Inferred from text)"
        # Check if float
        if all(re.match(r"^-?\d+\.\d+$", s.strip()) for s in non_nulls[:100]):
            return "DoubleType", "Decimal/Float (Inferred from text)"
        # Check if boolean
        if all(s.strip().lower() in ("true", "false", "1", "0", "yes", "no") for s in non_nulls[:100]):
            return "BooleanType", "Boolean (Inferred from text)"
        # Check if timestamp / date
        iso_dt_match = all(re.match(r"^\d{4}-\d{2}-\d{2}([\sT]\d{2}:\d{2}:\d{2})?.*$", s.strip()) for s in non_nulls[:100])
        if iso_dt_match:
            if any(":" in s for s in non_nulls[:20]):
                return "TimestampType", "Timestamp (Inferred from text)"
            return "DateType", "Date (Inferred from text)"

        return "StringType", "String"

def profile_dataframe(df: pd.DataFrame) -> List[ColumnProfile]:
    profiles = []
    total_rows = len(df)
    
    for col_name in df.columns:
        series = df[col_name]
        null_count = int(series.isna().sum())
        null_pct = round((null_count / total_rows * 100), 2) if total_rows > 0 else 0.0
        
        non_null_series = series.dropna()
        distinct_count = int(series.nunique(dropna=True))
        
        sample_vals = non_null_series.head(5).tolist()
        # Ensure sample values are JSON serializable
        clean_samples = []
        for val in sample_vals:
            if isinstance(val, (pd.Timestamp, datetime_type := type(pd.Timestamp.now()))):
                clean_samples.append(val.isoformat())
            elif isinstance(val, (np.integer, int)):
                clean_samples.append(int(val))
            elif isinstance(val, (np.floating, float)):
                clean_samples.append(round(float(val), 4))
            elif isinstance(val, (np.bool_, bool)):
                clean_samples.append(bool(val))
            else:
                clean_samples.append(str(val))

        min_val = None
        max_val = None
        if not non_null_series.empty:
            try:
                min_val = str(non_null_series.min())
                max_val = str(non_null_series.max())
            except Exception:
                pass

        spark_type, inferred_type = map_python_pandas_type_to_spark(series.dtype, series)

        profiles.append(ColumnProfile(
            name=str(col_name),
            spark_type=spark_type,
            inferred_type=inferred_type,
            nullable=null_count > 0,
            null_count=null_count,
            null_percentage=null_pct,
            distinct_count=distinct_count,
            sample_values=clean_samples,
            min_value=min_val,
            max_value=max_val
        ))
        
    return profiles

def apply_type_casting(df: pd.DataFrame, cast_rules: List[CastColumnRule]) -> Tuple[pd.DataFrame, List[str]]:
    df_out = df.copy()
    logs = []

    for rule in cast_rules:
        col = rule.column_name
        if col not in df_out.columns:
            logs.append(f"Skipped column {col}: not found in dataset.")
            continue

        target_type = rule.target_spark_type.strip()
        logs.append(f"Casting column '{col}' to {target_type}...")

        try:
            if "Integer" in target_type:
                if not pd.api.types.is_numeric_dtype(df_out[col]):
                    clean_s = df_out[col].astype(str).str.replace(r"[^\d\-]", "", regex=True)
                    df_out[col] = pd.to_numeric(clean_s, errors="coerce").astype("Int32")
                else:
                    df_out[col] = pd.to_numeric(df_out[col], errors="coerce").astype("Int32")
            elif "Long" in target_type:
                if not pd.api.types.is_numeric_dtype(df_out[col]):
                    clean_s = df_out[col].astype(str).str.replace(r"[^\d\-]", "", regex=True)
                    df_out[col] = pd.to_numeric(clean_s, errors="coerce").astype("Int64")
                else:
                    df_out[col] = pd.to_numeric(df_out[col], errors="coerce").astype("Int64")
            elif "Double" in target_type or "Float" in target_type or "Decimal" in target_type:
                if not pd.api.types.is_numeric_dtype(df_out[col]):
                    clean_s = df_out[col].astype(str).str.replace(r"[^\d\.\-]", "", regex=True)
                    df_out[col] = pd.to_numeric(clean_s, errors="coerce")
                else:
                    df_out[col] = pd.to_numeric(df_out[col], errors="coerce")
            elif "Boolean" in target_type:
                def to_bool(val):
                    if pd.isna(val):
                        return None
                    s = str(val).strip().lower()
                    if s in ("true", "1", "yes", "y", "t"):
                        return True
                    if s in ("false", "0", "no", "n", "f"):
                        return False
                    return None
                df_out[col] = df_out[col].apply(to_bool).astype("boolean")
            elif "Date" in target_type:
                if rule.format:
                    # Convert spark date format (yyyy-MM-dd) to python (%Y-%m-%d)
                    fmt = rule.format.replace("yyyy", "%Y").replace("MM", "%m").replace("dd", "%d")
                    df_out[col] = pd.to_datetime(df_out[col], format=fmt, errors="coerce").dt.date
                else:
                    df_out[col] = pd.to_datetime(df_out[col], errors="coerce").dt.date
            elif "Timestamp" in target_type:
                if rule.format:
                    fmt = (rule.format
                           .replace("yyyy", "%Y")
                           .replace("MM", "%m")
                           .replace("dd", "%d")
                           .replace("HH", "%H")
                           .replace("mm", "%M")
                           .replace("ss", "%S"))
                    df_out[col] = pd.to_datetime(df_out[col], format=fmt, errors="coerce")
                else:
                    df_out[col] = pd.to_datetime(df_out[col], errors="coerce")
            elif "String" in target_type:
                df_out[col] = df_out[col].astype(str).replace({"nan": None, "None": None, "<NA>": None})

            # Check null handling fallback
            if rule.default_value is not None:
                df_out[col] = df_out[col].fillna(rule.default_value)
                
            logs.append(f"Successfully cast column '{col}' to {target_type}.")
        except Exception as e:
            logs.append(f"Error casting column '{col}' to {target_type}: {str(e)}")
            
    return df_out, logs
