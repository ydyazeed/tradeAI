"""Railway startup script — surfaces import/startup errors clearly."""
import os
import sys
import subprocess

def main():
    # 1. Run alembic migrations
    print("=== Running migrations ===", flush=True)
    result = subprocess.run(["alembic", "upgrade", "head"], capture_output=False)
    if result.returncode != 0:
        print(f"!!! Alembic failed with exit code {result.returncode}", flush=True)
        sys.exit(1)

    # 2. Test app import
    print("=== Testing app import ===", flush=True)
    try:
        from app.main import app  # noqa: F401
        print("App import OK", flush=True)
    except Exception as e:
        print(f"!!! App import FAILED: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 3. Start uvicorn
    port = os.environ.get("PORT", "8000")
    print(f"=== Starting uvicorn on port {port} ===", flush=True)
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(port), log_level="info")

if __name__ == "__main__":
    main()
