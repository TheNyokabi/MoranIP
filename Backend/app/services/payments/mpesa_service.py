"""
M-Pesa Payment Service for Kenya
Handles STK Push, Till Number, and Paybill integrations
"""
import asyncio
import json
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
import httpx
import logging
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class MpesaConfig(BaseModel):
    """M-Pesa configuration settings"""
    consumer_key: str = Field(..., description="M-Pesa API Consumer Key")
    consumer_secret: str = Field(..., description="M-Pesa API Consumer Secret")
    shortcode: str = Field(..., description="Business Shortcode")
    passkey: str = Field(..., description="STK Push Passkey")
    base_url: str = Field(default="https://api.safaricom.co.ke", description="M-Pesa API Base URL")
    callback_url: str = Field(..., description="Callback URL for STK Push")
    environment: str = Field(default="sandbox", description="Environment: sandbox or production")


class MpesaSTKPushRequest(BaseModel):
    """STK Push request payload"""
    phone_number: str = Field(..., description="Customer phone number (254XXXXXXXXX)")
    amount: float = Field(..., gt=0, description="Amount to charge")
    account_reference: str = Field(..., description="Account reference")
    transaction_desc: str = Field(..., description="Transaction description")


class MpesaSTKPushResponse(BaseModel):
    """STK Push response"""
    merchant_request_id: str
    checkout_request_id: str
    response_code: str
    response_description: str
    customer_message: str


class MpesaQueryResponse(BaseModel):
    """STK Push query response"""
    response_code: str
    response_description: str
    merchant_request_id: str
    checkout_request_id: str
    result_code: str
    result_desc: str


class MpesaService:
    """M-Pesa payment service for Kenya"""

    def __init__(self, config: MpesaConfig):
        """Initialize M-Pesa service"""
        self.config = config
        self._access_token = None
        self._token_expiry = None
        self.client = httpx.AsyncClient(timeout=30.0)

    async def _get_access_token(self) -> str:
        """Get fresh access token from M-Pesa API"""
        if self._access_token and self._token_expiry and datetime.now() < self._token_expiry:
            return self._access_token

        auth = httpx.BasicAuth(self.config.consumer_key, self.config.consumer_secret)
        url = f"{self.config.base_url}/oauth/v1/generate"

        try:
            response = await self.client.get(
                f"{url}?grant_type=client_credentials",
                auth=auth
            )
            response.raise_for_status()

            data = response.json()
            self._access_token = data.get("access_token")

            # Token expires in 3600 seconds (1 hour)
            self._token_expiry = datetime.now() + timedelta(seconds=3590)

            return self._access_token

        except Exception as e:
            logger.error(f"Failed to get M-Pesa access token: {e}")
            raise Exception("Failed to authenticate with M-Pesa API")

    def _generate_password(self, timestamp: str) -> str:
        """Generate password for STK Push"""
        return self.config.passkey + self.config.shortcode + timestamp

    def _generate_timestamp(self) -> str:
        """Generate timestamp for M-Pesa API"""
        return datetime.now().strftime("%Y%m%d%H%M%S")

    async def initiate_stk_push(
        self,
        phone_number: str,
        amount: float,
        account_reference: str,
        transaction_desc: str = "Payment"
    ) -> MpesaSTKPushResponse:
        """
        Initiate STK Push payment

        Args:
            phone_number: Customer phone number (254XXXXXXXXX format)
            amount: Amount to charge
            account_reference: Account reference for the transaction
            transaction_desc: Transaction description

        Returns:
            STK Push response
        """
        try:
            access_token = await self._get_access_token()
            timestamp = self._generate_timestamp()
            password = self._generate_password(timestamp)

            url = f"{self.config.base_url}/mpesa/stkpush/v1/processrequest"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            payload = {
                "BusinessShortCode": self.config.shortcode,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": int(amount),
                "PartyA": phone_number,
                "PartyB": self.config.shortcode,
                "PhoneNumber": phone_number,
                "CallBackURL": self.config.callback_url,
                "AccountReference": account_reference,
                "TransactionDesc": transaction_desc
            }

            logger.info(f"Initiating STK Push for {phone_number}, amount: {amount}")

            response = await self.client.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            logger.info(f"STK Push initiated successfully: {data.get('CheckoutRequestID')}")

            return MpesaSTKPushResponse(**data)

        except httpx.HTTPStatusError as e:
            logger.error(f"M-Pesa STK Push failed: {e.response.status_code} - {e.response.text}")
            raise Exception(f"M-Pesa STK Push failed: {e.response.text}")
        except Exception as e:
            logger.error(f"STK Push error: {e}")
            raise Exception(f"Failed to initiate STK Push: {str(e)}")

    async def query_stk_push_status(
        self,
        checkout_request_id: str
    ) -> MpesaQueryResponse:
        """
        Query STK Push transaction status

        Args:
            checkout_request_id: Checkout request ID from STK Push

        Returns:
            Query response with transaction status
        """
        try:
            access_token = await self._get_access_token()
            timestamp = self._generate_timestamp()
            password = self._generate_password(timestamp)

            url = f"{self.config.base_url}/mpesa/stkpushquery/v1/query"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            payload = {
                "BusinessShortCode": self.config.shortcode,
                "Password": password,
                "Timestamp": timestamp,
                "CheckoutRequestID": checkout_request_id
            }

            response = await self.client.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            return MpesaQueryResponse(**data)

        except Exception as e:
            logger.error(f"STK Push query failed: {e}")
            raise Exception(f"Failed to query STK Push status: {str(e)}")

    def validate_phone_number(self, phone_number: str) -> str:
        """
        Validate and format Kenyan phone number

        Args:
            phone_number: Phone number in various formats

        Returns:
            Formatted phone number (254XXXXXXXXX)
        """
        # Remove all non-numeric characters
        clean_number = ''.join(filter(str.isdigit, phone_number))

        # Handle different formats
        if clean_number.startswith('254') and len(clean_number) == 12:
            return clean_number
        elif clean_number.startswith('0') and len(clean_number) == 10:
            return '254' + clean_number[1:]
        elif len(clean_number) == 9 and clean_number.startswith('7'):
            return '254' + clean_number
        else:
            raise ValueError("Invalid Kenyan phone number format")

    def generate_transaction_reference(self) -> str:
        """Generate unique transaction reference"""
        return f"TXN{secrets.token_hex(8).upper()}"

    def parse_callback_data(self, callback_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse M-Pesa callback data

        Args:
            callback_data: Raw callback data from M-Pesa

        Returns:
            Parsed transaction data
        """
        try:
            stk_callback = callback_data.get("Body", {}).get("stkCallback", {})

            if stk_callback.get("ResultCode") == 0:
                # Successful transaction
                callback_metadata = stk_callback.get("CallbackMetadata", {}).get("Item", [])

                parsed_data = {
                    "result_code": stk_callback["ResultCode"],
                    "result_desc": stk_callback["ResultDesc"],
                    "merchant_request_id": stk_callback["MerchantRequestID"],
                    "checkout_request_id": stk_callback["CheckoutRequestID"],
                    "amount": None,
                    "mpesa_receipt_number": None,
                    "transaction_date": None,
                    "phone_number": None,
                    "success": True
                }

                # Extract metadata
                for item in callback_metadata:
                    if item.get("Name") == "Amount":
                        parsed_data["amount"] = item.get("Value")
                    elif item.get("Name") == "MpesaReceiptNumber":
                        parsed_data["mpesa_receipt_number"] = item.get("Value")
                    elif item.get("Name") == "TransactionDate":
                        parsed_data["transaction_date"] = item.get("Value")
                    elif item.get("Name") == "PhoneNumber":
                        parsed_data["phone_number"] = item.get("Value")

                return parsed_data
            else:
                # Failed transaction
                return {
                    "result_code": stk_callback.get("ResultCode"),
                    "result_desc": stk_callback.get("ResultDesc"),
                    "merchant_request_id": stk_callback.get("MerchantRequestID"),
                    "checkout_request_id": stk_callback.get("CheckoutRequestID"),
                    "success": False
                }

        except Exception as e:
            logger.error(f"Failed to parse M-Pesa callback: {e}")
            return {"success": False, "error": str(e)}

    async def simulate_stk_push_callback(
        self,
        checkout_request_id: str,
        result_code: int = 0,
        amount: float = 100.0,
        phone_number: str = "254712345678"
    ) -> Dict[str, Any]:
        """
        Simulate STK Push callback for testing (sandbox only)

        Args:
            checkout_request_id: Checkout request ID
            result_code: Result code (0 = success)
            amount: Transaction amount
            phone_number: Customer phone number

        Returns:
            Simulated callback data
        """
        if self.config.environment != "sandbox":
            raise Exception("Simulation only available in sandbox environment")

        merchant_request_id = f"MR{secrets.token_hex(4).upper()}"

        if result_code == 0:
            # Success callback
            callback_data = {
                "Body": {
                    "stkCallback": {
                        "MerchantRequestID": merchant_request_id,
                        "CheckoutRequestID": checkout_request_id,
                        "ResultCode": result_code,
                        "ResultDesc": "The service request is processed successfully.",
                        "CallbackMetadata": {
                            "Item": [
                                {"Name": "Amount", "Value": amount},
                                {"Name": "MpesaReceiptNumber", "Value": f"N{secrets.token_hex(4).upper()}"},
                                {"Name": "TransactionDate", "Value": datetime.now().strftime("%Y%m%d%H%M%S")},
                                {"Name": "PhoneNumber", "Value": phone_number}
                            ]
                        }
                    }
                }
            }
        else:
            # Failure callback
            callback_data = {
                "Body": {
                    "stkCallback": {
                        "MerchantRequestID": merchant_request_id,
                        "CheckoutRequestID": checkout_request_id,
                        "ResultCode": result_code,
                        "ResultDesc": "Transaction failed"
                    }
                }
            }

        return callback_data

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()