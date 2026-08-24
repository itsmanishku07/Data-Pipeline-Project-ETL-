-- =============================================================================
-- DataFlow Studio: MySQL Metadata & Catalog Schema DDL
-- =============================================================================
-- This script creates the centralized metadata schema and all persistence tables
-- used by DataFlow Studio for tracking Data Flows, Saved Connections, Staged
-- Lakehouse Datasets, Pipeline DAG Executions, Ingestions, and Audit Trails.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dataflow_metadata 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE dataflow_metadata;

-- -----------------------------------------------------------------------------
-- 1. DATA FLOWS TABLE (dataflow_flows)
-- Tracks multi-step ETL workflows and business domain flows.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataflow_flows (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    category VARCHAR(64) DEFAULT 'General',
    status VARCHAR(32) DEFAULT 'active',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_flows_status (status),
    INDEX idx_flows_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. SAVED CONNECTIONS TABLE (dataflow_saved_connections)
-- Stores reusable source and destination credentials (MySQL, Postgres, S3, ADLS).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataflow_saved_connections (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    summary TEXT NULL,
    config_json JSON NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_conn_type (source_type),
    INDEX idx_conn_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. STAGED LAKEHOUSE DATASETS TABLE (dataflow_staged_datasets)
-- Catalog of staged Apache Parquet datasets, schema JSON profiles, and metrics.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataflow_staged_datasets (
    id VARCHAR(64) PRIMARY KEY,
    flow_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    source_type VARCHAR(64) NOT NULL,
    source_summary TEXT NULL,
    row_count INT DEFAULT 0,
    column_count INT DEFAULT 0,
    storage_path TEXT NOT NULL,
    storage_format VARCHAR(32) DEFAULT 'parquet',
    columns_json JSON NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    created_at DATETIME NOT NULL,
    INDEX idx_staged_flow (flow_id),
    INDEX idx_staged_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. PIPELINE JOBS & DAG EXECUTIONS (dataflow_pipeline_jobs)
-- Tracks Spark DAG pipeline execution runs, progress, row metrics, and logs.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataflow_pipeline_jobs (
    id VARCHAR(64) PRIMARY KEY,
    flow_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    progress FLOAT DEFAULT 0.0,
    message TEXT NULL,
    input_rows INT DEFAULT 0,
    output_rows INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    output_dataset_id VARCHAR(64) NULL,
    output_file_path TEXT NULL,
    logs_json JSON NOT NULL,
    error TEXT NULL,
    INDEX idx_jobs_flow (flow_id),
    INDEX idx_jobs_status (status),
    INDEX idx_jobs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. AUDIT & EVENT LOGS TABLE (dataflow_audit_logs)
-- Chronological audit trail of all platform activity and operations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataflow_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NULL,
    entity_type VARCHAR(64) NULL,
    summary VARCHAR(255) NOT NULL,
    details_json JSON NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_audit_event (event_type),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. INGESTION HISTORY TABLE (dataflow_ingestion_history)
-- Historical log of all raw source extractions and timing.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataflow_ingestion_history (
    id VARCHAR(64) PRIMARY KEY,
    source_name VARCHAR(255) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    host VARCHAR(255) NULL,
    database_name VARCHAR(255) NULL,
    table_query TEXT NULL,
    row_count INT DEFAULT 0,
    column_count INT DEFAULT 0,
    duration_ms FLOAT DEFAULT 0.0,
    status VARCHAR(32) DEFAULT 'SUCCESS',
    error_message TEXT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_ingest_status (status),
    INDEX idx_ingest_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. TRANSFORMATION HISTORY TABLE (dataflow_transformation_history)
-- Historical log of all PySpark transformation rules executed on datasets.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataflow_transformation_history (
    id VARCHAR(64) PRIMARY KEY,
    staging_dataset_id VARCHAR(64) NOT NULL,
    rule_count INT DEFAULT 0,
    rules_json JSON NOT NULL,
    initial_rows INT DEFAULT 0,
    transformed_rows INT DEFAULT 0,
    execution_time_ms FLOAT DEFAULT 0.0,
    created_at DATETIME NOT NULL,
    INDEX idx_tx_stage (staging_dataset_id),
    INDEX idx_tx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
