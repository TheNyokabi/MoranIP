"""
Offline Synchronization API for PoS
Manages offline transaction queuing and synchronization
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.pos.offline_service import OfflineService, OfflineTransaction, SyncConflict
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pos/sync",
    tags=["POS Offline Sync"],
)

# Global offline service instance
offline_service = OfflineService()


@router.get("/status")
async def get_sync_status(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current synchronization status

    Returns information about pending offline transactions and sync state
    """
    try:
        status = await offline_service.get_sync_status(tenant_id)
        return status
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "sync_status_error",
                "message": "Failed to get sync status",
                "error": str(e)
            }
        )


@router.get("/pending")
async def get_pending_transactions(
    limit: int = Query(50, description="Maximum transactions to return"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get pending offline transactions

    Returns list of transactions waiting to be synchronized
    """
    try:
        transactions = await offline_service.get_pending_transactions(tenant_id, limit)
        return {
            "pending_transactions": [tx.to_dict() for tx in transactions],
            "count": len(transactions),
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "pending_transactions_error",
                "message": "Failed to get pending transactions",
                "error": str(e)
            }
        )


@router.post("/sync")
async def sync_pending_transactions(
    background_tasks: BackgroundTasks,
    max_batch_size: int = Query(25, description="Maximum transactions to process"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Synchronize pending offline transactions

    Processes queued transactions and returns sync results
    """
    try:
        results = await offline_service.sync_pending_transactions(
            tenant_id=tenant_id,
            max_batch_size=max_batch_size
        )

        return {
            "sync_results": results,
            "message": f"Synchronized {results['successful']}/{results['processed']} transactions",
            "tenant_id": tenant_id
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "sync_error",
                "message": "Failed to synchronize transactions",
                "error": str(e)
            }
        )


@router.post("/queue")
async def queue_offline_transaction(
    transaction_type: str,
    data: Dict[str, Any],
    priority: int = Query(2, description="Transaction priority (1-4)"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Queue a transaction for offline processing

    Stores transaction data for later synchronization when online
    """
    try:
        # Validate transaction type
        allowed_types = offline_service.get_offline_config()['supported_transaction_types']
        if transaction_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "invalid_transaction_type",
                    "message": f"Transaction type '{transaction_type}' not supported",
                    "supported_types": allowed_types
                }
            )

        # Validate priority
        if not 1 <= priority <= 4:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "invalid_priority",
                    "message": "Priority must be between 1 and 4"
                }
            )

        transaction_id = await offline_service.queue_transaction(
            tenant_id=tenant_id,
            transaction_type=transaction_type,
            data=data,
            priority=priority
        )

        return {
            "transaction_id": transaction_id,
            "transaction_type": transaction_type,
            "status": "queued",
            "priority": priority,
            "message": "Transaction queued for offline processing"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "queue_error",
                "message": "Failed to queue transaction",
                "error": str(e)
            }
        )


@router.delete("/clear-old")
async def clear_old_transactions(
    max_age_days: int = Query(30, description="Maximum age in days for transactions to keep"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clear old completed/failed transactions

    Removes transactions older than specified days to free up space
    """
    try:
        cleared_count = await offline_service.clear_old_transactions(
            tenant_id=tenant_id,
            max_age_days=max_age_days
        )

        return {
            "cleared_count": cleared_count,
            "max_age_days": max_age_days,
            "message": f"Cleared {cleared_count} old transactions"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "clear_error",
                "message": "Failed to clear old transactions",
                "error": str(e)
            }
        )


@router.post("/resolve-conflict")
async def resolve_sync_conflict(
    conflict_id: str,
    resolution: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resolve a synchronization conflict

    Applies the specified resolution strategy to a sync conflict
    """
    try:
        # Validate resolution strategy
        allowed_resolutions = offline_service.get_offline_config()['conflict_resolution_strategies']
        if resolution not in allowed_resolutions:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "invalid_resolution",
                    "message": f"Resolution strategy '{resolution}' not supported",
                    "supported_resolutions": allowed_resolutions
                }
            )

        # Create conflict object (in production, this would be retrieved from storage)
        conflict = SyncConflict(
            id=conflict_id,
            tenant_id=tenant_id,
            entity_type="unknown",  # Would be determined from stored conflict
            entity_id="unknown",
            local_data={},
            remote_data={},
            conflict_type="unknown"
        )

        success = await offline_service.resolve_conflict(conflict, resolution)

        return {
            "conflict_id": conflict_id,
            "resolution": resolution,
            "success": success,
            "message": f"Conflict resolved using '{resolution}' strategy"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "conflict_resolution_error",
                "message": "Failed to resolve conflict",
                "error": str(e)
            }
        )


@router.get("/config")
async def get_offline_config(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get offline service configuration

    Returns configuration settings for offline functionality
    """
    try:
        config = offline_service.get_offline_config()
        return {
            "offline_config": config,
            "features": {
                "transaction_queue": True,
                "background_sync": True,
                "conflict_resolution": True,
                "retry_logic": True,
                "priority_queuing": True
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "config_error",
                "message": "Failed to get offline configuration",
                "error": str(e)
            }
        )


@router.post("/test-connectivity")
async def test_online_connectivity(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Test online connectivity

    Checks if the system can connect to required services
    """
    try:
        # Test ERPNext connectivity
        connectivity_results = {
            "erpnext": False,
            "database": False,
            "overall": False
        }

        # Test ERPNext connection
        try:
            # Simple ping to ERPNext
            result = await pos_service._request(
                method="GET",
                path="resource/Item?limit=1"
            )
            connectivity_results["erpnext"] = result is not None
        except Exception as e:
            logger.warning(f"ERPNext connectivity test failed: {e}")
            connectivity_results["erpnext"] = False

        # Test database connection
        try:
            # Simple database query
            db.execute("SELECT 1")
            connectivity_results["database"] = True
        except Exception as e:
            logger.warning(f"Database connectivity test failed: {e}")
            connectivity_results["database"] = False

        # Overall connectivity
        connectivity_results["overall"] = (
            connectivity_results["erpnext"] and connectivity_results["database"]
        )

        return {
            "connectivity_test": connectivity_results,
            "timestamp": datetime.now().isoformat(),
            "message": "Online" if connectivity_results["overall"] else "Offline mode recommended"
        }
    except Exception as e:
        return {
            "connectivity_test": {
                "erpnext": False,
                "database": False,
                "overall": False,
                "error": str(e)
            },
            "timestamp": datetime.now().isoformat(),
            "message": "Connectivity test failed - likely offline"
        }


@router.post("/force-sync")
async def force_sync_now(
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Force immediate synchronization

    Manually triggers synchronization of all pending transactions
    """
    try:
        # Add sync task to background
        background_tasks.add_task(
            offline_service.sync_pending_transactions,
            tenant_id=tenant_id,
            max_batch_size=50
        )

        return {
            "message": "Synchronization started in background",
            "tenant_id": tenant_id,
            "status": "processing"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "force_sync_error",
                "message": "Failed to start synchronization",
                "error": str(e)
            }
        )