"""
WhatsApp Business API Integration Service

Supports:
- Sending template messages (receipts, reminders, etc.)
- Sending text messages
- Webhook handling for incoming messages
- Message status tracking
"""

import logging
import hashlib
import hmac
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum

import httpx
from pydantic import BaseModel

from ...config import settings

logger = logging.getLogger(__name__)


class MessageStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class WhatsAppConfig(BaseModel):
    """WhatsApp Business API configuration"""
    api_url: str = "https://graph.facebook.com/v18.0"
    access_token: str
    phone_number_id: str
    business_account_id: str
    webhook_verify_token: str
    app_secret: str  # For webhook signature verification


class MessageTemplate(BaseModel):
    """WhatsApp message template"""
    name: str
    language_code: str = "en"
    components: List[Dict[str, Any]] = []


class WhatsAppMessage(BaseModel):
    """WhatsApp message record"""
    id: str
    phone_number: str
    template_name: Optional[str] = None
    message_type: str  # "template", "text", "interactive"
    content: Dict[str, Any]
    status: MessageStatus = MessageStatus.PENDING
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    error_message: Optional[str] = None


class WhatsAppService:
    """WhatsApp Business API integration service"""
    
    def __init__(self, config: WhatsAppConfig):
        self.config = config
        self.api_url = config.api_url
        self.access_token = config.access_token
        self.phone_number_id = config.phone_number_id
        self._client = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.api_url,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    # ==================== Template Messages ====================
    
    async def send_receipt(
        self,
        phone: str,
        customer_name: str,
        invoice_number: str,
        total: str,
        items_summary: str,
        currency: str = "KES"
    ) -> Dict[str, Any]:
        """Send a purchase receipt via WhatsApp"""
        return await self._send_template(
            phone=phone,
            template_name="purchase_receipt",
            components=[
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": customer_name},
                        {"type": "text", "text": invoice_number},
                        {"type": "text", "text": f"{currency} {total}"},
                        {"type": "text", "text": items_summary}
                    ]
                }
            ]
        )
    
    async def send_payment_reminder(
        self,
        phone: str,
        customer_name: str,
        invoice_number: str,
        amount_due: str,
        due_date: str,
        currency: str = "KES"
    ) -> Dict[str, Any]:
        """Send a payment reminder"""
        return await self._send_template(
            phone=phone,
            template_name="payment_reminder",
            components=[
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": customer_name},
                        {"type": "text", "text": invoice_number},
                        {"type": "text", "text": f"{currency} {amount_due}"},
                        {"type": "text", "text": due_date}
                    ]
                }
            ]
        )
    
    async def send_order_status(
        self,
        phone: str,
        customer_name: str,
        order_number: str,
        status: str,
        details: str = ""
    ) -> Dict[str, Any]:
        """Send order status update"""
        return await self._send_template(
            phone=phone,
            template_name="order_status",
            components=[
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": customer_name},
                        {"type": "text", "text": order_number},
                        {"type": "text", "text": status},
                        {"type": "text", "text": details}
                    ]
                }
            ]
        )
    
    async def send_stock_alert(
        self,
        phone: str,
        item_name: str,
        current_stock: int,
        reorder_level: int,
        warehouse: str
    ) -> Dict[str, Any]:
        """Send low stock alert to manager"""
        return await self._send_template(
            phone=phone,
            template_name="stock_alert",
            components=[
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": item_name},
                        {"type": "text", "text": str(current_stock)},
                        {"type": "text", "text": str(reorder_level)},
                        {"type": "text", "text": warehouse}
                    ]
                }
            ]
        )
    
    async def send_promotional_message(
        self,
        phone: str,
        customer_name: str,
        promotion_title: str,
        promotion_details: str,
        valid_until: str
    ) -> Dict[str, Any]:
        """Send promotional/marketing message"""
        return await self._send_template(
            phone=phone,
            template_name="promotional",
            components=[
                {
                    "type": "header",
                    "parameters": [
                        {"type": "text", "text": promotion_title}
                    ]
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": customer_name},
                        {"type": "text", "text": promotion_details},
                        {"type": "text", "text": valid_until}
                    ]
                }
            ]
        )
    
    # ==================== Core Methods ====================
    
    async def _send_template(
        self,
        phone: str,
        template_name: str,
        components: List[Dict[str, Any]],
        language_code: str = "en"
    ) -> Dict[str, Any]:
        """Send a template message"""
        # Normalize phone number (remove leading + or 0)
        phone = self._normalize_phone(phone)
        
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language_code
                },
                "components": components
            }
        }
        
        try:
            response = await self.client.post(
                f"/{self.phone_number_id}/messages",
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"WhatsApp template message sent to {phone}: {template_name}")
            return {
                "success": True,
                "message_id": result.get("messages", [{}])[0].get("id"),
                "phone": phone,
                "template": template_name
            }
        
        except httpx.HTTPStatusError as e:
            error_detail = e.response.json() if e.response.content else str(e)
            logger.error(f"WhatsApp API error: {error_detail}")
            return {
                "success": False,
                "error": error_detail,
                "phone": phone,
                "template": template_name
            }
        except Exception as e:
            logger.error(f"WhatsApp send error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "phone": phone,
                "template": template_name
            }
    
    async def send_text_message(
        self,
        phone: str,
        message: str,
        preview_url: bool = False
    ) -> Dict[str, Any]:
        """Send a plain text message"""
        phone = self._normalize_phone(phone)
        
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {
                "body": message,
                "preview_url": preview_url
            }
        }
        
        try:
            response = await self.client.post(
                f"/{self.phone_number_id}/messages",
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"WhatsApp text message sent to {phone}")
            return {
                "success": True,
                "message_id": result.get("messages", [{}])[0].get("id"),
                "phone": phone
            }
        except Exception as e:
            logger.error(f"WhatsApp send error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "phone": phone
            }
    
    async def send_interactive_buttons(
        self,
        phone: str,
        body_text: str,
        buttons: List[Dict[str, str]],
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send an interactive message with buttons"""
        phone = self._normalize_phone(phone)
        
        interactive = {
            "type": "button",
            "body": {"text": body_text},
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": btn["id"],
                            "title": btn["title"][:20]  # Max 20 chars
                        }
                    }
                    for btn in buttons[:3]  # Max 3 buttons
                ]
            }
        }
        
        if header_text:
            interactive["header"] = {"type": "text", "text": header_text}
        if footer_text:
            interactive["footer"] = {"text": footer_text}
        
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "interactive",
            "interactive": interactive
        }
        
        try:
            response = await self.client.post(
                f"/{self.phone_number_id}/messages",
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "success": True,
                "message_id": result.get("messages", [{}])[0].get("id"),
                "phone": phone
            }
        except Exception as e:
            logger.error(f"WhatsApp interactive send error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "phone": phone
            }
    
    # ==================== Webhook Handling ====================
    
    def verify_webhook(self, mode: str, token: str, challenge: str) -> Optional[str]:
        """Verify webhook subscription"""
        if mode == "subscribe" and token == self.config.webhook_verify_token:
            return challenge
        return None
    
    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook payload signature"""
        expected_signature = hmac.new(
            self.config.app_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(f"sha256={expected_signature}", signature)
    
    def parse_webhook_payload(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse incoming webhook payload"""
        messages = []
        
        try:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    
                    # Status updates
                    for status in value.get("statuses", []):
                        messages.append({
                            "type": "status",
                            "message_id": status.get("id"),
                            "status": status.get("status"),
                            "timestamp": status.get("timestamp"),
                            "recipient_id": status.get("recipient_id")
                        })
                    
                    # Incoming messages
                    for message in value.get("messages", []):
                        parsed = {
                            "type": "message",
                            "message_id": message.get("id"),
                            "from": message.get("from"),
                            "timestamp": message.get("timestamp"),
                            "message_type": message.get("type")
                        }
                        
                        if message.get("type") == "text":
                            parsed["text"] = message.get("text", {}).get("body")
                        elif message.get("type") == "button":
                            parsed["button"] = message.get("button", {})
                        elif message.get("type") == "interactive":
                            parsed["interactive"] = message.get("interactive", {})
                        
                        messages.append(parsed)
        
        except Exception as e:
            logger.error(f"Error parsing webhook payload: {e}")
        
        return messages
    
    # ==================== Utilities ====================
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number to international format"""
        # Remove spaces, dashes, and parentheses
        phone = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # Remove leading + if present
        if phone.startswith('+'):
            phone = phone[1:]
        
        # Handle Kenyan numbers
        if phone.startswith('0') and len(phone) == 10:
            phone = '254' + phone[1:]
        elif phone.startswith('7') and len(phone) == 9:
            phone = '254' + phone
        
        return phone
    
    async def get_message_status(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of a sent message (if supported)"""
        # Note: WhatsApp API doesn't have a direct status endpoint
        # Status is received via webhooks
        return None


# Factory function to create WhatsApp service
def create_whatsapp_service() -> Optional[WhatsAppService]:
    """Create WhatsApp service from environment settings"""
    access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
    phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', None)
    
    if not access_token or not phone_number_id:
        logger.warning("WhatsApp credentials not configured")
        return None
    
    config = WhatsAppConfig(
        access_token=access_token,
        phone_number_id=phone_number_id,
        business_account_id=getattr(settings, 'WHATSAPP_BUSINESS_ACCOUNT_ID', ''),
        webhook_verify_token=getattr(settings, 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'moran_verify'),
        app_secret=getattr(settings, 'WHATSAPP_APP_SECRET', '')
    )
    
    return WhatsAppService(config)
