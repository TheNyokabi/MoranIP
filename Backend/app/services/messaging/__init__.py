"""
Messaging Services

Provides WhatsApp and SMS integration for:
- Receipt delivery
- Payment reminders
- Order status updates
- Stock alerts
- OTP/Verification
- Promotional messages
"""

from .whatsapp_service import (
    WhatsAppService,
    WhatsAppConfig,
    create_whatsapp_service,
    MessageStatus
)

from .sms_service import (
    SMSService,
    SMSProvider,
    SMSStatus,
    create_sms_service,
    AfricasTalkingProvider,
    TwilioProvider
)

__all__ = [
    "WhatsAppService",
    "WhatsAppConfig",
    "create_whatsapp_service",
    "MessageStatus",
    "SMSService",
    "SMSProvider",
    "SMSStatus",
    "create_sms_service",
    "AfricasTalkingProvider",
    "TwilioProvider"
]
