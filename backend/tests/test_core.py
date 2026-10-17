"""
Unit tests for the DataFlow SparkLake Studio.

Run tests with: pytest tests/test_core.py -v
"""

import pytest
import pandas as pd
from datetime import datetime
from app.engine.schema_engine import profile_dataframe, map_python_pandas_type_to_spark
from app.engine.transform_engine import TransformationEngine
from app.models.schemas import DatabaseType, DatabaseSourceConfig, TransformationRule
from app.api.routes_flows import _compare_snapshots


class TestSchemaEngine:
    """Tests for schema profiling and type detection."""
    
    def test_profile_dataframe_basic(self):
        """Test basic dataframe profiling."""
        df = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'name': ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],
            'amount': [100.5, 200.75, 150.25, 300.0, 250.5],
            'is_active': [True, False, True, True, False]
        })
        
        profiles = profile_dataframe(df)
        
        assert len(profiles) == 4
        assert profiles[0].name == 'id'
        assert profiles[0].null_count == 0
        assert profiles[0].distinct_count == 5
    
    def test_profile_dataframe_with_nulls(self):
        """Test profiling with null values."""
        df = pd.DataFrame({
            'col1': [1, 2, None, 4, None],
            'col2': ['a', None, 'c', None, 'e']
        })
        
        profiles = profile_dataframe(df)
        
        col1_profile = next(p for p in profiles if p.name == 'col1')
        col2_profile = next(p for p in profiles if p.name == 'col2')
        
        assert col1_profile.null_count == 2
        assert col1_profile.null_percentage == 40.0
        assert col2_profile.null_count == 2
    
    def test_type_detection_integer(self):
        """Test integer type detection."""
        series = pd.Series([1, 2, 3, 4, 5])
        spark_type, description = map_python_pandas_type_to_spark(str(series.dtype), series, 'test_col')
        
        assert spark_type == 'IntegerType'
    
    def test_type_detection_string(self):
        """Test string type detection."""
        series = pd.Series(['a', 'b', 'c'])
        spark_type, description = map_python_pandas_type_to_spark(str(series.dtype), series, 'test_col')
        
        assert spark_type == 'StringType'
    
    def test_type_detection_timestamp(self):
        """Test timestamp type detection."""
        series = pd.Series([datetime.now(), datetime.now(), datetime.now()])
        spark_type, description = map_python_pandas_type_to_spark(str(series.dtype), series, 'test_col')
        
        assert spark_type == 'TimestampType'
    
    def test_type_detection_boolean(self):
        """Test boolean type detection."""
        series = pd.Series([True, False, True, False])
        spark_type, description = map_python_pandas_type_to_spark(str(series.dtype), series, 'test_col')
        
        assert spark_type == 'BooleanType'


class TestDatabaseConnector:
    """Tests for database connector configuration."""
    
    def test_mysql_config_creation(self):
        """Test MySQL configuration."""
        config = DatabaseSourceConfig(
            db_type=DatabaseType.MYSQL,
            host='localhost',
            port=3306,
            username='testuser',
            password='testpass',
            database='testdb',
            table_name='test_table'
        )
        
        assert config.db_type == DatabaseType.MYSQL
        assert config.port == 3306
        assert config.host == 'localhost'
    
    def test_postgres_config_creation(self):
        """Test PostgreSQL configuration."""
        config = DatabaseSourceConfig(
            db_type=DatabaseType.POSTGRES,
            host='localhost',
            port=5432,
            username='testuser',
            password='testpass',
            database='testdb',
            table_name='test_table'
        )
        
        assert config.db_type == DatabaseType.POSTGRES
        assert config.port == 5432
    
    def test_config_with_query(self):
        """Test configuration with custom query."""
        config = DatabaseSourceConfig(
            db_type=DatabaseType.MYSQL,
            host='localhost',
            username='testuser',
            password='testpass',
            database='testdb',
            query='SELECT * FROM users WHERE active = 1'
        )
        
        assert config.query is not None
        assert 'SELECT' in config.query


class TestDataTransformations:
    """Tests for data transformation utilities."""
    
    def test_dataframe_creation(self):
        """Test basic DataFrame creation."""
        df = pd.DataFrame({
            'a': [1, 2, 3],
            'b': [4, 5, 6]
        })
        
        assert len(df) == 3
        assert list(df.columns) == ['a', 'b']
    
    def test_null_handling(self):
        """Test null value handling."""
        df = pd.DataFrame({
            'col1': [1, None, 3, None, 5],
            'col2': ['a', 'b', None, 'd', 'e']
        })
        
        # Test dropna
        df_clean = df.dropna()
        assert len(df_clean) == 2
        
        # Test fillna
        df_filled = df.fillna({'col1': 0, 'col2': 'missing'})
        assert df_filled['col1'].isna().sum() == 0
        assert df_filled['col2'].isna().sum() == 0
    
    def test_filtering(self):
        """Test DataFrame filtering."""
        df = pd.DataFrame({
            'value': [10, 20, 30, 40, 50],
            'category': ['A', 'B', 'A', 'B', 'A']
        })
        
        # Filter by value
        filtered = df[df['value'] > 25]
        assert len(filtered) == 3
        
        # Filter by category
        filtered_cat = df[df['category'] == 'A']
        assert len(filtered_cat) == 3
    
    def test_aggregation(self):
        """Test DataFrame aggregation."""
        df = pd.DataFrame({
            'category': ['A', 'A', 'B', 'B', 'C'],
            'value': [10, 20, 30, 40, 50]
        })
        
        grouped = df.groupby('category')['value'].sum()
        
        assert grouped['A'] == 30
        assert grouped['B'] == 70
        assert grouped['C'] == 50


class TestTransformationEngine:
    def make_rule(self, rule_type, params):
        return TransformationRule(id="test", rule_type=rule_type, params=params)

    def test_drop_null_rows_on_selected_columns(self):
        df = pd.DataFrame({"id": [1, 2, 3], "name": ["a", None, "c"], "optional": [None, None, "x"]})
        result = TransformationEngine._apply_rule(df, self.make_rule("drop_na", {"columns": ["name"], "how": "any"}))
        assert result["id"].tolist() == [1, 3]

    def test_drop_null_rows_all_columns_and_all_mode(self):
        df = pd.DataFrame({"a": [None, None, 1], "b": [None, 2, None]})
        result = TransformationEngine._apply_rule(df, self.make_rule("drop_na", {"how": "all"}))
        assert len(result) == 2

    def test_drop_duplicates_by_keys_first_last_and_none(self):
        df = pd.DataFrame({"id": [1, 1, 1, 2], "value": ["first", "middle", "last", "only"]})
        first = TransformationEngine._apply_rule(df, self.make_rule("deduplicate", {"columns": ["id"], "keep": "first"}))
        last = TransformationEngine._apply_rule(df, self.make_rule("deduplicate", {"columns": ["id"], "keep": "last"}))
        none = TransformationEngine._apply_rule(df, self.make_rule("deduplicate", {"columns": ["id"], "keep": "none"}))
        assert first["value"].tolist() == ["first", "only"]
        assert last["value"].tolist() == ["last", "only"]
        assert none["id"].tolist() == [2]

    def test_string_transform_preserves_nulls(self):
        df = pd.DataFrame({"name": [" Alice ", None]})
        result = TransformationEngine._apply_rule(df, self.make_rule("string_transform", {"column": "name", "operation": "trim"}))
        assert result.loc[0, "name"] == "Alice"
        assert pd.isna(result.loc[1, "name"])

    def test_invalid_column_fails_preview(self):
        df = pd.DataFrame({"id": [1, 2]})
        with pytest.raises(ValueError, match="Transformation execution failed"):
            TransformationEngine.execute_rules(df, [self.make_rule("drop_na", {"columns": ["missing"]})])

    def test_failed_rule_does_not_return_partial_success(self):
        df = pd.DataFrame({"id": [1, 2]})
        with pytest.raises(ValueError, match="Transformation execution failed"):
            TransformationEngine.execute_rules(df, [self.make_rule("filter", {"condition": "unknown_col > 1"})])

    def test_invalid_cast_is_reported_as_failure(self):
        df = pd.DataFrame({"amount": ["10", "not-a-number"]})
        with pytest.raises(ValueError, match="Transformation execution failed"):
            TransformationEngine.execute_rules(df, [self.make_rule("cast_type", {"column": "amount", "target_type": "DoubleType"})])


class TestSnapshotChangeDetection:
    def test_identifies_insert_update_delete_and_changed_columns(self):
        previous = [
            {"id": 1, "name": "Ada", "status": "new"},
            {"id": 2, "name": "Lin", "status": "paid"},
        ]
        current = [
            {"id": 1, "name": "Ada", "status": "shipped"},
            {"id": 3, "name": "Grace", "status": "new"},
        ]
        report = _compare_snapshots(previous, current, ["id"])
        assert report["added_rows"] == 1
        assert report["changed_rows"] == 1
        assert report["deleted_rows"] == 1
        assert report["unchanged_rows"] == 0
        assert report["changed_sample"][0]["changed_columns"] == ["status"]

    def test_whole_row_mode_reports_multiset_deltas(self):
        report = _compare_snapshots([{"x": 1}, {"x": 1}, {"x": 2}], [{"x": 1}, {"x": 3}], [])
        assert report["added_rows"] == 1
        assert report["deleted_rows"] == 2
        assert report["unchanged_rows"] == 1

    def test_duplicate_or_null_primary_keys_are_rejected(self):
        with pytest.raises(ValueError, match="unique"):
            _compare_snapshots([], [{"id": 1}, {"id": 1}], ["id"])
        with pytest.raises(ValueError, match="null"):
            _compare_snapshots([], [{"id": None}], ["id"])


class TestConfigurationSettings:
    """Tests for application configuration."""
    
    def test_settings_defaults(self):
        """Test default configuration values."""
        from app.config import settings
        
        assert settings.APP_NAME == "DataFlow SparkLake Studio"
        assert settings.API_PREFIX == "/api"
        assert settings.DEFAULT_PAGE_SIZE == 50
    
    def test_pool_settings(self):
        """Test database pool configuration."""
        from app.config import settings
        
        assert hasattr(settings, 'DB_POOL_SIZE')
        assert hasattr(settings, 'DB_MAX_OVERFLOW')
        assert hasattr(settings, 'DB_POOL_RECYCLE')
        
        assert settings.DB_POOL_SIZE > 0
        assert settings.DB_MAX_OVERFLOW >= 0


class TestUtilities:
    """Tests for utility functions."""
    
    def test_timestamp_generation(self):
        """Test timestamp generation for audit columns."""
        now = datetime.utcnow()
        timestamp_str = now.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        
        assert 'T' in timestamp_str
        assert timestamp_str.endswith('Z')
    
    def test_json_serialization(self):
        """Test JSON serialization of data structures."""
        import json
        
        data = {
            'id': 'test_123',
            'name': 'Test Flow',
            'created_at': datetime.utcnow().isoformat()
        }
        
        json_str = json.dumps(data)
        parsed = json.loads(json_str)
        
        assert parsed['id'] == 'test_123'
        assert parsed['name'] == 'Test Flow'


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
