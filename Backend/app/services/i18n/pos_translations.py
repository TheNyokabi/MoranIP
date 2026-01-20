"""
POS Translation Service for Multi-Language Support
Provides translations for POS interface and receipts
"""
import json
import os
from typing import Dict, Any, Optional, Union
from datetime import datetime
from decimal import Decimal
from babel import Locale, dates, numbers
from babel.support import Translations
import logging

logger = logging.getLogger(__name__)


class POSTranslationService:
    """Service for handling POS translations and localization"""

    def __init__(self):
        """Initialize translation service"""
        self.translations = {}
        self.locales = {}
        self._load_translations()

    def _load_translations(self):
        """Load translation files"""
        # Default translations (English)
        self.translations['en'] = self._get_default_translations()

        # Load additional language files
        translation_files = {
            'sw': 'sw-pos.json',  # Swahili
            # Add more languages as needed
        }

        for lang_code, filename in translation_files.items():
            try:
                # In production, load from configured path
                # For now, we'll define them inline
                if lang_code == 'sw':
                    self.translations[lang_code] = self._get_swahili_translations()
                else:
                    self.translations[lang_code] = self._get_default_translations()

                self.locales[lang_code] = Locale(lang_code)
                logger.info(f"Loaded translations for {lang_code}")
            except Exception as e:
                logger.warning(f"Failed to load translations for {lang_code}: {e}")
                self.translations[lang_code] = self._get_default_translations()

    def _get_default_translations(self) -> Dict[str, Any]:
        """Get default English translations"""
        return {
            # POS Interface
            "pos.title": "Point of Sale",
            "pos.search_placeholder": "Search items...",
            "pos.customer": "Customer",
            "pos.total": "Total",
            "pos.subtotal": "Subtotal",
            "pos.tax": "Tax",
            "pos.discount": "Discount",
            "pos.payment": "Payment",
            "pos.change": "Change",
            "pos.checkout": "Checkout",
            "pos.cancel": "Cancel",
            "pos.save": "Save",
            "pos.print": "Print",
            "pos.email": "Email",
            "pos.sms": "SMS",

            # Quick Actions
            "quick_actions.title": "Quick Actions",
            "quick_actions.frequent_items": "Frequent Items",
            "quick_actions.recent_customers": "Recent Customers",
            "quick_actions.search": "Search",

            # Items
            "item.code": "Item Code",
            "item.name": "Item Name",
            "item.price": "Price",
            "item.quantity": "Quantity",
            "item.total": "Total",
            "item.add_to_cart": "Add to Cart",

            # Customers
            "customer.name": "Customer Name",
            "customer.phone": "Phone",
            "customer.email": "Email",
            "customer.walk_in": "Walk-in Customer",

            # Payments
            "payment.cash": "Cash",
            "payment.mpesa": "M-Pesa",
            "payment.card": "Card",
            "payment.amount": "Amount",
            "payment.tendered": "Tendered",
            "payment.change": "Change",

            # Receipts
            "receipt.invoice": "Invoice",
            "receipt.date": "Date",
            "receipt.customer": "Customer",
            "receipt.total": "Total",
            "receipt.thank_you": "Thank you for your business!",
            "receipt.visit_again": "Visit us again soon!",

            # Errors
            "error.item_not_found": "Item not found",
            "error.customer_not_found": "Customer not found",
            "error.payment_failed": "Payment failed",
            "error.insufficient_stock": "Insufficient stock",
            "error.invalid_amount": "Invalid amount",

            # Accessibility
            "accessibility.screen_reader": "Screen Reader Mode",
            "accessibility.high_contrast": "High Contrast",
            "accessibility.large_text": "Large Text",
            "accessibility.keyboard_nav": "Keyboard Navigation",
        }

    def _get_swahili_translations(self) -> Dict[str, Any]:
        """Get Swahili translations"""
        return {
            # POS Interface
            "pos.title": "Sehemu ya Mauzo",
            "pos.search_placeholder": "Tafuta bidhaa...",
            "pos.customer": "Mteja",
            "pos.total": "Jumla",
            "pos.subtotal": "Jumla Ndogo",
            "pos.tax": "Kodi",
            "pos.discount": "Punguzo",
            "pos.payment": "Malipo",
            "pos.change": "Mabadiliko",
            "pos.checkout": "Lipa",
            "pos.cancel": "Ghairi",
            "pos.save": "Hifadhi",
            "pos.print": "Chapisha",
            "pos.email": "Barua pepe",
            "pos.sms": "SMS",

            # Quick Actions
            "quick_actions.title": "Vitendo vya Haraka",
            "quick_actions.frequent_items": "Bidhaa za Mara kwa Mara",
            "quick_actions.recent_customers": "Wateja wa Hivi Karibuni",
            "quick_actions.search": "Tafuta",

            # Items
            "item.code": "Nambari ya Bidhaa",
            "item.name": "Jina la Bidhaa",
            "item.price": "Bei",
            "item.quantity": "Idadi",
            "item.total": "Jumla",
            "item.add_to_cart": "Ongeza kwenye Rukwama",

            # Customers
            "customer.name": "Jina la Mteja",
            "customer.phone": "Simu",
            "customer.email": "Barua pepe",
            "customer.walk_in": "Mteja wa Nje",

            # Payments
            "payment.cash": "Fedha Taslimu",
            "payment.mpesa": "M-Pesa",
            "payment.card": "Kadi",
            "payment.amount": "Kiasi",
            "payment.tendered": "Iliyotolewa",
            "payment.change": "Mabadiliko",

            # Receipts
            "receipt.invoice": "Ankara",
            "receipt.date": "Tarehe",
            "receipt.customer": "Mteja",
            "receipt.total": "Jumla",
            "receipt.thank_you": "Asante kwa kununua!",
            "receipt.visit_again": "Karibu tena hivi karibuni!",

            # Errors
            "error.item_not_found": "Bidhaa haijapatikana",
            "error.customer_not_found": "Mteja hajapatikana",
            "error.payment_failed": "Malipo yameshindikana",
            "error.insufficient_stock": "Hakuna bidhaa za kutosha",
            "error.invalid_amount": "Kiasi si sahihi",

            # Accessibility
            "accessibility.screen_reader": "Hali ya Kisoma Screen",
            "accessibility.high_contrast": "Tofauti ya Juu",
            "accessibility.large_text": "Nakala Kubwa",
            "accessibility.keyboard_nav": "Urambazaji wa Kibodi",
        }

    def get_text(self, key: str, language: str = "en", **kwargs) -> str:
        """
        Get translated text for a key

        Args:
            key: Translation key
            language: Language code (en, sw, etc.)
            **kwargs: Format parameters

        Returns:
            Translated text
        """
        translations = self.translations.get(language, self.translations.get('en', {}))
        text = translations.get(key, self.translations['en'].get(key, key))

        # Format with provided parameters
        if kwargs:
            try:
                text = text.format(**kwargs)
            except (KeyError, ValueError) as e:
                logger.warning(f"Failed to format translation {key}: {e}")

        return text

    def format_currency(self, amount: Union[float, Decimal], currency: str = "KES", language: str = "en") -> str:
        """
        Format currency amount with proper localization

        Args:
            amount: Amount to format
            currency: Currency code
            language: Language code

        Returns:
            Formatted currency string
        """
        try:
            locale = self.locales.get(language, Locale('en'))
            return numbers.format_currency(amount, currency, locale=locale)
        except Exception as e:
            logger.warning(f"Failed to format currency: {e}")
            return f"{currency} {amount:.2f}"

    def format_date(self, date: datetime, language: str = "en", format: str = "short") -> str:
        """
        Format date with proper localization

        Args:
            date: Date to format
            language: Language code
            format: Date format (short, medium, long, full)

        Returns:
            Formatted date string
        """
        try:
            locale = self.locales.get(language, Locale('en'))
            return dates.format_date(date, format=format, locale=locale)
        except Exception as e:
            logger.warning(f"Failed to format date: {e}")
            return date.strftime("%Y-%m-%d")

    def format_datetime(self, datetime_obj: datetime, language: str = "en", format: str = "short") -> str:
        """
        Format datetime with proper localization

        Args:
            datetime_obj: Datetime to format
            language: Language code
            format: Datetime format

        Returns:
            Formatted datetime string
        """
        try:
            locale = self.locales.get(language, Locale('en'))
            return dates.format_datetime(datetime_obj, format=format, locale=locale)
        except Exception as e:
            logger.warning(f"Failed to format datetime: {e}")
            return datetime_obj.strftime("%Y-%m-%d %H:%M:%S")

    def format_number(self, number: Union[int, float, Decimal], language: str = "en") -> str:
        """
        Format number with proper localization

        Args:
            number: Number to format
            language: Language code

        Returns:
            Formatted number string
        """
        try:
            locale = self.locales.get(language, Locale('en'))
            return numbers.format_number(number, locale=locale)
        except Exception as e:
            logger.warning(f"Failed to format number: {e}")
            return str(number)

    def get_receipt_translations(self, language: str = "en") -> Dict[str, str]:
        """
        Get receipt-specific translations

        Args:
            language: Language code

        Returns:
            Dictionary of receipt translations
        """
        translations = self.translations.get(language, self.translations.get('en', {}))

        return {
            "invoice": translations.get("receipt.invoice", "Invoice"),
            "date": translations.get("receipt.date", "Date"),
            "customer": translations.get("receipt.customer", "Customer"),
            "total": translations.get("receipt.total", "Total"),
            "thank_you": translations.get("receipt.thank_you", "Thank you for your business!"),
            "visit_again": translations.get("receipt.visit_again", "Visit us again soon!"),
        }

    def get_pos_interface_translations(self, language: str = "en") -> Dict[str, str]:
        """
        Get POS interface translations

        Args:
            language: Language code

        Returns:
            Dictionary of POS interface translations
        """
        translations = self.translations.get(language, self.translations.get('en', {}))
        return translations

    def get_supported_languages(self) -> Dict[str, str]:
        """
        Get list of supported languages

        Returns:
            Dictionary mapping language codes to display names
        """
        return {
            'en': 'English',
            'sw': 'Kiswahili'
        }

    def validate_language(self, language: str) -> bool:
        """
        Validate if language is supported

        Args:
            language: Language code

        Returns:
            True if supported, False otherwise
        """
        return language in self.translations

    def get_fallback_language(self, language: str) -> str:
        """
        Get fallback language if requested language is not available

        Args:
            language: Requested language

        Returns:
            Available language code
        """
        if language in self.translations:
            return language
        return 'en'  # Default fallback