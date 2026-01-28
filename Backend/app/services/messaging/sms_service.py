"""
SMS Integration Service

Supports multiple providers:
- Africa's Talking (Primary for East Africa)
- Twilio (Alternative/International)

Features:
- Single SMS sending
- Bulk SMS
- OTP/Verification codes
- Delivery status tracking
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum
import secrets

import httpx
from pydantic import BaseModel

from ...config import settings

logger = logging.getLogger(__name__)


class SMSProvider(str, Enum):
    AFRICAS_TALKING = "africas_talking"
    TWILIO = "twilio"


class SMSStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    REJECTED = "rejected"


class SMSMessage(BaseModel):
    """SMS message record"""
    id: str
    phone_number: str
    message: str
    provider: SMSProvider
    status: SMSStatus = SMSStatus.PENDING
    cost: Optional[float] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SMSProviderBase(ABC):
    """Base class for SMS providers"""
    
    @abstractmethod
    async def send_sms(self, phone: str, message: str) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    async def send_bulk_sms(self, phones: List[str], message: str) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    async def get_delivery_status(self, message_id: str) -> Optional[Dict[str, Any]]:
        pass


class AfricasTalkingProvider(SMSProviderBase):
    """Africa's Talking SMS provider"""
    
    API_URL = "https://api.africastalking.com/version1/messaging"
    SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging"
    
    def __init__(
        self,
        api_key: str,
        username: str,
        sender_id: Optional[str] = None,
        is_sandbox: bool = False
    ):
        self.api_key = api_key
        self.username = username
        self.sender_id = sender_id
        self.base_url = self.SANDBOX_URL if is_sandbox else self.API_URL
        self._client = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={
                    "apiKey": self.api_key,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def send_sms(self, phone: str, message: str) -> Dict[str, Any]:
        """Send a single SMS"""
        phone = self._normalize_phone(phone)
        
        data = {
            "username": self.username,
            "to": phone,
            "message": message
        }
        
        if self.sender_id:
            data["from"] = self.sender_id
        
        try:
            response = await self.client.post(self.base_url, data=data)
            response.raise_for_status()
            result = response.json()
            
            sms_data = result.get("SMSMessageData", {})
            recipients = sms_data.get("Recipients", [])
            
            if recipients:
                recipient = recipients[0]
                status = recipient.get("status", "Unknown")
                
                if status == "Success":
                    logger.info(f"SMS sent to {phone}")
                    return {
                        "success": True,
                        "message_id": recipient.get("messageId"),
                        "phone": phone,
                        "cost": recipient.get("cost"),
                        "status": SMSStatus.SENT.value
                    }
                else:
                    logger.warning(f"SMS failed to {phone}: {status}")
                    return {
                        "success": False,
                        "phone": phone,
                        "error": recipient.get("status"),
                        "status": SMSStatus.FAILED.value
                    }
            
            return {
                "success": False,
                "phone": phone,
                "error": "No recipients in response",
                "status": SMSStatus.FAILED.value
            }
        
        except httpx.HTTPStatusError as e:
            error_msg = str(e)
            logger.error(f"Africa's Talking API error: {error_msg}")
            return {
                "success": False,
                "phone": phone,
                "error": error_msg,
                "status": SMSStatus.FAILED.value
            }
        except Exception as e:
            logger.error(f"SMS send error: {str(e)}")
            return {
                "success": False,
                "phone": phone,
                "error": str(e),
                "status": SMSStatus.FAILED.value
            }
    
    async def send_bulk_sms(self, phones: List[str], message: str) -> Dict[str, Any]:
        """Send SMS to multiple recipients"""
        normalized_phones = [self._normalize_phone(p) for p in phones]
        phone_list = ",".join(normalized_phones)
        
        data = {
            "username": self.username,
            "to": phone_list,
            "message": message
        }
        
        if self.sender_id:
            data["from"] = self.sender_id
        
        try:
            response = await self.client.post(self.base_url, data=data)
            response.raise_for_status()
            result = response.json()
            
            sms_data = result.get("SMSMessageData", {})
            recipients = sms_data.get("Recipients", [])
            
            results = []
            success_count = 0
            for recipient in recipients:
                status = recipient.get("status", "Unknown")
                is_success = status == "Success"
                if is_success:
                    success_count += 1
                
                results.append({
                    "phone": recipient.get("number"),
                    "message_id": recipient.get("messageId"),
                    "status": SMSStatus.SENT.value if is_success else SMSStatus.FAILED.value,
                    "cost": recipient.get("cost"),
                    "error": None if is_success else status
                })
            
            return {
                "success": success_count > 0,
                "total_sent": len(phones),
                "success_count": success_count,
                "failed_count": len(phones) - success_count,
                "results": results
            }
        
        except Exception as e:
            logger.error(f"Bulk SMS error: {str(e)}")
            return {
                "success": False,
                "total_sent": len(phones),
                "success_count": 0,
                "failed_count": len(phones),
                "error": str(e)
            }
    
    async def get_delivery_status(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get delivery status (Africa's Talking sends via callback)"""
        # Africa's Talking sends delivery reports via webhooks
        # This would need to query a local database storing webhook updates
        return None
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number to international format"""
        phone = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        if not phone.startswith('+'):
            # Handle Kenyan numbers
            if phone.startswith('0') and len(phone) == 10:
                phone = '+254' + phone[1:]
            elif phone.startswith('7') and len(phone) == 9:
                phone = '+254' + phone
            elif phone.startswith('254'):
                phone = '+' + phone
            else:
                phone = '+' + phone
        
        return phone


class TwilioProvider(SMSProviderBase):
    """Twilio SMS provider"""
    
    API_URL = "https://api.twilio.com/2010-04-01"
    
    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        phone_number: str
    ):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = phone_number
        self._client = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                auth=(self.account_sid, self.auth_token),
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def send_sms(self, phone: str, message: str) -> Dict[str, Any]:
        """Send a single SMS via Twilio"""
        phone = self._normalize_phone(phone)
        
        url = f"{self.API_URL}/Accounts/{self.account_sid}/Messages.json"
        data = {
            "To": phone,
            "From": self.from_number,
            "Body": message
        }
        
        try:
            response = await self.client.post(url, data=data)
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Twilio SMS sent to {phone}")
            return {
                "success": True,
                "message_id": result.get("sid"),
                "phone": phone,
                "status": result.get("status")
            }
        
        except httpx.HTTPStatusError as e:
            error_data = e.response.json() if e.response.content else {}
            logger.error(f"Twilio API error: {error_data}")
            return {
                "success": False,
                "phone": phone,
                "error": error_data.get("message", str(e)),
                "status": SMSStatus.FAILED.value
            }
        except Exception as e:
            logger.error(f"Twilio send error: {str(e)}")
            return {
                "success": False,
                "phone": phone,
                "error": str(e),
                "status": SMSStatus.FAILED.value
            }
    
    async def send_bulk_sms(self, phones: List[str], message: str) -> Dict[str, Any]:
        """Send SMS to multiple recipients (sequentially for Twilio)"""
        results = []
        success_count = 0
        
        for phone in phones:
            result = await self.send_sms(phone, message)
            results.append(result)
            if result.get("success"):
                success_count += 1
        
        return {
            "success": success_count > 0,
            "total_sent": len(phones),
            "success_count": success_count,
            "failed_count": len(phones) - success_count,
            "results": results
        }
    
    async def get_delivery_status(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get delivery status from Twilio"""
        url = f"{self.API_URL}/Accounts/{self.account_sid}/Messages/{message_id}.json"
        
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            result = response.json()
            
            return {
                "message_id": result.get("sid"),
                "status": result.get("status"),
                "error_code": result.get("error_code"),
                "error_message": result.get("error_message")
            }
        except Exception as e:
            logger.error(f"Twilio status check error: {str(e)}")
            return None
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number for Twilio (E.164 format)"""
        phone = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        if not phone.startswith('+'):
            if phone.startswith('0') and len(phone) == 10:
                phone = '+254' + phone[1:]
            elif phone.startswith('7') and len(phone) == 9:
                phone = '+254' + phone
            elif phone.startswith('254'):
                phone = '+' + phone
            else:
                phone = '+' + phone
        
        return phone


class SMSService:
    """Unified SMS service supporting multiple providers"""
    
    def __init__(self, provider: SMSProviderBase, provider_name: SMSProvider):
        self.provider = provider
        self.provider_name = provider_name
    
    async def close(self):
        await self.provider.close()
    
    async def send_sms(
        self,
        phone: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send a single SMS"""
        result = await self.provider.send_sms(phone, message)
        result["provider"] = self.provider_name.value
        result["metadata"] = metadata
        return result
    
    async def send_bulk_sms(
        self,
        phones: List[str],
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send SMS to multiple recipients"""
        result = await self.provider.send_bulk_sms(phones, message)
        result["provider"] = self.provider_name.value
        result["metadata"] = metadata
        return result
    
    async def send_receipt(
        self,
        phone: str,
        customer_name: str,
        invoice_number: str,
        total: str,
        business_name: str = "MoranERP"
    ) -> Dict[str, Any]:
        """Send receipt SMS"""
        message = (
            f"Thank you {customer_name}! "
            f"Your purchase at {business_name} is confirmed. "
            f"Invoice: {invoice_number}, Total: {total}. "
            f"Thank you for your business!"
        )
        return await self.send_sms(phone, message, {"type": "receipt", "invoice": invoice_number})
    
    async def send_otp(
        self,
        phone: str,
        otp: Optional[str] = None,
        expiry_minutes: int = 5
    ) -> Dict[str, Any]:
        """Send OTP for verification"""
        if otp is None:
            otp = ''.join(secrets.choice('0123456789') for _ in range(6))
        
        message = (
            f"Your MoranERP verification code is: {otp}. "
            f"Valid for {expiry_minutes} minutes. "
            f"Do not share this code with anyone."
        )
        
        result = await self.send_sms(phone, message, {"type": "otp"})
        result["otp"] = otp  # Return OTP for verification
        return result
    
    async def send_payment_reminder(
        self,
        phone: str,
        customer_name: str,
        invoice_number: str,
        amount_due: str,
        due_date: str
    ) -> Dict[str, Any]:
        """Send payment reminder"""
        message = (
            f"Dear {customer_name}, "
            f"Reminder: Invoice {invoice_number} for {amount_due} is due on {due_date}. "
            f"Please make payment to avoid late fees. Thank you!"
        )
        return await self.send_sms(phone, message, {"type": "reminder", "invoice": invoice_number})
    
    async def send_stock_alert(
        self,
        phone: str,
        item_name: str,
        current_stock: int,
        reorder_level: int
    ) -> Dict[str, Any]:
        """Send stock alert to manager"""
        message = (
            f"Stock Alert: {item_name} is low! "
            f"Current: {current_stock}, Reorder Level: {reorder_level}. "
            f"Please restock soon."
        )
        return await self.send_sms(phone, message, {"type": "stock_alert", "item": item_name})
    
    async def get_delivery_status(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get delivery status"""
        return await self.provider.get_delivery_status(message_id)


# Factory function to create SMS service
def create_sms_service(
    provider: SMSProvider = SMSProvider.AFRICAS_TALKING
) -> Optional[SMSService]:
    """Create SMS service with specified provider"""
    
    if provider == SMSProvider.AFRICAS_TALKING:
        api_key = getattr(settings, 'AFRICASTALKING_API_KEY', None)
        username = getattr(settings, 'AFRICASTALKING_USERNAME', None)
        
        if not api_key or not username:
            logger.warning("Africa's Talking credentials not configured")
            return None
        
        provider_instance = AfricasTalkingProvider(
            api_key=api_key,
            username=username,
            sender_id=getattr(settings, 'AFRICASTALKING_SENDER_ID', None),
            is_sandbox=getattr(settings, 'AFRICASTALKING_SANDBOX', False)
        )
        return SMSService(provider_instance, SMSProvider.AFRICAS_TALKING)
    
    elif provider == SMSProvider.TWILIO:
        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        phone_number = getattr(settings, 'TWILIO_PHONE_NUMBER', None)
        
        if not all([account_sid, auth_token, phone_number]):
            logger.warning("Twilio credentials not configured")
            return None
        
        provider_instance = TwilioProvider(
            account_sid=account_sid,
            auth_token=auth_token,
            phone_number=phone_number
        )
        return SMSService(provider_instance, SMSProvider.TWILIO)
    
    return None
