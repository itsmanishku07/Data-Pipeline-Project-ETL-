import os
from pathlib import Path
from typing import Optional, Tuple
import pandas as pd
from ..config import settings
from .base import BaseConnector
from ..models.schemas import LocalSourceConfig, FileFormat

class LocalConnector(BaseConnector):
    def __init__(self, config: LocalSourceConfig):
        self.config = config

    def _resolve_path(self) -> Path:
        if self.config.file_path:
            return Path(self.config.file_path)
        raise ValueError("No file path specified for file ingestion.")

    def test_connection(self) -> Tuple[bool, str]:
        try:
            path = self._resolve_path()
            if path.exists():
                return True, f"Located uploaded dataset at {path.name} ({path.stat().st_size / 1024:.1f} KB)"
            return False, f"File '{path}' does not exist on filesystem."
        except Exception as e:
            return False, f"File source validation failed: {str(e)}"

    def extract_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        path = self._resolve_path()
        if not path.exists():
            raise FileNotFoundError(f"Source file {path} not found.")

        suffix = path.suffix.lower()
        if suffix == ".parquet":
            df = pd.read_parquet(path)
        elif suffix == ".json":
            df = pd.read_json(path)
        elif suffix in [".csv", ".txt", ".tsv"]:
            delimiter = self.config.delimiter if self.config else ","
            df = pd.read_csv(path, delimiter=delimiter, nrows=limit if limit else None)
        else:
            try:
                df = pd.read_parquet(path)
            except Exception:
                df = pd.read_csv(path, nrows=limit if limit else None)

        if limit and len(df) > limit:
            df = df.head(limit)
        return df

    def get_source_summary(self) -> str:
        if self.config.file_path:
            return f"File: {Path(self.config.file_path).name}"
        return "Uploaded File"
