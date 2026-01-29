"""
Receipt Generation Service for PoS
Creates thermal printer receipts, HTML receipts, and handles delivery
"""
import qrcode
import io
import base64
import html as html_lib
from typing import Dict, Any, Optional, List
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import logging
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

logger = logging.getLogger(__name__)


DEFAULT_COMPANY_NAME = "Company Name"


class ReceiptService:
    """Service for generating and managing POS receipts"""

    def __init__(self):
        """Initialize Receipt Service"""
        pass

    def _to_decimal(self, value: Any) -> Decimal:
        try:
            if value is None:
                return Decimal("0")
            if isinstance(value, Decimal):
                return value
            return Decimal(str(value))
        except Exception:
            return Decimal("0")

    def _money(self, value: Any) -> Decimal:
        return self._to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _escape_html(self, value: Any) -> str:
        return html_lib.escape("" if value is None else str(value), quote=True)

    def _extract_total_taxes(self, invoice_data: Dict[str, Any]) -> Decimal:
        """Normalize total taxes value from ERPNext payloads."""
        value = invoice_data.get("total_taxes_and_charges", None)
        if value is None:
            value = invoice_data.get("total_tax_amount", 0)
        if isinstance(value, dict):
            return self._money(value.get("total", 0) or 0)
        return self._money(value)

    def _extract_tax_lines(self, invoice_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract tax rows from ERPNext invoice payload, if present."""
        taxes = invoice_data.get("taxes", [])
        if not isinstance(taxes, list):
            return []

        lines: List[Dict[str, Any]] = []
        for tax in taxes:
            if not isinstance(tax, dict):
                continue
            label = tax.get("description") or tax.get("account_head") or tax.get("charge_type") or "Tax"
            amount = tax.get("tax_amount")
            if amount is None:
                amount = tax.get("base_tax_amount")
            if amount is None:
                continue
            amount_dec = self._money(amount)
            if amount_dec == 0:
                continue
            lines.append({"label": str(label), "amount": float(amount_dec)})

        return lines

    def generate_thermal_receipt(
        self,
        invoice_data: Dict[str, Any],
        width: int = 80,
        language: str = "en"
    ) -> str:
        """
        Generate thermal printer receipt (plain text format)

        Args:
            invoice_data: Invoice data dictionary
            width: Printer width in characters (32, 48, 80)
            language: Language code ('en' or 'sw')

        Returns:
            Plain text receipt formatted for thermal printer
        """
        lines = []

        # Header
        company_name = invoice_data.get("company", DEFAULT_COMPANY_NAME)
        lines.append(self._center_text(company_name, width))
        lines.append(self._center_text("=" * (width // 2), width))

        # Invoice details
        invoice_name = invoice_data.get("name", "N/A")
        posting_date = invoice_data.get("posting_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        lines.append(f"Invoice: {invoice_name}")
        lines.append(f"Date: {posting_date}")
        lines.append(f"Customer: {invoice_data.get('customer_name', invoice_data.get('customer', 'Walk-in'))}")
        lines.append("-" * width)

        # Items header
        lines.append(f"{'Item':<{(width*2)//3}}{'Qty':<8}{'Total':<10}")
        lines.append("-" * width)

        # Items
        items = invoice_data.get("items", [])
        for item in items:
            item_name = item.get("item_name", item.get("item_code", "Unknown"))[:width//2]
            qty = self._to_decimal(item.get("qty", 0))
            rate = self._to_decimal(item.get("rate", 0))
            amount_raw = item.get("amount")
            if amount_raw is None:
                amount_raw = item.get("base_amount")
            amount = self._money(amount_raw) if amount_raw is not None else self._money(qty * rate)

            # Keep qty displayed as int when possible
            qty_display = int(qty) if qty == int(qty) else float(qty)
            lines.append(f"{item_name:<{(width*2)//3}}{qty_display:<8}{float(amount):<10.2f}")

        lines.append("-" * width)

        # Totals
        total_qty = sum(self._to_decimal(item.get("qty", 0)) for item in items)
        net_total = self._money(invoice_data.get("net_total", invoice_data.get("total", 0)))
        tax_total = self._extract_total_taxes(invoice_data)
        grand_total = self._money(invoice_data.get("grand_total", 0))

        tax_lines = self._extract_tax_lines(invoice_data)

        total_qty_display = int(total_qty) if total_qty == int(total_qty) else float(total_qty)
        lines.append(f"{'Total Qty:':<{(width*3)//4}}{total_qty_display:>{width//4}}")
        lines.append(f"{'Net Total:':<{(width*3)//4}}{float(net_total):>{width//4}.2f}")
        if tax_lines:
            for tax in tax_lines:
                label = str(tax.get('label', 'Tax'))
                amount = float(tax.get('amount', 0) or 0)
                lines.append(f"{(label + ':'):<{(width*3)//4}}{amount:>{width//4}.2f}")
        elif tax_total > 0:
            lines.append(f"{'Tax:':<{(width*3)//4}}{float(tax_total):>{width//4}.2f}")
        lines.append(f"{'GRAND TOTAL:':<{(width*3)//4}}{float(grand_total):>{width//4}.2f}")

        # Payments
        payments = invoice_data.get("payments", [])
        if payments:
            lines.append("-" * width)
            lines.append("Payments:")
            for payment in payments:
                mode = payment.get("mode_of_payment", "Unknown")
                amount = payment.get("amount", 0)
                lines.append(f"  {mode}: {amount:.2f}")

        lines.append("-" * width)

        # M-Pesa transaction codes (Kenya-specific)
        mpesa_codes = self._extract_mpesa_codes(invoice_data)
        if mpesa_codes:
            lines.append("M-Pesa Transactions:")
            for code in mpesa_codes:
                lines.append(f"  {code}")
            lines.append("")

        # Footer
        lines.append(self._center_text("Thank you for your business!", width))
        lines.append(self._center_text("Visit us again soon!", width))

        # QR Code for invoice verification
        qr_data = f"Invoice:{invoice_name}"
        qr_ascii = self._generate_qr_ascii(qr_data)
        if qr_ascii:
            lines.append("")
            lines.append("Scan for verification:")
            lines.extend(qr_ascii)

        return "\n".join(lines)

    def generate_html_receipt(
        self,
        invoice_data: Dict[str, Any],
        language: str = "en",
        include_logo: bool = False
    ) -> str:
        """
        Generate HTML receipt for web display/printing

        Args:
            invoice_data: Invoice data dictionary
            language: Language code
            include_logo: Whether to include company logo

        Returns:
            HTML formatted receipt
        """
        company_name = self._escape_html(invoice_data.get("company", DEFAULT_COMPANY_NAME))
        invoice_name = self._escape_html(invoice_data.get("name", "N/A"))
        customer_name = self._escape_html(invoice_data.get("customer_name", invoice_data.get("customer", "Walk-in")))
        posting_date = self._escape_html(invoice_data.get("posting_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Receipt - {invoice_name}</title>
            <style>
                body {{
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.4;
                    max-width: 300px;
                    margin: 0 auto;
                    padding: 10px;
                }}
                .center {{ text-align: center; }}
                .right {{ text-align: right; }}
                .bold {{ font-weight: bold; }}
                table {{ width: 100%; border-collapse: collapse; }}
                th, td {{ text-align: left; padding: 2px 0; }}
                .total-row {{ border-top: 1px solid #000; font-weight: bold; }}
                .grand-total {{ font-size: 14px; border-top: 2px solid #000; }}
                .mpesa-code {{ background: #f0f0f0; padding: 5px; margin: 5px 0; }}
            </style>
        </head>
        <body>
            <div class="center bold">{company_name}</div>
            <div class="center">{'='*30}</div>

            <p><strong>Invoice:</strong> {invoice_name}</p>
            <p><strong>Date:</strong> {posting_date}</p>
            <p><strong>Customer:</strong> {customer_name}</p>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="right">Qty</th>
                        <th class="right">Rate</th>
                        <th class="right">Total</th>
                    </tr>
                </thead>
                <tbody>
        """

        items = invoice_data.get("items", [])
        for item in items:
            item_name = self._escape_html(item.get("item_name", item.get("item_code", "Unknown")))
            qty = self._to_decimal(item.get("qty", 0))
            rate = self._to_decimal(item.get("rate", 0))
            amount_raw = item.get("amount")
            if amount_raw is None:
                amount_raw = item.get("base_amount")
            amount = self._money(amount_raw) if amount_raw is not None else self._money(qty * rate)

            qty_display = int(qty) if qty == int(qty) else float(qty)

            html += f"""
                    <tr>
                        <td>{item_name}</td>
                        <td class="right">{qty_display}</td>
                        <td class="right">{float(self._money(rate)):.2f}</td>
                        <td class="right">{float(amount):.2f}</td>
                    </tr>
            """

        net_total = self._money(invoice_data.get("net_total", invoice_data.get("total", 0)))
        tax_total = self._extract_total_taxes(invoice_data)
        grand_total = self._money(invoice_data.get("grand_total", 0))
        tax_lines = self._extract_tax_lines(invoice_data)

        html += f"""
                </tbody>
            </table>

            <div class="total-row">
                <p class="right">Net Total: {float(net_total):.2f}</p>
        """

        if tax_lines:
            for tax in tax_lines:
                label = str(tax.get('label', 'Tax'))
                amount = float(tax.get('amount', 0) or 0)
                html += f"""<p class=\"right\">{label}: {amount:.2f}</p>"""
        elif tax_total > 0:
            html += f"""<p class=\"right\">Tax: {float(tax_total):.2f}</p>"""

        html += f"""
                <p class="grand-total right">GRAND TOTAL: {float(grand_total):.2f}</p>
            </div>
        """

        # Payments
        payments = invoice_data.get("payments", [])
        if payments:
            html += "<h4>Payments:</h4><ul>"
            for payment in payments:
                mode = payment.get("mode_of_payment", "Unknown")
                amount = payment.get("amount", 0)
                html += f"<li>{mode}: {amount:.2f}</li>"
            html += "</ul>"

        # M-Pesa codes
        mpesa_codes = self._extract_mpesa_codes(invoice_data)
        if mpesa_codes:
            html += '<div class="mpesa-code"><strong>M-Pesa Transactions:</strong><br>'
            html += '<br>'.join(mpesa_codes)
            html += '</div>'

        # QR Code
        qr_data = f"Invoice:{invoice_name}"
        qr_base64 = self._generate_qr_base64(qr_data)
        if qr_base64:
            html += f'''
            <div class="center">
                <p><strong>Scan for verification:</strong></p>
                <img src="data:image/png;base64,{qr_base64}" alt="QR Code" style="max-width: 100px;">
            </div>
            '''

        html += """
            <div class="center">
                <p>Thank you for your business!</p>
                <p>Visit us again soon!</p>
            </div>
        </body>
        </html>
        """

        return html

    def generate_pdf_receipt(
        self,
        invoice_data: Dict[str, Any],
        language: str = "en"
    ) -> bytes:
        """
        Generate PDF receipt

        Args:
            invoice_data: Invoice data dictionary
            language: Language code

        Returns:
            PDF content as bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        # Company header
        company_name = invoice_data.get("company", DEFAULT_COMPANY_NAME)
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=30,
            alignment=1  # Center
        )
        story.append(Paragraph(company_name, title_style))
        story.append(Spacer(1, 12))

        # Invoice details
        invoice_name = invoice_data.get("name", "N/A")
        customer_name = invoice_data.get("customer_name", invoice_data.get("customer", "Walk-in"))
        posting_date = invoice_data.get("posting_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        details = [
            f"Invoice: {invoice_name}",
            f"Date: {posting_date}",
            f"Customer: {customer_name}"
        ]

        for detail in details:
            story.append(Paragraph(detail, styles['Normal']))
        story.append(Spacer(1, 12))

        # Items table
        items = invoice_data.get("items", [])
        table_data = [['Item', 'Qty', 'Rate', 'Total']]

        for item in items:
            item_name = item.get("item_name", item.get("item_code", "Unknown"))
            qty = self._to_decimal(item.get("qty", 0))
            rate = self._to_decimal(item.get("rate", 0))
            amount_raw = item.get("amount")
            if amount_raw is None:
                amount_raw = item.get("base_amount")
            amount = self._money(amount_raw) if amount_raw is not None else self._money(qty * rate)

            qty_display = int(qty) if qty == int(qty) else float(qty)
            table_data.append([item_name, str(qty_display), f"{float(self._money(rate)):.2f}", f"{float(amount):.2f}"])

        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
        story.append(Spacer(1, 12))

        # Totals
        net_total = self._money(invoice_data.get("net_total", invoice_data.get("total", 0)))
        tax_total = self._extract_total_taxes(invoice_data)
        grand_total = self._money(invoice_data.get("grand_total", 0))
        tax_lines = self._extract_tax_lines(invoice_data)

        totals_style = styles['Normal']
        story.append(Paragraph(f"Net Total: {float(net_total):.2f}", totals_style))
        if tax_lines:
            for tax in tax_lines:
                label = str(tax.get('label', 'Tax'))
                amount = float(tax.get('amount', 0) or 0)
                story.append(Paragraph(f"{label}: {amount:.2f}", totals_style))
        elif tax_total > 0:
            story.append(Paragraph(f"Tax: {float(tax_total):.2f}", totals_style))
        story.append(Paragraph(f"<b>GRAND TOTAL: {float(grand_total):.2f}</b>", styles['Heading3']))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    def send_receipt_email(
        self,
        invoice_id: str,
        email: str,
        receipt_html: str,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Send receipt via email

        Args:
            invoice_id: Invoice identifier
            email: Recipient email
            receipt_html: HTML receipt content
            language: Language code

        Returns:
            Send result
        """
        # This would integrate with email service
        # For now, return mock success
        logger.info(f"Sending receipt {invoice_id} to {email}")

        return {
            "success": True,
            "message": f"Receipt sent to {email}",
            "invoice_id": invoice_id,
            "email": email
        }

    def send_receipt_sms(
        self,
        invoice_id: str,
        phone_number: str,
        receipt_text: str,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Send receipt via SMS (Kenya-specific)

        Args:
            invoice_id: Invoice identifier
            phone_number: Recipient phone number
            receipt_text: Text receipt content
            language: Language code

        Returns:
            Send result
        """
        # This would integrate with SMS service (e.g., Africa's Talking, M-Pesa SMS)
        # For now, return mock success
        logger.info(f"Sending SMS receipt {invoice_id} to {phone_number}")

        return {
            "success": True,
            "message": f"SMS receipt sent to {phone_number}",
            "invoice_id": invoice_id,
            "phone_number": phone_number,
            "message_length": len(receipt_text)
        }

    def _center_text(self, text: str, width: int) -> str:
        """Center text within given width"""
        return text.center(width)

    def _generate_qr_ascii(self, data: str) -> Optional[List[str]]:
        """Generate ASCII QR code"""
        try:
            qr = qrcode.QRCode(version=1, box_size=1, border=1)
            qr.add_data(data)
            qr.make(fit=True)

            matrix = qr.get_matrix()
            lines = []
            for row in matrix:
                line = "".join("██" if cell else "  " for cell in row)
                lines.append(line)
            return lines
        except Exception as e:
            logger.warning(f"Failed to generate QR code: {e}")
            return None

    def _generate_qr_base64(self, data: str) -> Optional[str]:
        """Generate base64 encoded QR code PNG"""
        try:
            qr = qrcode.QRCode(version=1, box_size=4, border=2)
            qr.add_data(data)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            return base64.b64encode(buffer.getvalue()).decode()
        except Exception as e:
            logger.warning(f"Failed to generate QR code: {e}")
            return None

    def _extract_mpesa_codes(self, invoice_data: Dict[str, Any]) -> List[str]:
        """Extract M-Pesa transaction codes from invoice data"""
        codes = []

        # Look in payments for M-Pesa transactions
        payments = invoice_data.get("payments", [])
        for payment in payments:
            if payment.get("mode_of_payment") == "M-Pesa":
                # M-Pesa transaction codes are typically in reference field or remarks
                reference = payment.get("reference", payment.get("remarks", ""))
                if reference and ("MP" in reference.upper() or len(reference) > 8):
                    codes.append(reference)

        return codes