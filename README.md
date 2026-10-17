# DataFlow SparkLake Studio - Production ETL Pipeline Platform

[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Enterprise-grade ETL/ELT data pipeline platform with multi-source ingestion, schema profiling, incremental sync, PySpark transformations, and lakehouse storage.

## 🚀 Features

### Core Capabilities
- **Multi-Source Data Ingestion**: MySQL, PostgreSQL, SQL Server, SQLite, Azure Blob/ADLS, AWS S3, Databricks, REST APIs
- **Intelligent Schema Profiling**: Automatic data type detection, null analysis, cardinality metrics, sample data
- **Incremental Sync Strategies**: Full refresh, append-only, upsert/merge with watermark-based CDC
- **PySpark Transformation Engine**: 15+ built-in transformations (filter, cast, rename, drop, deduplicate, etc.)
- **Unified Lakehouse Storage**: Database-centric staging with MySQL/PostgreSQL, Parquet export support
- **Data Flow Orchestration**: Isolated multi-tenant flows with independent sync modes and schedules
- **Automated Scheduling**: Cron-based job execution with APScheduler
- **Comprehensive Audit Trails**: Full lineage tracking and execution history

### Production-Ready
- **Security Hardened**: No hardcoded credentials, parameterized SQL queries, environment-based CORS
- **Production Logging**: Structured logging with rotation, level-based filtering
- **Connection Pooling**: Configurable pool sizes, connection recycling, health checks
- **Memory Management**: Spark session cleanup, graceful shutdown handling
- **Docker Ready**: Multi-stage builds, health checks, volume persistence
- **Error Handling**: Comprehensive exception handling with detailed logging

## 📋 Prerequisites

- **Python**: 3.12+
- **Node.js**: 18+ (for frontend)
- **Database**: MySQL 8.0+ or PostgreSQL 13+
- **Optional**: Apache Spark (for advanced transformations)
- **Docker**: 20+ (for containerized deployment)

## 🛠️ Installation

### Local Development Setup

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd Data-Pipeline-Project-ETL-
```

#### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials
```

#### 3. Database Setup
```bash
# For MySQL:
mysql -u root -p
CREATE DATABASE dataflow_metadata CHARACTER SET utf8mb4;

# For PostgreSQL:
psql -U postgres
CREATE DATABASE dataflow_metadata;
```

#### 4. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env if needed
```

#### 5. Start the Application
```bash
# Terminal 1 - Backend (from backend directory)
python run.py

# Terminal 2 - Frontend (from frontend directory)
npm run dev
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Docker Deployment

#### 1. Configure Environment
```bash
# Copy and edit Docker environment file
cp .env.docker .env
# Edit .env with secure passwords
```

#### 2. Build and Start
```bash
docker-compose up -d
```

#### 3. Verify Deployment
```bash
docker-compose ps
docker-compose logs -f app
```

Access the application:
- Application: http://localhost:3000
- API Health: http://localhost:8000/health

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# Database Configuration
METADATA_ENGINE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=dataflow_metadata

# Performance Settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=300
DB_QUERY_TIMEOUT=300
DB_CONNECTION_TIMEOUT=15

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
```

### Connection Pool Tuning
- `DB_POOL_SIZE`: Base connection pool size (default: 10)
- `DB_MAX_OVERFLOW`: Additional connections during peak load (default: 20)
- `DB_POOL_RECYCLE`: Connection recycling interval in seconds (default: 300)
- `DB_QUERY_TIMEOUT`: Maximum query execution time (default: 300s)

## 📚 Usage Guide

### Creating a Data Flow

1. **Navigate to Flows**: Click "Create New Flow" in the UI
2. **Configure Flow**:
   - Name: Descriptive flow name
   - Category: Organize flows by domain
   - Sync Mode: `full`, `incremental_append`, or `incremental_merge`
   - Watermark Column: Timestamp column for incremental sync (default: `aud_last_update`)
   - Primary Key: For merge operations

3. **Add Data Source**: Connect to your source system
4. **Profile Schema**: Review detected columns and data types
5. **Add Transformations**: Apply filters, casts, aggregations
6. **Execute Pipeline**: Run and monitor job execution

### Sync Modes

- **Full Refresh**: Complete dataset reload every sync
- **Incremental Append**: Add only new records since last watermark
- **Incremental Merge**: Upsert records by primary key with latest timestamp

### Scheduling Jobs

Flows can be scheduled with cron expressions:
```
0 */6 * * *    # Every 6 hours
0 2 * * *      # Daily at 2 AM
0 0 * * 0      # Weekly on Sunday
```

## 🏗️ Architecture

```
┌─────────────────┐
│   React UI      │
│  (Vite + Tailwind)
└────────┬────────┘
         │
    HTTP/REST
         │
┌────────▼────────┐
│   FastAPI       │
│   Backend       │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬───────────┐
    ▼         ▼          ▼           ▼
┌────────┐ ┌──────┐ ┌─────────┐ ┌─────────┐
│ MySQL/ │ │Spark │ │Connectors│ │Scheduler│
│Postgres│ │Engine│ │(Multi-DB)│ │(APSched)│
└────────┘ └──────┘ └─────────┘ └─────────┘
```

### Technology Stack

**Backend:**
- FastAPI: High-performance async API framework
- SQLAlchemy: Database ORM with connection pooling
- Pandas: Data manipulation and analysis
- PySpark: Distributed data transformations (optional)
- DuckDB: Embedded analytical database
- APScheduler: Job scheduling

**Frontend:**
- React 18: UI framework
- Vite: Build tool and dev server
- TailwindCSS: Utility-first styling
- Lucide Icons: Icon library

**Storage:**
- MySQL/PostgreSQL: Metadata and staging storage
- Parquet: Columnar file format for lakehouse

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
pytest test_pipeline.py -v
pytest test_flow_isolation.py -v
pytest test_incremental_sync.py -v
```

### Manual Testing Checklist
- [ ] Database connection (MySQL/PostgreSQL)
- [ ] Source connector test (Database, Azure, S3)
- [ ] Data ingestion and staging
- [ ] Schema profiling accuracy
- [ ] Transformation execution
- [ ] Full/incremental sync modes
- [ ] Pipeline job execution
- [ ] Schedule creation and execution
- [ ] UI navigation and responsiveness

## 🔒 Security Best Practices

### Production Deployment
1. **Change All Default Passwords**: Never use default credentials
2. **Enable SSL/TLS**: Configure SSL for database connections
3. **Restrict CORS Origins**: Set specific allowed origins, not `*`
4. **Use Secrets Management**: AWS Secrets Manager, Azure Key Vault, HashiCorp Vault
5. **Network Security**: Firewall rules, VPC isolation
6. **Regular Updates**: Keep dependencies up to date
7. **Audit Logging**: Monitor all data access and modifications
8. **Backup Strategy**: Regular database backups with point-in-time recovery

### Environment Secrets
Never commit `.env` files. Use:
```bash
# Add to .gitignore
.env
.env.local
.env.*.local
```

## 📊 Monitoring & Observability

### Health Checks
- Backend: `GET /health`
- Database connectivity verified on startup
- Docker health checks configured

### Log Files
- Location: `backend/logs/dataflow.log`
- Rotation: 10MB per file, 5 backup files
- Levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

### Metrics
Monitor these key metrics:
- Connection pool utilization
- Query execution times
- Job success/failure rates
- Data processing throughput
- API response times

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Test MySQL connection
mysql -h localhost -u root -p -e "SELECT 1"

# Test PostgreSQL connection
psql -h localhost -U postgres -c "SELECT 1"

# Check backend logs
tail -f backend/logs/dataflow.log
```

### Docker Issues
```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Port Conflicts
If ports 3000, 3306, or 8000 are in use:
```bash
# Edit docker-compose.yml or .env
MYSQL_HOST_PORT=3307
APP_FRONTEND_PORT=3001
APP_BACKEND_PORT=8001
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- Python: PEP 8, type hints, docstrings
- JavaScript: ESLint, Prettier
- Commit messages: Conventional Commits format

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- FastAPI framework by Sebastián Ramírez
- React community for excellent tooling
- Apache Spark for distributed processing
- All open-source contributors

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/yourusername/repo/issues)
- Documentation: [Wiki](https://github.com/yourusername/repo/wiki)
- Email: support@yourdomain.com

## 🗺️ Roadmap

- [ ] Real-time streaming ingestion (Kafka integration)
- [ ] ML model integration for data quality
- [ ] Advanced data lineage visualization
- [ ] Multi-region deployment support
- [ ] GraphQL API support
- [ ] dbt integration for transformations
- [ ] Snowflake/BigQuery connectors

---

**Built with ❤️ for the data engineering community**
