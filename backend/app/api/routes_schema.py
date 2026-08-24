from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from ..models.schemas import (
    SourceConnectionRequest, 
    CastColumnRule, 
    SparkDataTypeEnum,
    ColumnProfile
)
from ..connectors import get_connector
from ..engine.schema_engine import profile_dataframe, apply_type_casting
import pandas as pd

router = APIRouter(prefix="/schema", tags=["Schema & Type Casting"])

@router.get("/spark-types")
def get_supported_spark_types():
    return [
        {
            "type": "StringType",
            "category": "Text",
            "description": "Variable-length character strings.",
            "example": "\"ORD-10023\", \"Electronics\""
        },
        {
            "type": "IntegerType",
            "category": "Numeric",
            "description": "32-bit signed integer (-2,147,483,648 to 2,147,483,647).",
            "example": "42, -100"
        },
        {
            "type": "LongType",
            "category": "Numeric",
            "description": "64-bit signed integer (-9,223,372,036,854,775,808 to 9,223,372,036,854,775,807).",
            "example": "10000000000"
        },
        {
            "type": "DoubleType",
            "category": "Numeric",
            "description": "64-bit double-precision floating point number.",
            "example": "49.99, 1024.50"
        },
        {
            "type": "DecimalType(10,2)",
            "category": "Numeric",
            "description": "Exact fixed-point decimal with defined precision and scale.",
            "example": "199.95"
        },
        {
            "type": "BooleanType",
            "category": "Logical",
            "description": "Boolean values: True / False.",
            "example": "true, false"
        },
        {
            "type": "DateType",
            "category": "Temporal",
            "description": "Date without time component (YYYY-MM-DD).",
            "example": "2024-03-15"
        },
        {
            "type": "TimestampType",
            "category": "Temporal",
            "description": "Date and time with precision up to microseconds.",
            "example": "2024-03-15 14:30:00"
        }
    ]

@router.post("/validate-cast")
def validate_type_casting(source_request: SourceConnectionRequest, cast_rules: List[CastColumnRule]):
    try:
        connector = get_connector(source_request)
        df_raw = connector.extract_data(limit=100)
        df_cast, logs = apply_type_casting(df_raw, cast_rules)
        profiles = profile_dataframe(df_cast)

        preview_rows = df_cast.head(20).to_dict(orient="records")
        for r in preview_rows:
            for k, v in r.items():
                if pd.isna(v):
                    r[k] = None
                elif hasattr(v, "isoformat"):
                    r[k] = v.isoformat()

        return {
            "success": True,
            "columns": profiles,
            "preview_rows": preview_rows,
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Casting validation error: {str(e)}")
