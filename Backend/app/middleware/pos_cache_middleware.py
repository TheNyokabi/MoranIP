"""
POS Cache Middleware
FastAPI middleware for automatic caching of POS-related requests
"""
import json
import time
import logging
from typing import Callable, Dict, Any, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.services.cache.pos_cache import POSCacheService

logger = logging.getLogger(__name__)


class POSCacheMiddleware(BaseHTTPMiddleware):
    """
    Middleware for caching POS API responses

    Automatically caches GET requests and adds cache headers
    """

    def __init__(self, app: ASGIApp, cache_service: Optional[POSCacheService] = None):
        super().__init__(app)
        self.cache_service = cache_service

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and apply caching logic"""

        # Only cache GET requests to POS endpoints
        if request.method != "GET" or not request.url.path.startswith("/api/pos"):
            return await call_next(request)

        # Skip caching for certain endpoints that need fresh data
        skip_cache_endpoints = [
            "/api/pos/invoice",  # Invoice creation
            "/api/pos/sync",     # Sync operations
            "/api/pos/payments", # Payment operations
        ]

        if any(request.url.path.startswith(endpoint) for endpoint in skip_cache_endpoints):
            return await call_next(request)

        # Try to get cached response
        cache_key = self._generate_cache_key(request)
        cached_response = await self._get_cached_response(cache_key)

        if cached_response:
            # Return cached response with appropriate headers
            response = JSONResponse(
                content=cached_response["data"],
                status_code=200
            )
            response.headers["X-Cache-Status"] = "HIT"
            response.headers["X-Cache-Key"] = cache_key
            if cached_response.get("cached_at"):
                response.headers["X-Cached-At"] = cached_response["cached_at"]

            logger.debug(f"Cache HIT for {request.url.path}")
            return response

        # No cache hit, process request
        start_time = time.time()
        response = await call_next(request)
        processing_time = time.time() - start_time

        # Cache successful GET responses that took time to process
        if (response.status_code == 200 and
            processing_time > 0.1 and  # Only cache if processing took > 100ms
            hasattr(response, 'body') and
            len(response.body) < 1024 * 1024):  # Only cache responses < 1MB

            try:
                # Try to parse JSON response
                if hasattr(response, 'body'):
                    response_data = json.loads(response.body.decode('utf-8'))

                    # Cache the response
                    await self._cache_response(cache_key, response_data, request)

                    response.headers["X-Cache-Status"] = "MISS"
                    logger.debug(f"Cache MISS and stored for {request.url.path}")
                else:
                    response.headers["X-Cache-Status"] = "BYPASS"
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Not JSON or couldn't decode, don't cache
                response.headers["X-Cache-Status"] = "BYPASS"
        else:
            response.headers["X-Cache-Status"] = "BYPASS"

        return response

    def _generate_cache_key(self, request: Request) -> str:
        """Generate cache key from request"""
        path = request.url.path
        query_params = str(request.query_params)

        # Include tenant ID in cache key for multi-tenancy
        tenant_id = request.headers.get("X-Tenant-ID", "default")

        # Create deterministic cache key
        key_parts = [tenant_id, path]
        if query_params:
            # Sort query params for consistency
            sorted_params = "&".join(sorted(query_params.split("&")))
            key_parts.append(sorted_params)

        return ":".join(key_parts)

    async def _get_cached_response(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached response data"""
        if not self.cache_service or not hasattr(self.cache_service, 'redis'):
            return None

        try:
            # Use Redis directly for middleware caching
            # In a more sophisticated setup, this could use a separate cache namespace
            cached_data = await self.cache_service.redis.get(f"middleware:{cache_key}")
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Failed to get cached response for {cache_key}: {e}")

        return None

    async def _cache_response(self, cache_key: str, response_data: Any, request: Request) -> None:
        """Cache response data"""
        if not self.cache_service or not hasattr(self.cache_service, 'redis'):
            return

        try:
            # Determine TTL based on endpoint
            ttl = self._get_cache_ttl(request.url.path)

            cache_data = {
                "data": response_data,
                "cached_at": time.time(),
                "ttl": ttl
            }

            await self.cache_service.redis.setex(
                f"middleware:{cache_key}",
                ttl,
                json.dumps(cache_data)
            )

            logger.debug(f"Cached response for {cache_key} with TTL {ttl}s")

        except Exception as e:
            logger.warning(f"Failed to cache response for {cache_key}: {e}")

    def _get_cache_ttl(self, path: str) -> int:
        """Get cache TTL based on endpoint"""
        # Different TTLs for different types of data
        ttl_map = {
            "/api/pos/items": 1800,      # 30 minutes for items
            "/api/pos/customers": 900,   # 15 minutes for customers
            "/api/pos/profiles": 3600,   # 1 hour for profiles
            "/api/pos/quick-actions": 1800,  # 30 minutes for quick actions
            "/api/pos/analytics": 300,   # 5 minutes for analytics
        }

        # Check for exact matches first
        for endpoint, ttl in ttl_map.items():
            if path.startswith(endpoint):
                return ttl

        # Default TTL for other POS endpoints
        return 600  # 10 minutes


class CacheInvalidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for cache invalidation on write operations

    Automatically invalidates relevant cache entries when data is modified
    """

    def __init__(self, app: ASGIApp, cache_service: Optional[POSCacheService] = None):
        super().__init__(app)
        self.cache_service = cache_service

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and invalidate cache if needed"""

        # Store original request for cache invalidation
        response = await call_next(request)

        # Only invalidate cache for successful write operations
        if (request.method in ["POST", "PUT", "DELETE"] and
            request.url.path.startswith("/api/pos") and
            response.status_code in [200, 201, 204]):

            await self._invalidate_relevant_cache(request)

        return response

    async def _invalidate_relevant_cache(self, request: Request) -> None:
        """Invalidate cache entries related to the modified data"""
        if not self.cache_service:
            return

        path = request.url.path
        tenant_id = request.headers.get("X-Tenant-ID", "default")

        try:
            if path.startswith("/api/pos/items"):
                # Item modified - invalidate item caches
                await self._invalidate_item_cache(tenant_id)

            elif path.startswith("/api/pos/customers"):
                # Customer modified - invalidate customer cache
                await self._invalidate_customer_cache(tenant_id)

            elif path.startswith("/api/pos/profiles"):
                # POS profile modified - invalidate profile caches
                await self._invalidate_profile_cache(tenant_id)

            elif path.startswith("/api/pos/invoice"):
                # Invoice created - invalidate related caches
                await self._invalidate_transaction_cache(tenant_id)

            logger.debug(f"Invalidated cache for {path}")

        except Exception as e:
            logger.warning(f"Failed to invalidate cache for {path}: {e}")

    async def _invalidate_item_cache(self, tenant_id: str) -> None:
        """Invalidate item-related cache entries"""
        if not self.cache_service:
            return

        try:
            # Clear all item caches for the tenant
            pattern = f"pos:items:{tenant_id}:*"
            keys = await self.cache_service.redis.keys(pattern)
            if keys:
                await self.cache_service.redis.delete(*keys)
                logger.debug(f"Invalidated {len(keys)} item cache entries")

            # Also clear frequent items cache
            pattern = f"pos:frequent_items:{tenant_id}:*"
            keys = await self.cache_service.redis.keys(pattern)
            if keys:
                await self.cache_service.redis.delete(*keys)

        except Exception as e:
            logger.warning(f"Failed to invalidate item cache: {e}")

    async def _invalidate_customer_cache(self, tenant_id: str) -> None:
        """Invalidate customer-related cache entries"""
        if not self.cache_service:
            return

        try:
            key = f"pos:customers:{tenant_id}"
            await self.cache_service.redis.delete(key)
            logger.debug("Invalidated customer cache")

        except Exception as e:
            logger.warning(f"Failed to invalidate customer cache: {e}")

    async def _invalidate_profile_cache(self, tenant_id: str) -> None:
        """Invalidate POS profile-related cache entries"""
        if not self.cache_service:
            return

        try:
            # Clear all profile caches for the tenant
            pattern = f"pos:profile:{tenant_id}:*"
            keys = await self.cache_service.redis.keys(pattern)
            if keys:
                await self.cache_service.redis.delete(*keys)
                logger.debug(f"Invalidated {len(keys)} profile cache entries")

        except Exception as e:
            logger.warning(f"Failed to invalidate profile cache: {e}")

    async def _invalidate_transaction_cache(self, tenant_id: str) -> None:
        """Invalidate transaction-related cache entries"""
        if not self.cache_service:
            return

        try:
            # Clear quick actions cache (contains recent transactions)
            pattern = f"pos:quick_actions:{tenant_id}:*"
            keys = await self.cache_service.redis.keys(pattern)
            if keys:
                await self.cache_service.redis.delete(*keys)
                logger.debug(f"Invalidated {len(keys)} transaction cache entries")

        except Exception as e:
            logger.warning(f"Failed to invalidate transaction cache: {e}")