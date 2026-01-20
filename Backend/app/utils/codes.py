import random
import datetime
import string
from sqlalchemy.orm import Session
from typing import Optional

# Crockford's Base32 Alphabet (Excluding I, L, O, U)
BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

def generate_base32_suffix(length=5):
    return "".join(random.choices(BASE32_ALPHABET, k=length))

def generate_entity_code(prefix: str, country_code: str = "GLB", year: int = None, length: int = 5) -> str:
    """
    Generates a human-readable entity code.
    Format: PREFIX-COUNTRY-YEAR-SUFFIX
    Example: USR-KE-25-X8M4Q
    """
    if year is None:
        year = datetime.datetime.now().year % 100 # Last 2 digits
    
    suffix = generate_base32_suffix(length)
    return f"{prefix}-{country_code}-{year}-{suffix}".upper()

# Entity Prefixes
PREFIX_USER = "USR"
PREFIX_TENANT = "TEN"
PREFIX_STAFF = "STF"
PREFIX_KYC = "KYC"
PREFIX_CAPABILITY = "CAP"
PREFIX_ROLE = "ROL"
PREFIX_PERMISSION = "PRM"
PREFIX_SALES_PERSON = "SPN"
PREFIX_EMPLOYEE = "EMP"
PREFIX_CONTACT = "CON"
PREFIX_LEAD = "LID"

# Module Abbreviations for Permission Codes
MODULE_ABBREVIATIONS = {
    "IAM": "IAM",
    "CRM": "CRM",
    "INVENTORY": "INV",
    "MANUFACTURING": "MFG",
    "ACCOUNTING": "ACC",
    "HR": "HRM",
    "SALES": "SAL",
    "PURCHASING": "PUR",
    "CHAMA": "CHM",
    "LEDGER": "LDG",
    "TENANT": "TNT",
    "DASHBOARD": "DSH"
}

def generate_role_code(scope: str, country_code: Optional[str] = None, db: Optional[Session] = None) -> str:
    """
    Generate role code.
    - System roles: ROL-SYS-{seq}
    - Tenant roles: ROL-TEN-{seq}
    - Custom roles: ROL-CUS-{country_code}-{seq}
    
    Args:
        scope: SYSTEM, TENANT, or CUSTOM
        country_code: Required for CUSTOM roles
        db: Database session for sequence lookup (optional, will use random if not provided)
    
    Returns:
        Role code string
    """
    if scope == "SYSTEM":
        if db:
            from sqlalchemy import text
            result = db.execute(text("SELECT COUNT(*) FROM roles WHERE scope = 'SYSTEM'")).scalar()
            sequence = (result or 0) + 1
        else:
            sequence = 1
        return f"ROL-SYS-{sequence:03d}"
    
    elif scope == "TENANT":
        if db:
            from sqlalchemy import text
            result = db.execute(text("SELECT COUNT(*) FROM roles WHERE scope = 'TENANT' AND is_system = true")).scalar()
            sequence = (result or 0) + 1
        else:
            sequence = 1
        return f"ROL-TEN-{sequence:03d}"
    
    else:  # CUSTOM
        if not country_code:
            country_code = "GLB"
        if db:
            from sqlalchemy import text
            result = db.execute(text(
                "SELECT COUNT(*) FROM roles WHERE level = 'CUSTOM' AND tenant_id IS NOT NULL"
            )).scalar()
            sequence = (result or 0) + 1
        else:
            sequence = random.randint(1, 999)
        return f"ROL-CUS-{country_code}-{sequence:03d}"

def generate_permission_code(module: str, db: Optional[Session] = None) -> str:
    """
    Generate permission code.
    Format: PRM-{MODULE_ABBR}-{SEQ}
    
    Args:
        module: Module name (e.g., "iam", "crm", "inventory")
        db: Database session for sequence lookup (optional)
    
    Returns:
        Permission code string
    """
    module_upper = module.upper()
    module_abbr = MODULE_ABBREVIATIONS.get(module_upper, module[:3].upper())
    
    if db:
        from sqlalchemy import text
        result = db.execute(text(
            f"SELECT COUNT(*) FROM permissions WHERE module = :module"
        ), {"module": module.lower()}).scalar()
        sequence = (result or 0) + 1
    else:
        sequence = 1
    
    return f"PRM-{module_abbr}-{sequence:03d}"

def get_country_currency_map() -> dict:
    """
    Get mapping of country codes to currency codes.
    
    Returns:
        Dictionary mapping country codes (e.g., "KE") to currency codes (e.g., "KES")
    """
    return {
        "KE": "KES",  # Kenya
        "UG": "UGX",  # Uganda
        "TZ": "TZS",  # Tanzania
        "RW": "RWF",  # Rwanda
        "ET": "ETB",  # Ethiopia
        "GH": "GHS",  # Ghana
        "NG": "NGN",  # Nigeria
        "ZA": "ZAR",  # South Africa
    }
