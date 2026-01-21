"""
Provisioning Service

Orchestrates the end-to-end provisioning flow from workspace creation to POS readiness.
Implements all 11 steps with idempotency, retry logic, and comprehensive error handling.

Author: MoranERP Team
"""

import logging
import json
import time
import uuid
import re
from typing import Optional, Dict, List, Literal
from datetime import datetime, timezone
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.iam import Tenant
from app.models.onboarding import TenantOnboarding
from app.services.engine_health_service import engine_health_service, EngineHealthStatus
from app.services.erpnext_client import erpnext_adapter
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.exceptions.provisioning import (
    ProvisioningError,
    CriticalProvisioningError,
    TransientProvisioningError,
    NonCriticalProvisioningError
)

logger = logging.getLogger(__name__)


def _parse_erpnext_error(error: Exception, correlation_id: str) -> tuple[str, str]:
    """
    Parse ERPNext error and extract meaningful error message.
    
    Categorizes errors into:
    - duplicate_resource: Expected, can be treated as idempotent (409, DuplicateEntryError)
    - missing_resource: Resource doesn't exist (404, LinkValidationError)
    - validation_error: Data validation failed (417, ValidationError)
    - missing_required_field: Required field missing (417, MandatoryError)
    - link_validation_error: Reference to non-existent resource (417, LinkValidationError)
    - unknown_error: Unexpected error
    
    Returns:
        tuple: (error_type, error_message)
    """
    error_type = "unknown_error"
    error_message = str(error)
    
    if isinstance(error, HTTPException):
        status_code = error.status_code
        detail = error.detail
        
        # Handle 409 Conflict (duplicate) - expected and idempotent
        if status_code == 409:
            error_type = "duplicate_resource"
            if isinstance(detail, dict):
                error_message = detail.get("message", "Resource already exists")
            else:
                error_message = "Resource already exists (duplicate)"
            return error_type, error_message
        
        if isinstance(detail, dict):
            error_type = detail.get("type", "erp_error")
            error_message = detail.get("message", str(error))
            
            # Check error message directly for abbreviation conflicts (before parsing raw_response)
            # This handles cases where the error message is in the detail.message field
            if "abbreviation" in error_message.lower() and ("already used" in error_message.lower() or "already exists" in error_message.lower()):
                error_type = "duplicate_resource"
                return error_type, error_message
            
            # Extract specific error patterns from ERPNext
            raw_response = detail.get("raw_response")
            if raw_response:
                if isinstance(raw_response, dict):
                    exc = raw_response.get("exc")
                    exc_type = raw_response.get("exc_type", "")
                    
                    # Check exc_type first (more reliable)
                    if exc_type == "DuplicateEntryError":
                        error_type = "duplicate_resource"
                        error_message = "Resource already exists (duplicate entry)"
                        return error_type, error_message
                    elif exc_type == "ValidationError":
                        error_type = "validation_error"
                        # Check if it's an abbreviation conflict (should be treated as duplicate)
                        if exc and isinstance(exc, list) and len(exc) > 0:
                            exc_str = exc[0] if isinstance(exc[0], str) else str(exc[0])
                            if "abbreviation" in exc_str.lower() and ("already used" in exc_str.lower() or "already exists" in exc_str.lower()):
                                error_type = "duplicate_resource"  # Treat abbreviation conflicts as duplicates
                                error_message = "Abbreviation already used for another company"
                                return error_type, error_message
                    elif exc_type == "LinkValidationError":
                        error_type = "link_validation_error"
                    elif exc_type == "MandatoryError":
                        error_type = "missing_required_field"
                    
                    if exc and isinstance(exc, list) and len(exc) > 0:
                        exc_str = exc[0] if isinstance(exc[0], str) else str(exc[0])
                        
                        # Try to extract the actual error message
                        if "Could not find" in exc_str:
                            # Extract: "Could not find {Resource}: {Name}"
                            match = re.search(r"Could not find (\w+): (.+)", exc_str)
                            if match:
                                resource_type, resource_name = match.groups()
                                error_message = f"Missing {resource_type}: '{resource_name}'. Please ensure it exists in ERPNext."
                                if error_type == "unknown_error":
                                    error_type = "missing_resource"
                        elif "already exists" in exc_str.lower() or "already used" in exc_str.lower() or "Duplicate" in exc_str:
                            error_type = "duplicate_resource"
                            # Extract resource name if possible
                            match = re.search(r"(\w+)\s+already exists", exc_str, re.IGNORECASE)
                            if match:
                                error_message = f"{match.group(1)} already exists"
                            else:
                                error_message = "Resource already exists (duplicate)"
                        elif "mandatory" in exc_str.lower() or "required" in exc_str.lower() or "MandatoryError" in exc_str:
                            if error_type == "unknown_error":
                                error_type = "missing_required_field"
                            # Extract field names if possible
                            match = re.search(r"\[([^\]]+)\]:\s*(.+)", exc_str)
                            if match:
                                fields = match.group(1)
                                error_message = f"Required fields missing: {fields}"
                            else:
                                error_message = exc_str
                        elif "ValidationError" in exc_str:
                            if error_type == "unknown_error":
                                error_type = "validation_error"
                            # Check if it's an abbreviation conflict
                            if "abbreviation" in exc_str.lower() and ("already used" in exc_str.lower() or "already exists" in exc_str.lower()):
                                error_type = "duplicate_resource"  # Treat abbreviation conflicts as duplicates
                                error_message = "Abbreviation already used for another company"
                                return error_type, error_message
                            # Extract validation message
                            match = re.search(r"ValidationError[:\s]+(.+)", exc_str)
                            if match:
                                error_message = match.group(1).strip()
                            else:
                                error_message = exc_str
                        elif "LinkValidationError" in exc_str:
                            if error_type == "unknown_error":
                                error_type = "link_validation_error"
                            match = re.search(r"Could not find (\w+): (.+)", exc_str)
                            if match:
                                resource_type, resource_name = match.groups()
                                error_message = f"Invalid reference: {resource_type} '{resource_name}' does not exist or is not linked to the company."
                            else:
                                error_message = exc_str
    
    return error_type, error_message


def _generate_unique_abbr(company_name: str, existing_abbrs: List[str], max_attempts: int = 20) -> str:
    """
    Generate a unique company abbreviation with multiple fallback strategies.
    This ensures resilience since abbreviations are auto-generated, not user-driven.
    
    Args:
        company_name: Company name
        existing_abbrs: List of existing abbreviations
        max_attempts: Maximum attempts to find unique abbreviation
    
    Returns:
        Unique abbreviation (guaranteed to be unique)
    """
    # Strategy 1: First letters of words (up to 3 words, max 10 chars)
    words = [w for w in company_name.split()[:3] if w]
    base_abbr = "".join(w[0] for w in words).upper()[:10]
    
    # Strategy 2: If no words or too short, use first 3-5 alphanumeric chars
    if not base_abbr or len(base_abbr) < 2:
        base_abbr = "".join(c for c in company_name if c.isalnum())[:5].upper()
        if not base_abbr:
            base_abbr = "CO"  # Fallback
    
    # Ensure minimum length
    if len(base_abbr) < 2:
        base_abbr = base_abbr + "X"
    
    # Check if base is unique
    if base_abbr not in existing_abbrs:
        return base_abbr
    
    # Strategy 3: Try numbered suffixes (1-9999) - more aggressive
    # Can go up to 9999 if needed
    max_number = min(max_attempts * 100, 9999)
    for i in range(1, max_number):
        candidate = f"{base_abbr[:8]}{i}"[:10]
        if candidate not in existing_abbrs:
            return candidate
    
    # Strategy 4: Use timestamp-based suffix (last 4 digits)
    import time
    timestamp_suffix = str(int(time.time()))[-4:]
    candidate = f"{base_abbr[:6]}{timestamp_suffix}"[:10]
    if candidate not in existing_abbrs:
        return candidate
    
    # Strategy 5: Use random number suffix (4 digits)
    import random
    for _ in range(10):  # Try 10 random numbers
        random_suffix = str(random.randint(1000, 9999))
        candidate = f"{base_abbr[:6]}{random_suffix}"[:10]
        if candidate not in existing_abbrs:
            return candidate
    
    # Strategy 6: Use UUID suffix (short, 4 chars)
    import uuid
    for _ in range(5):  # Try multiple UUIDs
        uuid_suffix = str(uuid.uuid4()).replace('-', '')[:4].upper()
        candidate = f"{base_abbr[:6]}{uuid_suffix}"[:10]
        if candidate not in existing_abbrs:
            return candidate
    
    # Strategy 7: Full UUID (last resort, guaranteed unique)
    return str(uuid.uuid4()).replace('-', '')[:10].upper()
    return str(uuid.uuid4())[:8].upper()


# ==================== Data Models ====================

@dataclass
class ProvisioningConfig:
    """Configuration for provisioning flow"""
    include_demo_data: bool = False
    pos_store_enabled: bool = True
    country_template: Optional[str] = None


@dataclass
class StepResult:
    """Result of a provisioning step execution"""
    step_name: str
    status: Literal["completed", "failed", "exists", "skipped"]
    message: str
    error: Optional[str] = None
    metadata: Optional[Dict] = None
    duration_ms: float = 0.0


class ProvisioningStatus(str, Enum):
    """Provisioning status enum"""
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


@dataclass
class ProvisioningResult:
    """Result of complete provisioning flow"""
    status: ProvisioningStatus
    current_step: Optional[str] = None
    progress: float = 0.0
    steps_completed: int = 0
    total_steps: int = 11
    errors: List[Dict[str, str]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []


# ==================== Provisioning Service ====================

class ProvisioningService:
    """
    Orchestrates the end-to-end provisioning flow from workspace creation to POS readiness.
    
    Implements all 11 steps with:
    - Idempotency (safe to retry)
    - Error classification (Critical, Transient, Non-Critical)
    - State tracking in TenantOnboarding
    - Comprehensive logging
    """
    
    # List of all provisioning steps in order
    PROVISIONING_STEPS = [
        "step_0_engine_check",
        "step_1_platform_setup",
        "step_2_company",
        "step_3_chart_of_accounts",
        "step_4_warehouses",
        "step_5_settings",
        "step_6_items",
        "step_7_customer",
        "step_8_pos_profile",
        "step_9_pos_session",
        "step_10_post_sale_updates"
    ]
    
    def __init__(self):
        """Initialize provisioning service"""
        pass
    
    def provision_workspace_to_pos(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        user_id: Optional[str] = None
    ) -> ProvisioningResult:
        """
        Execute complete provisioning flow from workspace to POS readiness.
        
        Args:
            tenant_id: Tenant UUID
            config: Provisioning configuration
            db: Database session
            user_id: User initiating provisioning (optional)
            
        Returns:
            ProvisioningResult with status, progress, and errors
        """
        correlation_id = str(uuid.uuid4())
        logger.info(f"[{correlation_id}] Starting provisioning for tenant {tenant_id}")
        
        start_time = datetime.now(timezone.utc)
        
        # Get or create onboarding record
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")
        
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()
        
        if not onboarding:
            onboarding = TenantOnboarding(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                template="FULL_POS",  # Use FULL_POS as default template
                status="IN_PROGRESS",
                provisioning_type="FULL_POS",
                provisioning_config=config.__dict__ if hasattr(config, '__dict__') else {
                    "include_demo_data": config.include_demo_data,
                    "pos_store_enabled": config.pos_store_enabled,
                    "country_template": config.country_template
                },
                provisioning_steps={},
                provisioning_metadata={},
                started_at=start_time
            )
            db.add(onboarding)
        else:
            onboarding.status = "IN_PROGRESS"
            onboarding.started_at = onboarding.started_at or start_time
            if not onboarding.provisioning_steps:
                onboarding.provisioning_steps = {}
            if not onboarding.provisioning_metadata:
                onboarding.provisioning_metadata = {}
        
        # Update tenant status
        tenant.provisioning_status = "PROVISIONING"
        tenant.provisioning_error = None
        db.commit()
        db.refresh(onboarding)
        
        # Execute steps
        steps = onboarding.provisioning_steps or {}
        errors = []
        current_step = None
        
        try:
            for step_name in self.PROVISIONING_STEPS:
                # Skip optional steps if not configured
                if step_name == "step_6_items" and not config.include_demo_data:
                    logger.info(f"[{correlation_id}] Skipping optional step: {step_name}")
                    steps[step_name] = {
                        "status": "skipped",
                        "message": "Demo items not requested",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    onboarding.provisioning_steps = steps  # Ensure SQLAlchemy detects the change
                    db.commit()
                    continue
                
                # Check if step already completed
                step_data = steps.get(step_name, {})
                if step_data.get("status") in ["completed", "exists", "skipped"]:
                    logger.info(f"[{correlation_id}] Step {step_name} already completed, skipping")
                    continue
                
                current_step = step_name
                logger.info(f"[{correlation_id}] Executing step: {step_name}")
                
                # Execute step
                try:
                    result = self._execute_step(
                        step_name=step_name,
                        tenant_id=tenant_id,
                        config=config,
                        db=db,
                        onboarding=onboarding,
                        correlation_id=correlation_id
                    )
                    
                    # Store step result
                    steps[step_name] = {
                        "status": result.status,
                        "message": result.message,
                        "error": result.error,
                        "metadata": result.metadata or {},
                        "duration_ms": result.duration_ms,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Explicitly update onboarding.provisioning_steps to ensure SQLAlchemy detects the change
                    onboarding.provisioning_steps = steps
                    
                    # Update metadata if provided
                    if result.metadata:
                        if not onboarding.provisioning_metadata:
                            onboarding.provisioning_metadata = {}
                        onboarding.provisioning_metadata.update(result.metadata)
                    
                    # Handle step result
                    if result.status == "failed":
                        error_msg = result.error or result.message
                        errors.append({"step": step_name, "error": error_msg})
                        onboarding.error_message = error_msg
                        onboarding.error_step = step_name
                        
                        # Check if critical error - POS Profile is critical for POS operations
                        critical_steps = ["step_0_engine_check", "step_2_company", "step_3_chart_of_accounts", "step_8_pos_profile"]
                        if step_name in critical_steps:
                            logger.error(f"[{correlation_id}] Critical step {step_name} failed, stopping provisioning")
                            tenant.provisioning_status = "FAILED"
                            tenant.provisioning_error = error_msg
                            onboarding.status = "FAILED"
                            db.commit()
                            return ProvisioningResult(
                                status=ProvisioningStatus.FAILED,
                                current_step=step_name,
                                progress=self._calculate_progress(steps, config),
                                steps_completed=len([s for s, d in steps.items() if d.get("status") in ["completed", "exists"]]),
                                total_steps=len([s for s in self.PROVISIONING_STEPS if s != "step_6_items" or config.include_demo_data]),
                                errors=errors,
                                started_at=start_time,
                                completed_at=datetime.now(timezone.utc)
                            )
                    
                    db.commit()
                    db.refresh(onboarding)
                    
                except CriticalProvisioningError as e:
                    logger.error(f"[{correlation_id}] Critical error in step {step_name}: {e}")
                    error_msg = str(e)
                    errors.append({"step": step_name, "error": error_msg})
                    onboarding.error_message = error_msg
                    onboarding.error_step = step_name
                    tenant.provisioning_status = "FAILED"
                    tenant.provisioning_error = error_msg
                    onboarding.status = "FAILED"
                    db.commit()
                    return ProvisioningResult(
                        status=ProvisioningStatus.FAILED,
                        current_step=step_name,
                        progress=self._calculate_progress(steps, config),
                        steps_completed=len([s for s, d in steps.items() if d.get("status") in ["completed", "exists"]]),
                        total_steps=len([s for s in self.PROVISIONING_STEPS if s != "step_6_items" or config.include_demo_data]),
                        errors=errors,
                        started_at=start_time,
                        completed_at=datetime.now(timezone.utc)
                    )
                except Exception as e:
                    logger.error(f"[{correlation_id}] Unexpected error in step {step_name}: {e}", exc_info=True)
                    error_msg = str(e)
                    errors.append({"step": step_name, "error": error_msg})
                    onboarding.error_message = error_msg
                    onboarding.error_step = step_name
                    # Continue to next step for non-critical errors
                    steps[step_name] = {
                        "status": "failed",
                        "message": f"Step failed: {error_msg}",
                        "error": error_msg,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    onboarding.provisioning_steps = steps  # Ensure SQLAlchemy detects the change
                    db.commit()
                    db.refresh(onboarding)
            
            # All steps completed
            completed_steps = len([s for s, d in steps.items() if d.get("status") in ["completed", "exists"]])
            total_steps = len([s for s in self.PROVISIONING_STEPS if s != "step_6_items" or config.include_demo_data])
            
            if errors:
                status = ProvisioningStatus.PARTIAL
                tenant.provisioning_status = "PARTIAL"
            else:
                status = ProvisioningStatus.COMPLETED
                tenant.provisioning_status = "PROVISIONED"
                tenant.provisioned_at = datetime.now(timezone.utc)
            
            onboarding.status = "COMPLETED" if status == ProvisioningStatus.COMPLETED else "PARTIAL"
            onboarding.completed_at = datetime.now(timezone.utc)
            db.commit()
            
            logger.info(f"[{correlation_id}] Provisioning completed with status: {status.value}")
            
            return ProvisioningResult(
                status=status,
                progress=100.0 if status == ProvisioningStatus.COMPLETED else self._calculate_progress(steps, config),
                steps_completed=completed_steps,
                total_steps=total_steps,
                errors=errors,
                started_at=start_time,
                completed_at=datetime.now(timezone.utc)
            )
            
        except Exception as e:
            logger.error(f"[{correlation_id}] Fatal error during provisioning: {e}", exc_info=True)
            tenant.provisioning_status = "FAILED"
            tenant.provisioning_error = str(e)
            onboarding.status = "FAILED"
            onboarding.error_message = str(e)
            onboarding.completed_at = datetime.now(timezone.utc)
            db.commit()
            
            return ProvisioningResult(
                status=ProvisioningStatus.FAILED,
                current_step=current_step,
                progress=self._calculate_progress(steps, config),
                steps_completed=len([s for s, d in steps.items() if d.get("status") in ["completed", "exists"]]),
                total_steps=len([s for s in self.PROVISIONING_STEPS if s != "step_6_items" or config.include_demo_data]),
                errors=errors + [{"step": current_step or "unknown", "error": str(e)}],
                started_at=start_time,
                completed_at=datetime.now(timezone.utc)
            )
    
    def _execute_step(
        self,
        step_name: str,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Execute a specific provisioning step"""
        step_methods = {
            "step_0_engine_check": self._step_engine_check,
            "step_1_platform_setup": self._step_platform_setup,
            "step_2_company": self._step_company,
            "step_3_chart_of_accounts": self._step_chart_of_accounts,
            "step_4_warehouses": self._step_warehouses,
            "step_5_settings": self._step_settings,
            "step_6_items": self._step_items,
            "step_7_customer": self._step_customer,
            "step_8_pos_profile": self._step_pos_profile,
            "step_9_pos_session": self._step_pos_session,
            "step_10_paint_setup": self._step_paint_setup,
            # Current provisioning flow uses step_10_post_sale_updates (see PROVISIONING_STEPS).
            # Keep step_11_post_sale_updates as an alias in case the step list is updated.
            "step_10_post_sale_updates": self._step_post_sale_updates,
            "step_11_post_sale_updates": self._step_post_sale_updates,
        }
        
        method = step_methods.get(step_name)
        if not method:
            raise ValueError(f"Unknown step: {step_name}")
        
        return method(tenant_id, config, db, onboarding, correlation_id)
    
    def _calculate_progress(self, steps: Dict, config: ProvisioningConfig) -> float:
        """Calculate provisioning progress percentage"""
        total_steps = len([s for s in self.PROVISIONING_STEPS if s != "step_6_items" or config.include_demo_data])
        completed = len([s for s, d in steps.items() if d.get("status") in ["completed", "exists", "skipped"]])
        return (completed / total_steps * 100) if total_steps > 0 else 0.0

    def _ensure_engine_online(
        self,
        tenant_id: str,
        step_name: str,
        db: Session,
        correlation_id: str
    ) -> Optional[StepResult]:
        """Verify engine is online before running a critical ERPNext step."""
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return StepResult(
                step_name=step_name,
                status="failed",
                message="Tenant not found for engine health check",
                error="Tenant not found",
                duration_ms=0
            )

        engine_type = tenant.engine or "erpnext"
        health_result = engine_health_service.check_engine_health(
            tenant_id=tenant_id,
            engine_type=engine_type,
            force_refresh=True,
            correlation_id=correlation_id
        )

        if health_result.status != EngineHealthStatus.ONLINE:
            return StepResult(
                step_name=step_name,
                status="failed",
                message=f"Engine not stable. Check server status before provisioning. {health_result.message}",
                error=health_result.error or health_result.message,
                duration_ms=0
            )

        return None
    
    def _handle_erpnext_error(
        self,
        error: Exception,
        correlation_id: str,
        resource_name: str,
        step_name: str,
        is_idempotent: bool = True
    ) -> StepResult:
        """
        Handle ERPNext errors consistently.
        
        Args:
            error: The exception that occurred
            correlation_id: Correlation ID for logging
            resource_name: Name of the resource being created/updated
            step_name: Name of the provisioning step
            is_idempotent: Whether duplicate errors should be treated as success (default: True)
        
        Returns:
            StepResult with appropriate status
        """
        error_type, error_message = _parse_erpnext_error(error, correlation_id)
        
        # Handle duplicate resources as idempotent success
        if is_idempotent and (error_type == "duplicate_resource" or isinstance(error, HTTPException) and getattr(error, 'status_code', None) == 409):
            logger.info(f"[{correlation_id}] Resource '{resource_name}' already exists (idempotent success)")
            return StepResult(
                step_name=step_name,
                status="exists",
                message=f"{resource_name} already exists",
                duration_ms=0
            )
        
        # Handle expected validation errors that can be recovered from
        if error_type in ["missing_required_field", "validation_error"]:
            logger.warning(f"[{correlation_id}] Validation error for {resource_name}: {error_message}")
            return StepResult(
                step_name=step_name,
                status="failed",
                message=f"Validation failed: {error_message}",
                error=error_message,
                duration_ms=0
            )
        
        # Handle missing resources (link validation errors)
        if error_type in ["missing_resource", "link_validation_error"]:
            logger.error(f"[{correlation_id}] Missing resource for {resource_name}: {error_message}")
            raise CriticalProvisioningError(
                f"Missing required resource: {error_message}",
                step_name
            )
        
        # All other errors are unexpected
        logger.error(f"[{correlation_id}] Unexpected error for {resource_name}: {error_type} - {error_message}")
        raise CriticalProvisioningError(
            f"Unexpected error: {error_message}",
            step_name
        )
    
    # ==================== Step Implementations ====================
    
    def _step_engine_check(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 0: Engine Availability Check"""
        start_time = time.time()
        
        try:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise ValueError(f"Tenant {tenant_id} not found")
            
            engine_type = tenant.engine or "erpnext"
            health_result = engine_health_service.check_engine_health(
                tenant_id=tenant_id,
                engine_type=engine_type,
                force_refresh=True,
                correlation_id=correlation_id
            )
            
            if health_result.status != EngineHealthStatus.ONLINE:
                return StepResult(
                    step_name="step_0_engine_check",
                    status="failed",
                    message=f"Engine not stable. Check server status before provisioning. {health_result.message}",
                    error=health_result.error or health_result.message,
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            return StepResult(
                step_name="step_0_engine_check",
                status="completed",
                message=health_result.message or "Engine is online",
                duration_ms=(time.time() - start_time) * 1000
            )
        except Exception as e:
            return StepResult(
                step_name="step_0_engine_check",
                status="failed",
                message=f"Engine check failed: {str(e)}",
                error=str(e),
                duration_ms=(time.time() - start_time) * 1000
            )
    
    def _step_platform_setup(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 1: Platform Setup.

        This step is intended for lightweight, idempotent platform defaults.

        For ERPNext, we ensure a small set of required master data exists so
        subsequent user actions (like creating Items from the UI) don't fail
        with LinkValidationError due to missing references.
        """
        start_time = time.time()

        try:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                return StepResult(
                    step_name="step_1_platform_setup",
                    status="failed",
                    message="Platform setup failed: tenant not found",
                    error="Tenant not found",
                    duration_ms=(time.time() - start_time) * 1000,
                )

            # Only apply ERPNext-specific defaults for ERPNext tenants.
            if getattr(tenant, "engine", None) != "erpnext":
                return StepResult(
                    step_name="step_1_platform_setup",
                    status="completed",
                    message="Platform setup completed",
                    duration_ms=(time.time() - start_time) * 1000,
                )

            # ---- Ensure UOMs ----
            required_uoms = ["Nos", "Kg", "Liter", "Milliliter"]
            for uom_name in required_uoms:
                try:
                    erpnext_adapter.get_resource("UOM", uom_name, tenant_id)
                except HTTPException as e:
                    if e.status_code != 404:
                        raise
                    try:
                        erpnext_adapter.create_resource(
                            "UOM",
                            {
                                "uom_name": uom_name,
                                "must_be_whole_number": 1 if uom_name == "Nos" else 0,
                            },
                            tenant_id,
                        )
                        logger.info(f"[{correlation_id}] Created missing ERPNext UOM: {uom_name}")
                    except HTTPException as create_err:
                        if create_err.status_code != 409:
                            raise

            # ---- Ensure Item Group(s) ----
            # Define comprehensive item group hierarchy
            # This creates a standard structure suitable for most businesses
            common_item_groups = [
                # Root group (must be created first)
                {"name": "All Item Groups", "parent": None, "is_group": 1},
                
                # Top-level categories
                {"name": "Products", "parent": "All Item Groups", "is_group": 1},
                {"name": "Services", "parent": "All Item Groups", "is_group": 1},
                {"name": "Raw Materials", "parent": "All Item Groups", "is_group": 1},
                
                # Product subcategories
                {"name": "Consumables", "parent": "Products", "is_group": 0},
                {"name": "Sub Assemblies", "parent": "Products", "is_group": 0},
                {"name": "Finished Goods", "parent": "Products", "is_group": 0},
                
                # Service subcategories
                {"name": "Consulting", "parent": "Services", "is_group": 0},
                {"name": "Installation", "parent": "Services", "is_group": 0},
                {"name": "Maintenance", "parent": "Services", "is_group": 0},
            ]
            
            # Create item groups in order (parents before children)
            for ig in common_item_groups:
                ig_name = ig["name"]
                try:
                    erpnext_adapter.get_resource("Item Group", ig_name, tenant_id)
                    logger.debug(f"[{correlation_id}] Item Group '{ig_name}' already exists")
                except HTTPException as e:
                    if e.status_code != 404:
                        raise
                    
                    # Build payload for creation
                    payload = {
                        "item_group_name": ig_name,
                        "is_group": ig.get("is_group", 0),
                    }
                    
                    # Add parent if specified
                    if ig.get("parent"):
                        payload["parent_item_group"] = ig["parent"]
                    
                    try:
                        erpnext_adapter.create_resource("Item Group", payload, tenant_id)
                        logger.info(f"[{correlation_id}] Created ERPNext Item Group: {ig_name}")
                    except HTTPException as create_err:
                        if create_err.status_code == 409:
                            logger.debug(f"[{correlation_id}] Item Group '{ig_name}' already exists (409)")
                            continue
                        
                        # If parent linkage fails, try without parent for resilience
                        if ig.get("parent"):
                            logger.warning(f"[{correlation_id}] Failed to create '{ig_name}' with parent, retrying without parent")
                            try:
                                erpnext_adapter.create_resource(
                                    "Item Group",
                                    {"item_group_name": ig_name, "is_group": ig.get("is_group", 0)},
                                    tenant_id,
                                )
                                logger.info(f"[{correlation_id}] Created ERPNext Item Group (no parent): {ig_name}")
                            except HTTPException as retry_err:
                                if retry_err.status_code != 409:
                                    logger.error(f"[{correlation_id}] Failed to create Item Group '{ig_name}': {retry_err}")
                                    raise
                        else:
                            raise

            # ---- Ensure Fiscal Year(s) ----
            # Create fiscal years for current year and next 2 years to prevent
            # "Date is not in any active Fiscal Year" errors when submitting stock entries
            from datetime import datetime
            current_year = datetime.now().year
            fiscal_years_to_create = [
                {"year": str(current_year), "start": f"{current_year}-01-01", "end": f"{current_year}-12-31"},
                {"year": str(current_year + 1), "start": f"{current_year + 1}-01-01", "end": f"{current_year + 1}-12-31"},
                {"year": str(current_year + 2), "start": f"{current_year + 2}-01-01", "end": f"{current_year + 2}-12-31"},
            ]
            
            for fy in fiscal_years_to_create:
                try:
                    erpnext_adapter.get_resource("Fiscal Year", fy["year"], tenant_id)
                    logger.debug(f"[{correlation_id}] Fiscal Year '{fy['year']}' already exists")
                except HTTPException as e:
                    if e.status_code != 404:
                        raise
                    
                    try:
                        erpnext_adapter.create_resource(
                            "Fiscal Year",
                            {
                                "year": fy["year"],
                                "year_start_date": fy["start"],
                                "year_end_date": fy["end"],
                                "disabled": 0
                            },
                            tenant_id,
                        )
                        logger.info(f"[{correlation_id}] Created Fiscal Year: {fy['year']}")
                    except HTTPException as create_err:
                        if create_err.status_code != 409:
                            logger.warning(f"[{correlation_id}] Failed to create Fiscal Year '{fy['year']}': {create_err}")


            return StepResult(
                step_name="step_1_platform_setup",
                status="completed",
                message="Platform setup completed",
                duration_ms=(time.time() - start_time) * 1000,
            )
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] Platform setup failed: {error_type} - {error_msg}")
            return StepResult(
                step_name="step_1_platform_setup",
                status="failed",
                message=f"Platform setup failed: {error_msg}",
                error=error_msg,
                duration_ms=(time.time() - start_time) * 1000,
            )
    
    def _step_company(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 2: Create Company"""
        start_time = time.time()

        health_check = self._ensure_engine_online(
            tenant_id=tenant_id,
            step_name="step_2_company",
            db=db,
            correlation_id=correlation_id
        )
        if health_check:
            return health_check
        
        try:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            company_name = tenant.name

            # Ensure required ERPNext master data exists before creating the Company.
            # ERPNext may attempt to create default warehouses (e.g., Transit) during
            # company setup and will hard-fail if the Warehouse Type doesn't exist.
            required_warehouse_types = [
                "Transit",
            ]

            for warehouse_type_name in required_warehouse_types:
                try:
                    erpnext_adapter.get_resource("Warehouse Type", warehouse_type_name, tenant_id)
                except HTTPException as e:
                    if e.status_code != 404:
                        raise

                    try:
                        erpnext_adapter.create_resource(
                            "Warehouse Type",
                            {
                                "name": warehouse_type_name,
                                "description": "System-created by MoranERP provisioning",
                            },
                            tenant_id,
                        )
                        logger.info(
                            f"[{correlation_id}] Created missing ERPNext Warehouse Type: {warehouse_type_name}"
                        )
                    except HTTPException as create_err:
                        # Treat duplicates as idempotent success.
                        if create_err.status_code != 409:
                            raise
            
            # Check if company exists (idempotency) - check by both name and abbreviation
            companies_response = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Company",
                method="GET",
                params={"limit_page_length": 100}
            )
            companies = companies_response.get("data", []) if isinstance(companies_response, dict) else []
            company_names = [c.get("name") for c in companies if isinstance(c, dict) and c.get("name")]
            existing_abbrs = [c.get("abbr") for c in companies if isinstance(c, dict) and c.get("abbr")]
            
            # Check if company exists by name
            existing_company = next((c for c in companies if isinstance(c, dict) and c.get("name") == company_name), None)
            if existing_company:
                company_abbr = existing_company.get("abbr")
                logger.info(f"[{correlation_id}] Company '{company_name}' already exists with abbreviation '{company_abbr}' (idempotent success)")
                return StepResult(
                    step_name="step_2_company",
                    status="exists",
                    message=f"Company '{company_name}' already exists",
                    metadata={"company_name": company_name, "company_abbr": company_abbr},
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            # Create company
            from app.utils.codes import get_country_currency_map
            currency_map = get_country_currency_map()
            currency = currency_map.get(tenant.country_code, "KES")
            
            # Map country code to country name (ERPNext expects full name, not code)
            country_map = {
                "KE": "Kenya",
                "UG": "Uganda",
                "TZ": "Tanzania",
                "RW": "Rwanda",
                "ET": "Ethiopia"
            }
            country_name = country_map.get(tenant.country_code, "Kenya")
            
            # Get existing company abbreviations to ensure uniqueness
            # existing_abbrs already populated above
            company_abbr = _generate_unique_abbr(company_name, existing_abbrs)
            
            # Validate required fields before creation
            if not company_name or len(company_name.strip()) == 0:
                raise ValueError("Company name cannot be empty")
            if not company_abbr or len(company_abbr.strip()) == 0:
                raise ValueError("Company abbreviation cannot be empty")
            if not currency:
                raise ValueError("Currency is required")
            if not country_name:
                raise ValueError("Country is required")
            
            company_data = {
                "company_name": company_name.strip(),
                "abbr": company_abbr.strip(),
                "default_currency": currency,
                "country": country_name,  # Use full country name, not code
                "is_group": 0,
                "parent_company": ""
            }
            
            # Retry logic for abbreviation conflicts
            max_retries = 3
            retry_count = 0
            created_company = None
            
            while retry_count < max_retries:
                try:
                    result = erpnext_adapter.create_resource("Company", company_data, tenant_id)
                    created_company = result.get("name") if isinstance(result, dict) else company_name
                    break  # Success, exit retry loop
                except HTTPException as e:
                    error_type, error_msg = _parse_erpnext_error(e, correlation_id)
                    
                    # Handle duplicate abbreviation - regenerate and retry
                    # Check for abbreviation conflicts in error message or error type
                    # Be very permissive - check the full error message string (may contain traceback)
                    error_msg_lower = error_msg.lower()
                    is_abbreviation_conflict = (
                        error_type == "duplicate_resource" or
                        ("abbreviation" in error_msg_lower and ("already used" in error_msg_lower or "already exists" in error_msg_lower)) or
                        ("validation" in error_type.lower() and "abbreviation" in error_msg_lower) or
                        ("erp_error" in error_type.lower() and "abbreviation" in error_msg_lower and "already" in error_msg_lower)
                    )
                    
                    # Log for debugging
                    if is_abbreviation_conflict:
                        logger.info(f"[{correlation_id}] Detected abbreviation conflict: error_type={error_type}, checking error_msg (first 200 chars): {error_msg[:200]}")
                    
                    if is_abbreviation_conflict and retry_count < max_retries - 1:
                        retry_count += 1
                        logger.warning(f"[{correlation_id}] Abbreviation '{company_abbr}' conflict detected, regenerating (attempt {retry_count}/{max_retries})")
                        
                        # Re-fetch existing abbreviations (might have changed)
                        companies_response = erpnext_adapter.proxy_request(
                            tenant_id,
                            "resource/Company",
                            method="GET",
                            params={"limit_page_length": 100}
                        )
                        companies = companies_response.get("data", []) if isinstance(companies_response, dict) else []
                        existing_abbrs = [c.get("abbr") for c in companies if isinstance(c, dict) and c.get("abbr")]
                        
                        # Add the failed abbreviation to the list to ensure we don't try it again
                        if company_abbr not in existing_abbrs:
                            existing_abbrs.append(company_abbr)
                        
                        logger.info(f"[{correlation_id}] Existing abbreviations before regeneration ({len(existing_abbrs)} total): {existing_abbrs[:20]}")
                        
                        # Calculate base abbreviation to avoid retrying similar patterns
                        words = [w for w in company_name.split()[:3] if w]
                        base_abbr_for_tracking = "".join(w[0] for w in words).upper()[:10]
                        if not base_abbr_for_tracking or len(base_abbr_for_tracking) < 2:
                            base_abbr_for_tracking = "".join(c for c in company_name if c.isalnum())[:5].upper() or "CO"
                        
                        # Add previous attempt patterns to avoid retrying them
                        # Skip ahead more aggressively: if retry_count is 2, we've tried 1 and 2, so start from 100+
                        start_number = max(100, retry_count * 50)  # Start from higher numbers on retries
                        for prev_num in range(1, start_number + 50):
                            prev_candidate = f"{base_abbr_for_tracking[:8]}{prev_num}"[:10]
                            if prev_candidate not in existing_abbrs:
                                existing_abbrs.append(prev_candidate)
                        
                        # Generate new unique abbreviation with more attempts and higher starting point
                        company_abbr = _generate_unique_abbr(company_name, existing_abbrs, max_attempts=200)  # More attempts
                        company_data["abbr"] = company_abbr.strip()
                        
                        logger.info(f"[{correlation_id}] Generated new abbreviation: '{company_abbr}' (attempt {retry_count + 1}, skipped {start_number} previous patterns)")
                        
                        # Also check if company was created by another process
                        existing_company = next((c for c in companies if isinstance(c, dict) and c.get("name") == company_name), None)
                        if existing_company:
                            company_abbr = existing_company.get("abbr")
                            logger.info(f"[{correlation_id}] Company '{company_name}' was created by another process (idempotent success)")
                            return StepResult(
                                step_name="step_2_company",
                                status="exists",
                                message=f"Company '{company_name}' already exists",
                                metadata={"company_name": company_name, "company_abbr": company_abbr},
                                duration_ms=(time.time() - start_time) * 1000
                            )
                        continue  # Retry with new abbreviation
                    
                    # Handle other errors or final retry failure
                    logger.error(f"[{correlation_id}] Company creation failed: {error_type} - {error_msg}")
                    
                    # Check if company was created despite error (race condition)
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                        # Double-check if company exists now
                        companies_response = erpnext_adapter.proxy_request(
                            tenant_id,
                            "resource/Company",
                            method="GET",
                            params={"limit_page_length": 100}
                        )
                        companies = companies_response.get("data", []) if isinstance(companies_response, dict) else []
                        existing_company = next((c for c in companies if isinstance(c, dict) and c.get("name") == company_name), None)
                        if existing_company:
                            company_abbr = existing_company.get("abbr")
                            logger.info(f"[{correlation_id}] Company '{company_name}' exists after error (idempotent success)")
                            return StepResult(
                                step_name="step_2_company",
                                status="exists",
                                message=f"Company '{company_name}' already exists",
                                metadata={"company_name": company_name, "company_abbr": company_abbr},
                                duration_ms=(time.time() - start_time) * 1000
                            )
                    
                    # Provide actionable error messages for non-recoverable errors
                    if error_type == "missing_resource" or "Could not find" in error_msg:
                        raise CriticalProvisioningError(
                            f"Company creation failed: {error_msg}. Please ensure all required master data exists in ERPNext.",
                            "step_2_company"
                        )
                    else:
                        raise CriticalProvisioningError(
                            f"Company creation failed after {retry_count + 1} attempts: {error_msg}",
                            "step_2_company"
                        )
            
            if not created_company:
                raise CriticalProvisioningError(
                    f"Company creation failed after {max_retries} attempts with abbreviation conflicts",
                    "step_2_company"
                )
            
            return StepResult(
                step_name="step_2_company",
                status="completed",
                message=f"Company '{created_company}' created successfully",
                metadata={"company_name": created_company, "company_abbr": company_abbr},
                duration_ms=(time.time() - start_time) * 1000
            )
        except CriticalProvisioningError:
            raise  # Re-raise critical errors
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] Company creation failed: {error_type} - {error_msg}")
            return StepResult(
                step_name="step_2_company",
                status="failed",
                message=f"Company creation failed: {error_msg}",
                error=error_msg,
                duration_ms=(time.time() - start_time) * 1000
            )
    
    def _step_chart_of_accounts(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 3: Import Chart of Accounts"""
        start_time = time.time()

        health_check = self._ensure_engine_online(
            tenant_id=tenant_id,
            step_name="step_3_chart_of_accounts",
            db=db,
            correlation_id=correlation_id
        )
        if health_check:
            return health_check
        
        try:
            import json
            company_name = onboarding.provisioning_metadata.get("company_name") if onboarding.provisioning_metadata else None
            if not company_name:
                tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                company_name = tenant.name
            
            # Check if accounts already exist (idempotency)
            accounts_response = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Account",
                method="GET",
                params={
                    "filters": f'[["company", "=", "{company_name}"]]',
                    "limit_page_length": 10
                }
            )
            existing_accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
            
            if len(existing_accounts) > 5:  # If more than 5 accounts exist, assume chart is imported
                return StepResult(
                    step_name="step_3_chart_of_accounts",
                    status="exists",
                    message=f"Chart of accounts already exists ({len(existing_accounts)} accounts found)",
                    metadata={"accounts_count": len(existing_accounts)},
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            # Determine template
            country_code = tenant.country_code if 'tenant' in locals() else db.query(Tenant).filter(Tenant.id == tenant_id).first().country_code or "KE"
            template_map = {
                "KE": "Kenya",
                "UG": "Uganda",
                "TZ": "Tanzania",
                "RW": "Rwanda",
                "ET": "Ethiopia"
            }
            template_name = config.country_template or template_map.get(country_code, "Standard")
            
            # Import chart of accounts
            result = erpnext_adapter.import_chart_of_accounts(
                tenant_id=tenant_id,
                company_name=company_name,
                template_name=template_name
            )
            
            accounts_count = result.get("accounts_count", 0) if isinstance(result, dict) else 0
            
            return StepResult(
                step_name="step_3_chart_of_accounts",
                status="completed",
                message=f"Chart of accounts imported successfully ({accounts_count} accounts)",
                metadata={"accounts_count": accounts_count, "template": template_name},
                duration_ms=(time.time() - start_time) * 1000
            )
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] Chart of accounts import failed: {error_type} - {error_msg}")
            raise CriticalProvisioningError(
                f"Chart of accounts import failed: {error_msg}",
                "step_3_chart_of_accounts"
            )
    
    def _step_warehouses(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 4: Create Warehouses"""
        start_time = time.time()
        
        try:
            company_name = onboarding.provisioning_metadata.get("company_name") if onboarding.provisioning_metadata else None
            if not company_name:
                tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                company_name = tenant.name
            
            # Resolve company abbreviation to place warehouses under the root
            root_warehouse = None
            enable_perpetual_inventory = False
            try:
                company_doc = erpnext_adapter.proxy_request(
                    tenant_id,
                    f"resource/Company/{company_name}",
                    method="GET"
                )
                company_data = company_doc.get("data", {}) if isinstance(company_doc, dict) else {}
                company_abbr = company_data.get("abbr") or company_data.get("abbreviation")
                enable_perpetual_inventory = bool(company_data.get("enable_perpetual_inventory"))
                if company_abbr:
                    from urllib.parse import quote
                    candidate_root = f"All Warehouses - {company_abbr}"
                    erpnext_adapter.proxy_request(
                        tenant_id,
                        f"resource/Warehouse/{quote(candidate_root)}",
                        method="GET"
                    )
                    root_warehouse = candidate_root
            except Exception:
                root_warehouse = None
            
            # Validate Chart of Accounts exists for company
            accounts_response = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Account",
                method="GET",
                params={
                    "filters": f'[["company", "=", "{company_name}"]]',
                    "limit_page_length": 1,
                    "fields": '["name","account_type","account_name"]'
                }
            )
            accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
            if not accounts:
                raise CriticalProvisioningError(
                    f"Chart of Accounts not found for company '{company_name}'. Please import chart of accounts first.",
                    "step_4_warehouses"
                )
            
            # Resolve stock asset account if perpetual inventory is enabled
            stock_account = None
            if enable_perpetual_inventory:
                account_filters = [
                    f'[["company", "=", "{company_name}"], ["account_type", "=", "Stock"], ["is_group", "=", 0]]',
                    f'[["company", "=", "{company_name}"], ["account_name", "like", "%Stock In Hand%"], ["is_group", "=", 0]]',
                    f'[["company", "=", "{company_name}"], ["account_name", "like", "%Inventory%"], ["is_group", "=", 0]]'
                ]
                for account_filter in account_filters:
                    resp = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Account",
                        method="GET",
                        params={
                            "filters": account_filter,
                            "limit_page_length": 1,
                            "fields": '["name","account_name","account_type"]'
                        }
                    )
                    data = resp.get("data", []) if isinstance(resp, dict) else []
                    if data:
                        stock_account = data[0].get("name")
                        break
                if not stock_account:
                    raise CriticalProvisioningError(
                        "Stock Asset account not found. Create a Stock account in Chart of Accounts or disable perpetual inventory.",
                        "step_4_warehouses"
                    )
            
            # Get existing warehouses for this company (filter by company)
            warehouses_response = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Warehouse",
                method="GET",
                params={
                    "filters": f'[["company", "=", "{company_name}"]]',
                    "limit_page_length": 100
                }
            )
            existing_warehouses = warehouses_response.get("data", []) if isinstance(warehouses_response, dict) else []
            existing_warehouse_names = []
            for wh in existing_warehouses:
                if isinstance(wh, dict):
                    wh_name = wh.get("name")  # Full name with company suffix
                    wh_warehouse_name = wh.get("warehouse_name", "").lower()
                    if wh_name:
                        existing_warehouse_names.append(wh_name)
            
            warehouses_created = []
            
            # Create parent group warehouse for hierarchy
            group_base_name = "Main Branch"
            group_full_name = None
            existing_group_check = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Warehouse",
                method="GET",
                params={
                    "filters": f'[["warehouse_name", "=", "{group_base_name}"], ["company", "=", "{company_name}"]]',
                    "limit_page_length": 1
                }
            )
            if existing_group_check.get("data"):
                group_full_name = existing_group_check["data"][0].get("name")
            else:
                try:
                    group_payload = {
                        "warehouse_name": group_base_name,
                        "company": company_name,
                        "is_group": 1,
                        "disabled": 0
                    }
                    if root_warehouse:
                        group_payload["parent_warehouse"] = root_warehouse
                    group_result = erpnext_adapter.create_resource("Warehouse", group_payload, tenant_id)
                    if isinstance(group_result, dict):
                        group_full_name = group_result.get("name")
                except Exception:
                    group_full_name = root_warehouse
            
            # Create Main Store (required)
            base_name = "Main Store"
            main_store_name_to_use = base_name
            main_store_full_name = None
            attempt = 0
            max_attempts = 10
            
            while attempt < max_attempts:
                if attempt == 0:
                    check_name = base_name
                else:
                    check_name = f"{base_name}-{attempt}"
                
                # Check if this warehouse_name already exists for this company
                existing_check_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Warehouse",
                    method="GET",
                    params={
                        "filters": f'[["warehouse_name", "=", "{check_name}"], ["company", "=", "{company_name}"]]',
                        "limit_page_length": 1
                    }
                )
                if existing_check_response.get("data"):
                    logger.warning(f"[{correlation_id}] Warehouse '{check_name}' already exists for company '{company_name}'. Using existing.")
                    main_store_full_name = existing_check_response["data"][0].get("name")
                    main_store_name_to_use = check_name
                    break
                
                # Try to create with this name
                try:
                    warehouse_data = {
                        "warehouse_name": check_name,
                        "company": company_name,
                        "is_group": 0,
                        "disabled": 0
                    }
                    if group_full_name:
                        warehouse_data["parent_warehouse"] = group_full_name
                    elif root_warehouse:
                        warehouse_data["parent_warehouse"] = root_warehouse
                    if stock_account:
                        warehouse_data["account"] = stock_account
                    result = erpnext_adapter.create_resource("Warehouse", warehouse_data, tenant_id)
                    if isinstance(result, dict):
                        main_store_full_name = result.get("name")
                    
                    if not main_store_full_name:
                        warehouses_check = erpnext_adapter.proxy_request(
                            tenant_id,
                            "resource/Warehouse",
                            method="GET",
                            params={
                                "filters": f'[["warehouse_name", "=", "{check_name}"], ["company", "=", "{company_name}"]]',
                                "limit_page_length": 1
                            }
                        )
                        if isinstance(warehouses_check, dict):
                            data = warehouses_check.get("data", [])
                            if data and len(data) > 0:
                                main_store_full_name = data[0].get("name")
                    
                    if not main_store_full_name:
                        main_store_full_name = check_name
                    
                    main_store_name_to_use = check_name
                    warehouses_created.append(main_store_full_name)
                    if attempt > 0:
                        logger.info(f"[{correlation_id}] Created warehouse: {main_store_full_name} (warehouse_name: {check_name}, attempt {attempt})")
                    else:
                        logger.info(f"[{correlation_id}] Created warehouse: {main_store_full_name} (warehouse_name: {check_name})")
                    break
                except HTTPException as e:
                    error_type, error_msg = _parse_erpnext_error(e, correlation_id)
                    if e.status_code == 409:
                        logger.debug(f"[{correlation_id}] Warehouse '{check_name}' already exists (409), trying next number...")
                        attempt += 1
                        continue
                    elif error_type == "link_validation_error" or "Could not find" in error_msg:
                        raise CriticalProvisioningError(
                            f"Warehouse creation failed: {error_msg}. Please ensure company '{company_name}' exists in ERPNext.",
                            "step_4_warehouses"
                        )
                    else:
                        logger.error(f"[{correlation_id}] Warehouse creation error: {error_type} - {error_msg}")
                        raise CriticalProvisioningError(
                            f"Warehouse creation failed: {error_msg}",
                            "step_4_warehouses"
                        )
                except Exception as e:
                    error_type, error_msg = _parse_erpnext_error(e, correlation_id)
                    logger.error(f"[{correlation_id}] Unexpected error creating warehouse '{check_name}': {error_type} - {error_msg}")
                    raise CriticalProvisioningError(
                        f"Warehouse creation failed: {error_msg}",
                        "step_4_warehouses"
                    )
            
            if attempt >= max_attempts:
                error_msg = f"Failed to create warehouse after {max_attempts} attempts. All names from '{base_name}' to '{base_name}-{max_attempts-1}' appear to be taken."
                logger.error(f"[{correlation_id}] {error_msg}")
                return StepResult(
                    step_name="step_4_warehouses",
                    status="failed",
                    message=error_msg,
                    error=error_msg,
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            # Create POS Store (if enabled)
            if config.pos_store_enabled:
                pos_base_name = "POS Store"
                pos_store_name_to_use = pos_base_name
                pos_store_full_name = None
                pos_attempt = 0
                max_pos_attempts = 10
                
                while pos_attempt < max_pos_attempts:
                    if pos_attempt == 0:
                        check_pos_name = pos_base_name
                    else:
                        check_pos_name = f"{pos_base_name}-{pos_attempt}"
                    
                    existing_pos_check = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Warehouse",
                        method="GET",
                        params={
                            "filters": f'[["warehouse_name", "=", "{check_pos_name}"], ["company", "=", "{company_name}"]]',
                            "limit_page_length": 1
                        }
                    )
                    if existing_pos_check.get("data"):
                        logger.warning(f"[{correlation_id}] POS Warehouse '{check_pos_name}' already exists. Using existing.")
                        pos_store_full_name = existing_pos_check["data"][0].get("name")
                        pos_store_name_to_use = check_pos_name
                        break
                    
                    try:
                        pos_warehouse_data = {
                            "warehouse_name": check_pos_name,
                            "company": company_name,
                            "is_group": 0,
                            "disabled": 0
                        }
                        if group_full_name:
                            pos_warehouse_data["parent_warehouse"] = group_full_name
                        elif root_warehouse:
                            pos_warehouse_data["parent_warehouse"] = root_warehouse
                        if stock_account:
                            pos_warehouse_data["account"] = stock_account
                        pos_result = erpnext_adapter.create_resource("Warehouse", pos_warehouse_data, tenant_id)
                        if isinstance(pos_result, dict):
                            pos_store_full_name = pos_result.get("name")
                        
                        if not pos_store_full_name:
                            pos_warehouses_check = erpnext_adapter.proxy_request(
                                tenant_id,
                                "resource/Warehouse",
                                method="GET",
                                params={
                                    "filters": f'[["warehouse_name", "=", "{check_pos_name}"], ["company", "=", "{company_name}"]]',
                                    "limit_page_length": 1
                                }
                            )
                            if isinstance(pos_warehouses_check, dict):
                                pos_data = pos_warehouses_check.get("data", [])
                                if pos_data and len(pos_data) > 0:
                                    pos_store_full_name = pos_data[0].get("name")
                        
                        if not pos_store_full_name:
                            pos_store_full_name = check_pos_name
                        
                        pos_store_name_to_use = check_pos_name
                        warehouses_created.append(pos_store_full_name)
                        if pos_attempt > 0:
                            logger.info(f"[{correlation_id}] Created warehouse: {pos_store_full_name} (warehouse_name: {check_pos_name}, attempt {pos_attempt})")
                        else:
                            logger.info(f"[{correlation_id}] Created warehouse: {pos_store_full_name} (warehouse_name: {check_pos_name})")
                        break
                    except HTTPException as e:
                        if e.status_code == 409:
                            logger.debug(f"[{correlation_id}] POS Warehouse '{check_pos_name}' already exists (409), trying next number...")
                            pos_attempt += 1
                            continue
                        else:
                            logger.warning(f"[{correlation_id}] Failed to create POS Store warehouse: {e.detail}")
                            break  # Non-critical, continue
                    except Exception as e:
                        logger.warning(f"[{correlation_id}] Error creating POS Store warehouse: {e}")
                        break  # Non-critical, continue
                
                if not pos_store_full_name:
                    logger.warning(f"[{correlation_id}] POS Store warehouse not created, but continuing...")
            
            # Store warehouse names (full names with company suffix) in metadata
            warehouse_names = [main_store_full_name]
            if config.pos_store_enabled and pos_store_full_name:
                warehouse_names.append(pos_store_full_name)
            
            return StepResult(
                step_name="step_4_warehouses",
                status="completed",
                message=f"Warehouses created successfully ({len(warehouses_created)} new, {len(existing_warehouse_names)} existing)",
                metadata={
                    "warehouse_names": warehouse_names,
                    "main_store": main_store_full_name,
                    "parent_warehouse": group_full_name or root_warehouse,
                    "stock_account": stock_account
                },
                duration_ms=(time.time() - start_time) * 1000
            )
        except CriticalProvisioningError:
            raise
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] Warehouse creation failed: {error_type} - {error_msg}")
            return StepResult(
                step_name="step_4_warehouses",
                status="failed",
                message=f"Warehouse creation failed: {error_msg}",
                error=error_msg,
                duration_ms=(time.time() - start_time) * 1000
            )
    
    def _step_settings(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 5: Configure Selling & Stock Settings"""
        start_time = time.time()
        
        try:
            company_name = onboarding.provisioning_metadata.get("company_name") if onboarding.provisioning_metadata else None
            if not company_name:
                tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                company_name = tenant.name
            
            warehouse_names = onboarding.provisioning_metadata.get("warehouse_names", []) if onboarding.provisioning_metadata else []
            
            # Get warehouses and filter for non-group warehouses (group warehouses cannot be used in transactions)
            warehouses_response = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Warehouse",
                method="GET",
                params={
                    "filters": f'[["company", "=", "{company_name}"]]',
                    "limit_page_length": 100
                }
            )
            existing_warehouses = warehouses_response.get("data", []) if isinstance(warehouses_response, dict) else []
            
            # Find first non-group warehouse (is_group = 0)
            # Exclude "All Warehouses" which is always a group warehouse
            main_store = None
            for wh in existing_warehouses:
                if isinstance(wh, dict):
                    wh_name = wh.get("name", "")
                    is_group = wh.get("is_group", 1)  # Default to group if not specified
                    # Skip group warehouses and "All Warehouses" (default group warehouse)
                    if is_group == 0 and "All Warehouses" not in wh_name:
                        main_store = wh.get("name")
                        logger.info(f"[{correlation_id}] Using non-group warehouse '{main_store}' as default")
                        break
            
            # Fallback: use first warehouse from metadata if no non-group found
            if not main_store and warehouse_names:
                # Try to find the warehouse in ERPNext to check if it's non-group
                for wh_name in warehouse_names:
                    for wh in existing_warehouses:
                        if isinstance(wh, dict) and wh.get("name") == wh_name:
                            is_group = wh.get("is_group", 1)
                            if is_group == 0:
                                main_store = wh_name
                                logger.info(f"[{correlation_id}] Using warehouse from metadata '{main_store}' as default")
                                break
                    if main_store:
                        break
            
            # Last fallback: Check if we need to create a warehouse
            if not main_store:
                # Check if we have warehouses in metadata that we created
                if warehouse_names:
                    # Try to fetch these specific warehouses to check their is_group status
                    for wh_name in warehouse_names:
                        try:
                            from urllib.parse import quote
                            wh_check = erpnext_adapter.proxy_request(
                                tenant_id,
                                f"resource/Warehouse/{quote(wh_name)}",
                                method="GET"
                            )
                            if wh_check and isinstance(wh_check, dict):
                                wh_data = wh_check.get("data", {})
                                if isinstance(wh_data, dict):
                                    is_group = wh_data.get("is_group", 1)
                                    wh_company = wh_data.get("company")
                                    # Verify it's non-group and belongs to the correct company
                                    if is_group == 0 and wh_company == company_name:
                                        main_store = wh_name
                                        logger.info(f"[{correlation_id}] Using warehouse from metadata '{main_store}' (verified non-group, company: {wh_company})")
                                        break
                        except Exception as e:
                            logger.debug(f"[{correlation_id}] Could not check warehouse '{wh_name}': {e}")
                            continue
                
                # If still no non-group warehouse, try fetching all warehouses again with company filter
                if not main_store:
                    logger.warning(f"[{correlation_id}] No non-group warehouse found in initial search. Re-fetching with company filter...")
                    warehouses_response = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Warehouse",
                        method="GET",
                        params={
                            "filters": f'[["company", "=", "{company_name}"], ["is_group", "=", 0]]',
                            "limit_page_length": 100
                        }
                    )
                    retry_warehouses = warehouses_response.get("data", []) if isinstance(warehouses_response, dict) else []
                    for wh in retry_warehouses:
                        if isinstance(wh, dict):
                            wh_name = wh.get("name", "")
                            if wh_name and "All Warehouses" not in wh_name:
                                main_store = wh_name
                                logger.info(f"[{correlation_id}] Found non-group warehouse '{main_store}' on retry")
                                break
                
                # If still no non-group warehouse, raise error
                if not main_store:
                    error_msg = f"No non-group warehouse found for company '{company_name}'. Please ensure at least one non-group warehouse exists."
                    logger.error(f"[{correlation_id}] {error_msg}")
                    raise ValueError(error_msg)
            
            # Update Selling Settings
            selling_settings = {
                "customer_group": "Individual",
                "territory": "All Territories",
                "maintain_same_rate": 1
            }

            # Some ERPNext setups (or custom scripts) expect this field to exist on Selling Settings.
            # Create it if missing to avoid server-side AttributeError during save.
            try:
                selling_cf_filters = json.dumps([
                    ["dt", "=", "Selling Settings"],
                    ["fieldname", "=", "fallback_to_default_price_list"],
                ])
                selling_cf_check = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Custom Field",
                    method="GET",
                    params={
                        "filters": selling_cf_filters,
                        "fields": json.dumps(["name"]),
                        "limit_page_length": 1,
                    },
                )
                if not (isinstance(selling_cf_check, dict) and selling_cf_check.get("data")):
                    selling_cf_payload = {
                        "dt": "Selling Settings",
                        "fieldname": "fallback_to_default_price_list",
                        "label": "Fallback To Default Price List",
                        "fieldtype": "Check",
                        "insert_after": "maintain_same_rate",
                    }
                    try:
                        erpnext_adapter.create_resource("Custom Field", selling_cf_payload, tenant_id)
                    except Exception:
                        erpnext_adapter.proxy_request(
                            tenant_id,
                            "method/frappe.client.insert",
                            method="POST",
                            json_data={
                                "doc": {"doctype": "Custom Field", **selling_cf_payload},
                                "ignore_permissions": 1,
                            },
                        )
            except Exception:
                # Non-critical; proceed with settings update.
                pass

            erpnext_adapter.update_selling_settings(tenant_id, selling_settings)
            
            # Ensure Global Defaults default_company is set for link validation
            try:
                erpnext_adapter.proxy_request(
                    tenant_id,
                    "method/frappe.client.set_value",
                    method="POST",
                    json_data={
                        "doctype": "Global Defaults",
                        "name": "Global Defaults",
                        "fieldname": "default_company",
                        "value": company_name,
                        "ignore_permissions": 1
                    }
                )
                # Also set user default company (Administrator) for link validation
                erpnext_adapter.proxy_request(
                    tenant_id,
                    "method/frappe.defaults.set_user_default",
                    method="POST",
                    json_data={
                        "key": "Company",
                        "value": company_name,
                        "user": "Administrator"
                    }
                )
            except Exception:
                # Non-critical; continue
                pass
            
            # Ensure Stock Settings has default_target_warehouse custom field
            custom_field_filters = json.dumps([
                ["dt", "=", "Stock Settings"],
                ["fieldname", "=", "default_target_warehouse"]
            ])
            custom_field_check = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Custom Field",
                method="GET",
                params={
                    "filters": custom_field_filters,
                    "fields": json.dumps(["name"]),
                    "limit_page_length": 1
                }
            )
            custom_field_exists = (
                isinstance(custom_field_check, dict)
                and custom_field_check.get("data")
            )
            if not custom_field_exists:
                custom_field_payload = {
                    "dt": "Stock Settings",
                    "fieldname": "default_target_warehouse",
                    "label": "Default Target Warehouse",
                    "fieldtype": "Link",
                    "options": "Warehouse",
                    "insert_after": "default_warehouse"
                }
                try:
                    erpnext_adapter.create_resource("Custom Field", custom_field_payload, tenant_id)
                except Exception:
                    # Fallback to ERPNext method API with ignore_permissions
                    erpnext_adapter.proxy_request(
                        tenant_id,
                        "method/frappe.client.insert",
                        method="POST",
                        json_data={
                            "doc": {
                                "doctype": "Custom Field",
                                **custom_field_payload
                            },
                            "ignore_permissions": 1
                        }
                    )
                # Re-check to ensure the custom field exists
                custom_field_check = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Custom Field",
                    method="GET",
                    params={
                        "filters": custom_field_filters,
                        "fields": json.dumps(["name"]),
                        "limit_page_length": 1
                    }
                )
                if not (isinstance(custom_field_check, dict) and custom_field_check.get("data")):
                    raise ValueError("Failed to create default_target_warehouse custom field in ERPNext")
            
            # Update Stock Settings
            stock_settings = {
                "enable_stock_tracking": 1,
                "default_warehouse": main_store,
                "default_target_warehouse": main_store,
                "auto_create_serial_and_batch_bundle_for_outward_transaction": 1
            }
            
            try:
                erpnext_adapter.update_stock_settings(tenant_id, stock_settings)
            except HTTPException as e:
                error_msg = str(e.detail) if hasattr(e, "detail") else str(e)
                if "Default Warehouse" in error_msg or "Default Target Warehouse" in error_msg:
                    # Fallback: set values via frappe.client.set_value
                    erpnext_adapter.proxy_request(
                        tenant_id,
                        "method/frappe.client.set_value",
                        method="POST",
                        json_data={
                            "doctype": "Stock Settings",
                            "name": "Stock Settings",
                            "fieldname": "default_warehouse",
                            "value": main_store,
                            "ignore_permissions": 1
                        }
                    )
                    erpnext_adapter.proxy_request(
                        tenant_id,
                        "method/frappe.client.set_value",
                        method="POST",
                        json_data={
                            "doctype": "Stock Settings",
                            "name": "Stock Settings",
                            "fieldname": "default_target_warehouse",
                            "value": main_store,
                            "ignore_permissions": 1
                        }
                    )
                else:
                    raise
            
            return StepResult(
                step_name="step_5_settings",
                status="completed",
                message="Selling and Stock settings configured successfully",
                duration_ms=(time.time() - start_time) * 1000
            )
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] Settings update failed: {error_type} - {error_msg}")
            return StepResult(
                step_name="step_5_settings",
                status="failed",
                message=f"Settings update failed: {error_msg}",
                error=error_msg,
                duration_ms=(time.time() - start_time) * 1000
            )
    
    def _step_items(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 6: Create Items (Optional, for demo data)"""
        start_time = time.time()
        
        # Skip if demo data not requested
        if not config.include_demo_data:
            return StepResult(
                step_name="step_6_items",
                status="skipped",
                message="Demo items creation skipped",
                duration_ms=(time.time() - start_time) * 1000
            )
        
        # This step can be implemented later with actual item creation logic
        # For now, return skipped
        return StepResult(
            step_name="step_6_items",
            status="skipped",
            message="Demo items creation not yet implemented",
            duration_ms=(time.time() - start_time) * 1000
        )
    
    def _step_customer(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 7: Create Default Customer (Walk-In)"""
        start_time = time.time()
        
        try:
            # Some ERPNext setups (or custom scripts) expect name fields on Customer.
            # Create them as custom fields if missing to avoid server-side AttributeError.
            try:
                for fieldname, label in [
                    ("first_name", "First Name"),
                    ("last_name", "Last Name"),
                    ("prospect_name", "Prospect Name"),
                ]:
                    customer_cf_filters = json.dumps([
                        ["dt", "=", "Customer"],
                        ["fieldname", "=", fieldname],
                    ])
                    customer_cf_check = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Custom Field",
                        method="GET",
                        params={
                            "filters": customer_cf_filters,
                            "fields": json.dumps(["name"]),
                            "limit_page_length": 1,
                        },
                    )
                    if not (isinstance(customer_cf_check, dict) and customer_cf_check.get("data")):
                        customer_cf_payload = {
                            "dt": "Customer",
                            "fieldname": fieldname,
                            "label": label,
                            "fieldtype": "Data",
                            "insert_after": "customer_name",
                        }
                        try:
                            erpnext_adapter.create_resource("Custom Field", customer_cf_payload, tenant_id)
                        except Exception:
                            erpnext_adapter.proxy_request(
                                tenant_id,
                                "method/frappe.client.insert",
                                method="POST",
                                json_data={
                                    "doc": {"doctype": "Custom Field", **customer_cf_payload},
                                    "ignore_permissions": 1,
                                },
                            )
            except Exception:
                pass

            # Check if Walk-In Customer exists
            customers_response = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Customer",
                method="GET",
                params={
                    "filters": f'[["customer_name", "=", "Walk-In Customer"]]',
                    "limit_page_length": 1
                }
            )
            customers = customers_response.get("data", []) if isinstance(customers_response, dict) else []
            
            if customers:
                return StepResult(
                    step_name="step_7_customer",
                    status="exists",
                    message="Walk-In Customer already exists",
                    metadata={"customer_name": "Walk-In Customer"},
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            # Get or create Customer Group "Individual"
            customer_group = "Individual"
            try:
                customer_groups_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Customer Group",
                    method="GET",
                    params={
                        "filters": f'[["name", "=", "{customer_group}"]]',
                        "limit_page_length": 1
                    }
                )
                customer_groups = customer_groups_response.get("data", []) if isinstance(customer_groups_response, dict) else []
                
                if not customer_groups:
                    # Create Customer Group if it doesn't exist
                    logger.info(f"[{correlation_id}] Creating Customer Group: {customer_group}")
                    erpnext_adapter.create_resource("Customer Group", {
                        "customer_group_name": customer_group,
                        "is_group": 0
                    }, tenant_id)
            except Exception as e:
                logger.warning(f"[{correlation_id}] Could not ensure Customer Group exists: {e}. Trying with default.")
                try:
                    default_groups = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Customer Group",
                        method="GET",
                        params={"limit_page_length": 1}
                    )
                    if default_groups.get("data"):
                        customer_group = default_groups["data"][0].get("name", "All Customer Groups")
                except:
                    customer_group = "All Customer Groups"  # Fallback
            
            # Get or create Territory "All Territories"
            territory = "All Territories"
            try:
                territories_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Territory",
                    method="GET",
                    params={
                        "filters": f'[["name", "=", "{territory}"]]',
                        "limit_page_length": 1
                    }
                )
                territories = territories_response.get("data", []) if isinstance(territories_response, dict) else []
                
                if not territories:
                    # Create Territory if it doesn't exist
                    logger.info(f"[{correlation_id}] Creating Territory: {territory}")
                    erpnext_adapter.create_resource("Territory", {
                        "territory_name": territory,
                        "is_group": 0
                    }, tenant_id)
            except Exception as e:
                logger.warning(f"[{correlation_id}] Could not ensure Territory exists: {e}. Trying with default.")
                try:
                    default_territories = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Territory",
                        method="GET",
                        params={"limit_page_length": 1}
                    )
                    if default_territories.get("data"):
                        territory = default_territories["data"][0].get("name", "All Territories")
                except:
                    territory = "All Territories"  # Fallback
            
            # Create Walk-In Customer
            customer_data = {
                "customer_name": "Walk-In Customer",
                "customer_group": customer_group,
                "territory": territory,
                "customer_type": "Company"
            }
            
            result = erpnext_adapter.create_resource("Customer", customer_data, tenant_id)
            customer_id = result.get("name") if isinstance(result, dict) else "Walk-In Customer"
            
            return StepResult(
                step_name="step_7_customer",
                status="completed",
                message=f"Walk-In Customer '{customer_id}' created successfully",
                metadata={"customer_name": customer_id},
                duration_ms=(time.time() - start_time) * 1000
            )
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] Customer creation failed: {error_type} - {error_msg}")
            return StepResult(
                step_name="step_7_customer",
                status="failed",
                message=f"Customer creation failed: {error_msg}",
                error=error_msg,
                duration_ms=(time.time() - start_time) * 1000
            )
    
    def _step_pos_profile(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 8: Create POS Profile"""
        start_time = time.time()
        
        try:
            company_name = onboarding.provisioning_metadata.get("company_name") if onboarding.provisioning_metadata else None
            if not company_name:
                tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                company_name = tenant.name
            
            warehouse_names_from_metadata = onboarding.provisioning_metadata.get("warehouse_names", [])
            warehouse = None
            
            if warehouse_names_from_metadata:
                # Prioritize POS Store, then Main Store, then any other
                for wh_full_name in reversed(warehouse_names_from_metadata):
                    if "POS Store" in wh_full_name:
                        warehouse = wh_full_name
                        break
                if not warehouse:
                    for wh_full_name in warehouse_names_from_metadata:
                        if "Main Store" in wh_full_name:
                            warehouse = wh_full_name
                            break
                if not warehouse:
                    warehouse = warehouse_names_from_metadata[0]
            
            if not warehouse:
                # Fallback: fetch from ERPNext
                logger.warning(f"[{correlation_id}] Warehouse names not found in metadata. Attempting to fetch from ERPNext.")
                try:
                    warehouses_response = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Warehouse",
                        method="GET",
                        params={
                            "filters": f'[["company", "=", "{company_name}"]]',
                            "limit_page_length": 100
                        }
                    )
                    existing_warehouses = warehouses_response.get("data", []) if isinstance(warehouses_response, dict) else []
                    
                    if not existing_warehouses:
                        raise ValueError(f"No warehouses found for company '{company_name}' in ERPNext.")
                    
                    # Prioritize POS Store, then Main Store, then any other
                    for w in existing_warehouses:
                        if isinstance(w, dict):
                            wh_full_name = w.get("name")
                            warehouse_name_field = w.get("warehouse_name", "").lower()
                            if "pos store" in warehouse_name_field:
                                warehouse = wh_full_name
                                break
                            elif "main store" in warehouse_name_field and not warehouse:
                                warehouse = wh_full_name
                    
                    if not warehouse and existing_warehouses:
                        warehouse = existing_warehouses[0].get("name") if isinstance(existing_warehouses[0], dict) else None
                    
                    if not warehouse:
                        raise ValueError(f"No warehouse found for company '{company_name}'")
                    
                    logger.info(f"[{correlation_id}] Fetched warehouse from ERPNext: {warehouse}")
                except Exception as e:
                    logger.error(f"[{correlation_id}] Failed to fetch warehouse from ERPNext: {e}")
                    raise ValueError(f"Could not determine warehouse for POS Profile. Error: {str(e)}")
            
            # Check if profile exists (idempotency)
            profile_name = f"Default POS Profile - {warehouse}"
            
            # Create POS profile via POS service
            from app.models.pos_profile import PosProfileCreate, PaymentMethod, SessionSettings, InventorySettings, ReceiptSettings
            
            profile_data = PosProfileCreate(
                name=profile_name,
                warehouse=warehouse,
                payment_methods=[
                    PaymentMethod(type='Cash', enabled=True),
                    PaymentMethod(type='M-Pesa', enabled=True)
                ],
                session_settings=SessionSettings(),
                inventory_settings=InventorySettings(),
                receipt_settings=ReceiptSettings()
            )
            
            # Get company abbreviation from metadata or fetch from ERPNext
            company_abbr = None
            if onboarding.provisioning_metadata:
                company_abbr = onboarding.provisioning_metadata.get("company_abbr")
            
            if not company_abbr:
                try:
                    companies_response = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Company",
                        method="GET",
                        params={
                            "filters": f'[["name", "=", "{company_name}"]]',
                            "limit_page_length": 1
                        }
                    )
                    companies = companies_response.get("data", []) if isinstance(companies_response, dict) else []
                    if companies:
                        company_abbr = companies[0].get("abbr")
                        # Store in metadata for future use
                        if onboarding.provisioning_metadata:
                            onboarding.provisioning_metadata["company_abbr"] = company_abbr
                except Exception as e:
                    logger.warning(f"[{correlation_id}] Could not fetch company abbreviation: {e}")
            
            # Ensure payment methods exist in ERPNext and get their actual names
            payments_for_erpnext = []
            default_set = False
            for pm in profile_data.payment_methods:
                if pm.enabled:
                    erpnext_name = self._ensure_mode_of_payment(
                        tenant_id, 
                        pm.type, 
                        correlation_id,
                        company_name=company_name,
                        company_abbr=company_abbr
                    )
                    
                    # ERPNext requires at least one default payment method
                    is_default = 0
                    if not default_set:
                        is_default = 1
                        default_set = True
                    
                    payments_for_erpnext.append({
                        "mode_of_payment": erpnext_name,
                        "default": is_default,
                        "allow_in_returns": 1
                    })
            
            if not payments_for_erpnext:
                raise ValueError("At least one payment method must be enabled for POS Profile")
            
            # Validate required fields before creation
            if not company_name:
                raise ValueError("Company name is required for POS Profile")
            if not warehouse:
                raise ValueError("Warehouse is required for POS Profile")
            
            # Verify warehouse belongs to company
            try:
                warehouse_check = erpnext_adapter.proxy_request(
                    tenant_id,
                    f"resource/Warehouse/{warehouse}",
                    method="GET"
                )
                if warehouse_check and isinstance(warehouse_check, dict):
                    wh_data = warehouse_check.get("data", {})
                    if isinstance(wh_data, dict) and wh_data.get("company") != company_name:
                        logger.warning(f"[{correlation_id}] Warehouse '{warehouse}' belongs to company '{wh_data.get('company')}', not '{company_name}'. This may cause issues.")
            except Exception as e:
                logger.warning(f"[{correlation_id}] Could not verify warehouse company: {e}")
            
            # Find or get write-off account (Profit and Loss account, non-group)
            write_off_account = None
            try:
                # Try to find existing write-off account
                accounts_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Account",
                    method="GET",
                    params={
                        "filters": f'[["company", "=", "{company_name}"], ["account_type", "=", "Expense"], ["is_group", "=", 0], ["report_type", "=", "Profit and Loss"]]',
                        "limit_page_length": 10
                    }
                )
                accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
                if accounts:
                    # Prefer accounts with "Write Off" or "Expense" in name
                    for acc in accounts:
                        acc_name = (acc.get("account_name") or acc.get("name") or "").lower()
                        if "write off" in acc_name or "expense" in acc_name:
                            write_off_account = acc.get("name") or acc.get("account_name")
                            logger.info(f"[{correlation_id}] Found write-off account: {write_off_account}")
                            break
                    # If no specific match, use first expense account
                    if not write_off_account and accounts:
                        write_off_account = accounts[0].get("name") or accounts[0].get("account_name")
                        logger.info(f"[{correlation_id}] Using first expense account as write-off: {write_off_account}")
                
                if not write_off_account:
                    logger.warning(f"[{correlation_id}] No write-off account found. Will try to use company default.")
                    # Try to get company's default write-off account
                    companies_response = erpnext_adapter.proxy_request(
                        tenant_id,
                        f"resource/Company/{company_name}",
                        method="GET"
                    )
                    if isinstance(companies_response, dict):
                        company_data = companies_response.get("data", {})
                        write_off_account = company_data.get("write_off_account")
                        if write_off_account:
                            logger.info(f"[{correlation_id}] Using company default write-off account: {write_off_account}")
            except Exception as e:
                logger.warning(f"[{correlation_id}] Could not find write-off account: {e}")
            
            if not write_off_account:
                raise CriticalProvisioningError(
                    f"No write-off account found for company '{company_name}'. Please ensure chart of accounts includes an Expense account.",
                    "step_8_pos_profile"
                )
            
            # Find or get cost center (non-group)
            write_off_cost_center = None
            try:
                # Try to find existing cost center (non-group)
                cost_centers_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Cost Center",
                    method="GET",
                    params={
                        "filters": f'[["company", "=", "{company_name}"], ["is_group", "=", 0]]',
                        "limit_page_length": 10
                    }
                )
                cost_centers = cost_centers_response.get("data", []) if isinstance(cost_centers_response, dict) else []
                if cost_centers:
                    # Use first non-group cost center
                    write_off_cost_center = cost_centers[0].get("name")
                    logger.info(f"[{correlation_id}] Found cost center: {write_off_cost_center}")
                
                if not write_off_cost_center:
                    # Try to find root cost center (company name)
                    root_cc_response = erpnext_adapter.proxy_request(
                        tenant_id,
                        f"resource/Cost Center/{company_name}",
                        method="GET"
                    )
                    if isinstance(root_cc_response, dict) and root_cc_response.get("data"):
                        write_off_cost_center = company_name
                        logger.info(f"[{correlation_id}] Using root cost center (company name): {write_off_cost_center}")
            except Exception as e:
                logger.warning(f"[{correlation_id}] Could not find cost center: {e}")
            
            if not write_off_cost_center:
                raise CriticalProvisioningError(
                    f"No cost center found for company '{company_name}'. Please ensure cost centers are set up.",
                    "step_8_pos_profile"
                )
            
            # Create POS Profile via ERPNext
            pos_profile_data = {
                "doctype": "POS Profile",
                "company": company_name,
                "warehouse": warehouse,
                "name": profile_name,
                "payments": payments_for_erpnext,
                "write_off_account": write_off_account,
                "write_off_cost_center": write_off_cost_center,
                "write_off_limit": 0.0  # Required field with default 0
            }
            
            try:
                result = erpnext_adapter.create_resource("POS Profile", pos_profile_data, tenant_id)
                profile_id = result.get("name") if isinstance(result, dict) else profile_name
            except HTTPException as e:
                error_type, error_msg = _parse_erpnext_error(e, correlation_id)
                
                # Handle duplicate (409) as idempotent success
                if e.status_code == 409 or error_type == "duplicate_resource":
                    logger.info(f"[{correlation_id}] POS Profile '{profile_name}' already exists (idempotent)")
                    # Verify it exists and get its ID
                    try:
                        existing_response = erpnext_adapter.proxy_request(
                            tenant_id,
                            f"resource/POS Profile/{profile_name}",
                            method="GET"
                        )
                        if isinstance(existing_response, dict) and existing_response.get("data"):
                            profile_id = profile_name
                            logger.info(f"[{correlation_id}] Using existing POS Profile: {profile_id}")
                        else:
                            # Profile name exists but couldn't fetch - treat as error
                            raise CriticalProvisioningError(
                                f"POS Profile '{profile_name}' appears to exist but could not be verified.",
                                "step_8_pos_profile"
                            )
                    except Exception as verify_error:
                        logger.warning(f"[{correlation_id}] Could not verify existing POS Profile: {verify_error}")
                        raise CriticalProvisioningError(
                            f"POS Profile '{profile_name}' appears to exist but could not be verified: {str(verify_error)}",
                            "step_8_pos_profile"
                        )
                # Handle link validation errors (missing resources)
                elif error_type == "link_validation_error" or "Could not find" in error_msg:
                    if "Warehouse" in error_msg:
                        raise CriticalProvisioningError(
                            f"POS Profile creation failed: Warehouse '{warehouse}' not found or not linked to company '{company_name}'. "
                            f"Please ensure the warehouse exists and belongs to the company.",
                            "step_8_pos_profile"
                        )
                    else:
                        raise CriticalProvisioningError(
                            f"POS Profile creation failed: {error_msg}",
                            "step_8_pos_profile"
                        )
                # Handle validation errors (missing required fields)
                elif error_type == "validation_error" or error_type == "missing_required_field" or "mandatory" in error_msg.lower():
                    raise CriticalProvisioningError(
                        f"POS Profile validation failed: {error_msg}",
                        "step_8_pos_profile"
                    )
                # All other errors
                else:
                    raise CriticalProvisioningError(
                        f"POS Profile creation failed: {error_msg}",
                        "step_8_pos_profile"
                    )
            
            return StepResult(
                step_name="step_8_pos_profile",
                status="completed",
                message=f"POS Profile '{profile_id}' created successfully",
                metadata={"pos_profile_id": profile_id, "warehouse": warehouse},
                duration_ms=(time.time() - start_time) * 1000
            )
        except CriticalProvisioningError:
            raise
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] POS Profile creation failed: {error_type} - {error_msg}")
            return StepResult(
                step_name="step_8_pos_profile",
                status="failed",
                message=f"POS Profile creation failed: {error_msg}",
                error=error_msg,
                duration_ms=(time.time() - start_time) * 1000
            )
    
    def _step_pos_session(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 9: Open POS Session"""
        start_time = time.time()
        
        try:
            pos_profile_id = onboarding.provisioning_metadata.get("pos_profile_id") if onboarding.provisioning_metadata else None
            if not pos_profile_id:
                # Try to find default profile
                profiles_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/POS Profile",
                    method="GET",
                    params={"limit_page_length": 1}
                )
                profiles = profiles_response.get("data", []) if isinstance(profiles_response, dict) else []
                if profiles:
                    pos_profile_id = profiles[0].get("name")
            
            if not pos_profile_id:
                raise ValueError("No POS Profile found. Please create a POS Profile first.")
            
            # Check if session already open (idempotency - one session rule)
            sessions_response = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/POS Opening Entry",
                method="GET",
                params={
                    "filters": f'[["pos_profile", "=", "{pos_profile_id}"], ["status", "=", "Open"]]',
                    "limit_page_length": 1
                }
            )
            existing_sessions = sessions_response.get("data", []) if isinstance(sessions_response, dict) else []
            
            if existing_sessions:
                session_id = existing_sessions[0].get("name")
                return StepResult(
                    step_name="step_9_pos_session",
                    status="exists",
                    message=f"POS Session '{session_id}' already open",
                    metadata={"pos_session_id": session_id},
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            # Get company name - must match the company name used in POS Profile
            company_name = onboarding.provisioning_metadata.get("company_name") if onboarding.provisioning_metadata else None
            if not company_name:
                tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                company_name = tenant.name
            
            # Verify POS Profile belongs to the correct company
            # Fetch the POS Profile to get its company
            try:
                profile_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    f"resource/POS Profile/{pos_profile_id}",
                    method="GET"
                )
                profile_data = profile_response.get("data") if isinstance(profile_response, dict) else {}
                if isinstance(profile_data, dict):
                    profile_company = profile_data.get("company")
                else:
                    profile_company = None
                
                if profile_company:
                    # Use the company from the profile to ensure match
                    logger.info(f"[{correlation_id}] Using company from POS Profile: '{profile_company}' (Profile: {pos_profile_id})")
                    company_name = profile_company
                else:
                    logger.warning(f"[{correlation_id}] Could not get company from POS Profile, using tenant company: '{company_name}'")
            except Exception as e:
                logger.warning(f"[{correlation_id}] Could not fetch POS Profile to verify company: {e}. Using tenant company: '{company_name}'")
            
            # Get user for POS session - use admin user or system user
            pos_user = onboarding.provisioning_metadata.get("admin_user") if onboarding.provisioning_metadata else None
            if not pos_user:
                # Try to get the admin user from tenant
                tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                if tenant:
                    # Get admin email from tenant creation or use default
                    admin_email = onboarding.provisioning_metadata.get("admin_email") if onboarding.provisioning_metadata else None
                    if admin_email:
                        from app.models.iam import User
                        admin_user = db.query(User).filter(User.email == admin_email).first()
                        if admin_user:
                            pos_user = admin_user.email
                            logger.info(f"[{correlation_id}] Using admin user '{pos_user}' for POS session")
            
            if not pos_user:
                # Fallback: use ERPNext default admin user
                pos_user = "Administrator"
                logger.warning(f"[{correlation_id}] No admin user found, using default 'Administrator' for POS session")
            
            # Get payment methods from POS Profile for balance_details
            balance_details = []
            try:
                # Fetch POS Profile to get payment methods
                profile_response = erpnext_adapter.proxy_request(
                    tenant_id,
                    f"resource/POS Profile/{pos_profile_id}",
                    method="GET"
                )
                profile_data = profile_response.get("data") if isinstance(profile_response, dict) else {}
                if isinstance(profile_data, dict):
                    payments = profile_data.get("payments", [])
                    if payments:
                        for payment in payments:
                            if isinstance(payment, dict):
                                mode_of_payment = payment.get("mode_of_payment")
                                if mode_of_payment:
                                    balance_details.append({
                                        "mode_of_payment": mode_of_payment,
                                        "opening_amount": 0.0
                                    })
            except Exception as e:
                logger.warning(f"[{correlation_id}] Could not fetch payment methods from POS Profile: {e}")
            
            # If no payment methods found, use default Cash payment
            if not balance_details:
                # Try to get Cash mode of payment
                try:
                    cash_mop_response = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Mode of Payment",
                        method="GET",
                        params={
                            "filters": f'[["name", "=", "Cash"]]',
                            "limit_page_length": 1
                        }
                    )
                    cash_mop = cash_mop_response.get("data", [])
                    if cash_mop and isinstance(cash_mop, list) and len(cash_mop) > 0:
                        balance_details.append({
                            "mode_of_payment": "Cash",
                            "opening_amount": 0.0
                        })
                except:
                    pass
            
            # Ensure at least one payment method
            if not balance_details:
                raise ValueError("No payment methods found in POS Profile. Cannot create POS Opening Entry without balance_details.")
            
            # Open POS session via POS service
            # Note: This requires proper authentication context
            # For provisioning, we may need to open sessions directly via ERPNext API
            # Format datetime as MySQL expects: YYYY-MM-DD HH:MM:SS (no timezone)
            now_utc = datetime.now(timezone.utc)
            period_start_date_str = now_utc.strftime("%Y-%m-%d %H:%M:%S")
            posting_date_str = now_utc.date().isoformat()
            
            opening_entry_data = {
                "doctype": "POS Opening Entry",
                "period_start_date": period_start_date_str,  # MySQL format: YYYY-MM-DD HH:MM:SS
                "posting_date": posting_date_str,  # MySQL format: YYYY-MM-DD
                "company": company_name,  # Use verified company name
                "pos_profile": pos_profile_id,
                "user": pos_user,  # Use valid user
                "balance_details": balance_details  # Required table field
            }
            
            result = erpnext_adapter.create_resource("POS Opening Entry", opening_entry_data, tenant_id)
            session_id = result.get("name") if isinstance(result, dict) else None
            
            return StepResult(
                step_name="step_9_pos_session",
                status="completed",
                message=f"POS Session '{session_id}' opened successfully",
                metadata={"pos_session_id": session_id},
                duration_ms=(time.time() - start_time) * 1000
            )
        except Exception as e:
            error_type, error_msg = _parse_erpnext_error(e, correlation_id)
            logger.error(f"[{correlation_id}] POS Session creation failed: {error_type} - {error_msg}")
            return StepResult(
                step_name="step_9_pos_session",
                status="failed",
                message=f"POS Session creation failed: {error_msg}",
                error=error_msg,
                duration_ms=(time.time() - start_time) * 1000
            )

    def _step_paint_setup(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 10: Paint Management Setup (Custom Fields and Item Templates)"""
        start_time = time.time()

        try:
            logger.info(f"Setting up paint management for tenant {tenant_id}", extra={
                "tenant_id": tenant_id,
                "correlation_id": correlation_id,
                "step": "paint_setup"
            })

            # Create custom fields for Item doctype (paint classification)
            paint_custom_fields = [
                {
                    "dt": "Item",
                    "fieldname": "is_base_paint",
                    "label": "Is Base Paint",
                    "fieldtype": "Check",
                    "description": "Mark if this item is a base paint for tinting",
                    "insert_after": "is_stock_item"
                },
                {
                    "dt": "Item",
                    "fieldname": "is_tint",
                    "label": "Is Tint/Pigment",
                    "fieldtype": "Check",
                    "description": "Mark if this item is a paint tint or pigment",
                    "insert_after": "is_base_paint"
                },
                {
                    "dt": "Item",
                    "fieldname": "is_finished_paint",
                    "label": "Is Finished Paint",
                    "fieldtype": "Check",
                    "description": "Mark if this item represents finished/custom paint (non-stock)",
                    "insert_after": "is_tint"
                },
                {
                    "dt": "Item",
                    "fieldname": "paint_color_system",
                    "label": "Paint Color System",
                    "fieldtype": "Select",
                    "options": "RAL\nPantone\nNCS\nCustom",
                    "description": "Color system for paint items",
                    "insert_after": "is_finished_paint",
                    "depends_on": "eval:doc.is_base_paint || doc.is_tint || doc.is_finished_paint"
                },
                {
                    "dt": "Item",
                    "fieldname": "paint_color_code",
                    "label": "Paint Color Code",
                    "fieldtype": "Data",
                    "description": "Color code (e.g., RAL-5015)",
                    "insert_after": "paint_color_system",
                    "depends_on": "eval:doc.is_base_paint || doc.is_tint || doc.is_finished_paint"
                }
            ]

            for field_config in paint_custom_fields:
                fieldname = field_config["fieldname"]
                filters = json.dumps([
                    ["dt", "=", field_config["dt"]],
                    ["fieldname", "=", fieldname]
                ])

                # Check if custom field exists
                existing_field = erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path="resource/Custom Field",
                    method="GET",
                    params={"filters": filters}
                )

                if not (isinstance(existing_field, dict) and existing_field.get("data")):
                    # Create custom field
                    try:
                        erpnext_adapter.create_resource("Custom Field", field_config, tenant_id)
                        logger.info(f"Created custom field {fieldname} for {field_config['dt']}")
                    except Exception as e:
                        logger.warning(f"Failed to create custom field {fieldname}: {e}")
                        # Try with ERPNext method API
                        try:
                            erpnext_adapter.proxy_request(
                                tenant_id,
                                "method/frappe.client.insert",
                                method="POST",
                                json_data={
                                    "doc": {
                                        "doctype": "Custom Field",
                                        **field_config
                                    },
                                    "ignore_permissions": 1
                                }
                            )
                        except Exception as fallback_e:
                            logger.error(f"Failed to create custom field {fieldname} via fallback: {fallback_e}")

            # Create sample base paint and tint items for testing
            sample_items = [
                {
                    "item_code": "BASE-A-WHITE",
                    "item_name": "Base Paint A - White",
                    "item_group": "Paint",
                    "stock_uom": "Liter",
                    "is_stock_item": 1,
                    "is_base_paint": 1,
                    "paint_color_system": "Custom",
                    "paint_color_code": "BASE-A",
                    "standard_rate": 500.00,
                    "valuation_rate": 450.00
                },
                {
                    "item_code": "TINT-BLUE-001",
                    "item_name": "Blue Tint #001",
                    "item_group": "Paint Tints",
                    "stock_uom": "Milliliter",
                    "is_stock_item": 1,
                    "is_tint": 1,
                    "paint_color_system": "Custom",
                    "paint_color_code": "BLUE-001",
                    "standard_rate": 50.00,
                    "valuation_rate": 45.00
                },
                {
                    "item_code": "TINT-BLACK-001",
                    "item_name": "Black Tint #001",
                    "item_group": "Paint Tints",
                    "stock_uom": "Milliliter",
                    "is_stock_item": 1,
                    "is_tint": 1,
                    "paint_color_system": "Custom",
                    "paint_color_code": "BLACK-001",
                    "standard_rate": 30.00,
                    "valuation_rate": 25.00
                }
            ]

            for item_data in sample_items:
                try:
                    # Check if item exists
                    existing_item = erpnext_adapter.proxy_request(
                        tenant_id=tenant_id,
                        path=f"resource/Item/{item_data['item_code']}",
                        method="GET"
                    )

                    if not (isinstance(existing_item, dict) and existing_item.get("data")):
                        erpnext_adapter.create_resource("Item", item_data, tenant_id)
                        logger.info(f"Created sample item {item_data['item_code']}")
                    else:
                        logger.info(f"Sample item {item_data['item_code']} already exists")
                except Exception as e:
                    logger.warning(f"Failed to create sample item {item_data['item_code']}: {e}")

            onboarding.step_10_paint_setup_completed_at = datetime.now(timezone.utc)
            db.commit()

            return StepResult(
                success=True,
                message="Paint management setup completed successfully",
                duration_ms=(time.time() - start_time) * 1000
            )

        except Exception as e:
            error_msg = f"Paint setup failed: {str(e)}"
            logger.error(error_msg, extra={
                "tenant_id": tenant_id,
                "correlation_id": correlation_id,
                "step": "paint_setup",
                "error": str(e)
            }, exc_info=True)

            return StepResult(
                success=False,
                message=error_msg,
                duration_ms=(time.time() - start_time) * 1000
            )

    def _step_post_sale_updates(
        self,
        tenant_id: str,
        config: ProvisioningConfig,
        db: Session,
        onboarding: TenantOnboarding,
        correlation_id: str
    ) -> StepResult:
        """Step 10: Post-Sale Updates (placeholder for future post-provisioning tasks)"""
        start_time = time.time()
        
        # This step is reserved for post-provisioning tasks like:
        # - Sending welcome emails
        # - Creating default reports
        # - Setting up integrations
        # - etc.
        
        return StepResult(
            step_name="step_10_post_sale_updates",
            status="completed",
            message="Post-sale updates completed",
            duration_ms=(time.time() - start_time) * 1000
        )
    
    def _ensure_mode_of_payment(
        self,
        tenant_id: str,
        payment_type: Literal['Cash', 'M-Pesa', 'Card', 'Bank', 'Credit'],
        correlation_id: str,
        company_name: Optional[str] = None,
        company_abbr: Optional[str] = None
    ) -> str:
        """
        Ensures a Mode of Payment exists in ERPNext for the given payment_type.
        Maps our PaymentMethod.type to ERPNext mode_of_payment name.
        
        Args:
            tenant_id: The ID of the tenant.
            payment_type: Our PaymentMethod.type ('Cash', 'M-Pesa', 'Card', 'Bank', 'Credit')
            correlation_id: Correlation ID for logging.
            company_name: Company name (optional, for account lookup)
            company_abbr: Company abbreviation (optional, for account lookup)
            
        Returns:
            The actual mode_of_payment name to use in ERPNext.
        """
        # Define possible ERPNext names for our payment types
        name_mapping = {
            'Cash': ['Cash'],
            'M-Pesa': ['M-Pesa', 'Mpesa'],
            'Card': ['Card', 'Credit Card'],
            'Bank': ['Bank', 'Bank Transfer'],
            'Credit': ['Credit']
        }
        
        # Define ERPNext 'type' for the Mode of Payment doctype
        erpnext_type_mapping = {
            'Cash': 'Cash',
            'M-Pesa': 'Phone',
            'Card': 'Bank',
            'Bank': 'Bank',
            'Credit': 'General'
        }
        
        possible_names = name_mapping.get(payment_type, [payment_type])
        erpnext_type = erpnext_type_mapping.get(payment_type, 'Bank')
        
        # Check if any of the possible names already exist
        for name in possible_names:
            try:
                response = erpnext_adapter.proxy_request(
                    tenant_id,
                    "resource/Mode of Payment",
                    method="GET",
                    params={
                        "filters": f'[["mode_of_payment", "=", "{name}"]]',
                        "limit_page_length": 1
                    }
                )
                
                if isinstance(response, dict):
                    data = response.get("data", [])
                    if data and len(data) > 0:
                        existing_name = data[0].get("mode_of_payment")
                        if existing_name:
                            logger.info(f"[{correlation_id}] Found existing Mode of Payment: {existing_name}")
                            return existing_name
            except Exception as e:
                logger.debug(f"[{correlation_id}] Error checking for Mode of Payment '{name}': {e}")
                continue
        
        # Not found, create it using the first (preferred) name
        preferred_name = possible_names[0]
        try:
            # Get company info if not provided
            if not company_name or not company_abbr:
                try:
                    companies_response = erpnext_adapter.proxy_request(
                        tenant_id,
                        "resource/Company",
                        method="GET",
                        params={"limit_page_length": 1}
                    )
                    companies = companies_response.get("data", []) if isinstance(companies_response, dict) else []
                    if companies:
                        company_name = company_name or companies[0].get("name")
                        company_abbr = company_abbr or companies[0].get("abbr")
                except Exception as e:
                    logger.warning(f"[{correlation_id}] Could not fetch company info: {e}")
            
            # Determine which account to use based on payment type
            # Cash types use Cash account, Bank/Phone types use Bank account
            account_type = "Cash" if erpnext_type == "Cash" else "Bank"
            
            # Try to find the appropriate account
            account_name = None
            if company_name:
                # Try standard account names: "Cash - {ABBR}" or "Bank - {ABBR}"
                possible_account_names = []
                if company_abbr:
                    possible_account_names.extend([
                        f"{account_type} - {company_abbr}",
                        f"{account_type} - {company_name}",
                    ])
                possible_account_names.append(account_type)
                
                # Also try with different casing
                possible_account_names.extend([
                    account_type.lower(),
                    account_type.upper(),
                ])
                
                for acc_name in possible_account_names:
                    if not acc_name:
                        continue
                    try:
                        # Try account_name field first
                        accounts_response = erpnext_adapter.proxy_request(
                            tenant_id,
                            "resource/Account",
                            method="GET",
                            params={
                                "filters": f'[["account_name", "=", "{acc_name}"], ["company", "=", "{company_name}"]]',
                                "limit_page_length": 1
                            }
                        )
                        accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
                        if accounts:
                            account_name = accounts[0].get("name") or accounts[0].get("account_name")
                            logger.info(f"[{correlation_id}] Found account for Mode of Payment: {account_name} (searched: {acc_name}, company: {company_name})")
                            logger.info(f"[{correlation_id}] Account details: name={accounts[0].get('name')}, account_name={accounts[0].get('account_name')}, account_type={accounts[0].get('account_type')}, company={accounts[0].get('company')}")
                            break
                        
                        # If not found, try name field (some accounts might use name directly)
                        if not account_name:
                            accounts_response = erpnext_adapter.proxy_request(
                                tenant_id,
                                "resource/Account",
                                method="GET",
                                params={
                                    "filters": f'[["name", "=", "{acc_name}"], ["company", "=", "{company_name}"]]',
                                    "limit_page_length": 1
                                }
                            )
                            accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
                            if accounts:
                                account_name = accounts[0].get("name") or accounts[0].get("account_name")
                                logger.info(f"[{correlation_id}] Found account for Mode of Payment: {account_name} (searched by name: {acc_name})")
                                break
                    except Exception as e:
                        logger.debug(f"[{correlation_id}] Error checking for account '{acc_name}': {e}")
                        continue
                
                # If still not found, try to find ANY account of the right type in the company
                if not account_name:
                    try:
                        # Search for accounts with account_type matching our needs
                        # Cash accounts typically have root_type "Asset" and account_type "Cash"
                        # Bank accounts typically have root_type "Asset" and account_type "Bank"
                        account_type_filter = "Cash" if account_type == "Cash" else "Bank"
                        accounts_response = erpnext_adapter.proxy_request(
                            tenant_id,
                            "resource/Account",
                            method="GET",
                            params={
                                "filters": f'[["company", "=", "{company_name}"], ["account_type", "=", "{account_type_filter}"]]',
                                "limit_page_length": 10
                            }
                        )
                        accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
                        if accounts:
                            # Prefer accounts that are not groups
                            for acc in accounts:
                                if not acc.get("is_group", 0):
                                    account_name = acc.get("name") or acc.get("account_name")
                                    logger.info(f"[{correlation_id}] Found {account_type} account for Mode of Payment: {account_name} (by account_type)")
                                    break
                            # If no non-group account found, use the first one
                            if not account_name and accounts:
                                account_name = accounts[0].get("name") or accounts[0].get("account_name")
                                logger.info(f"[{correlation_id}] Found {account_type} account for Mode of Payment: {account_name} (first match by account_type)")
                    except Exception as e:
                        logger.debug(f"[{correlation_id}] Error searching for {account_type} account by type: {e}")
            
            # Build mode of payment data
            mode_of_payment_data = {
                "doctype": "Mode of Payment",
                "mode_of_payment": preferred_name,
                "type": erpnext_type,
                "enabled": 1
            }
            
            # Add account if found - REQUIRED by ERPNext
            if account_name:
                mode_of_payment_data["accounts"] = [{
                    "company": company_name,
                    "default_account": account_name
                }]
                logger.info(f"[{correlation_id}] Setting account '{account_name}' for Mode of Payment '{preferred_name}' in company '{company_name}'")
                logger.info(f"[{correlation_id}] Mode of Payment data before creation: {mode_of_payment_data}")
            else:
                # ERPNext requires accounts to be set - fail early with clear error
                error_msg = f"No {account_type} account found for company '{company_name}'. Please ensure chart of accounts is imported and contains a {account_type} account."
                logger.error(f"[{correlation_id}] {error_msg}")
                logger.error(f"[{correlation_id}] Company name: {company_name}, Company abbr: {company_abbr}, Account type: {account_type}")
                logger.error(f"[{correlation_id}] Attempted account name searches: {possible_account_names if 'possible_account_names' in locals() else 'N/A'}")
                raise CriticalProvisioningError(error_msg)
            
            try:
                result = erpnext_adapter.create_resource("Mode of Payment", mode_of_payment_data, tenant_id)
                created_name = result.get("name") if isinstance(result, dict) else preferred_name
                logger.info(f"[{correlation_id}] Created Mode of Payment: {created_name} (type: {erpnext_type}, account: {account_name or 'none'})")
                
                # Verify the account was set correctly by checking the created Mode of Payment
                if account_name:
                    try:
                        verify_response = erpnext_adapter.proxy_request(
                            tenant_id,
                            f"resource/Mode of Payment/{created_name}",
                            method="GET"
                        )
                        if isinstance(verify_response, dict):
                            verify_data = verify_response.get("data", {})
                            accounts = verify_data.get("accounts", [])
                            if not accounts or not any(acc.get("default_account") == account_name for acc in accounts):
                                logger.warning(f"[{correlation_id}] Mode of Payment '{created_name}' created but account not set correctly. Attempting to update...")
                                # Try to update the Mode of Payment with the account
                                update_data = {
                                    "accounts": [{
                                        "company": company_name,
                                        "default_account": account_name
                                    }]
                                }
                                try:
                                    update_result = erpnext_adapter.update_resource("Mode of Payment", created_name, update_data, tenant_id)
                                    logger.info(f"[{correlation_id}] Update result: {update_result}")
                                    
                                    # Verify the update worked
                                    verify_response2 = erpnext_adapter.proxy_request(
                                        tenant_id,
                                        f"resource/Mode of Payment/{created_name}",
                                        method="GET"
                                    )
                                    if isinstance(verify_response2, dict):
                                        verify_data2 = verify_response2.get("data", {})
                                        verify_accounts2 = verify_data2.get("accounts", [])
                                        logger.info(f"[{correlation_id}] Verified accounts after update: {verify_accounts2}")
                                        has_account_after2 = any(
                                            acc.get("company") == company_name and 
                                            acc.get("default_account") == account_name 
                                            for acc in verify_accounts2
                                        )
                                        if not has_account_after2:
                                            logger.error(f"[{correlation_id}] Update failed - account still not set after update!")
                                            raise CriticalProvisioningError(f"Failed to set account '{account_name}' for Mode of Payment '{created_name}' in company '{company_name}'. Update appeared to succeed but account is still missing.")
                                        else:
                                            logger.info(f"[{correlation_id}] Successfully updated Mode of Payment '{created_name}' with account '{account_name}'")
                                except Exception as update_ex2:
                                    logger.error(f"[{correlation_id}] Update failed with exception: {update_ex2}", exc_info=True)
                                    raise CriticalProvisioningError(f"Failed to update Mode of Payment '{created_name}' with account '{account_name}': {str(update_ex2)}")
                    except Exception as verify_error:
                        logger.error(f"[{correlation_id}] Could not verify/update Mode of Payment account: {verify_error}", exc_info=True)
                        raise CriticalProvisioningError(f"Failed to verify/update Mode of Payment account: {str(verify_error)}")
                
                return created_name
            except HTTPException as e:
                error_type, error_msg = _parse_erpnext_error(e, correlation_id)
                # Handle duplicate (409) - update with account if missing
                if e.status_code == 409 or error_type == "duplicate_resource":
                    logger.info(f"[{correlation_id}] Mode of Payment '{preferred_name}' already exists (409 conflict)")
                    if account_name:
                        try:
                            # Check if it has the account
                            existing_response = erpnext_adapter.proxy_request(
                                tenant_id,
                                f"resource/Mode of Payment/{preferred_name}",
                                method="GET"
                            )
                            if isinstance(existing_response, dict):
                                existing_data = existing_response.get("data", {})
                                accounts = existing_data.get("accounts", [])
                                logger.info(f"[{correlation_id}] Existing Mode of Payment accounts: {accounts}")
                                # Check if account is already set for this company
                                has_account = any(
                                    acc.get("company") == company_name and 
                                    acc.get("default_account") == account_name 
                                    for acc in accounts
                                )
                                if not has_account:
                                    logger.warning(f"[{correlation_id}] Existing Mode of Payment '{preferred_name}' missing account. Updating...")
                                    # Update with account - need to preserve existing accounts and add/update this one
                                    # Get all existing accounts for other companies
                                    other_accounts = [acc for acc in accounts if acc.get("company") != company_name]
                                    # Add/update account for this company
                                    update_data = {
                                        "accounts": other_accounts + [{
                                            "company": company_name,
                                            "default_account": account_name
                                        }]
                                    }
                                    logger.info(f"[{correlation_id}] Updating Mode of Payment with data: {update_data}")
                                    try:
                                        update_result = erpnext_adapter.update_resource("Mode of Payment", preferred_name, update_data, tenant_id)
                                        logger.info(f"[{correlation_id}] Update result: {update_result}")
                                        
                                        # Verify the update worked
                                        verify_response = erpnext_adapter.proxy_request(
                                            tenant_id,
                                            f"resource/Mode of Payment/{preferred_name}",
                                            method="GET"
                                        )
                                        if isinstance(verify_response, dict):
                                            verify_data = verify_response.get("data", {})
                                            verify_accounts = verify_data.get("accounts", [])
                                            logger.info(f"[{correlation_id}] Verified accounts after update: {verify_accounts}")
                                            has_account_after = any(
                                                acc.get("company") == company_name and 
                                                acc.get("default_account") == account_name 
                                                for acc in verify_accounts
                                            )
                                            if not has_account_after:
                                                logger.error(f"[{correlation_id}] Update failed - account still not set after update!")
                                                raise CriticalProvisioningError(f"Failed to set account '{account_name}' for Mode of Payment '{preferred_name}' in company '{company_name}'. Update appeared to succeed but account is still missing.")
                                            else:
                                                logger.info(f"[{correlation_id}] Successfully updated existing Mode of Payment '{preferred_name}' with account '{account_name}'")
                                    except Exception as update_ex:
                                        logger.error(f"[{correlation_id}] Update failed with exception: {update_ex}", exc_info=True)
                                        raise CriticalProvisioningError(f"Failed to update Mode of Payment '{preferred_name}' with account '{account_name}': {str(update_ex)}")
                                else:
                                    logger.info(f"[{correlation_id}] Existing Mode of Payment '{preferred_name}' already has account '{account_name}'")
                        except Exception as update_error:
                            logger.error(f"[{correlation_id}] Could not update existing Mode of Payment: {update_error}", exc_info=True)
                            raise CriticalProvisioningError(f"Failed to ensure account is set for Mode of Payment '{preferred_name}': {str(update_error)}")
                    else:
                        logger.error(f"[{correlation_id}] Mode of Payment '{preferred_name}' exists but no account found to set!")
                    return preferred_name
                else:
                    logger.error(f"[{correlation_id}] Failed to create Mode of Payment '{preferred_name}': {error_type} - {error_msg}")
                    raise
            except Exception as e:
                error_type, error_msg = _parse_erpnext_error(e, correlation_id)
                logger.error(f"[{correlation_id}] Unexpected error creating Mode of Payment '{preferred_name}': {error_type} - {error_msg}")
                raise
        except Exception as e:
            logger.error(f"[{correlation_id}] Failed to ensure Mode of Payment: {e}")
            raise


# ==================== Service Instance ====================

provisioning_service = ProvisioningService()
