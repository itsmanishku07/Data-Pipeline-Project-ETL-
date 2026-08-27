from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.routes_sources import router as sources_router
from .api.routes_schema import router as schema_router
from .api.routes_staging import router as staging_router
from .api.routes_transform import router as transform_router
from .api.routes_jobs import router as jobs_router
from .api.routes_history import router as history_router
from .api.routes_flows import router as flows_router
# Auto-initialize metadata tables on server boot
try:
    init_db()
except Exception as _e:
    pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure databases
    try:
        init_db()
    except Exception:
        pass
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Data Pipeline Studio: Multi-Source Ingestion, Schema Profiling, Staging Layer, and PySpark Transformation Engine.",
    lifespan=lifespan
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(flows_router, prefix=settings.API_PREFIX)
app.include_router(sources_router, prefix=settings.API_PREFIX)
app.include_router(schema_router, prefix=settings.API_PREFIX)
app.include_router(staging_router, prefix=settings.API_PREFIX)
app.include_router(transform_router, prefix=settings.API_PREFIX)
app.include_router(jobs_router, prefix=settings.API_PREFIX)
app.include_router(history_router, prefix=settings.API_PREFIX)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "engine": "Apache Spark & DuckDB Hybrid"
    }

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} Backend API",
        "docs": "/docs",
        "health": "/health"
    }
