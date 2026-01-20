import json
import re
import time
import uuid
from urllib import request, error

BASE = "http://localhost:4000"
EMAIL = "admin@moran.com"
PASSWORD = "password123"

CODE_PATTERN = re.compile(r"^SPN-[A-Z]{2}-\d{2}-[0-9A-Z]{5}$")


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
        with request.urlopen(req, timeout=30) as resp:
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


def login_get_token_and_tenant():
    code, resp1 = http_json(
        "POST", "/api/auth/v1/login-with-tenant", {"email": EMAIL, "password": PASSWORD}
    )
    if code >= 400:
        raise RuntimeError(f"login step1 failed: {code} {resp1}")

    if isinstance(resp1, dict) and resp1.get("access_token") and resp1.get("tenant"):
        return resp1["access_token"], resp1["tenant"]["id"]

    tenants = (resp1.get("tenants") if isinstance(resp1, dict) else None) or []
    if not tenants:
        raise RuntimeError(f"no tenants returned: {resp1}")

    tenant_id = tenants[0]["id"]
    code, resp2 = http_json(
        "POST",
        "/api/auth/v1/login-with-tenant",
        {"email": EMAIL, "password": PASSWORD, "tenant_id": tenant_id},
    )
    if code >= 400:
        raise RuntimeError(f"login step2 failed: {code} {resp2}")

    token = resp2.get("access_token") if isinstance(resp2, dict) else None
    if not token:
        raise RuntimeError(f"no access_token: {resp2}")

    return token, tenant_id


def main() -> int:
    code, payload = http_json("GET", "/api/health")
    print("proxy /api/health:", code, payload)
    if code != 200:
        return 1

    token, tenant_id = login_get_token_and_tenant()
    headers = {"Authorization": f"Bearer {token}"}
    print("tenant_id:", tenant_id)

    suffix = uuid.uuid4().hex[:6]
    person_name = f"Test Person {time.strftime('%H%M%S')}-{suffix}"

    base = f"/api/tenants/{tenant_id}/erp/crm/sales-persons"

    # Create (do NOT send `name` from client; backend should generate human-readable code)
    create_body = {
        "sales_person_name": person_name,
        "enabled": 1,
    }

    code, created = http_json("POST", base, data=create_body, headers=headers)
    print("create:", code)
    if code >= 400:
        print(created)
        return 1

    created_code = created.get("name") if isinstance(created, dict) else None
    print("created_code:", created_code)
    if not created_code:
        print("unexpected create payload:", created)
        return 1

    if not CODE_PATTERN.match(created_code):
        print("ERROR: Sales Person ID is not human-readable code format")
        print("expected pattern:", CODE_PATTERN.pattern)
        return 1

    # Get
    code, fetched = http_json("GET", f"{base}/{request.quote(created_code)}", headers=headers)
    print("get:", code)
    if code >= 400:
        print(fetched)
        return 1

    # Update
    code, updated = http_json(
        "PUT",
        f"{base}/{request.quote(created_code)}",
        data={"enabled": 0},
        headers=headers,
    )
    print("update:", code)
    if code >= 400:
        print(updated)
        http_json("DELETE", f"{base}/{request.quote(created_code)}", headers=headers)
        return 1

    # Delete
    code, _ = http_json("DELETE", f"{base}/{request.quote(created_code)}", headers=headers)
    print("delete:", code)
    if code not in (200, 204):
        return 1

    print("CRUD cycle OK (human-readable id)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
