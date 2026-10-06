import os
import sys
import uvicorn

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", "8000"))
    print(f"Starting DataFlow Studio on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
