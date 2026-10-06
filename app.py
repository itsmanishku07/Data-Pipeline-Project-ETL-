import os
import sys
import uvicorn

root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from backend.app.main import app

if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", "8000"))
    print(f"Starting DataFlow Studio on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
