import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import settings
from .api.routes_sources import router as sources_router
from .api.routes_schema import router as schema_router
from .api.routes_staging import router as staging_router
from .api.routes_transform import router as transform_router
from .api.routes_jobs import router as jobs_router
from .api.routes_history import router as history_router
from .api.routes_flows import router as flows_router
from .api.routes_schedules import router as schedules_router
from .models.db_models import init_db
from .services.scheduler_service import SchedulerService

# Resolve the path to the pre-built frontend dist directory
DIST_DIR = Path(__file__).resolve().parent.parent / "dist"

# Auto-initialize metadata tables on server boot
try:
    init_db()
except Exception as _e:
    pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure databases and start background cron scheduler
    try:
        init_db()
        SchedulerService.start()
    except Exception as e:
        print(f"Error during startup: {e}")
    yield
    # Shutdown: graceful stop
    try:
        SchedulerService.shutdown()
    except Exception as e:
        print(f"Error during shutdown: {e}")

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
app.include_router(schedules_router, prefix=settings.API_PREFIX)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "engine": "Apache Spark & DuckDB Hybrid"
    }

# ---------------------------------------------------------------------------
# Serve the pre-built React SPA frontend from backend/dist/
# ---------------------------------------------------------------------------
# Mount static assets (JS, CSS, images) under /assets so they resolve
# correctly from the index.html references.
if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    # Mount the assets sub-directory for JS/CSS bundles
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    # SPA catch-all: any non-API, non-docs path serves index.html
    # so that React Router client-side routing works.
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # If a specific static file exists in dist, serve it directly
        file_path = DIST_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve the SPA entry point
        return FileResponse(str(DIST_DIR / "index.html"))
else:
    # Fallback: no frontend build found, serve JSON info at root
    @app.get("/")
    def root():
        return {
            "message": f"Welcome to {settings.APP_NAME} Backend API",
            "docs": "/docs",
            "health": "/health",
            "note": "Frontend dist/ not found. Build the frontend first."
        }
