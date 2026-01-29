"""Integration tests for POS Receipt endpoints.

These tests validate that receipt generation includes line items and taxes
and that PDF responses are base64-encoded (as expected by the frontend).
"""

import base64
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.dependencies.auth import get_current_user, require_tenant_access
from app.services.pos.pos_service_factory import get_pos_service


@pytest.fixture
def client():
    return TestClient(app)


class _DummyPosService:
    def __init__(self, invoice_doc: dict):
        self._invoice_doc = invoice_doc

    async def _request(self, method: str, endpoint: str, **kwargs):
        # The receipts router must call using the `endpoint` kwarg.
        assert method == "GET"
        assert endpoint.startswith("/api/resource/Sales Invoice/")
        return {"data": self._invoice_doc}


@pytest.fixture
def invoice_doc() -> dict:
    return {
        "name": "SINV-TEST-00001",
        "company": "Test Company",
        "customer": "TEST_CUSTOMER",
        "customer_name": "Test Customer",
        "posting_date": "2026-01-01 12:00:00",
        "items": [
            {
                "item_code": "TEST_ITEM",
                "item_name": "Test Item",
                "qty": 2,
                "rate": 1000.0,
                "amount": 2000.0,
            }
        ],
        "taxes": [
            {
                "description": "VAT 16%",
                "tax_amount": 320.0,
            }
        ],
        "net_total": 2000.0,
        "total_taxes_and_charges": 320.0,
        "grand_total": 2320.0,
        "payments": [
            {"mode_of_payment": "Cash", "amount": 2320.0},
        ],
    }


@pytest.fixture
def overridden_deps(invoice_doc: dict):
    """Override auth/db/service dependencies for receipt endpoints."""

    dummy_service = _DummyPosService(invoice_doc)

    app.dependency_overrides[get_db] = lambda: None
    app.dependency_overrides[require_tenant_access] = lambda: "test-tenant"
    app.dependency_overrides[get_current_user] = lambda: {"sub": "test-user", "tenant_id": "test-tenant"}
    app.dependency_overrides[get_pos_service] = lambda: dummy_service

    try:
        yield
    finally:
        app.dependency_overrides = {}


def test_get_thermal_receipt_includes_items_and_tax(client: TestClient, overridden_deps):
    res = client.get("/api/pos/receipts/SINV-TEST-00001?format=thermal&language=en")
    assert res.status_code == 200
    data = res.json()
    assert data["format"] == "thermal"
    assert "Test Item" in data["content"]
    assert "Qty" in data["content"]
    assert "VAT 16%" in data["content"]
    assert "GRAND TOTAL" in data["content"]


def test_get_html_receipt_includes_items_table_and_tax(client: TestClient, overridden_deps):
    res = client.get("/api/pos/receipts/SINV-TEST-00001?format=html&language=en")
    assert res.status_code == 200
    data = res.json()
    assert data["format"] == "html"
    assert "<th>Item</th>" in data["content"]
    assert "Test Item" in data["content"]
    assert "VAT 16%" in data["content"]


def test_get_pdf_receipt_is_base64_encoded_pdf(client: TestClient, overridden_deps):
    res = client.get("/api/pos/receipts/SINV-TEST-00001?format=pdf&language=en")
    assert res.status_code == 200
    data = res.json()
    assert data["format"] == "pdf"
    pdf_bytes = base64.b64decode(data["content"])
    assert pdf_bytes.startswith(b"%PDF")


def test_email_receipt_accepts_json_body(client: TestClient, overridden_deps):
    with patch(
        "app.services.pos.receipt_service.ReceiptService.send_receipt_email",
        return_value={"success": True},
    ):
        res = client.post(
            "/api/pos/receipts/SINV-TEST-00001/email?language=en",
            json={"email": "test@example.com", "language": "en"},
        )
        assert res.status_code == 200
        assert res.json().get("success") is True


def test_sms_receipt_accepts_json_body(client: TestClient, overridden_deps):
    with patch(
        "app.services.pos.receipt_service.ReceiptService.send_receipt_sms",
        return_value={"success": True},
    ):
        res = client.post(
            "/api/pos/receipts/SINV-TEST-00001/sms?language=en",
            json={"phone_number": "+254700000000", "language": "en"},
        )
        assert res.status_code == 200
        assert res.json().get("success") is True
