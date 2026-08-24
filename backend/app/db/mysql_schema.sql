-- ====================================================================
-- DataFlow SparkLake Studio - MySQL Metadata Schema
-- ====================================================================

CREATE DATABASE IF NOT EXISTS dataflow_metadata 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE dataflow_metadata;

-- 1. Ingestion Events & Source Audit
CREATE TABLE IF NOT EXISTS dataflow_ingestion_history (
    id VARCHAR(64) PRIMARY KEY,
    source_name VARCHAR(255) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    host VARCHAR(255) NULL,
    database_name VARCHAR(255) NULL,
    table_query TEXT NULL,
    row_count INT NOT NULL DEFAULT 0,
    column_count INT NOT NULL DEFAULT 0,
    duration_ms FLOAT NOT NULL DEFAULT 0.0,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ingest_created_at (created_at),
    INDEX idx_ingest_source_type (source_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Staged Lakehouse Datasets Metadata
CREATE TABLE IF NOT EXISTS dataflow_staged_datasets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    source_type VARCHAR(64) NOT NULL,
    source_summary TEXT NOT NULL,
    row_count INT NOT NULL DEFAULT 0,
    column_count INT NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    storage_format VARCHAR(32) NOT NULL DEFAULT 'parquet',
    columns_json JSON NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_staged_created_at (created_at),
    INDEX idx_staged_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Transformation Rules Executions History
CREATE TABLE IF NOT EXISTS dataflow_transformation_history (
    id VARCHAR(64) PRIMARY KEY,
    staging_dataset_id VARCHAR(64) NOT NULL,
    rule_count INT NOT NULL DEFAULT 0,
    rules_json JSON NOT NULL,
    initial_rows INT NOT NULL DEFAULT 0,
    transformed_rows INT NOT NULL DEFAULT 0,
    execution_time_ms FLOAT NOT NULL DEFAULT 0.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_transform_dataset (staging_dataset_id),
    INDEX idx_transform_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Pipeline Jobs Execution DAGs & Exports
CREATE TABLE IF NOT EXISTS dataflow_pipeline_jobs (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    staging_dataset_id VARCHAR(64) NOT NULL,
    rules_json JSON NOT NULL,
    output_dataset_name VARCHAR(255) NULL,
    output_dataset_id VARCHAR(64) NULL,
    export_format VARCHAR(32) NOT NULL DEFAULT 'csv',
    export_path TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    progress INT NOT NULL DEFAULT 0,
    input_rows INT NOT NULL DEFAULT 0,
    output_rows INT NOT NULL DEFAULT 0,
    error TEXT NULL,
    logs_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    INDEX idx_jobs_status (status),
    INDEX idx_jobs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Universal Application Activity & Audit Logs
CREATE TABLE IF NOT EXISTS dataflow_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NULL,
    entity_type VARCHAR(64) NULL,
    summary VARCHAR(255) NOT NULL,
    details_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_event_type (event_type),
    INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
