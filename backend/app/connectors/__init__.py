from .base import BaseConnector
from .s3_connector import S3Connector
from .azure_connector import AzureLakehouseConnector
from .database_connector import DatabaseConnector
from .local_connector import LocalConnector
from ..models.schemas import SourceType, SourceConnectionRequest

def get_connector(request: SourceConnectionRequest) -> BaseConnector:
    stype = request.source_type
    if stype == SourceType.S3:
        return S3Connector(request.s3_config)
    elif stype == SourceType.AZURE_LAKEHOUSE:
        return AzureLakehouseConnector(request.azure_config)
    elif stype == SourceType.DATABASE:
        return DatabaseConnector(request.database_config)
    elif stype in [SourceType.LOCAL_CATALOG, SourceType.FILE_UPLOAD]:
        return LocalConnector(request.local_config)
    else:
        raise ValueError(f"Unsupported source type: {stype}")
