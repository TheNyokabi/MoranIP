#!/usr/bin/env python3
"""Verify Stock Entry posting into ERPNext ledgers.

Creates and submits a Material Receipt Stock Entry via the MoranERP API Gateway,
then queries ERPNext for related GL Entry and Stock Ledger Entry rows.

Usage:
  python3 Backend/scripts/verify_stock_entry_posting.py \
    --base-url http://localhost:9000 \
    --tenant-id <uuid> \
    --email admin@moran.com \
    --password admin123

Defaults are set for local dev.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional


def http_json(method: str, url: str, *, headers: Optional[Dict[str, str]] = None, body: Any = None) -> Any:
    req_headers = dict(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")

    return json.loads(raw) if raw else None


def pick_first(items: List[Dict[str, Any]], *keys: str) -> Optional[str]:
    if not items:
        return None
    for k in keys:
        v = (items[0] or {}).get(k)
        if isinstance(v, str) and v:
            return v
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:9000")
    ap.add_argument("--tenant-id", default="9f31ac8b-c021-44fc-8360-1496ac6273d0")
    ap.add_argument("--email", default="admin@moran.com")
    ap.add_argument("--password", default="admin123")
    ap.add_argument("--basic-rate", type=float, default=100.0)
    ap.add_argument("--qty", type=float, default=1.0)
    args = ap.parse_args()

    base = args.base_url.rstrip("/")

    print("1) Login...", flush=True)
    login = http_json(
        "POST",
        f"{base}/api/auth/v1/login-with-tenant",
        body={"email": args.email, "password": args.password, "tenant_id": args.tenant_id},
    )
    token = (login or {}).get("access_token")
    if not token:
        print(f"FAILED: No access_token in login response: {login}", file=sys.stderr)
        return 2

    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": args.tenant_id}

    print("2) Pick item + warehouse...", flush=True)
    items = http_json(
        "GET",
        f"{base}/api/inventory/items?" + urllib.parse.urlencode({"is_stock_item": 1, "disabled": 0, "limit": 5}),
        headers=headers,
    )
    item_list = (items or {}).get("items") or []
    item_code = pick_first(item_list, "name", "item_code")
    if not item_code:
        print(f"FAILED: No items returned: {items}", file=sys.stderr)
        return 2

    warehouses = http_json(
        "GET",
        f"{base}/api/inventory/warehouses?" + urllib.parse.urlencode({"is_group": 0, "disabled": 0}),
        headers=headers,
    )
    wh_list = (warehouses or {}).get("warehouses") or []
    warehouse = pick_first(wh_list, "name")
    if not warehouse:
        print(f"FAILED: No warehouses returned: {warehouses}", file=sys.stderr)
        return 2

    print(f"Using item={item_code} warehouse={warehouse}", flush=True)

    print("3) Create Stock Entry (Material Receipt)...", flush=True)
    create_payload = {
        "stock_entry_type": "Material Receipt",
        "items": [
            {
                "item_code": item_code,
                "qty": args.qty,
                "t_warehouse": warehouse,
                "basic_rate": args.basic_rate,
            }
        ],
    }

    created = http_json("POST", f"{base}/api/inventory/stock-entries", headers=headers, body=create_payload)
    created_data = (created or {}).get("data") if isinstance(created, dict) else None
    if not isinstance(created_data, dict):
        created_data = created if isinstance(created, dict) else {}

    ste_name = created_data.get("name")
    if not ste_name:
        print(f"FAILED: Could not parse Stock Entry name from: {created}", file=sys.stderr)
        return 2

    print(f"Created: {ste_name}", flush=True)

    print("4) Submit...", flush=True)
    submitted = http_json(
        "POST",
        f"{base}/api/inventory/stock-entries/{urllib.parse.quote(ste_name)}/submit",
        headers=headers,
    )
    docstatus = (((submitted or {}).get("data") or {}) if isinstance(submitted, dict) else {}).get("docstatus")
    if docstatus != 1:
        print(f"FAILED: Stock Entry did not submit cleanly: {submitted}", file=sys.stderr)
        return 2

    print("5) Query ERPNext ledgers...", flush=True)
    filters = json.dumps([["voucher_type", "=", "Stock Entry"], ["voucher_no", "=", ste_name]])

    gl_params = {
        "filters": filters,
        "fields": json.dumps(["name", "account", "debit", "credit", "voucher_type", "voucher_no"]),
        "limit_page_length": 50,
    }
    # Note: ERPNext engine router is mounted without the global /api prefix.
    gl = http_json(
        "GET",
        f"{base}/erpnext/resource/GL%20Entry?" + urllib.parse.urlencode(gl_params),
        headers=headers,
    )
    gl_rows = (gl or {}).get("data") or []

    sle_params = {
        "filters": filters,
        "fields": json.dumps(
            [
                "name",
                "item_code",
                "warehouse",
                "actual_qty",
                "qty_after_transaction",
                "stock_value_difference",
                "voucher_type",
                "voucher_no",
            ]
        ),
        "limit_page_length": 50,
    }
    sle = http_json(
        "GET",
        f"{base}/erpnext/resource/Stock%20Ledger%20Entry?" + urllib.parse.urlencode(sle_params),
        headers=headers,
    )
    sle_rows = (sle or {}).get("data") or []

    print(f"GL rows={len(gl_rows)}")
    for r in gl_rows[:5]:
        print(f"  {r.get('account')}: Dr {r.get('debit')} Cr {r.get('credit')}")

    print(f"SLE rows={len(sle_rows)}")
    for r in sle_rows[:5]:
        print(
            f"  {r.get('item_code')} @ {r.get('warehouse')}: {r.get('actual_qty')} (after {r.get('qty_after_transaction')}) valueΔ {r.get('stock_value_difference')}"
        )

    print("OK: Submitted + ledgers queryable")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
