import re
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
import pandas as pd
import numpy as np
from ..models.schemas import ColumnProfile, CastColumnRule, SparkDataTypeEnum

def map_python_pandas_type_to_spark(dtype: str, sample_series: pd.Series, col_name: str = "") -> Tuple[str, str]:
    dtype_str = str(dtype).lower()
    col_name_lower = str(col_name).lower()
    
    if col_name_lower == "aud_last_update" or col_name_lower.endswith("_at") or col_name_lower.endswith("_timestamp"):
        return "TimestampType", "Audit Timestamp"

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
            if isinstance(val, (pd.Timestamp, datetime)):
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

        spark_type, inferred_type = map_python_pandas_type_to_spark(series.dtype, series, col_name=str(col_name))

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
            logs.append(f"Error casting column '{col}': column not found in dataset.")
            continue

        target_type = rule.target_spark_type.strip()
        logs.append(f"Casting column '{col}' to {target_type}...")

        try:
            normalized_type = target_type.lower()
            original = df_out[col]
            non_null = original.notna()

            if normalized_type in {"integertype", "integer", "int", "shorttype", "short"}:
                converted = pd.to_numeric(original, errors="coerce")
                if (converted[non_null].isna()).any():
                    raise ValueError("one or more non-null values are not valid integers")
                if ((converted.dropna() % 1) != 0).any():
                    raise ValueError("one or more values contain a fractional part")
                df_out[col] = converted.astype("Int32")
            elif normalized_type in {"longtype", "long", "bigint"}:
                converted = pd.to_numeric(original, errors="coerce")
                if (converted[non_null].isna()).any():
                    raise ValueError("one or more non-null values are not valid integers")
                if ((converted.dropna() % 1) != 0).any():
                    raise ValueError("one or more values contain a fractional part")
                df_out[col] = converted.astype("Int64")
            elif normalized_type in {"doubletype", "double", "floattype", "float", "decimaltype", "decimal"}:
                converted = pd.to_numeric(original, errors="coerce")
                if (converted[non_null].isna()).any():
                    raise ValueError("one or more non-null values are not numeric")
                df_out[col] = converted
            elif normalized_type in {"booleantype", "boolean", "bool"}:
                def to_bool(val):
                    if pd.isna(val):
                        return None
                    s = str(val).strip().lower()
                    if s in ("true", "1", "yes", "y", "t"):
                        return True
                    if s in ("false", "0", "no", "n", "f"):
                        return False
                    raise ValueError(f"'{val}' is not a recognized boolean value")
                df_out[col] = original.apply(to_bool).astype("boolean")
            elif normalized_type in {"datetype", "date"}:
                if rule.format and rule.format.strip():
                    fmt = _spark_datetime_format_to_python(rule.format.strip())
                    parsed = pd.to_datetime(df_out[col], format=fmt, errors="coerce")
                    if (non_null & parsed.isna()).any():
                        raise ValueError(f"some non-null values do not match date format '{rule.format}'")
                    df_out[col] = parsed.dt.date
                else:
                    parsed = pd.to_datetime(original, errors="coerce")
                    if (non_null & parsed.isna()).any():
                        raise ValueError("some non-null values are not valid dates")
                    df_out[col] = parsed.dt.date
            elif normalized_type in {"timestamptype", "timestamp"}:
                if rule.format and rule.format.strip():
                    fmt = _spark_datetime_format_to_python(rule.format.strip())
                    parsed = pd.to_datetime(df_out[col], format=fmt, errors="coerce")
                    if (non_null & parsed.isna()).any():
                        raise ValueError(f"some non-null values do not match timestamp format '{rule.format}'")
                    df_out[col] = parsed
                else:
                    parsed = pd.to_datetime(original, errors="coerce")
                    if (non_null & parsed.isna()).any():
                        raise ValueError("some non-null values are not valid timestamps")
                    df_out[col] = parsed
            elif normalized_type in {"stringtype", "string"}:
                df_out[col] = original.astype("string")
            else:
                raise ValueError(f"Unsupported target type '{target_type}'.")

            # Check null handling fallback
            if rule.default_value is not None:
                df_out[col] = df_out[col].fillna(rule.default_value)
            logs.append(f"Successfully cast column '{col}' to {target_type}.")
        except Exception as e:
            logs.append(f"Error casting column '{col}' to {target_type}: {str(e)}")
    return df_out, logs


def _spark_datetime_format_to_python(fmt: str) -> str:
    """Translate common Spark/JVM date tokens to Python strptime tokens."""
    tokens = {
        "yyyy": "%Y", "yy": "%y", "MM": "%m", "dd": "%d",
        "HH": "%H", "hh": "%I", "mm": "%M", "ss": "%S",
        "SSS": "%f", "a": "%p",
    }
    pattern = re.compile("|".join(re.escape(token) for token in sorted(tokens, key=len, reverse=True)))
    return pattern.sub(lambda match: tokens[match.group(0)], fmt)
