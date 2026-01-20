import json
import sys
from urllib import request, error

BASE = "http://[::1]:4000"
EMAIL = "admin@moran.com"
PASSWORD = "password123"


def http_json(method: str, path: str, data=None, headers=None):
    url = BASE + path
    body = None
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        hdrs["Content-Type"] = "application/json"

    req = request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
            ct = resp.headers.get("Content-Type", "")
            if "application/json" in ct:
                return resp.status, json.loads(raw.decode("utf-8") or "null")
            return resp.status, raw.decode("utf-8", errors="replace")
    except error.HTTPError as e:
        raw = e.read()
        ct = e.headers.get("Content-Type", "")
        try:
            payload = (
                json.loads(raw.decode("utf-8") or "null")
                if "application/json" in ct
                else raw.decode("utf-8", errors="replace")
            )
        except Exception:
            payload = raw.decode("utf-8", errors="replace")
        return e.code, payload


def main() -> int:
    code, payload = http_json("GET", "/api/health")
    print("proxy /api/health:", code, payload)
    if code >= 400:
        return 1

    code, resp1 = http_json(
        "POST", "/api/auth/v1/login-with-tenant", {"email": EMAIL, "password": PASSWORD}
    )
    print("login step1:", code)
    if code >= 400:
        print(resp1)
        return 1

    tenant_id = None
    token = None

    if isinstance(resp1, dict) and resp1.get("access_token") and resp1.get("tenant"):
        tenant_id = resp1["tenant"]["id"]
        token = resp1["access_token"]
    else:
        tenants = (resp1.get("tenants") if isinstance(resp1, dict) else None) or []
        if not tenants:
            print("no tenants returned:", resp1)
            return 1

        tenant_id = tenants[0]["id"]
        code, resp2 = http_json(
            "POST",
            "/api/auth/v1/login-with-tenant",
            {"email": EMAIL, "password": PASSWORD, "tenant_id": tenant_id},
        )
        print("login step2:", code)
        if code >= 400:
            print(resp2)
            return 1
        token = resp2.get("access_token") if isinstance(resp2, dict) else None

    if not tenant_id or not token:
        print("missing tenant_id/token")
        return 1

    print("tenant_id:", tenant_id)

    headers = {"Authorization": f"Bearer {token}"}

    tails = [
        "crm/customer-groups",
        "crm/territories",
        "crm/sales-persons",
        "hr/departments",
        "hr/designations",
        "hr/holiday-lists",
        "hr/shift-types",
        "manufacturing/work-centers",
        "manufacturing/operations",
        "projects/project-templates",
    ]

    any_fail = False
    for tail in tails:
        code, payload = http_json(
            "GET", f"/api/tenants/{tenant_id}/erp/{tail}", headers=headers
        )

        if code >= 400:
            any_fail = True
            detail = payload.get("detail") if isinstance(payload, dict) else str(payload)[:200]
            print(f"{tail}: {code} ERROR {detail}")
            continue

        if isinstance(payload, list):
            print(f"{tail}: {code} list[{len(payload)}]")
        elif isinstance(payload, dict) and isinstance(payload.get("data"), list):
            print(f"{tail}: {code} data[{len(payload['data'])}]")
        else:
            print(f"{tail}: {code} ok")

    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
