"""
Base PoS Service Interface
Platform-agnostic PoS operations
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime


class PosServiceBase(ABC):
    """Abstract base class for PoS operations"""
    
    # ==================== Profile Management ====================
    
    @abstractmethod
    async def create_profile(
        self,
        name: str,
        warehouse: str,
        payment_methods: List[Dict[str, Any]],
        session_settings: Dict[str, Any],
        inventory_settings: Dict[str, Any],
        receipt_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a new PoS profile"""
        pass
    
    @abstractmethod
    async def get_profile(self, profile_id: str) -> Dict[str, Any]:
        """Get PoS profile by ID"""
        pass
    
    @abstractmethod
    async def list_profiles(
        self,
        warehouse: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List PoS profiles"""
        pass
    
    @abstractmethod
    async def update_profile(
        self,
        profile_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Update PoS profile"""
        pass
    
    @abstractmethod
    async def delete_profile(self, profile_id: str) -> bool:
        """Delete PoS profile"""
        pass
    
    # ==================== Session Management ====================
    
    @abstractmethod
    async def open_session(
        self,
        profile_id: str,
        user: str,
        opening_cash: Optional[float] = None
    ) -> Dict[str, Any]:
        """Open a new PoS session"""
        pass
    
    @abstractmethod
    async def get_session(self, session_id: str) -> Dict[str, Any]:
        """Get session details"""
        pass
    
    @abstractmethod
    async def list_sessions(
        self,
        profile_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List PoS sessions"""
        pass
    
    @abstractmethod
    async def close_session(
        self,
        session_id: str,
        closing_cash: Optional[float] = None
    ) -> Dict[str, Any]:
        """Close PoS session"""
        pass
    
    # ==================== Order Management ====================
    
    @abstractmethod
    async def create_order(
        self,
        session_id: str,
        items: List[Dict[str, Any]],
        customer: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new PoS order"""
        pass
    
    @abstractmethod
    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """Get order details"""
        pass
    
    @abstractmethod
    async def update_order(
        self,
        order_id: str,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Update order items"""
        pass
    
    @abstractmethod
    async def process_payment(
        self,
        order_id: str,
        payment_method: str,
        amount: float
    ) -> Dict[str, Any]:
        """Process payment for order"""
        pass
    
    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel order"""
        pass
    
    # ==================== Account Resolution ====================
    
    @abstractmethod
    async def get_payment_account(self, mode_of_payment: str, company: str) -> str:
        """Get GL account for a payment mode"""
        pass
    
    @abstractmethod
    async def validate_accounts_exist(self, account_list: List[str], company: str) -> bool:
        """Validate that accounts exist in chart of accounts"""
        pass
    
    @abstractmethod
    async def get_pos_profile_details(self, profile_id: str) -> Dict[str, Any]:
        """Get POS Profile with account mappings"""
        pass