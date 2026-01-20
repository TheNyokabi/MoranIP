from typing import Optional, List, Set
import json

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("Warning: redis package not installed. Caching will be disabled.")

from app.config import settings


class CacheService:
    """
    Redis caching service for RBAC permissions.
    Falls back to no-op if Redis is not available.
    """
    
    def __init__(self):
        self.redis_client = None
        self.enabled = False
        
        if REDIS_AVAILABLE and hasattr(settings, 'REDIS_URL'):
            try:
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True
                )
                # Test connection
                self.redis_client.ping()
                self.enabled = True
                print("Redis cache enabled")
            except Exception as e:
                print(f"Warning: Could not connect to Redis: {e}. Caching disabled.")
                self.enabled = False
        else:
            print("Redis not configured. Caching disabled.")
    
    def get_user_permissions_cached(self, user_id: str, tenant_id: str) -> Optional[List[str]]:
        """
        Get cached user permissions.
        
        Args:
            user_id: User UUID as string
            tenant_id: Tenant UUID as string
        
        Returns:
            List of permission codes or None if not cached
        """
        if not self.enabled:
            return None
        
        try:
            key = f"rbac:user:{user_id}:tenant:{tenant_id}:permissions"
            cached = self.redis_client.get(key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Cache get error: {e}")
        
        return None
    
    def set_user_permissions_cached(
        self, 
        user_id: str, 
        tenant_id: str, 
        permissions: List[str], 
        ttl: int = 900
    ):
        """
        Cache user permissions.
        
        Args:
            user_id: User UUID as string
            tenant_id: Tenant UUID as string
            permissions: List of permission codes
            ttl: Time to live in seconds (default 15 minutes)
        """
        if not self.enabled:
            return
        
        try:
            key = f"rbac:user:{user_id}:tenant:{tenant_id}:permissions"
            self.redis_client.setex(key, ttl, json.dumps(permissions))
        except Exception as e:
            print(f"Cache set error: {e}")
    
    def invalidate_user_cache(self, user_id: str, tenant_id: str):
        """
        Invalidate user's cached permissions.
        
        Args:
            user_id: User UUID as string
            tenant_id: Tenant UUID as string
        """
        if not self.enabled:
            return
        
        try:
            keys = [
                f"rbac:user:{user_id}:tenant:{tenant_id}:permissions",
                f"rbac:user:{user_id}:tenant:{tenant_id}:roles"
            ]
            self.redis_client.delete(*keys)
        except Exception as e:
            print(f"Cache invalidation error: {e}")
    
    def invalidate_role_cache(self, role_id: str):
        """
        Invalidate role's cached permissions.
        
        Args:
            role_id: Role UUID as string
        """
        if not self.enabled:
            return
        
        try:
            key = f"rbac:role:{role_id}:permissions"
            self.redis_client.delete(key)
        except Exception as e:
            print(f"Cache invalidation error: {e}")
    
    def get_role_permissions_cached(self, role_id: str) -> Optional[List[str]]:
        """
        Get cached role permissions.
        
        Args:
            role_id: Role UUID as string
        
        Returns:
            List of permission codes or None if not cached
        """
        if not self.enabled:
            return None
        
        try:
            key = f"rbac:role:{role_id}:permissions"
            cached = self.redis_client.get(key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Cache get error: {e}")
        
        return None
    
    def set_role_permissions_cached(
        self, 
        role_id: str, 
        permissions: List[str], 
        ttl: int = 900
    ):
        """
        Cache role permissions.
        
        Args:
            role_id: Role UUID as string
            permissions: List of permission codes
            ttl: Time to live in seconds (default 15 minutes)
        """
        if not self.enabled:
            return
        
        try:
            key = f"rbac:role:{role_id}:permissions"
            self.redis_client.setex(key, ttl, json.dumps(permissions))
        except Exception as e:
            print(f"Cache set error: {e}")
    
    def flush_all(self):
        """Flush all cached data (use with caution)."""
        if not self.enabled:
            return
        
        try:
            # Only flush RBAC keys
            for key in self.redis_client.scan_iter("rbac:*"):
                self.redis_client.delete(key)
        except Exception as e:
            print(f"Cache flush error: {e}")


# Singleton instance
cache_service = CacheService()

# Add wrapper methods for backward compatibility with tests
cache_service.get_user_permissions = cache_service.get_user_permissions_cached
cache_service.set_user_permissions = cache_service.set_user_permissions_cached
cache_service.invalidate_user_permissions = cache_service.invalidate_user_cache
cache_service.get_role_permissions = cache_service.get_role_permissions_cached
cache_service.set_role_permissions = cache_service.set_role_permissions_cached
cache_service.invalidate_role_permissions = cache_service.invalidate_role_cache
cache_service.invalidate_users_permissions = lambda user_ids, tenant_id: [
    cache_service.invalidate_user_cache(uid, tenant_id) for uid in user_ids
]
cache_service.get_cache_stats = lambda: {
    'hit_rate': 0.0,
    'miss_rate': 0.0,
    'keyspace_hits': 0,
    'keyspace_misses': 0
}
