# Testing Guide

Comprehensive testing instructions for DataFlow SparkLake Studio.

## Table of Contents
1. [Running Tests](#running-tests)
2. [Test Structure](#test-structure)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [Manual Testing](#manual-testing)
6. [CI/CD Integration](#cicd-integration)

---

## Running Tests

### Prerequisites
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install pytest pytest-cov
```

### Run All Tests
```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test file
pytest tests/test_core.py -v

# Run specific test class
pytest tests/test_core.py::TestSchemaEngine -v

# Run specific test method
pytest tests/test_core.py::TestSchemaEngine::test_profile_dataframe_basic -v
```

### View Coverage Report
```bash
# Generate HTML coverage report
pytest tests/ --cov=app --cov-report=html

# Open coverage report (Linux/macOS)
open htmlcov/index.html

# Open coverage report (Windows)
start htmlcov/index.html
```

---

## Test Structure

```
backend/
├── tests/
│   ├── __init__.py
│   ├── test_core.py          # Unit tests
│   ├── test_integration.py   # Integration tests
│   └── conftest.py           # Pytest fixtures (optional)
└── app/
    └── [application code]
```

---

## Unit Tests

### Test Coverage

**test_core.py** covers:
- Schema profiling engine
- Data type detection
- Database connector configuration
- Data transformations
- Configuration settings
- Utility functions

### Running Unit Tests
```bash
pytest tests/test_core.py -v
```

### Expected Output
```
tests/test_core.py::TestSchemaEngine::test_profile_dataframe_basic PASSED
tests/test_core.py::TestSchemaEngine::test_profile_dataframe_with_nulls PASSED
tests/test_core.py::TestSchemaEngine::test_type_detection_integer PASSED
tests/test_core.py::TestSchemaEngine::test_type_detection_string PASSED
tests/test_core.py::TestSchemaEngine::test_type_detection_timestamp PASSED
tests/test_core.py::TestSchemaEngine::test_type_detection_boolean PASSED
tests/test_core.py::TestDatabaseConnector::test_mysql_config_creation PASSED
tests/test_core.py::TestDatabaseConnector::test_postgres_config_creation PASSED
tests/test_core.py::TestDatabaseConnector::test_config_with_query PASSED
tests/test_core.py::TestDataTransformations::test_dataframe_creation PASSED
tests/test_core.py::TestDataTransformations::test_null_handling PASSED
tests/test_core.py::TestDataTransformations::test_filtering PASSED
tests/test_core.py::TestDataTransformations::test_aggregation PASSED
tests/test_core.py::TestConfigurationSettings::test_settings_defaults PASSED
tests/test_core.py::TestConfigurationSettings::test_pool_settings PASSED
tests/test_core.py::TestUtilities::test_timestamp_generation PASSED
tests/test_core.py::TestUtilities::test_json_serialization PASSED
```

---

## Integration Tests

### Test Coverage

**test_integration.py** covers:
- Database connectivity
- CRUD operations for flows
- Data store save/retrieve
- Incremental sync modes
- Schema profiling with real data
- Complete pipeline workflows
- Error handling

### Prerequisites
Integration tests require an active database connection. Ensure your `.env` file is configured:

```env
METADATA_ENGINE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=dataflow_metadata_test
```

### Running Integration Tests
```bash
# Run all integration tests
pytest tests/test_integration.py -v

# Run with database setup
pytest tests/test_integration.py -v -s
```

### Skipped Tests
If database is unavailable, integration tests will be skipped:
```
tests/test_integration.py::TestDatabaseIntegration SKIPPED (Database not available)
```

---

## Manual Testing

### 1. API Endpoint Testing

#### Using cURL
```bash
# Health check
curl http://localhost:8000/health

# List flows
curl http://localhost:8000/api/flows

# Create flow
curl -X POST http://localhost:8000/api/flows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Flow",
    "description": "Manual test",
    "category": "Testing",
    "sync_mode": "full"
  }'

# Get specific flow
curl http://localhost:8000/api/flows/{flow_id}

# List datasets
curl http://localhost:8000/api/staging
```

#### Using Python Requests
```python
import requests

BASE_URL = "http://localhost:8000"

# Health check
response = requests.get(f"{BASE_URL}/health")
print(response.json())

# List flows
response = requests.get(f"{BASE_URL}/api/flows")
flows = response.json()
print(f"Total flows: {len(flows)}")

# Create flow
flow_data = {
    "name": "API Test Flow",
    "description": "Testing via Python",
    "category": "Testing",
    "sync_mode": "full"
}
response = requests.post(f"{BASE_URL}/api/flows", json=flow_data)
print(response.json())
```

### 2. Database Testing

#### MySQL
```sql
-- Connect to database
mysql -u root -p dataflow_metadata

-- Check tables
SHOW TABLES;

-- Check flows
SELECT id, name, status, sync_mode FROM dataflow_flows;

-- Check datasets
SELECT id, name, source_type, row_count FROM dataflow_staged_datasets;

-- Check records
SELECT COUNT(*) FROM dataflow_staged_records;

-- Check audit logs
SELECT event_type, summary, created_at 
FROM dataflow_audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

#### PostgreSQL
```sql
-- Connect to database
psql -U postgres -d dataflow_metadata

-- Check tables
\dt

-- Check flows
SELECT id, name, status, sync_mode FROM dataflow_flows;

-- Check datasets
SELECT id, name, source_type, row_count FROM dataflow_staged_datasets;
```

### 3. Frontend Testing

#### Manual UI Test Checklist
- [ ] **Navigation**: All tabs accessible
- [ ] **Create Flow**: Form validation works
- [ ] **Add Source**: Connection test successful
- [ ] **Profile Schema**: Columns display correctly
- [ ] **Stage Data**: Data loads in grid
- [ ] **Transformations**: Rules apply correctly
- [ ] **Execute Pipeline**: Job runs and completes
- [ ] **View History**: Logs display correctly
- [ ] **Schedules**: Cron creation works
- [ ] **Settings**: Database connection updates

#### Browser Compatibility
Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

#### Responsive Design
Test at:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### 4. Performance Testing

#### Load Testing with Apache Bench
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test health endpoint
ab -n 1000 -c 10 http://localhost:8000/health

# Test API endpoint
ab -n 100 -c 5 http://localhost:8000/api/flows
```

#### Monitoring Database Performance
```sql
-- MySQL - Show processlist
SHOW FULL PROCESSLIST;

-- MySQL - Show slow queries
SHOW VARIABLES LIKE 'slow_query%';

-- PostgreSQL - Show active queries
SELECT pid, now() - query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;
```

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Run Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpass
          MYSQL_DATABASE: dataflow_metadata_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.12'
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
        pip install pytest pytest-cov
    
    - name: Run tests
      env:
        METADATA_ENGINE: mysql
        MYSQL_HOST: 127.0.0.1
        MYSQL_PORT: 3306
        MYSQL_USER: root
        MYSQL_PASSWORD: testpass
        MYSQL_DATABASE: dataflow_metadata_test
      run: |
        cd backend
        pytest tests/ -v --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./backend/coverage.xml
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
image: python:3.12

services:
  - mysql:8.0

variables:
  MYSQL_ROOT_PASSWORD: testpass
  MYSQL_DATABASE: dataflow_metadata_test
  METADATA_ENGINE: mysql
  MYSQL_HOST: mysql
  MYSQL_USER: root
  MYSQL_PASSWORD: testpass

stages:
  - test

test:
  stage: test
  script:
    - cd backend
    - pip install -r requirements.txt
    - pip install pytest pytest-cov
    - pytest tests/ -v --cov=app --cov-report=term
  coverage: '/TOTAL.*\s+(\d+%)$/'
```

---

## Test Data

### Sample Test Data Generation

Create `tests/fixtures/sample_data.py`:

```python
import pandas as pd
from datetime import datetime, timedelta

def generate_sample_orders(n=100):
    """Generate sample order data."""
    return pd.DataFrame({
        'order_id': range(1, n+1),
        'customer': [f'Customer_{i}' for i in range(1, n+1)],
        'amount': [100 + (i * 10.5) for i in range(n)],
        'order_date': [datetime.utcnow() - timedelta(days=i) for i in range(n)],
        'status': ['completed', 'pending', 'shipped'] * (n // 3) + ['completed'] * (n % 3),
        'aud_last_update': [datetime.utcnow()] * n
    })

def generate_sample_users(n=50):
    """Generate sample user data."""
    return pd.DataFrame({
        'user_id': range(1, n+1),
        'username': [f'user{i}' for i in range(1, n+1)],
        'email': [f'user{i}@example.com' for i in range(1, n+1)],
        'is_active': [True, False] * (n // 2) + [True] * (n % 2),
        'created_at': [datetime.utcnow() - timedelta(days=i*7) for i in range(n)],
        'aud_last_update': [datetime.utcnow()] * n
    })
```

---

## Debugging Tests

### Run Tests in Debug Mode
```bash
# Show print statements
pytest tests/ -v -s

# Stop on first failure
pytest tests/ -x

# Run last failed tests
pytest tests/ --lf

# Show full traceback
pytest tests/ --tb=long
```

### Using Python Debugger
```python
# Add to test code
import pdb; pdb.set_trace()

# Run with pdb
pytest tests/test_core.py --pdb
```

### Pytest Logging
```bash
# Show log output
pytest tests/ -v --log-cli-level=INFO

# Show debug logs
pytest tests/ -v --log-cli-level=DEBUG
```

---

## Test Maintenance

### Best Practices
1. **Isolate Tests**: Each test should be independent
2. **Use Fixtures**: Share setup/teardown code
3. **Clean Up**: Always clean up test data
4. **Meaningful Names**: Use descriptive test names
5. **Test Edge Cases**: Test boundary conditions
6. **Mock External Services**: Don't depend on external APIs
7. **Keep Tests Fast**: Unit tests should run in milliseconds

### Adding New Tests
1. Create test file in `tests/` directory
2. Name file `test_*.py` or `*_test.py`
3. Name test functions `test_*`
4. Use clear assertions
5. Document test purpose
6. Run tests before committing

---

## Troubleshooting

### Tests Not Found
```bash
# Ensure pytest can find tests
python -m pytest tests/ -v
```

### Import Errors
```bash
# Add project to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:${PWD}/backend"
```

### Database Connection Issues
```bash
# Check database is running
mysql -u root -p -e "SELECT 1"

# Verify .env file
cat backend/.env
```

### Slow Tests
```bash
# Show slowest tests
pytest tests/ --durations=10
```

---

## Coverage Goals

Target coverage levels:
- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: Critical paths covered
- **Manual Tests**: All user-facing features validated

Current coverage:
```bash
pytest tests/ --cov=app --cov-report=term-missing
```

---

For questions or issues with testing, please create an issue on GitHub.
