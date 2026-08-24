from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any, Optional
import pandas as pd
from ..models.schemas import SchemaInspectionResult

class BaseConnector(ABC):
    @abstractmethod
    def test_connection(self) -> Tuple[bool, str]:
        """Verify connectivity to the target data source."""
        pass

    @abstractmethod
    def extract_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        """Extract data from the source into a DataFrame."""
        pass

    @abstractmethod
    def get_source_summary(self) -> str:
        """Return human-readable summary of source."""
        pass
