"""
Internationalization API for PoS
Provides translation and localization services
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.i18n.pos_translations import POSTranslationService

router = APIRouter(
    prefix="/i18n",
    tags=["Internationalization"],
)

# Global translation service instance
translation_service = POSTranslationService()


@router.get("/languages")
async def get_supported_languages(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of supported languages

    Returns available language codes and display names
    """
    return {
        "languages": translation_service.get_supported_languages(),
        "default_language": "en"
    }


@router.get("/translations/{language}")
async def get_translations(
    language: str,
    section: Optional[str] = Query(None, description="Translation section (pos, receipt, etc.)"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get translations for a specific language

    Returns translation dictionary for the requested language
    """
    if not translation_service.validate_language(language):
        raise HTTPException(
            status_code=404,
            detail={
                "type": "language_not_supported",
                "message": f"Language '{language}' is not supported",
                "supported_languages": list(translation_service.get_supported_languages().keys())
            }
        )

    if section == "receipt":
        translations = translation_service.get_receipt_translations(language)
    elif section == "pos":
        translations = translation_service.get_pos_interface_translations(language)
    else:
        translations = translation_service.get_pos_interface_translations(language)

    return {
        "language": language,
        "section": section or "all",
        "translations": translations,
        "fallback_language": translation_service.get_fallback_language(language)
    }


@router.post("/format/currency")
async def format_currency(
    amount: float,
    currency: str = Query("KES", description="Currency code"),
    language: str = Query("en", description="Language code"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Format currency amount with proper localization

    Returns formatted currency string
    """
    try:
        formatted = translation_service.format_currency(amount, currency, language)
        return {
            "amount": amount,
            "currency": currency,
            "language": language,
            "formatted": formatted
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "formatting_error",
                "message": "Failed to format currency",
                "error": str(e)
            }
        )


@router.post("/format/date")
async def format_date(
    date_string: str,
    format: str = Query("short", description="Date format (short, medium, long, full)"),
    language: str = Query("en", description="Language code"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Format date string with proper localization

    Expects date_string in ISO format (YYYY-MM-DDTHH:MM:SS)
    """
    try:
        from datetime import datetime
        date_obj = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        formatted = translation_service.format_date(date_obj, language, format)
        return {
            "date_string": date_string,
            "language": language,
            "format": format,
            "formatted": formatted
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "type": "invalid_date_format",
                "message": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)",
                "error": str(e)
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "formatting_error",
                "message": "Failed to format date",
                "error": str(e)
            }
        )


@router.post("/format/datetime")
async def format_datetime(
    datetime_string: str,
    format: str = Query("short", description="Datetime format"),
    language: str = Query("en", description="Language code"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Format datetime string with proper localization

    Expects datetime_string in ISO format (YYYY-MM-DDTHH:MM:SS)
    """
    try:
        from datetime import datetime
        datetime_obj = datetime.fromisoformat(datetime_string.replace('Z', '+00:00'))
        formatted = translation_service.format_datetime(datetime_obj, language, format)
        return {
            "datetime_string": datetime_string,
            "language": language,
            "format": format,
            "formatted": formatted
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "type": "invalid_datetime_format",
                "message": "Invalid datetime format. Use ISO format (YYYY-MM-DDTHH:MM:SS)",
                "error": str(e)
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "formatting_error",
                "message": "Failed to format datetime",
                "error": str(e)
            }
        )


@router.post("/format/number")
async def format_number(
    number: float,
    language: str = Query("en", description="Language code"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Format number with proper localization

    Returns formatted number string
    """
    try:
        formatted = translation_service.format_number(number, language)
        return {
            "number": number,
            "language": language,
            "formatted": formatted
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "formatting_error",
                "message": "Failed to format number",
                "error": str(e)
            }
        )


@router.get("/text/{key}")
async def get_text(
    key: str,
    language: str = Query("en", description="Language code"),
    params: Optional[str] = Query(None, description="Format parameters as JSON string"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get translated text for a specific key

    Supports format parameters for dynamic content
    """
    try:
        # Parse format parameters if provided
        format_params = {}
        if params:
            try:
                import json
                format_params = json.loads(params)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "invalid_params",
                        "message": "Invalid JSON format for params"
                    }
                )

        text = translation_service.get_text(key, language, **format_params)
        return {
            "key": key,
            "language": language,
            "text": text,
            "params": format_params
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "translation_error",
                "message": "Failed to get translation",
                "error": str(e)
            }
        )


@router.get("/validate/{language}")
async def validate_language(
    language: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate if a language code is supported

    Returns validation result and fallback information
    """
    is_valid = translation_service.validate_language(language)
    fallback = translation_service.get_fallback_language(language)

    return {
        "language": language,
        "is_valid": is_valid,
        "fallback_language": fallback,
        "supported_languages": list(translation_service.get_supported_languages().keys())
    }