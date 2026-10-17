"""
Integration tests for end-to-end data pipeline workflows.

Run tests with: pytest tests/test_integration.py -v
"""

import pytest
import pandas as pd
from datetime import datetime
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.db_models import CatalogDB, get_db_connection, init_db
from app.services.data_store import DataStoreEngine
from app.engine.schema_engine import profile_dataframe


class TestDatabaseIntegration:
    """Integration tests for database operations."""
    
    @classmethod
    def setup_class(cls):
        """Setup test database."""
        try:
            init_db()
        except Exception as e:
            pytest.skip(f"Database not available: {e}")
    
    def test_database_connection(self):
        """Test database connectivity."""
        db_type, engine = get_db_connection()
        assert engine is not None, "Database engine should be connected"
        assert db_type in ['mysql', 'postgres'], "Should connect to MySQL or PostgreSQL"
    
    def test_flow_crud_operations(self):
        """Test create, read, update, delete operations for flows."""
        # Create flow
        flow_data = {
            'name': 'Test Integration Flow',
            'description': 'Integration test flow',
            'category': 'Testing',
            'sync_mode': 'full',
            'watermark_column': 'aud_last_update'
        }
        
        flow = CatalogDB.create_flow(flow_data)
        assert flow is not None
        assert flow['name'] == 'Test Integration Flow'
        flow_id = flow['id']
        
        # Read flow
        retrieved_flow = CatalogDB.get_flow(flow_id)
        assert retrieved_flow is not None
        assert retrieved_flow['name'] == 'Test Integration Flow'
        
        # Update flow
        updates = {'description': 'Updated description'}
        updated_flow = CatalogDB.update_flow(flow_id, updates)
        assert updated_flow['description'] == 'Updated description'
        
        # Delete flow
        CatalogDB.delete_flow(flow_id)
        deleted_flow = CatalogDB.get_flow(flow_id)
        assert deleted_flow is None


class TestDataStoreIntegration:
    """Integration tests for data storage operations."""
    
    @classmethod
    def setup_class(cls):
        """Setup test database."""
        try:
            init_db()
        except Exception as e:
            pytest.skip(f"Database not available: {e}")
    
    def test_save_and_retrieve_dataframe(self):
        """Test saving and retrieving staged data."""
        # Create test dataframe
        df = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'name': ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],
            'value': [100, 200, 150, 300, 250],
            'aud_last_update': [datetime.utcnow()] * 5
        })
        
        dataset_id = f'test_dataset_{int(datetime.utcnow().timestamp())}'
        
        # Save dataframe
        storage_path, storage_format, size_bytes, row_count, watermark = \
            DataStoreEngine.save_staged_dataframe(
                dataset_id=dataset_id,
                df=df,
                sync_mode='full'
            )
        
        assert row_count == 5
        assert storage_path is not None
        
        # Retrieve dataframe
        retrieved_df = DataStoreEngine.load_staged_dataframe(dataset_id)
        assert len(retrieved_df) == 5
        assert list(retrieved_df.columns) == list(df.columns)
    
    def test_incremental_append(self):
        """Test incremental append sync mode."""
        dataset_id = f'test_append_{int(datetime.utcnow().timestamp())}'
        
        # Initial load
        df1 = pd.DataFrame({
            'id': [1, 2, 3],
            'value': [100, 200, 300],
            'aud_last_update': [datetime.utcnow()] * 3
        })
        
        _, _, _, count1, _ = DataStoreEngine.save_staged_dataframe(
            dataset_id=dataset_id,
            df=df1,
            sync_mode='full'
        )
        assert count1 == 3
        
        # Incremental append
        df2 = pd.DataFrame({
            'id': [4, 5],
            'value': [400, 500],
            'aud_last_update': [datetime.utcnow()] * 2
        })
        
        _, _, _, count2, _ = DataStoreEngine.save_staged_dataframe(
            dataset_id=dataset_id,
            df=df2,
            sync_mode='incremental_append'
        )
        assert count2 == 5  # Total count should be 5
        
        # Verify total records
        retrieved_df = DataStoreEngine.load_staged_dataframe(dataset_id)
        assert len(retrieved_df) == 5


class TestSchemaProfilingIntegration:
    """Integration tests for schema profiling."""
    
    def test_profile_mixed_types(self):
        """Test profiling dataframe with mixed data types."""
        df = pd.DataFrame({
            'int_col': [1, 2, 3, 4, 5],
            'float_col': [1.1, 2.2, 3.3, 4.4, 5.5],
            'string_col': ['a', 'b', 'c', 'd', 'e'],
            'bool_col': [True, False, True, False, True],
            'timestamp_col': [datetime.utcnow()] * 5,
            'null_col': [None, None, None, None, None]
        })
        
        profiles = profile_dataframe(df)
        
        assert len(profiles) == 6
        
        # Verify each column profile
        profile_dict = {p.column_name: p for p in profiles}
        
        assert profile_dict['int_col'].inferred_spark_type == 'IntegerType'
        assert profile_dict['float_col'].inferred_spark_type == 'DoubleType'
        assert profile_dict['string_col'].inferred_spark_type == 'StringType'
        assert profile_dict['bool_col'].inferred_spark_type == 'BooleanType'
        assert profile_dict['timestamp_col'].inferred_spark_type == 'TimestampType'
        assert profile_dict['null_col'].null_count == 5
    
    def test_profile_large_dataset(self):
        """Test profiling larger dataset."""
        df = pd.DataFrame({
            'id': range(1000),
            'category': ['A', 'B', 'C'] * 333 + ['A'],
            'value': [i * 1.5 for i in range(1000)]
        })
        
        profiles = profile_dataframe(df)
        
        assert len(profiles) == 3
        
        id_profile = next(p for p in profiles if p.column_name == 'id')
        assert id_profile.distinct_count == 1000
        
        category_profile = next(p for p in profiles if p.column_name == 'category')
        assert category_profile.distinct_count == 3


class TestPipelineWorkflow:
    """Integration tests for complete pipeline workflows."""
    
    @classmethod
    def setup_class(cls):
        """Setup test environment."""
        try:
            init_db()
        except Exception as e:
            pytest.skip(f"Database not available: {e}")
    
    def test_complete_pipeline_flow(self):
        """Test complete end-to-end pipeline flow."""
        # 1. Create flow
        flow_data = {
            'name': 'Complete Pipeline Test',
            'description': 'End-to-end test',
            'category': 'Testing',
            'sync_mode': 'full'
        }
        flow = CatalogDB.create_flow(flow_data)
        flow_id = flow['id']
        
        # 2. Create and stage data
        df = pd.DataFrame({
            'order_id': [1, 2, 3, 4, 5],
            'customer': ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],
            'amount': [100.50, 200.75, 150.25, 300.00, 250.50],
            'order_date': [datetime.utcnow()] * 5,
            'aud_last_update': [datetime.utcnow()] * 5
        })
        
        dataset_id = f'test_pipeline_{int(datetime.utcnow().timestamp())}'
        
        # 3. Save staged data
        storage_path, _, _, row_count, _ = DataStoreEngine.save_staged_dataframe(
            dataset_id=dataset_id,
            df=df,
            flow_id=flow_id,
            sync_mode='full'
        )
        
        assert row_count == 5
        
        # 4. Profile schema
        profiles = profile_dataframe(df)
        assert len(profiles) == 5
        
        # 5. Save dataset metadata
        dataset_info = {
            'id': dataset_id,
            'flow_id': flow_id,
            'name': 'Test Pipeline Dataset',
            'description': 'Testing dataset',
            'source_type': 'test',
            'source_summary': 'Test data',
            'sync_mode': 'full',
            'watermark_column': 'aud_last_update',
            'row_count': row_count,
            'column_count': len(df.columns),
            'storage_path': storage_path,
            'storage_format': 'database_table',
            'created_at': datetime.utcnow(),
            'columns': profiles,
            'file_size_bytes': 0
        }
        
        CatalogDB.save_staged_dataset(dataset_info)
        
        # 6. Verify dataset saved
        datasets = CatalogDB.list_staged_datasets(flow_id=flow_id)
        assert len(datasets) > 0
        
        # 7. Cleanup
        CatalogDB.delete_flow(flow_id)


class TestErrorHandling:
    """Integration tests for error handling."""
    
    def test_invalid_flow_id(self):
        """Test handling of invalid flow ID."""
        flow = CatalogDB.get_flow('nonexistent_flow_id')
        assert flow is None
    
    def test_invalid_dataset_id(self):
        """Test handling of invalid dataset ID."""
        with pytest.raises(Exception):
            DataStoreEngine.load_staged_dataframe('nonexistent_dataset_id')
    
    def test_empty_dataframe_handling(self):
        """Test handling of empty dataframe."""
        df = pd.DataFrame()
        profiles = profile_dataframe(df)
        assert len(profiles) == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
