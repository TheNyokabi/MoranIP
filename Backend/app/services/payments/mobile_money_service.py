"""
Mobile Money Service for Kenya
Unified interface for Airtel Money, T-Kash, and other mobile money providers
"""
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Union
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)


class MobileMoneyProvider(ABC):
    """Abstract base class for mobile money providers"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.client = httpx.AsyncClient(timeout=30.0)

    @abstractmethod
    async def initiate_payment(
        self,
        phone_number: str,
        amount: float,
        reference: str,
        description: str = ""
    ) -> Dict[str, Any]:
        """Initiate payment with provider"""
        pass

    @abstractmethod
    async def check_payment_status(self, transaction_id: str) -> Dict[str, Any]:
        """Check payment status"""
        pass

    @abstractmethod
    def validate_phone_number(self, phone_number: str) -> str:
        """Validate and format phone number"""
        pass

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


class AirtelMoneyProvider(MobileMoneyProvider):
    """Airtel Money integration"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get("base_url", "https://api.airtel.africa")
        self.client_id = config["client_id"]
        self.client_secret = config["client_secret"]
        self.country = config.get("country", "KE")
        self.currency = config.get("currency", "KES")

    async def _get_access_token(self) -> str:
        """Get access token for Airtel Money API"""
        try:
            auth_url = f"{self.base_url}/auth/oauth2/token"
            data = {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret
            }

            response = await self.client.post(auth_url, data=data)
            response.raise_for_status()

            token_data = response.json()
            return token_data["access_token"]

        except Exception as e:
            logger.error(f"Airtel Money auth failed: {e}")
            raise Exception("Failed to authenticate with Airtel Money")

    async def initiate_payment(
        self,
        phone_number: str,
        amount: float,
        reference: str,
        description: str = ""
    ) -> Dict[str, Any]:
        """Initiate Airtel Money payment"""
        try:
            access_token = await self._get_access_token()
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            url = f"{self.base_url}/merchant/v1/payments/"
            payload = {
                "subscriber": {
                    "country": self.country,
                    "currency": self.currency,
                    "msisdn": phone_number
                },
                "transaction": {
                    "amount": amount,
                    "country": self.country,
                    "currency": self.currency,
                    "id": reference
                }
            }

            response = await self.client.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            return {
                "success": True,
                "transaction_id": data.get("transaction", {}).get("id"),
                "status": data.get("status"),
                "message": data.get("message", "Payment initiated")
            }

        except Exception as e:
            logger.error(f"Airtel Money payment failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to initiate Airtel Money payment"
            }

    async def check_payment_status(self, transaction_id: str) -> Dict[str, Any]:
        """Check Airtel Money payment status"""
        try:
            access_token = await self._get_access_token()
            headers = {"Authorization": f"Bearer {access_token}"}

            url = f"{self.base_url}/merchant/v1/payments/{transaction_id}"
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()

            data = response.json()
            return {
                "transaction_id": transaction_id,
                "status": data.get("status"),
                "amount": data.get("transaction", {}).get("amount"),
                "currency": data.get("transaction", {}).get("currency")
            }

        except Exception as e:
            logger.error(f"Airtel Money status check failed: {e}")
            return {
                "transaction_id": transaction_id,
                "status": "error",
                "error": str(e)
            }

    def validate_phone_number(self, phone_number: str) -> str:
        """Validate Airtel Money phone number"""
        # Airtel numbers in Kenya start with 073, 0732-0739
        clean_number = ''.join(filter(str.isdigit, phone_number))

        if clean_number.startswith('254') and len(clean_number) == 12:
            if clean_number[3:6] in ['732', '733', '734', '735', '736', '737', '738', '739']:
                return clean_number
        elif clean_number.startswith('073') and len(clean_number) == 10:
            if clean_number[1:4] in ['732', '733', '734', '735', '736', '737', '738', '739']:
                return '254' + clean_number[1:]
        elif len(clean_number) == 9 and clean_number.startswith('73'):
            if clean_number[0:3] in ['732', '733', '734', '735', '736', '737', '738', '739']:
                return '254' + clean_number

        raise ValueError("Invalid Airtel Money phone number")


class TKashProvider(MobileMoneyProvider):
    """T-Kash (Safaricom) integration"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get("base_url", "https://api.safaricom.co.ke")
        self.consumer_key = config["consumer_key"]
        self.consumer_secret = config["consumer_secret"]
        self.shortcode = config["shortcode"]

    async def _get_access_token(self) -> str:
        """Get T-Kash access token"""
        try:
            auth_url = f"{self.base_url}/oauth/v1/generate"
            auth = httpx.BasicAuth(self.consumer_key, self.consumer_secret)

            response = await self.client.get(
                f"{auth_url}?grant_type=client_credentials",
                auth=auth
            )
            response.raise_for_status()

            data = response.json()
            return data["access_token"]

        except Exception as e:
            logger.error(f"T-Kash auth failed: {e}")
            raise Exception("Failed to authenticate with T-Kash")

    async def initiate_payment(
        self,
        phone_number: str,
        amount: float,
        reference: str,
        description: str = ""
    ) -> Dict[str, Any]:
        """Initiate T-Kash payment"""
        try:
            access_token = await self._get_access_token()
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            url = f"{self.base_url}/mpesa/b2c/v1/paymentrequest"
            payload = {
                "InitiatorName": self.config.get("initiator_name"),
                "SecurityCredential": self.config.get("security_credential"),
                "CommandID": "BusinessPayment",
                "Amount": str(int(amount)),
                "PartyA": self.shortcode,
                "PartyB": phone_number,
                "Remarks": description or "Payment",
                "QueueTimeOutURL": self.config.get("timeout_url"),
                "ResultURL": self.config.get("result_url"),
                "Occasion": reference
            }

            response = await self.client.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            return {
                "success": True,
                "transaction_id": data.get("ConversationID"),
                "originator_conversation_id": data.get("OriginatorConversationID"),
                "response_code": data.get("ResponseCode"),
                "message": data.get("ResponseDescription", "Payment initiated")
            }

        except Exception as e:
            logger.error(f"T-Kash payment failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to initiate T-Kash payment"
            }

    async def check_payment_status(self, transaction_id: str) -> Dict[str, Any]:
        """Check T-Kash payment status"""
        # T-Kash doesn't have a direct status check API like M-Pesa
        # Status is typically received via callback/webhook
        logger.warning("T-Kash status check not implemented - use webhooks")
        return {
            "transaction_id": transaction_id,
            "status": "unknown",
            "message": "Status check not available for T-Kash"
        }

    def validate_phone_number(self, phone_number: str) -> str:
        """Validate T-Kash phone number"""
        # T-Kash works with all Safaricom numbers
        clean_number = ''.join(filter(str.isdigit, phone_number))

        if clean_number.startswith('254') and len(clean_number) == 12:
            if clean_number[3:5] in ['70', '71', '72', '74', '79']:
                return clean_number
        elif clean_number.startswith('0') and len(clean_number) == 10:
            if clean_number[1:3] in ['70', '71', '72', '74', '79']:
                return '254' + clean_number[1:]
        elif len(clean_number) == 9 and clean_number.startswith('7'):
            if clean_number[0:2] in ['70', '71', '72', '74', '79']:
                return '254' + clean_number

        raise ValueError("Invalid T-Kash phone number")


class MobileMoneyService:
    """Unified mobile money service for Kenya"""

    def __init__(self):
        self.providers: Dict[str, MobileMoneyProvider] = {}

    def register_provider(self, name: str, provider_class: type, config: Dict[str, Any]):
        """Register a mobile money provider"""
        try:
            provider_instance = provider_class(config)
            self.providers[name] = provider_instance
            logger.info(f"Registered mobile money provider: {name}")
        except Exception as e:
            logger.error(f"Failed to register provider {name}: {e}")

    def get_provider(self, name: str) -> Optional[MobileMoneyProvider]:
        """Get registered provider by name"""
        return self.providers.get(name)

    def get_available_providers(self) -> Dict[str, str]:
        """Get list of available providers"""
        return {
            "airtel_money": "Airtel Money",
            "t_kash": "T-Kash",
            "mpesa": "M-Pesa"  # Note: M-Pesa is handled separately
        }

    def detect_provider_from_phone(self, phone_number: str) -> str:
        """
        Detect mobile money provider from phone number

        Args:
            phone_number: Phone number in any format

        Returns:
            Provider name or 'unknown'
        """
        try:
            clean_number = ''.join(filter(str.isdigit, phone_number))

            # Convert to 254 format for checking
            if clean_number.startswith('0') and len(clean_number) == 10:
                clean_number = '254' + clean_number[1:]
            elif len(clean_number) == 9 and clean_number.startswith('7'):
                clean_number = '254' + clean_number

            if not clean_number.startswith('254') or len(clean_number) != 12:
                return 'unknown'

            # Check prefixes
            prefix = clean_number[3:6]  # Get first 3 digits after 254

            # Safaricom (M-Pesa): 700-759
            if prefix.startswith('7'):
                if prefix in ['700', '701', '702', '703', '704', '705', '706', '707', '708', '709',
                            '710', '711', '712', '713', '714', '715', '716', '717', '718', '719',
                            '720', '721', '722', '723', '724', '725', '726', '727', '728', '729',
                            '730', '731', '740', '741', '742', '743', '744', '745', '746', '747',
                            '748', '749', '750', '751', '752', '753', '754', '755', '756', '757',
                            '758', '759']:
                    return 'mpesa'

            # Airtel: 732-739
            elif prefix in ['732', '733', '734', '735', '736', '737', '738', '739']:
                return 'airtel_money'

            # Telkom/Orange: 770-789
            elif prefix in ['770', '771', '772', '773', '774', '775', '776', '777', '778', '779',
                          '780', '781', '782', '783', '784', '785', '786', '787', '788', '789']:
                return 't_kash'

            return 'unknown'

        except Exception as e:
            logger.warning(f"Failed to detect provider from phone {phone_number}: {e}")
            return 'unknown'

    async def initiate_payment(
        self,
        provider_name: str,
        phone_number: str,
        amount: float,
        reference: str,
        description: str = ""
    ) -> Dict[str, Any]:
        """
        Initiate payment with specified provider

        Args:
            provider_name: Name of the mobile money provider
            phone_number: Customer phone number
            amount: Amount to charge
            reference: Transaction reference
            description: Transaction description

        Returns:
            Payment initiation response
        """
        provider = self.get_provider(provider_name)
        if not provider:
            return {
                "success": False,
                "error": f"Provider {provider_name} not registered",
                "message": "Mobile money provider not available"
            }

        try:
            # Validate phone number for the provider
            formatted_phone = provider.validate_phone_number(phone_number)

            # Initiate payment
            result = await provider.initiate_payment(
                phone_number=formatted_phone,
                amount=amount,
                reference=reference,
                description=description
            )

            return result

        except ValueError as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Invalid phone number for selected provider"
            }
        except Exception as e:
            logger.error(f"Payment initiation failed for {provider_name}: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to initiate mobile money payment"
            }

    async def check_payment_status(
        self,
        provider_name: str,
        transaction_id: str
    ) -> Dict[str, Any]:
        """
        Check payment status with provider

        Args:
            provider_name: Name of the mobile money provider
            transaction_id: Transaction ID from initiation

        Returns:
            Payment status response
        """
        provider = self.get_provider(provider_name)
        if not provider:
            return {
                "success": False,
                "error": f"Provider {provider_name} not registered",
                "status": "unknown"
            }

        try:
            result = await provider.check_payment_status(transaction_id)
            return result
        except Exception as e:
            logger.error(f"Status check failed for {provider_name}: {e}")
            return {
                "transaction_id": transaction_id,
                "status": "error",
                "error": str(e)
            }

    async def close(self):
        """Close all provider connections"""
        for provider in self.providers.values():
            await provider.close()