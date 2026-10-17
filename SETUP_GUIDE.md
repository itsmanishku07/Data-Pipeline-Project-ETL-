# DataFlow SparkLake Studio - Setup Guide

Complete step-by-step setup instructions for local development and production deployment.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Local Development Setup](#local-development-setup)
3. [Docker Deployment](#docker-deployment)
4. [Production Deployment](#production-deployment)
5. [Configuration Details](#configuration-details)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites Check
```bash
# Check Python version (requires 3.12+)
python --version

# Check Node.js version (requires 18+)
node --version

# Check Docker version (optional, for containerized deployment)
docker --version
```

### Fastest Setup (Docker)
```bash
# 1. Clone repository
git clone <repository-url>
cd Data-Pipeline-Project-ETL-

# 2. Configure environment
cp .env.docker .env
# Edit .env - Change MYSQL_ROOT_PASSWORD to a secure value

# 3. Start application
docker-compose up -d

# 4. Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
```

---

## Local Development Setup

### Step 1: System Requirements

**Required:**
- Python 3.12 or higher
- Node.js 18.0 or higher
- MySQL 8.0+ or PostgreSQL 13+
- Git
- 4GB RAM minimum

**Optional:**
- Apache Spark 3.x (for advanced transformations)
- Docker & Docker Compose (for containerized deployment)

### Step 2: Clone Repository
```bash
git clone <repository-url>
cd Data-Pipeline-Project-ETL-
```

### Step 3: Database Setup

#### Option A: MySQL
```bash
# Install MySQL 8.0+
# On Ubuntu/Debian:
sudo apt-get install mysql-server

# On macOS:
brew install mysql

# On Windows: Download from https://dev.mysql.com/downloads/

# Start MySQL service
sudo systemctl start mysql  # Linux
brew services start mysql   # macOS

# Create database
mysql -u root -p
```

```sql
CREATE DATABASE dataflow_metadata CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dataflow_user'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON dataflow_metadata.* TO 'dataflow_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Option B: PostgreSQL
```bash
# Install PostgreSQL 13+
# On Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib

# On macOS:
brew install postgresql

# On Windows: Download from https://www.postgresql.org/download/

# Start PostgreSQL service
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS

# Create database
sudo -u postgres psql
```

```sql
CREATE DATABASE dataflow_metadata;
CREATE USER dataflow_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE dataflow_metadata TO dataflow_user;
\q
```

### Step 4: Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate

# On Linux/macOS:
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Edit .env file with your database credentials
# Use your favorite editor (nano, vim, notepad, VS Code, etc.)
nano .env
```

**Edit `.env` file:**
```env
METADATA_ENGINE=mysql

# For MySQL:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=dataflow_user
MYSQL_PASSWORD=secure_password_here
MYSQL_DATABASE=dataflow_metadata

# For PostgreSQL (if using instead of MySQL):
# METADATA_ENGINE=postgres
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# POSTGRES_USER=dataflow_user
# POSTGRES_PASSWORD=secure_password_here
# POSTGRES_DATABASE=dataflow_metadata
# POSTGRES_SCHEMA=public

# Performance Settings (adjust based on your system)
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=300
DB_QUERY_TIMEOUT=300
DB_CONNECTION_TIMEOUT=15

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Step 5: Frontend Setup

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env

# Edit if needed (default works for local development)
nano .env
```

**Frontend `.env` (optional, default works):**
```env
VITE_API_URL=http://localhost:8000
```

### Step 6: Initialize Database

```bash
# From backend directory with activated venv
cd backend
python run.py
```

The application will automatically create all required database tables on first run.

### Step 7: Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python run.py
```

Backend will start on: http://localhost:8000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Frontend will start on: http://localhost:3000

### Step 8: Verify Installation

1. Open browser: http://localhost:3000
2. Check API docs: http://localhost:8000/docs
3. Health check: http://localhost:8000/health

Expected health response:
```json
{
  "status": "healthy",
  "app": "DataFlow SparkLake Studio",
  "version": "1.0.0",
  "engine": "Apache Spark & DuckDB Hybrid"
}
```

---

## Docker Deployment

### Option 1: Using Docker Compose (Recommended)

#### Step 1: Configure Environment
```bash
# Copy Docker environment template
cp .env.docker .env

# Edit with secure credentials
nano .env
```

**Important:** Change all default passwords!

#### Step 2: Build and Start
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

#### Step 3: Verify Deployment
```bash
# Check application health
curl http://localhost:8000/health

# Check MySQL connection
docker-compose exec mysql mysql -uroot -p -e "SHOW DATABASES;"

# Access frontend
open http://localhost:3000
```

### Option 2: Manual Docker Build

```bash
# Build image
docker build -t dataflow-studio:latest .

# Run MySQL container
docker run -d \
  --name dataflow-mysql \
  -e MYSQL_ROOT_PASSWORD=changeme \
  -e MYSQL_DATABASE=dataflow_metadata \
  -p 3307:3306 \
  mysql:8.0

# Run application container
docker run -d \
  --name dataflow-app \
  --link dataflow-mysql:mysql \
  -e MYSQL_HOST=mysql \
  -e MYSQL_PASSWORD=changeme \
  -p 3000:3000 \
  -p 8000:8000 \
  dataflow-studio:latest
```

---

## Production Deployment

### Security Checklist

- [ ] **Change all default passwords**
- [ ] **Use strong passwords (16+ characters, mixed case, numbers, symbols)**
- [ ] **Configure specific CORS origins (not wildcard)**
- [ ] **Enable SSL/TLS for database connections**
- [ ] **Use environment secrets management (AWS Secrets Manager, Azure Key Vault)**
- [ ] **Configure firewall rules**
- [ ] **Set up regular database backups**
- [ ] **Enable application monitoring**
- [ ] **Configure log rotation**
- [ ] **Review and lock down network access**

### Production Environment Variables

```env
# Production Database (use managed services)
METADATA_ENGINE=postgres
POSTGRES_HOST=your-db-instance.region.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_USER=dataflow_prod
POSTGRES_PASSWORD=<use-secrets-manager>
POSTGRES_DATABASE=dataflow_production
POSTGRES_SCHEMA=public

# Performance (tune for production load)
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_RECYCLE=300
DB_QUERY_TIMEOUT=600
DB_CONNECTION_TIMEOUT=30

# Security
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### Deployment Platforms

#### AWS Deployment
1. **Database**: Amazon RDS (PostgreSQL or MySQL)
2. **Compute**: ECS Fargate or EKS
3. **Storage**: S3 for lakehouse files
4. **Secrets**: AWS Secrets Manager
5. **Load Balancer**: ALB with SSL/TLS
6. **Monitoring**: CloudWatch

#### Azure Deployment
1. **Database**: Azure Database for PostgreSQL/MySQL
2. **Compute**: Azure Container Instances or AKS
3. **Storage**: Azure Blob Storage / ADLS Gen2
4. **Secrets**: Azure Key Vault
5. **Load Balancer**: Azure Application Gateway
6. **Monitoring**: Azure Monitor

#### Google Cloud Deployment
1. **Database**: Cloud SQL (PostgreSQL or MySQL)
2. **Compute**: Cloud Run or GKE
3. **Storage**: Cloud Storage
4. **Secrets**: Secret Manager
5. **Load Balancer**: Cloud Load Balancing
6. **Monitoring**: Cloud Monitoring

---

## Configuration Details

### Database Connection Pooling

Tune these settings based on your workload:

```env
# Light workload (1-10 concurrent users)
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10

# Medium workload (10-50 concurrent users)
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20

# Heavy workload (50+ concurrent users)
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
```

### Query Timeouts

```env
# Short queries (OLTP workload)
DB_QUERY_TIMEOUT=60

# Long-running analytics
DB_QUERY_TIMEOUT=600

# ETL batch processing
DB_QUERY_TIMEOUT=1800
```

### CORS Configuration

```env
# Development (allow localhost)
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Production (specific domains only)
ALLOWED_ORIGINS=https://app.yourdomain.com,https://yourdomain.com

# Multiple environments
ALLOWED_ORIGINS=https://app.yourdomain.com,https://staging.yourdomain.com
```

---

## Troubleshooting

### Database Connection Failed

**Error:** `Failed to connect to MySQL/PostgreSQL metadata database`

**Solutions:**
1. Verify database is running:
   ```bash
   # MySQL
   sudo systemctl status mysql
   
   # PostgreSQL
   sudo systemctl status postgresql
   ```

2. Check credentials in `.env` file

3. Test connection manually:
   ```bash
   # MySQL
   mysql -h localhost -u root -p
   
   # PostgreSQL
   psql -h localhost -U postgres
   ```

4. Check firewall rules:
   ```bash
   # MySQL
   sudo ufw allow 3306/tcp
   
   # PostgreSQL
   sudo ufw allow 5432/tcp
   ```

### Port Already in Use

**Error:** `Address already in use: 3000` or `8000`

**Solutions:**
1. Find and kill process using the port:
   ```bash
   # Linux/macOS
   lsof -i :3000
   kill -9 <PID>
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. Change ports in configuration:
   ```env
   # For Docker
   APP_FRONTEND_PORT=3001
   APP_BACKEND_PORT=8001
   ```

### Docker Container Won't Start

**Error:** `Container exited with code 1`

**Solutions:**
1. Check logs:
   ```bash
   docker-compose logs app
   docker-compose logs mysql
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Rebuild without cache:
   ```bash
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Frontend Can't Connect to Backend

**Error:** `Network Error` or `CORS Error`

**Solutions:**
1. Verify backend is running:
   ```bash
   curl http://localhost:8000/health
   ```

2. Check CORS configuration in `.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. Clear browser cache and cookies

4. Check frontend API URL in `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

### Dependencies Installation Failed

**Error:** `pip install` or `npm install` errors

**Solutions:**
1. Update package managers:
   ```bash
   # Python
   pip install --upgrade pip setuptools wheel
   
   # Node.js
   npm install -g npm@latest
   ```

2. Clear caches:
   ```bash
   # Python
   pip cache purge
   
   # Node.js
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Check Python version:
   ```bash
   python --version  # Should be 3.12+
   ```

### Database Tables Not Created

**Error:** `Table 'dataflow_flows' doesn't exist`

**Solutions:**
1. Check database connection in logs

2. Manually run initialization:
   ```bash
   cd backend
   python -c "from app.models.db_models import init_db; init_db()"
   ```

3. Verify database exists:
   ```sql
   SHOW DATABASES;  -- MySQL
   \l               -- PostgreSQL
   ```

---

## Performance Optimization

### Database Indexing
The application automatically creates indexes on:
- Flow IDs
- Dataset IDs
- Created timestamps
- Foreign key relationships

### Caching Strategy
- In-memory caching for frequently accessed metadata
- Connection pool reuse
- Query result caching (planned feature)

### Scalability
- Horizontal scaling: Multiple backend instances behind load balancer
- Vertical scaling: Increase DB_POOL_SIZE and server resources
- Database read replicas for heavy read workloads

---

## Next Steps

After successful setup:

1. **Create Your First Flow**: Navigate to Flows tab
2. **Connect Data Source**: Add MySQL, PostgreSQL, or cloud storage
3. **Profile Data**: Review schema and column statistics
4. **Add Transformations**: Apply business logic
5. **Schedule Jobs**: Set up automated runs
6. **Monitor Execution**: Track job history and performance

---

## Support

- **Documentation**: See README.md for detailed features
- **Issues**: Report bugs on GitHub Issues
- **Community**: Join our Discord/Slack community
- **Enterprise Support**: Contact sales@yourdomain.com

