import os
import urllib.parse
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

# Custom robust .env parser (reads backend/.env and root .env)
def load_env_file(env_path: Path):
    if env_path.exists() and env_path.is_file():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        # Do not overwrite existing environment variables if already set
                        os.environ[k] = v
        except Exception as e:
            print(f"[WARN] Failed to load .env from {env_path}: {e}")

# Load backend .env file
load_env_file(BASE_DIR / ".env")

class Settings(BaseModel):
    APP_NAME: str = "DataFlow SparkLake Studio"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    SPARK_APP_NAME: str = "DataFlowStudioEngine"
    SPARK_MASTER: str = "local[*]"
    DEFAULT_PAGE_SIZE: int = 50

    # Active Metadata Storage Engine: 'mysql' or 'postgres'
    METADATA_ENGINE: str = os.getenv("METADATA_ENGINE", "mysql").lower()

    # MySQL Metadata Storage Config
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "3435")
    MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "dataflow_metadata")

    # PostgreSQL Metadata Storage Config
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DATABASE: str = os.getenv("POSTGRES_DATABASE", "dataflow_metadata")
    POSTGRES_SCHEMA: str = os.getenv("POSTGRES_SCHEMA", "public")

    def get_mysql_metadata_url(self) -> str:
        user = urllib.parse.quote_plus(self.MYSQL_USER)
        pwd = f":{urllib.parse.quote_plus(self.MYSQL_PASSWORD)}" if self.MYSQL_PASSWORD else ""
        return f"mysql+pymysql://{user}{pwd}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"

    def get_postgres_metadata_url(self) -> str:
        user = urllib.parse.quote_plus(self.POSTGRES_USER)
        pwd = f":{urllib.parse.quote_plus(self.POSTGRES_PASSWORD)}" if self.POSTGRES_PASSWORD else ""
        return f"postgresql+psycopg2://{user}{pwd}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DATABASE}"

    def get_active_metadata_url(self) -> str:
        if self.METADATA_ENGINE == "postgres":
            return self.get_postgres_metadata_url()
        return self.get_mysql_metadata_url()

settings = Settings()
