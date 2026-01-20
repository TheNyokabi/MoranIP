"""
Response Normalizer Middleware

Normalizes responses from different ERP engines into a common format.
Handles both success responses and errors consistently across engines.

Author: MoranERP Team
"""

from typing import Dict, Any


class ResponseNormalizer:
    """
    Normalizes responses from different ERP engines into a common format.
    Handles both success responses and errors.
    """
    
    @staticmethod
    def normalize_erpnext(response: Any) -> Dict:
        """
        Normalize ERPNext response to common format.
        
        ERPNext API returns responses in different formats:
        - Success: {"message": {...}} or {"data": {...}}
        - Error: {"message": "error"} or {"exc": "..."}
        
        We normalize all successful responses to {"data": {...}} format.
        
        Args:
            response: Raw ERPNext response
            
        Returns:
            Standardized response dict with "data" key
        """
        if isinstance(response, dict):
            # If already has "data" key, return as-is
            if "data" in response:
                return response
            
            # If has "message" key (ERPNext success format), wrap it
            if "message" in response:
                return {"data": response["message"]}
            
            # If it's an error response (has "error" or "exc"), return as-is
            if "error" in response or "exc" in response:
                return response
            
            # Otherwise, wrap the entire dict in "data"
            return {"data": response}
        
        # Wrap primitive responses
        return {"data": response}
    
    @staticmethod
    def normalize_odoo(response: Any) -> Dict:
        """
        Normalize Odoo XML-RPC response to common format.
        
        Args:
            response: Raw Odoo XML-RPC response
            
        Returns:
            Standardized response dict
        """
        if isinstance(response, (list, dict)):
            return {"data": response}
        
        return {"data": response}
    
    @staticmethod
    def normalize_error(message: str, error_type: str = "unknown", code: int = 500) -> Dict:
        """
        Create standardized error response.
        
        Args:
            message: Error message
            error_type: Type of error
            code: HTTP status code
            
        Returns:
            Standardized error dict
        """
        return {
            "error": {
                "message": message,
                "type": error_type,
                "code": code
            }
        }
    
    @staticmethod
    def is_error(response: Dict) -> bool:
        """
        Check if response contains an error.
        
        Args:
            response: Response dict to check
            
        Returns:
            True if response contains error
        """
        return "error" in response
    
    @staticmethod
    def normalize_list(response: Any, resource_name: str = "items") -> Dict:
        """
        Normalize a list response to common format.
        
        For list endpoints, we return {"items": [...]} or {"{resource_name}": [...]}
        instead of {"data": [...]} for better API clarity.
        
        Args:
            response: Raw response (list or dict)
            resource_name: Name of the resource (e.g., "items", "warehouses", "customers")
            
        Returns:
            Standardized list response dict
        """
        if isinstance(response, list):
            return {resource_name: response}
        
        if isinstance(response, dict):
            # If already has the resource_name key, return as-is
            if resource_name in response:
                return response
            
            # If has "data" key, extract and rename
            if "data" in response:
                return {resource_name: response["data"]}
            
            # If has "message" key (ERPNext format), extract and rename
            if "message" in response:
                message = response["message"]
                if isinstance(message, list):
                    return {resource_name: message}
                return {resource_name: [message]}
            
            # Otherwise, wrap in resource_name
            return {resource_name: [response]}
        
        # Wrap primitive responses
        return {resource_name: [response]}
    
    @staticmethod
    def normalize_single(response: Any) -> Dict:
        """
        Normalize a single resource response to common format.
        
        This is an alias for normalize_erpnext for clarity when dealing
        with single resources vs lists.
        
        Args:
            response: Raw response
            
        Returns:
            Standardized response dict with "data" key
        """
        return ResponseNormalizer.normalize_erpnext(response)