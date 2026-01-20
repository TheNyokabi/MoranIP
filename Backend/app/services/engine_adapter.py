"""
Abstract Base Class for ERP Engine Adapters

Defines the interface that all ERP engine clients (ERPNext, Odoo, etc.) must implement.
This enables platform-agnostic ERP operations across different systems.

Author: MoranERP Team
"""

from typing import Dict, Optional
from abc import ABC, abstractmethod


class EngineAdapter(ABC):
    """
    Abstract base class for ERP engine adapters (ERPNext, Odoo, etc.)
    Defines the interface that all engine clients must implement.
    """
    
    def __init__(self, tenant_id: str, **kwargs):
        self.tenant_id = tenant_id
        self._init_credentials(**kwargs)
    
    @abstractmethod
    def _init_credentials(self, **kwargs):
        """Initialize engine-specific credentials."""
        pass
    
    # ==================== Resource CRUD Operations ====================
    
    @abstractmethod
    def list_resource(self, doctype: str, filters: Optional[Dict] = None) -> Dict:
        """
        List resources of a given type.
        
        Args:
            doctype: Document/Resource type (e.g., 'Customer', 'Item')
            filters: Optional filters to apply
            
        Returns:
            Dict with resource list in standardized format
        """
        pass
    
    @abstractmethod
    def get_resource(self, doctype: str, name: str) -> Dict:
        """
        Get a single resource by name/ID.
        
        Args:
            doctype: Document/Resource type
            name: Resource identifier
            
        Returns:
            Dict with resource data
        """
        pass
    
    @abstractmethod
    def create_resource(self, doctype: str, data: Dict) -> Dict:
        """
        Create a new resource.
        
        Args:
            doctype: Document/Resource type
            data: Resource data to create
            
        Returns:
            Dict with created resource data
        """
        pass
    
    @abstractmethod
    def update_resource(self, doctype: str, name: str, data: Dict) -> Dict:
        """
        Update an existing resource.
        
        Args:
            doctype: Document/Resource type
            name: Resource identifier
            data: Updated field values
            
        Returns:
            Dict with updated resource data
        """
        pass
    
    @abstractmethod
    def delete_resource(self, doctype: str, name: str) -> Dict:
        """
        Delete a resource.
        
        Args:
            doctype: Document/Resource type
            name: Resource identifier
            
        Returns:
            Dict with deletion confirmation
        """
        pass
    
    @abstractmethod
    def execute_method(self, method: str, **kwargs) -> Dict:
        """
        Execute an RPC method.
        
        Args:
            method: Method name to execute
            **kwargs: Method-specific arguments
            
        Returns:
            Dict with method execution result
        """
        pass
    
    # ==================== Engine Capabilities ====================
    
    @abstractmethod
    def supports_transactions(self) -> bool:
        """
        Check if engine supports transactions.
        
        Returns:
            True if transactions are supported
        """
        pass
    
    @abstractmethod
    def supports_audit_trail(self) -> bool:
        """
        Check if engine tracks change history.
        
        Returns:
            True if audit trail is available
        """
        pass
    
    # ==================== Helper Methods for Subclasses ====================
    
    def _wrap_response(self, data: any) -> Dict:
        """
        Wrap raw engine response in standard format.
        
        Args:
            data: Raw response from engine
            
        Returns:
            Standardized response dict
        """
        if isinstance(data, dict) and "data" in data:
            return data
        return {"data": data}
    
    def _handle_error(self, error: Exception) -> Dict:
        """
        Convert exception to standard error response.
        
        Args:
            error: Exception to convert
            
        Returns:
            Standardized error dict
        """
        return {
            "error": {
                "message": str(error),
                "type": type(error).__name__
            }
        }
