# Deploy DataFlow Studio to Databricks Apps with Lakebase

This deployment packages the React frontend into FastAPI and uses a Lakebase PostgreSQL database for application metadata and staging records. Databricks Apps deploys the repository root; `app.yaml` is at the root.

## Architecture

- Databricks Apps runs one FastAPI/Uvicorn process.
- FastAPI serves the built React app and `/api` routes from the same origin.
- Lakebase PostgreSQL persists flows, schedules, jobs, history, and staged records.
- The Databricks App's Lakebase resource provides connection settings and app service-principal identity. The backend obtains a short-lived Lakebase OAuth database token when SQLAlchemy opens a physical connection.

## Build the application bundle

From the repository root:

```powershell
cd frontend
npm ci
npm run build
```

Vite writes production assets to `backend/frontend_dist`. Deploy the **repository root**, which includes:

- `app.yaml`
- `backend/app/`, `backend/run.py`, and `backend/requirements.txt`
- `frontend/` and its `package-lock.json`

Do not deploy `.env`, a virtual environment, `node_modules`, or local test databases. Databricks Apps supports project files up to 10 MB each; check the built assets and bundle against your workspace limits.

## Prepare Lakebase

1. Create or select a Lakebase project and production branch, and select its database (normally `databricks_postgres`).
2. In Databricks Apps, create/edit the app and add a **Lakebase Autoscaling database** resource with key **`postgres`** and the **Can connect and create** permission.
3. The resource supplies `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, and `PGSSLMODE`. `valueFrom: postgres` sets `LAKEBASE_ENDPOINT` to the Lakebase endpoint path.
4. `app.yaml` sets `POSTGRES_SCHEMA=dataflow_studio`. Startup creates that schema and the application's tables. Do not manually point the app at another application's schema.
5. The App service principal must retain the database resource permission after deployment. Do not put a Lakebase password or Databricks token in source control or `app.yaml`.

The deployed code expects `databricks-sdk` to be installed. Databricks injects app service-principal identity; the backend obtains a short-lived database credential at connection time. `PGHOST`, `PGUSER`, and `PGDATABASE` are connection values, while `LAKEBASE_ENDPOINT` identifies the endpoint for credential generation.

## Deploy

Create a Databricks App in the workspace, connect its Git source to the repository root (or upload the root directory), add the Lakebase resource as above, and deploy. The root `app.yaml` installs Python dependencies, builds Vite assets, then launches `backend/run.py`. The server uses `DATABRICKS_APP_PORT` (with `PORT` fallback locally).

After deployment, verify:

- `/` serves the React application.
- `/health` returns the application health response.
- `/ready` returns HTTP 200 with `metadata_engine: postgres` after it can query Lakebase; otherwise it returns HTTP 503.
- `/docs` serves FastAPI's API documentation.
- Create a test flow and confirm it remains after an app redeploy/restart.

## Local development

The existing local `backend/.env` settings can continue to use MySQL or standalone PostgreSQL. To test same-origin frontend requests locally, run FastAPI on port 8000 and Vite on 3000; Vite proxies `/api` requests to `http://localhost:8000` by default. Set `VITE_API_BASE_URL` only when a separately hosted API is required.

For a local production-style test, build the frontend and start `backend/run.py`. FastAPI serves both the interface and API from port 8000.

## Operational notes and limitations

- Current staged rows are stored in Lakebase as JSON records along with metadata. Large staging datasets can consume substantial Lakebase storage and transaction capacity. Load-test representative volumes before production use; a future change should move bulk staged records to Delta/Unity Catalog while leaving metadata in Lakebase.
- The cron scheduler is an in-process APScheduler service. Keep the Databricks app at a single running instance if schedules are enabled; multiple replicas would each start the scheduler and could duplicate scheduled runs. For horizontal scaling, migrate scheduling/execution to a Databricks Job or another single-consumer scheduler.
- Background schedules only run while the app process is running. Monitor the app and inspect History & Logs after scheduled runs.
- OAuth tokens are short-lived. The SQLAlchemy `do_connect` hook obtains a fresh Lakebase database credential for new physical connections; the pool is kept small and recycled. Stale connections are checked with `pool_pre_ping`.
- `/health` is a liveness endpoint; `/ready` checks database readiness. Configure deployment monitoring to use `/ready` when database readiness matters.
- The app currently allows source and destination credentials to be entered in its UI. Limit access to trusted users and review how those credentials are persisted before exposing the app broadly.

## References

- [Databricks Apps app.yaml runtime](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime)
- [Databricks Apps environment variables](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/environment-variables)
- [Lakebase resource for Databricks Apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase)
- [Lakebase Apps integration tutorial](https://docs.databricks.com/aws/en/oltp/projects/databricks-apps)
- [Lakebase authentication and token rotation](https://docs.databricks.com/aws/en/oltp/projects/authentication)
