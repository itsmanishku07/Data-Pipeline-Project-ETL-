import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .config import settings
from .api.routes_sources import router as sources_router
from .api.routes_schema import router as schema_router
from .api.routes_staging import router as staging_router
from .api.routes_transform import router as transform_router
from .api.routes_jobs import router as jobs_router
from .api.routes_history import router as history_router
from .api.routes_flows import router as flows_router
from .api.routes_schedules import router as schedules_router
from .models.db_models import init_db, get_db_connection
from .services.scheduler_service import SchedulerService

FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend_dist"
IS_DATABRICKS_APP = bool(os.getenv("DATABRICKS_APP_PORT"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure databases and start background cron scheduler
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        db_type, engine = get_db_connection()
        if engine is None:
            raise RuntimeError(f"Configured {db_type} metadata database is unavailable.")
        init_db()
        if not IS_DATABRICKS_APP or os.getenv("ENABLE_IN_PROCESS_SCHEDULER", "true").lower() == "true":
            SchedulerService.start()
        logger.info("Application startup completed successfully.")
    except Exception as e:
        logger.error(f"Error during startup: {e}", exc_info=True)
        raise
    yield
    # Shutdown: graceful stop
    try:
        SchedulerService.shutdown()
        # Stop Spark session to prevent memory leaks
        from .engine.spark_session import spark_manager
        spark_manager.stop_session()
        logger.info("Application shutdown completed successfully.")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}", exc_info=True)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Data Pipeline Studio: Multi-Source Ingestion, Schema Profiling, Staging Layer, and PySpark Transformation Engine.",
    lifespan=lifespan
)

# CORS is only needed when a separately hosted development frontend is configured.
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
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
app.include_router(schedules_router, prefix=settings.API_PREFIX)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "engine": "Apache Spark & DuckDB Hybrid"
    }

@app.get("/ready")
def readiness_check():
    db_type, engine = get_db_connection()
    if engine is None:
        raise HTTPException(status_code=503, detail=f"{db_type} metadata database is unavailable")
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Metadata database readiness check failed") from exc
    return {"status": "ready", "metadata_engine": db_type}

@app.get("/")
def root():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {
        "message": f"Welcome to {settings.APP_NAME} Backend API",
        "docs": "/docs",
        "health": "/health"
    }


if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")


@app.get("/{frontend_path:path}", include_in_schema=False)
def serve_frontend(frontend_path: str):
    """Serve the SPA for browser routes, without masking API or operational routes."""
    if frontend_path.startswith(("api/", "docs", "redoc", "openapi.json", "health", "ready")):
        raise HTTPException(status_code=404, detail="Not found")
    index_file = FRONTEND_DIST / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Frontend build is not installed")
    requested_file = (FRONTEND_DIST / frontend_path).resolve()
    if requested_file.is_relative_to(FRONTEND_DIST.resolve()) and requested_file.is_file():
        return FileResponse(requested_file)
    return FileResponse(index_file)
