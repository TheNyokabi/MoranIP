"""
Business Intelligence Connector Service

Provides:
- Connectors for Power BI, Tableau, Metabase, etc.
- Data export capabilities
- Scheduled data sync
- Custom report generation
- Data transformation
"""

import logging
import json
import csv
import io
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any, Callable
from enum import Enum

from sqlalchemy.orm import Session

from ...models.enterprise import BIConnector, DataExport, DataExportRun

logger = logging.getLogger(__name__)


class ConnectorType(str, Enum):
    POWERBI = "powerbi"
    TABLEAU = "tableau"
    METABASE = "metabase"
    GOOGLE_DATASTUDIO = "google_datastudio"
    CUSTOM = "custom"


class DataSource(str, Enum):
    SALES = "sales"
    INVENTORY = "inventory"
    CUSTOMERS = "customers"
    PRODUCTS = "products"
    PURCHASES = "purchases"
    PAYMENTS = "payments"
    POS_SESSIONS = "pos_sessions"
    EMPLOYEES = "employees"
    ANALYTICS = "analytics"


class ExportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    PARQUET = "parquet"
    EXCEL = "excel"


class DestinationType(str, Enum):
    S3 = "s3"
    GCS = "gcs"
    AZURE_BLOB = "azure_blob"
    WEBHOOK = "webhook"
    SFTP = "sftp"
    LOCAL = "local"


class BIConnectorService:
    """Service for Business Intelligence integrations"""
    
    def __init__(
        self,
        db: Session,
        tenant_id: str,
        erpnext_adapter=None
    ):
        self.db = db
        self.tenant_id = tenant_id
        self.erpnext_adapter = erpnext_adapter
        
        # Data source extractors
        self._extractors: Dict[DataSource, Callable] = {
            DataSource.SALES: self._extract_sales,
            DataSource.INVENTORY: self._extract_inventory,
            DataSource.CUSTOMERS: self._extract_customers,
            DataSource.PRODUCTS: self._extract_products,
            DataSource.PURCHASES: self._extract_purchases,
            DataSource.POS_SESSIONS: self._extract_pos_sessions,
        }
    
    # ==================== Connector Management ====================
    
    def create_connector(
        self,
        name: str,
        connector_type: str,
        connection_settings: Dict[str, Any],
        enabled_data_sources: List[str],
        sync_frequency: str = "hourly",
        created_by: Optional[str] = None
    ) -> BIConnector:
        """Create a new BI connector"""
        connector = BIConnector(
            tenant_id=self.tenant_id,
            name=name,
            connector_type=connector_type,
            connection_settings=connection_settings,
            enabled_data_sources=enabled_data_sources,
            sync_frequency=sync_frequency,
            sync_enabled=True,
            created_by=created_by
        )
        
        self.db.add(connector)
        self.db.commit()
        self.db.refresh(connector)
        
        logger.info(f"Created BI connector: {name} ({connector_type})")
        return connector
    
    def get_connectors(self) -> List[BIConnector]:
        """Get all BI connectors for tenant"""
        return self.db.query(BIConnector).filter(
            BIConnector.tenant_id == self.tenant_id
        ).all()
    
    def get_connector(self, connector_id: str) -> Optional[BIConnector]:
        """Get a specific connector"""
        return self.db.query(BIConnector).filter(
            BIConnector.id == connector_id,
            BIConnector.tenant_id == self.tenant_id
        ).first()
    
    def update_connector(
        self,
        connector_id: str,
        updates: Dict[str, Any]
    ) -> Optional[BIConnector]:
        """Update connector settings"""
        connector = self.get_connector(connector_id)
        if not connector:
            return None
        
        allowed_fields = [
            'name', 'connection_settings', 'sync_enabled',
            'sync_frequency', 'enabled_data_sources', 'status'
        ]
        
        for field, value in updates.items():
            if field in allowed_fields:
                setattr(connector, field, value)
        
        self.db.commit()
        self.db.refresh(connector)
        
        return connector
    
    def delete_connector(self, connector_id: str) -> bool:
        """Delete a connector"""
        connector = self.get_connector(connector_id)
        if not connector:
            return False
        
        self.db.delete(connector)
        self.db.commit()
        return True
    
    # ==================== Data Extraction ====================
    
    async def extract_data(
        self,
        data_source: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        filters: Optional[Dict] = None,
        columns: Optional[List[str]] = None,
        limit: int = 10000
    ) -> List[Dict[str, Any]]:
        """Extract data from a source"""
        try:
            source = DataSource(data_source)
            extractor = self._extractors.get(source)
            
            if not extractor:
                logger.error(f"No extractor for data source: {data_source}")
                return []
            
            return await extractor(from_date, to_date, filters, columns, limit)
        
        except ValueError:
            logger.error(f"Invalid data source: {data_source}")
            return []
    
    async def _extract_sales(
        self,
        from_date: Optional[datetime],
        to_date: Optional[datetime],
        filters: Optional[Dict],
        columns: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Extract sales data"""
        if not self.erpnext_adapter:
            return []
        
        default_columns = [
            "name", "posting_date", "customer", "customer_name",
            "grand_total", "net_total", "total_taxes_and_charges",
            "status", "currency", "creation"
        ]
        
        erpnext_filters = [["docstatus", "=", 1]]
        
        if from_date:
            erpnext_filters.append(["posting_date", ">=", from_date.strftime("%Y-%m-%d")])
        if to_date:
            erpnext_filters.append(["posting_date", "<=", to_date.strftime("%Y-%m-%d")])
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice",
                fields=columns or default_columns,
                filters=erpnext_filters,
                limit=limit
            )
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error extracting sales: {e}")
            return []
    
    async def _extract_inventory(
        self,
        from_date: Optional[datetime],
        to_date: Optional[datetime],
        filters: Optional[Dict],
        columns: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Extract inventory data"""
        if not self.erpnext_adapter:
            return []
        
        default_columns = [
            "item_code", "warehouse", "actual_qty",
            "reserved_qty", "ordered_qty", "valuation_rate"
        ]
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Bin",
                fields=columns or default_columns,
                filters=[],
                limit=limit
            )
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error extracting inventory: {e}")
            return []
    
    async def _extract_customers(
        self,
        from_date: Optional[datetime],
        to_date: Optional[datetime],
        filters: Optional[Dict],
        columns: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Extract customer data"""
        if not self.erpnext_adapter:
            return []
        
        default_columns = [
            "name", "customer_name", "customer_type", "customer_group",
            "territory", "email_id", "mobile_no", "creation"
        ]
        
        erpnext_filters = [["disabled", "=", 0]]
        
        if from_date:
            erpnext_filters.append(["creation", ">=", from_date.isoformat()])
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Customer",
                fields=columns or default_columns,
                filters=erpnext_filters,
                limit=limit
            )
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error extracting customers: {e}")
            return []
    
    async def _extract_products(
        self,
        from_date: Optional[datetime],
        to_date: Optional[datetime],
        filters: Optional[Dict],
        columns: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Extract product data"""
        if not self.erpnext_adapter:
            return []
        
        default_columns = [
            "item_code", "item_name", "item_group", "brand",
            "standard_rate", "valuation_rate", "is_stock_item",
            "has_serial_no", "has_batch_no"
        ]
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Item",
                fields=columns or default_columns,
                filters=[["disabled", "=", 0]],
                limit=limit
            )
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error extracting products: {e}")
            return []
    
    async def _extract_purchases(
        self,
        from_date: Optional[datetime],
        to_date: Optional[datetime],
        filters: Optional[Dict],
        columns: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Extract purchase data"""
        if not self.erpnext_adapter:
            return []
        
        default_columns = [
            "name", "posting_date", "supplier", "supplier_name",
            "grand_total", "status", "creation"
        ]
        
        erpnext_filters = [["docstatus", "=", 1]]
        
        if from_date:
            erpnext_filters.append(["posting_date", ">=", from_date.strftime("%Y-%m-%d")])
        if to_date:
            erpnext_filters.append(["posting_date", "<=", to_date.strftime("%Y-%m-%d")])
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Purchase Invoice",
                fields=columns or default_columns,
                filters=erpnext_filters,
                limit=limit
            )
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error extracting purchases: {e}")
            return []
    
    async def _extract_pos_sessions(
        self,
        from_date: Optional[datetime],
        to_date: Optional[datetime],
        filters: Optional[Dict],
        columns: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Extract POS session data"""
        if not self.erpnext_adapter:
            return []
        
        default_columns = [
            "name", "pos_profile", "user",
            "opening_amount", "closing_amount",
            "status", "creation"
        ]
        
        erpnext_filters = []
        
        if from_date:
            erpnext_filters.append(["creation", ">=", from_date.isoformat()])
        if to_date:
            erpnext_filters.append(["creation", "<=", to_date.isoformat()])
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="POS Opening Entry",
                fields=columns or default_columns,
                filters=erpnext_filters,
                limit=limit
            )
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error extracting POS sessions: {e}")
            return []
    
    # ==================== Data Export ====================
    
    def create_export(
        self,
        name: str,
        data_source: str,
        destination_type: str,
        destination_config: Dict[str, Any],
        export_format: str = "json",
        filters: Optional[Dict] = None,
        columns: Optional[List[str]] = None,
        schedule: Optional[str] = None,
        connector_id: Optional[str] = None
    ) -> DataExport:
        """Create a data export configuration"""
        export = DataExport(
            tenant_id=self.tenant_id,
            connector_id=connector_id,
            name=name,
            data_source=data_source,
            export_format=export_format,
            filters=filters or {},
            columns=columns or [],
            destination_type=destination_type,
            destination_config=destination_config,
            schedule=schedule,
            is_scheduled=schedule is not None
        )
        
        self.db.add(export)
        self.db.commit()
        self.db.refresh(export)
        
        logger.info(f"Created data export: {name}")
        return export
    
    def get_exports(self) -> List[DataExport]:
        """Get all data exports for tenant"""
        return self.db.query(DataExport).filter(
            DataExport.tenant_id == self.tenant_id
        ).all()
    
    async def run_export(
        self,
        export_id: str,
        triggered_by: str = "manual",
        triggered_by_user: Optional[str] = None
    ) -> Optional[DataExportRun]:
        """Execute a data export"""
        export = self.db.query(DataExport).filter(
            DataExport.id == export_id,
            DataExport.tenant_id == self.tenant_id
        ).first()
        
        if not export:
            return None
        
        # Create run record
        run = DataExportRun(
            export_id=export_id,
            tenant_id=self.tenant_id,
            started_at=datetime.utcnow(),
            triggered_by=triggered_by,
            triggered_by_user=triggered_by_user,
            status="running"
        )
        
        self.db.add(run)
        self.db.commit()
        
        try:
            # Extract data
            data = await self.extract_data(
                data_source=export.data_source,
                filters=export.filters,
                columns=export.columns if export.columns else None,
                limit=100000
            )
            
            # Format data
            formatted = self._format_data(data, export.export_format)
            
            # Upload to destination
            file_url = await self._upload_to_destination(
                formatted,
                export.destination_type,
                export.destination_config,
                export.export_format,
                export.name
            )
            
            # Update run record
            run.status = "completed"
            run.completed_at = datetime.utcnow()
            run.records_exported = len(data)
            run.file_size_bytes = len(formatted.encode() if isinstance(formatted, str) else formatted)
            run.file_url = file_url
            
            # Update export last run
            export.last_run_at = datetime.utcnow()
            export.last_run_status = "completed"
            export.last_run_records = len(data)
            
            self.db.commit()
            self.db.refresh(run)
            
            logger.info(f"Export completed: {export.name}, {len(data)} records")
            return run
        
        except Exception as e:
            run.status = "failed"
            run.completed_at = datetime.utcnow()
            run.error_message = str(e)
            
            export.last_run_at = datetime.utcnow()
            export.last_run_status = "failed"
            
            self.db.commit()
            
            logger.error(f"Export failed: {export.name}, {e}")
            return run
    
    def _format_data(
        self,
        data: List[Dict[str, Any]],
        format_type: str
    ) -> Any:
        """Format data for export"""
        if format_type == "json":
            return json.dumps(data, default=str, indent=2)
        
        elif format_type == "csv":
            if not data:
                return ""
            
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
            return output.getvalue()
        
        elif format_type == "parquet":
            # Would require pyarrow
            return json.dumps(data, default=str)
        
        else:
            return json.dumps(data, default=str)
    
    async def _upload_to_destination(
        self,
        data: Any,
        destination_type: str,
        config: Dict[str, Any],
        format_type: str,
        export_name: str
    ) -> Optional[str]:
        """Upload formatted data to destination"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{export_name}_{timestamp}.{format_type}"
        
        if destination_type == "webhook":
            # POST to webhook URL
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    config.get("url"),
                    content=data.encode() if isinstance(data, str) else data,
                    headers=config.get("headers", {})
                )
                response.raise_for_status()
            return config.get("url")
        
        elif destination_type == "s3":
            # Would use boto3
            return f"s3://{config.get('bucket')}/{config.get('prefix', '')}{filename}"
        
        elif destination_type == "local":
            # Save locally (for development)
            path = f"/tmp/exports/{filename}"
            import os
            os.makedirs("/tmp/exports", exist_ok=True)
            with open(path, 'w') as f:
                f.write(data if isinstance(data, str) else data.decode())
            return path
        
        return None
    
    def get_export_runs(
        self,
        export_id: str,
        limit: int = 50
    ) -> List[DataExportRun]:
        """Get export run history"""
        return self.db.query(DataExportRun).filter(
            DataExportRun.export_id == export_id
        ).order_by(
            DataExportRun.started_at.desc()
        ).limit(limit).all()
    
    # ==================== Available Data Sources ====================
    
    def get_available_data_sources(self) -> List[Dict[str, Any]]:
        """Get list of available data sources"""
        return [
            {
                "id": ds.value,
                "name": ds.value.replace("_", " ").title(),
                "description": self._get_source_description(ds)
            }
            for ds in DataSource
        ]
    
    def _get_source_description(self, source: DataSource) -> str:
        """Get description for data source"""
        descriptions = {
            DataSource.SALES: "Sales invoices and transactions",
            DataSource.INVENTORY: "Current stock levels by warehouse",
            DataSource.CUSTOMERS: "Customer master data",
            DataSource.PRODUCTS: "Product/Item master data",
            DataSource.PURCHASES: "Purchase invoices and transactions",
            DataSource.PAYMENTS: "Payment entries and receipts",
            DataSource.POS_SESSIONS: "POS session data",
            DataSource.EMPLOYEES: "Employee master data",
            DataSource.ANALYTICS: "Aggregated analytics data"
        }
        return descriptions.get(source, "")
