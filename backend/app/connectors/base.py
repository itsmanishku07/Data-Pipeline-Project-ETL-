from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any, Optional
from datetime import datetime
import pandas as pd

class BaseConnector(ABC):
    @abstractmethod
    def test_connection(self) -> Tuple[bool, str]:
        """Verify connectivity to the target data source."""
        pass

    @abstractmethod
    def extract_data(
        self, 
        limit: Optional[int] = None,
        watermark_col: Optional[str] = None,
        last_watermark: Optional[str] = None
    ) -> pd.DataFrame:
        """Extract data from the source into a DataFrame with optional incremental watermark filtering."""
        pass

    @abstractmethod
    def get_source_summary(self) -> str:
        """Return human-readable summary of source."""
        pass

    @staticmethod
    def append_audit_timestamp(df: pd.DataFrame, force_new: bool = False) -> pd.DataFrame:
        """
        Appends or refreshes the standard enterprise audit column `aud_last_update`
        with high-precision UTC timestamp (ISO 8601).
        """
        if df is None:
            return df
        
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        if "aud_last_update" not in df.columns or force_new:
            df["aud_last_update"] = now_iso
        else:
            # Fill any null audit timestamps with current sync time
            df["aud_last_update"] = df["aud_last_update"].fillna(now_iso)
        return df
