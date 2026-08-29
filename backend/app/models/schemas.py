from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class SourceType(str, Enum):
    S3 = "s3"
    AZURE_LAKEHOUSE = "azure_lakehouse"
    DATABASE = "database"
    LOCAL_CATALOG = "local_catalog"
    FILE_UPLOAD = "file_upload"
    TRANSFORMED_PIPELINE = "transformed_pipeline"

class FileFormat(str, Enum):
    CSV = "csv"
    PARQUET = "parquet"
    JSON = "json"
    DELTA = "delta"

class DatabaseType(str, Enum):
    POSTGRES = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    SQLSERVER = "sqlserver"
    DUCKDB = "duckdb"

class SparkDataTypeEnum(str, Enum):
    STRING = "StringType"
    INTEGER = "IntegerType"
    LONG = "LongType"
    DOUBLE = "DoubleType"
    DECIMAL = "DecimalType(10,2)"
    BOOLEAN = "BooleanType"
    DATE = "DateType"
    TIMESTAMP = "TimestampType"
    BINARY = "BinaryType"

# Flow Management Models
class DataFlow(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "General"
    status: Optional[str] = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class CreateFlowRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "General"

class FlowSummary(BaseModel):
    id: str
    name: str
    description: str
    category: str
    status: str
    dataset_count: int = 0
    total_rows: int = 0
    created_at: datetime
    stages: List[Dict[str, Any]] = []

# Source Configurations
class S3SourceConfig(BaseModel):
    bucket: str = Field(..., description="S3 Bucket Name")
    key_prefix: str = Field("", description="Path or key prefix (e.g. data/sales.parquet)")
    region: str = Field("us-east-1", description="AWS Region")
    access_key: Optional[str] = Field(None, description="AWS Access Key ID")
    secret_key: Optional[str] = Field(None, description="AWS Secret Access Key")
    endpoint_url: Optional[str] = Field(None, description="Custom S3 / MinIO endpoint URL")
    file_format: FileFormat = FileFormat.CSV
    delimiter: str = ","
    has_header: bool = True

class AzureLakehouseConfig(BaseModel):
    account_name: str = Field(..., description="Azure Storage Account Name")
    container_name: str = Field(..., description="ADLS Gen2 Container / Filesystem")
    path: str = Field(..., description="Path within container (e.g. lakehouse/tables/customers)")
    account_key: Optional[str] = Field(None, description="Azure Account Key")
    sas_token: Optional[str] = Field(None, description="Shared Access Signature Token")
    connection_string: Optional[str] = Field(None, description="Azure Storage Connection String")
    file_format: FileFormat = FileFormat.DELTA

class DatabaseSourceConfig(BaseModel):
    db_type: DatabaseType = DatabaseType.POSTGRES
    host: Optional[str] = "localhost"
    port: Optional[int] = 5432
    database: Optional[str] = "public"
    username: Optional[str] = None
    password: Optional[str] = None
    table_name: Optional[str] = None
    query: Optional[str] = None
    sqlite_path: Optional[str] = None

class LocalSourceConfig(BaseModel):
    dataset_id: Optional[str] = Field(None, description="Pre-seeded dataset identifier (e.g. ecommerce_orders, customer_360)")
    file_path: Optional[str] = None
    file_format: FileFormat = FileFormat.CSV
    delimiter: str = ","
    has_header: bool = True

class SourceConnectionRequest(BaseModel):
    source_type: SourceType
    name: str
    description: Optional[str] = ""
    s3_config: Optional[S3SourceConfig] = None
    azure_config: Optional[AzureLakehouseConfig] = None
    database_config: Optional[DatabaseSourceConfig] = None
    local_config: Optional[LocalSourceConfig] = None

# Schema & Profiling Models
class ColumnProfile(BaseModel):
    name: str
    spark_type: str
    nullable: bool = True
    null_count: int = 0
    null_percentage: float = 0.0
    distinct_count: int = 0
    sample_values: List[Any] = []
    min_value: Optional[str] = None
    max_value: Optional[str] = None

class SchemaInspectionResult(BaseModel):
    source_name: str
    source_type: Union[SourceType, str]
    row_count: int
    column_count: int
    columns: List[ColumnProfile]
    preview_rows: List[Dict[str, Any]]
    inferred_at: datetime = Field(default_factory=datetime.utcnow)

class CastColumnRule(BaseModel):
    column_name: str
    target_spark_type: str
    format: Optional[str] = Field(None, description="Optional date/timestamp parsing format like 'yyyy-MM-dd HH:mm:ss'")
    null_handling: Optional[str] = Field("null_on_error", description="'keep', 'null_on_error', or 'default'")
    default_value: Optional[Any] = None

class StageDatasetRequest(BaseModel):
    source_request: SourceConnectionRequest
    dataset_name: str
    description: Optional[str] = ""
    flow_id: Optional[str] = None
    cast_rules: List[CastColumnRule] = []

# Staging Metadata & Preview
class StagedDatasetInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    flow_id: Optional[str] = None
    source_type: Union[SourceType, str]
    source_summary: str
    row_count: int
    column_count: int
    storage_path: str
    storage_format: str
    created_at: datetime
    columns: List[ColumnProfile]
    file_size_bytes: int = 0

class StagedDataPreview(BaseModel):
    dataset_id: str
    name: str
    total_rows: int
    page: int
    page_size: int
    columns: List[str]
    schema_profiles: List[ColumnProfile]
    rows: List[Dict[str, Any]]

# Transformation Engine Models
class RuleType(str, Enum):
    FILTER = "filter"
    DROP_COLUMNS = "drop_columns"
    SELECT_COLUMNS = "select_columns"
    RENAME_COLUMN = "rename_column"
    FILL_NA = "fill_na"
    DROP_NA = "drop_na"
    STRING_TRANSFORM = "string_transform"
    CAST_TYPE = "cast_type"
    DERIVED_COLUMN = "derived_column"
    AGGREGATE = "aggregate"
    WINDOW_FUNCTION = "window_function"
    DEDUPLICATE = "deduplicate"
    SPARK_SQL = "spark_sql"
    JOIN = "join"

class TransformationRule(BaseModel):
    id: str
    rule_type: RuleType
    params: Dict[str, Any]
    description: Optional[str] = ""
    enabled: bool = True

class PreviewTransformRequest(BaseModel):
    staging_dataset_id: str
    rules: List[TransformationRule]
    limit: int = 50

class TransformPreviewResult(BaseModel):
    initial_rows: int
    transformed_rows: int
    columns: List[ColumnProfile]
    preview_rows: List[Dict[str, Any]]
    execution_time_ms: float
    spark_plan: Optional[str] = None
    step_summaries: List[Dict[str, Any]] = []
    generated_pyspark_code: Optional[str] = None
    generated_sql_query: Optional[str] = None

# Destination Export Engine Models
class DestinationTypeEnum(str, Enum):
    LAKEHOUSE = "lakehouse"
    DATABASE = "database"
    S3 = "s3"
    AZURE = "azure"

class DatabaseDestinationConfig(BaseModel):
    db_type: str = "mysql"  # 'mysql', 'postgresql', 'sqlserver'
    host: str = "localhost"
    port: int = 3306
    database: str
    schema_name: Optional[str] = None
    username: Optional[str] = "root"
    password: Optional[str] = ""
    table_name: str
    write_mode: str = "replace"  # 'replace', 'append', 'fail'
    create_database_if_not_exists: bool = True
    create_schema_if_not_exists: bool = True

class S3DestinationConfig(BaseModel):
    bucket: str
    key_prefix: str
    region: str = "us-east-1"
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    file_format: str = "parquet"

class AzureDestinationConfig(BaseModel):
    account_name: str
    container_name: str
    path: str
    account_key: Optional[str] = None
    file_format: str = "parquet"

class ExportDestinationRequest(BaseModel):
    destination_type: DestinationTypeEnum = DestinationTypeEnum.LAKEHOUSE
    database_dest: Optional[DatabaseDestinationConfig] = None
    s3_dest: Optional[S3DestinationConfig] = None
    azure_dest: Optional[AzureDestinationConfig] = None

class PipelineExecutionRequest(BaseModel):
    name: str
    staging_dataset_id: str
    rules: List[TransformationRule]
    output_dataset_name: str
    output_description: Optional[str] = ""
    flow_id: Optional[str] = None
    stage_output: bool = True
    export_format: Optional[FileFormat] = None
    destination_config: Optional[ExportDestinationRequest] = None

# Job Execution Status
class JobStatusEnum(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class JobStatus(BaseModel):
    id: str
    name: str
    status: JobStatusEnum
    progress: float = 0.0
    message: str = ""
    input_rows: int = 0
    output_rows: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    output_dataset_id: Optional[str] = None
    output_file_path: Optional[str] = None
    logs: List[str] = []
    error: Optional[str] = None
