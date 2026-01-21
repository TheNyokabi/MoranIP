"""
Provisioning Router

API endpoints for workspace provisioning operations.

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

from app.database import get_db
from app.models.iam import Tenant
from app.models.onboarding import TenantOnboarding
from app.dependencies.auth import get_current_user, verify_tenant_membership
from app.services.provisioning_service import (
    provisioning_service,
    ProvisioningConfig,
    ProvisioningStatus
)
from app.services.engine_health_service import EngineHealthStatus

router = APIRouter(
    prefix="/provisioning",
    tags=["Provisioning"],
)


# ==================== Request/Response Models ====================

class ProvisioningConfigRequest(BaseModel):
    """Configuration for provisioning"""
    include_demo_data: bool = Field(default=False, description="Include demo items in provisioning")
    pos_store_enabled: bool = Field(default=True, description="Create POS Store warehouse")
    country_template: Optional[str] = Field(default=None, description="Chart of accounts template (auto-detect if not provided)")
    template: Optional[str] = Field(default=None, description="Provisioning template (company_to_pos when ERPNext is selected)")


class StepError(BaseModel):
    """Error information for a provisioning step"""
    step: str
    error: str


class ProvisioningStatusResponse(BaseModel):
    """Response model for provisioning status"""
    status: Literal["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED", "PARTIAL"]
    current_step: Optional[str] = None
    progress: float = Field(..., ge=0, le=100, description="Progress percentage (0-100)")
    steps_completed: int
    total_steps: int
    errors: List[StepError] = Field(default_factory=list)
    estimated_completion: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class RetryRequest(BaseModel):
    """Request to retry provisioning"""
    step: Optional[str] = Field(default=None, description="Specific step to retry (retries all if not provided)")


class SkipStepRequest(BaseModel):
    """Request to skip a provisioning step"""
    step: str = Field(..., description="Step name to skip")


# ==================== Endpoints ====================

@router.post("/tenants/{tenant_id}/start", response_model=ProvisioningStatusResponse)
def start_provisioning(
    tenant_id: str,
    config: Optional[ProvisioningConfigRequest] = Body(default=None),
    current_user: dict = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
):
    """
    Start provisioning for a tenant.
    
    Initiates the full provisioning flow from workspace creation to POS readiness.
    """
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Check if already provisioning
        if tenant.provisioning_status == "PROVISIONING":
            raise HTTPException(
                status_code=409,
                detail={
                    "type": "already_provisioning",
                    "message": "Provisioning is already in progress for this tenant"
                }
            )
        
        # Check engine health
        from app.services.engine_health_service import engine_health_service
        health_result = engine_health_service.check_engine_health(
            tenant_id=tenant_id,
            engine_type=tenant.engine or 'erpnext'
        )
        
        if health_result.status != EngineHealthStatus.ONLINE:
            raise HTTPException(
                status_code=503,
                detail={
                    "type": "engine_unstable",
                    "message": f"Engine not stable. Check server status before provisioning. {health_result.message}",
                    "engine": tenant.engine,
                    "status": health_result.status.value
                }
            )
        
        # Get or create onboarding record
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()

        template_value = None
        if config and config.template:
            template_value = config.template
        elif tenant.engine == "erpnext":
            template_value = "company_to_pos"
        else:
            template_value = "default"

        if not onboarding:
            onboarding = TenantOnboarding(
                tenant_id=tenant_id,
                template=template_value,
                status="NOT_STARTED",
                provisioning_type="company_to_pos" if tenant.engine == "erpnext" else "default",
                provisioning_config=config.dict() if config else {"template": template_value},
                started_at=datetime.utcnow()
            )
            db.add(onboarding)
        else:
            # Reset status and clear steps for a fresh start
            onboarding.status = "NOT_STARTED"
            onboarding.template = template_value or onboarding.template
            onboarding.provisioning_steps = {}
            onboarding.error_message = None
            onboarding.error_step = None
            onboarding.started_at = datetime.utcnow()
            onboarding.completed_at = None
            onboarding.provisioning_config = config.dict() if config else {"template": template_value}
        
        tenant.provisioning_status = "PROVISIONING"  # Set to PROVISIONING to prevent duplicate starts
        tenant.provisioned_at = None
        tenant.provisioning_error = None

        db.commit()
        db.refresh(onboarding)
        db.refresh(tenant)

        # Prepare config
        provisioning_config = ProvisioningConfig(
            include_demo_data=config.include_demo_data if config else False,
            pos_store_enabled=config.pos_store_enabled if config else True,
            country_template=config.country_template if config else None
        )
        
        # Start provisioning in background thread (don't wait for completion)
        # This prevents timeout and allows immediate response
        import threading
        
        user_id = current_user.get("user_id")
        
        def start_provisioning_async():
            """Start provisioning in background thread"""
            try:
                # Create new DB session for background thread
                from app.database import SessionLocal
                background_db = SessionLocal()
                try:
                    provisioning_service.provision_workspace_to_pos(
                        tenant_id=tenant_id,
                        config=provisioning_config,
                        db=background_db,
                        user_id=user_id
                    )
                finally:
                    background_db.close()
            except Exception as e:
                # Log error but don't fail - provisioning can be retried
                logger.error(f"Background provisioning failed for tenant {tenant_id}: {e}", exc_info=True)
                # Update tenant status to failed
                try:
                    from app.database import SessionLocal
                    error_db = SessionLocal()
                    try:
                        error_tenant = error_db.query(Tenant).filter(Tenant.id == tenant_id).first()
                        error_onboarding = error_db.query(TenantOnboarding).filter(
                            TenantOnboarding.tenant_id == tenant_id
                        ).first()
                        if error_tenant:
                            error_tenant.provisioning_status = "FAILED"
                            error_tenant.provisioning_error = str(e)
                        if error_onboarding:
                            error_onboarding.status = "FAILED"
                            error_onboarding.error_message = str(e)
                        error_db.commit()
                    finally:
                        error_db.close()
                except Exception as db_error:
                    logger.error(f"Failed to update error status: {db_error}", exc_info=True)
        
        # Start provisioning in background thread
        provisioning_thread = threading.Thread(target=start_provisioning_async, daemon=True)
        provisioning_thread.start()
        
        # Return initial status - provisioning is starting
        return ProvisioningStatusResponse(
            status="IN_PROGRESS",
            progress=0,
            current_step="step_0_engine_check",
            steps_completed=0,
            total_steps=len(provisioning_service.PROVISIONING_STEPS),
            started_at=onboarding.started_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting provisioning for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "type": "provisioning_error",
                "message": f"Failed to start provisioning: {str(e)}"
            }
        )


@router.get("/tenants/{tenant_id}/status", response_model=ProvisioningStatusResponse)
def get_provisioning_status(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
):
    """
    Get provisioning status for a tenant.
    
    Returns current step, progress, and any errors.
    """
    try:
        # Get onboarding record
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()
        
        if not onboarding or not onboarding.provisioning_type:
            return ProvisioningStatusResponse(
                status="NOT_STARTED",
                progress=0,
                steps_completed=0,
                total_steps=len(provisioning_service.PROVISIONING_STEPS)
            )
        
        # Get tenant
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        
        # Calculate progress
        steps = onboarding.provisioning_steps or {}
        completed_steps = [s for s, data in steps.items() if data.get("status") in ["completed", "exists"]]
        total_steps = len([s for s in provisioning_service.PROVISIONING_STEPS 
                          if s != "step_6_items" or onboarding.provisioning_config.get("include_demo_data", False)])
        progress = (len(completed_steps) / total_steps * 100) if total_steps > 0 else 0
        
        # Find current step (first incomplete step)
        current_step = None
        for step in provisioning_service.PROVISIONING_STEPS:
            if step not in steps or steps[step].get("status") not in ["completed", "exists", "skipped"]:
                current_step = step
                break
        
        # Collect errors
        errors = []
        for step_name, step_data in steps.items():
            if step_data.get("status") == "failed":
                errors.append(StepError(
                    step=step_name,
                    error=step_data.get("error", "Unknown error")
                ))
        
        # If no errors in steps but status is FAILED, use error_message from onboarding
        if not errors and (tenant.provisioning_status == "FAILED" or onboarding.status == "FAILED"):
            if onboarding.error_message and onboarding.error_step:
                errors.append(StepError(
                    step=onboarding.error_step,
                    error=onboarding.error_message
                ))
            elif onboarding.error_message:
                errors.append(StepError(
                    step=current_step or "unknown",
                    error=onboarding.error_message
                ))
            elif tenant.provisioning_error:
                errors.append(StepError(
                    step=current_step or "unknown",
                    error=tenant.provisioning_error
                ))
        
        # Map tenant.provisioning_status to response status
        # "PROVISIONING" -> "IN_PROGRESS" (for API compatibility)
        tenant_status = tenant.provisioning_status or "NOT_STARTED"
        if tenant_status == "PROVISIONING":
            tenant_status = "IN_PROGRESS"
        elif tenant_status == "PROVISIONED":
            tenant_status = "COMPLETED"
        elif tenant_status == "NOT_PROVISIONED":
            tenant_status = "NOT_STARTED"
        elif tenant_status == "PARTIAL":
            # PARTIAL is valid, keep it as is
            pass
        elif tenant_status == "FAILED":
            # FAILED is valid, keep it as is
            pass
        
        return ProvisioningStatusResponse(
            status=tenant_status,
            current_step=current_step,
            progress=progress,
            steps_completed=len(completed_steps),
            total_steps=total_steps,
            errors=errors,
            started_at=onboarding.started_at,
            completed_at=onboarding.completed_at
        )
        
    except Exception as e:
        logger.error(f"Error getting provisioning status for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "type": "status_error",
                "message": f"Failed to get provisioning status: {str(e)}"
            }
        )


@router.post("/tenants/{tenant_id}/retry", response_model=ProvisioningStatusResponse)
def retry_provisioning(
    tenant_id: str,
    req: Optional[RetryRequest] = Body(default=None),
    current_user: dict = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
):
    """
    Retry failed provisioning - clears all failed steps and retries from the beginning.
    
    This will:
    - Clear failed step statuses
    - Reset tenant provisioning status to PROVISIONING
    - Retry all failed steps (completed steps are skipped)
    """
    try:
        # Get onboarding record
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()
        
        if not onboarding:
            raise HTTPException(status_code=404, detail="Provisioning record not found")
        
        # Clear failed steps - mark them as not completed so they'll be retried
        steps = onboarding.provisioning_steps or {}
        # Create a new dict to avoid "dictionary changed size during iteration" error
        new_steps = {}
        for step_name, step_data in steps.items():
            if step_data.get("status") != "failed":
                # Keep non-failed steps
                new_steps[step_name] = step_data
            else:
                # Remove failed steps so they'll be retried
                logger.info(f"Clearing failed step {step_name} for retry")
        
        onboarding.provisioning_steps = new_steps
        onboarding.error_message = None
        onboarding.error_step = None
        
        # Reset tenant status
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            tenant.provisioning_status = "PROVISIONING"
            tenant.provisioning_error = None
        
        db.commit()
        
        # Get config from onboarding
        config_data = onboarding.provisioning_config or {}
        config = ProvisioningConfig(
            include_demo_data=config_data.get("include_demo_data", False),
            pos_store_enabled=config_data.get("pos_store_enabled", True),
            country_template=config_data.get("country_template")
        )
        
        # Start retry provisioning in background thread
        import threading
        
        user_id = current_user.get("user_id")
        
        def retry_provisioning_async():
            """Retry provisioning in background thread"""
            try:
                from app.database import SessionLocal
                background_db = SessionLocal()
                try:
                    provisioning_service.provision_workspace_to_pos(
                        tenant_id=tenant_id,
                        config=config,
                        db=background_db,
                        user_id=user_id
                    )
                finally:
                    background_db.close()
            except Exception as e:
                logger.error(f"Background retry provisioning failed for tenant {tenant_id}: {e}", exc_info=True)
                try:
                    from app.database import SessionLocal
                    error_db = SessionLocal()
                    try:
                        error_tenant = error_db.query(Tenant).filter(Tenant.id == tenant_id).first()
                        error_onboarding = error_db.query(TenantOnboarding).filter(
                            TenantOnboarding.tenant_id == tenant_id
                        ).first()
                        if error_tenant:
                            error_tenant.provisioning_status = "FAILED"
                            error_tenant.provisioning_error = str(e)
                        if error_onboarding:
                            error_onboarding.status = "FAILED"
                            error_onboarding.error_message = str(e)
                        error_db.commit()
                    finally:
                        error_db.close()
                except Exception as db_error:
                    logger.error(f"Failed to update error status: {db_error}", exc_info=True)
        
        # Start retry in background thread
        retry_thread = threading.Thread(target=retry_provisioning_async, daemon=True)
        retry_thread.start()
        
        # Calculate progress from completed steps
        completed_steps = len([s for s, d in steps.items() if d.get("status") in ["completed", "exists", "skipped"]])
        total_steps = len(provisioning_service.PROVISIONING_STEPS)
        progress = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # Return initial status - retry is starting
        return ProvisioningStatusResponse(
            status="IN_PROGRESS",
            progress=progress,
            current_step=None,  # Will be determined during execution
            steps_completed=completed_steps,
            total_steps=total_steps,
            started_at=onboarding.started_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying provisioning for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "type": "retry_error",
                "message": f"Failed to retry provisioning: {str(e)}"
            }
        )


@router.post("/tenants/{tenant_id}/continue", response_model=ProvisioningStatusResponse)
def continue_provisioning(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
):
    """
    Continue provisioning from where it failed.
    
    This will:
    - Clear only the failed step status (not all failed steps)
    - Resume from the first failed step
    - Keep all completed steps as-is
    """
    try:
        # Get onboarding record
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()
        
        if not onboarding:
            raise HTTPException(status_code=404, detail="Provisioning record not found")
        
        # Find the first failed step
        steps = onboarding.provisioning_steps or {}
        first_failed_step = None
        for step_name in provisioning_service.PROVISIONING_STEPS:
            step_data = steps.get(step_name, {})
            if step_data.get("status") == "failed":
                first_failed_step = step_name
                # Clear only this failed step
                del steps[step_name]
                logger.info(f"Clearing failed step {step_name} to continue from here")
                break
        
        if not first_failed_step:
            # No failed steps found, check if provisioning is actually failed
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if tenant and tenant.provisioning_status == "FAILED":
                # Clear error and reset status to continue
                tenant.provisioning_status = "PROVISIONING"
                tenant.provisioning_error = None
                onboarding.error_message = None
                onboarding.error_step = None
                logger.info("No specific failed step found, resetting status to continue")
            else:
                raise HTTPException(
                    status_code=400,
                    detail="No failed steps found. Provisioning may be completed or not started."
                )
        
        onboarding.provisioning_steps = steps
        onboarding.error_message = None
        onboarding.error_step = None
        
        # Reset tenant status if needed
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant and tenant.provisioning_status in ["FAILED", "PARTIAL"]:
            tenant.provisioning_status = "PROVISIONING"
            tenant.provisioning_error = None
        
        db.commit()
        
        # Get config from onboarding
        config_data = onboarding.provisioning_config or {}
        config = ProvisioningConfig(
            include_demo_data=config_data.get("include_demo_data", False),
            pos_store_enabled=config_data.get("pos_store_enabled", True),
            country_template=config_data.get("country_template")
        )
        
        # Start continue provisioning in background thread
        import threading
        
        user_id = current_user.get("user_id")
        
        def continue_provisioning_async():
            """Continue provisioning in background thread"""
            try:
                from app.database import SessionLocal
                background_db = SessionLocal()
                try:
                    provisioning_service.provision_workspace_to_pos(
                        tenant_id=tenant_id,
                        config=config,
                        db=background_db,
                        user_id=user_id
                    )
                finally:
                    background_db.close()
            except Exception as e:
                logger.error(f"Background continue provisioning failed for tenant {tenant_id}: {e}", exc_info=True)
                try:
                    from app.database import SessionLocal
                    error_db = SessionLocal()
                    try:
                        error_tenant = error_db.query(Tenant).filter(Tenant.id == tenant_id).first()
                        error_onboarding = error_db.query(TenantOnboarding).filter(
                            TenantOnboarding.tenant_id == tenant_id
                        ).first()
                        if error_tenant:
                            error_tenant.provisioning_status = "FAILED"
                            error_tenant.provisioning_error = str(e)
                        if error_onboarding:
                            error_onboarding.status = "FAILED"
                            error_onboarding.error_message = str(e)
                        error_db.commit()
                    finally:
                        error_db.close()
                except Exception as db_error:
                    logger.error(f"Failed to update error status: {db_error}", exc_info=True)
        
        # Start continue in background thread
        continue_thread = threading.Thread(target=continue_provisioning_async, daemon=True)
        continue_thread.start()
        
        # Calculate progress from completed steps
        completed_steps = len([s for s, d in steps.items() if d.get("status") in ["completed", "exists", "skipped"]])
        total_steps = len(provisioning_service.PROVISIONING_STEPS)
        progress = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # Return initial status - continue is starting
        return ProvisioningStatusResponse(
            status="IN_PROGRESS",
            progress=progress,
            current_step=first_failed_step,
            steps_completed=completed_steps,
            total_steps=total_steps,
            started_at=onboarding.started_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error continuing provisioning for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "type": "continue_error",
                "message": f"Failed to continue provisioning: {str(e)}"
            }
        )


@router.post("/tenants/{tenant_id}/skip-step", response_model=ProvisioningStatusResponse)
def skip_step(
    tenant_id: str,
    req: SkipStepRequest,
    current_user: dict = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
):
    """
    Skip an optional provisioning step.
    
    Only works for optional steps (e.g., step_6_items).
    """
    try:
        # Get onboarding record
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()
        
        if not onboarding:
            raise HTTPException(status_code=404, detail="Provisioning record not found")
        
        # Validate step is skippable
        skippable_steps = ["step_6_items"]
        if req.step not in skippable_steps:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "step_not_skippable",
                    "message": f"Step {req.step} cannot be skipped (only optional steps can be skipped)"
                }
            )
        
        # Mark step as skipped
        if not onboarding.provisioning_steps:
            onboarding.provisioning_steps = {}
        
        onboarding.provisioning_steps[req.step] = {
            "status": "skipped",
            "message": f"Step {req.step} skipped by user",
            "completed_at": datetime.utcnow().isoformat()
        }
        
        db.commit()
        db.refresh(onboarding)
        
        # Return updated status
        return get_provisioning_status(tenant_id, current_user, _, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error skipping step for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "type": "skip_error",
                "message": f"Failed to skip step: {str(e)}"
            }
        )


@router.get("/tenants/{tenant_id}/logs")
def get_provisioning_logs(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
):
    """
    Get provisioning logs for debugging.
    
    Returns detailed log entries for each provisioning step.
    """
    try:
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()
        
        if not onboarding:
            return {"logs": []}
        
        steps = onboarding.provisioning_steps or {}
        logs = []
        
        for step_name, step_data in steps.items():
            logs.append({
                "step": step_name,
                "status": step_data.get("status"),
                "message": step_data.get("message"),
                "error": step_data.get("error"),
                "completed_at": step_data.get("completed_at"),
                "duration_ms": step_data.get("duration_ms")
            })
        
        return {"logs": logs}
        
    except Exception as e:
        logger.error(f"Error getting provisioning logs for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "type": "logs_error",
                "message": f"Failed to get provisioning logs: {str(e)}"
            }
        )


import logging
logger = logging.getLogger(__name__)
