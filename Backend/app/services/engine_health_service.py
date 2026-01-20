"""
Engine Health Check Service

Centralized service for checking ERPNext/Odoo engine availability with caching,
retry logic, and structured error handling.

Author: MoranERP Team
"""

import logging
import time
from typing import Optional, Literal
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from fastapi import HTTPException
from app.config import settings
from app.services.erpnext_client import erpnext_adapter
from app.services.odoo_client import odoo_adapter

logger = logging.getLogger(__name__)


class EngineHealthStatus(str, Enum):
    """Engine health status values"""
    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    NOT_PROVISIONED = "not_provisioned"


@dataclass
class EngineHealthResult:
    """Result of engine health check"""
    status: EngineHealthStatus
    message: str
    checked_at: datetime
    response_time_ms: Optional[float] = None
    error: Optional[str] = None


class EngineOfflineError(Exception):
    """Raised when engine is offline"""
    pass


class EngineDegradedError(Exception):
    """Raised when engine is degraded (partial functionality)"""
    pass


class EngineHealthService:
    """
    Service for checking engine health with caching and retry logic.
    
    Features:
    - In-memory cache with TTL (30-60s)
    - Retry logic for transient failures (3 retries with exponential backoff)
    - Structured error types
    - Logging with correlation IDs
    """
    
    def __init__(self, cache_ttl_seconds: int = 45):
        """
        Initialize engine health service.
        
        Args:
            cache_ttl_seconds: Cache TTL in seconds (default: 45s)
        """
        self.cache_ttl = cache_ttl_seconds
        self._cache: dict[str, tuple[EngineHealthResult, datetime]] = {}
        self._max_retries = 3
        self._retry_delays = [1, 2, 4]  # Exponential backoff in seconds
    
    def check_engine_health(
        self,
        tenant_id: str,
        engine_type: str,
        force_refresh: bool = False,
        correlation_id: Optional[str] = None
    ) -> EngineHealthResult:
        """
        Check engine health for a tenant.
        
        Args:
            tenant_id: Tenant UUID
            engine_type: Engine type ('erpnext' or 'odoo')
            force_refresh: Force refresh cache
            correlation_id: Optional correlation ID for logging
        
        Returns:
            EngineHealthResult with status, message, and metadata
        """
        cache_key = f"{tenant_id}:{engine_type}"
        
        # Check cache first
        if not force_refresh:
            cached_result = self.get_cached_health(tenant_id, engine_type)
            if cached_result:
                logger.debug(
                    f"[{correlation_id}] Using cached health check for {cache_key}: {cached_result.status}"
                )
                return cached_result
        
        # Perform health check with retry logic
        last_error = None
        for attempt in range(self._max_retries):
            try:
                result = self._perform_health_check(tenant_id, engine_type, correlation_id)
                
                # Cache successful result
                self._cache[cache_key] = (result, datetime.utcnow())
                
                logger.info(
                    f"[{correlation_id}] Engine health check for {cache_key}: {result.status} "
                    f"(attempt {attempt + 1}/{self._max_retries})"
                )
                
                return result
                
            except Exception as e:
                last_error = str(e)
                if attempt < self._max_retries - 1:
                    delay = self._retry_delays[attempt]
                    logger.warning(
                        f"[{correlation_id}] Health check failed for {cache_key} "
                        f"(attempt {attempt + 1}/{self._max_retries}): {last_error}. "
                        f"Retrying in {delay}s..."
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"[{correlation_id}] Health check failed for {cache_key} "
                        f"after {self._max_retries} attempts: {last_error}"
                    )
        
        # All retries failed - return offline status
        result = EngineHealthResult(
            status=EngineHealthStatus.OFFLINE,
            message=f"Engine health check failed after {self._max_retries} attempts",
            checked_at=datetime.utcnow(),
            error=last_error
        )
        
        # Cache failure result (shorter TTL for failures)
        self._cache[cache_key] = (result, datetime.utcnow())
        
        return result
    
    def _perform_health_check(
        self,
        tenant_id: str,
        engine_type: str,
        correlation_id: Optional[str] = None
    ) -> EngineHealthResult:
        """
        Perform actual health check against engine.
        
        Args:
            tenant_id: Tenant UUID
            engine_type: Engine type ('erpnext' or 'odoo')
            correlation_id: Optional correlation ID for logging
        
        Returns:
            EngineHealthResult
        """
        start_time = time.time()
        
        try:
            if engine_type.lower() == "erpnext":
                return self._check_erpnext_health(tenant_id, start_time, correlation_id)
            elif engine_type.lower() == "odoo":
                return self._check_odoo_health(tenant_id, start_time, correlation_id)
            else:
                return EngineHealthResult(
                    status=EngineHealthStatus.NOT_PROVISIONED,
                    message=f"Unknown engine type: {engine_type}",
                    checked_at=datetime.utcnow()
                )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            error_msg = str(e)
            
            logger.error(
                f"[{correlation_id}] Health check error for {tenant_id} ({engine_type}): {error_msg}",
                exc_info=True
            )
            
            # Classify error type
            if "timeout" in error_msg.lower() or "connection" in error_msg.lower():
                status = EngineHealthStatus.OFFLINE
                message = f"Engine connection failed: {error_msg}"
            else:
                status = EngineHealthStatus.DEGRADED
                message = f"Engine check failed: {error_msg}"
            
            return EngineHealthResult(
                status=status,
                message=message,
                checked_at=datetime.utcnow(),
                response_time_ms=response_time,
                error=error_msg
            )
    
    def _check_erpnext_health(
        self,
        tenant_id: str,
        start_time: float,
        correlation_id: Optional[str] = None
    ) -> EngineHealthResult:
        """Check ERPNext engine health"""
        try:
            # Attempt login to verify connectivity and authentication
            login_success, login_error = erpnext_adapter._login(tenant_id)
            
            response_time = (time.time() - start_time) * 1000
            
            if login_success:
                return EngineHealthResult(
                    status=EngineHealthStatus.ONLINE,
                    message="ERPNext is connected and authenticated",
                    checked_at=datetime.utcnow(),
                    response_time_ms=response_time
                )
            else:
                # Login failed - check if it's a connection issue or auth issue
                if "connection" in login_error.lower() or "timeout" in login_error.lower():
                    status = EngineHealthStatus.OFFLINE
                    message = f"ERPNext connection failed: {login_error}"
                else:
                    status = EngineHealthStatus.DEGRADED
                    message = f"ERPNext authentication failed: {login_error}"
                
                return EngineHealthResult(
                    status=status,
                    message=message,
                    checked_at=datetime.utcnow(),
                    response_time_ms=response_time,
                    error=login_error
                )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            error_msg = str(e)
            
            return EngineHealthResult(
                status=EngineHealthStatus.OFFLINE,
                message=f"Failed to connect to ERPNext: {error_msg}",
                checked_at=datetime.utcnow(),
                response_time_ms=response_time,
                error=error_msg
            )
    
    def _check_odoo_health(
        self,
        tenant_id: str,
        start_time: float,
        correlation_id: Optional[str] = None
    ) -> EngineHealthResult:
        """Check Odoo engine health"""
        try:
            # Attempt system authentication to verify connectivity
            uid = odoo_adapter.authenticate_system(tenant_id)
            
            response_time = (time.time() - start_time) * 1000
            
            if uid:
                return EngineHealthResult(
                    status=EngineHealthStatus.ONLINE,
                    message="Odoo is connected and authenticated",
                    checked_at=datetime.utcnow(),
                    response_time_ms=response_time
                )
            else:
                return EngineHealthResult(
                    status=EngineHealthStatus.DEGRADED,
                    message="Odoo authentication failed",
                    checked_at=datetime.utcnow(),
                    response_time_ms=response_time,
                    error="Authentication returned no user ID"
                )
        except HTTPException as e:
            response_time = (time.time() - start_time) * 1000
            
            if e.status_code in [502, 503, 504]:
                status = EngineHealthStatus.OFFLINE
                message = f"Odoo connection failed: {e.detail}"
            else:
                status = EngineHealthStatus.DEGRADED
                message = f"Odoo check failed: {e.detail}"
            
            return EngineHealthResult(
                status=status,
                message=message,
                checked_at=datetime.utcnow(),
                response_time_ms=response_time,
                error=str(e.detail)
            )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            error_msg = str(e)
            
            return EngineHealthResult(
                status=EngineHealthStatus.OFFLINE,
                message=f"Failed to connect to Odoo: {error_msg}",
                checked_at=datetime.utcnow(),
                response_time_ms=response_time,
                error=error_msg
            )
    
    def get_cached_health(
        self,
        tenant_id: str,
        engine_type: str
    ) -> Optional[EngineHealthResult]:
        """
        Get cached health check result if still valid.
        
        Args:
            tenant_id: Tenant UUID
            engine_type: Engine type
        
        Returns:
            Cached EngineHealthResult if valid, None otherwise
        """
        cache_key = f"{tenant_id}:{engine_type}"
        
        if cache_key not in self._cache:
            return None
        
        result, cached_at = self._cache[cache_key]
        
        # Check if cache is still valid
        age = (datetime.utcnow() - cached_at).total_seconds()
        if age > self.cache_ttl:
            # Cache expired
            del self._cache[cache_key]
            return None
        
        return result
    
    def is_engine_available(
        self,
        tenant_id: str,
        engine_type: str,
        force_refresh: bool = False
    ) -> bool:
        """
        Check if engine is available (online or degraded).
        
        Args:
            tenant_id: Tenant UUID
            engine_type: Engine type
            force_refresh: Force refresh cache
        
        Returns:
            True if engine is online or degraded, False if offline
        """
        result = self.check_engine_health(tenant_id, engine_type, force_refresh)
        return result.status in [EngineHealthStatus.ONLINE, EngineHealthStatus.DEGRADED]
    
    def clear_cache(self, tenant_id: Optional[str] = None, engine_type: Optional[str] = None):
        """
        Clear health check cache.
        
        Args:
            tenant_id: Optional tenant ID to clear (clears all if not provided)
            engine_type: Optional engine type to clear
        """
        if tenant_id and engine_type:
            cache_key = f"{tenant_id}:{engine_type}"
            self._cache.pop(cache_key, None)
        elif tenant_id:
            # Clear all entries for this tenant
            keys_to_remove = [k for k in self._cache.keys() if k.startswith(f"{tenant_id}:")]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            # Clear all cache
            self._cache.clear()


# Singleton instance
engine_health_service = EngineHealthService()
