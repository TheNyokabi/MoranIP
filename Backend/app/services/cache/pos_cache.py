"""
POS Cache Service
Redis-based caching for improved performance of frequently accessed POS data
"""
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass
from redis.asyncio import Redis

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Cache configuration"""
    ttl_items: int = 3600  # 1 hour for items
    ttl_customers: int = 1800  # 30 minutes for customers
    ttl_pos_profiles: int = 3600  # 1 hour for POS profiles
    ttl_frequent_items: int = 86400  # 24 hours for frequent items
    ttl_quick_actions: int = 1800  # 30 minutes for quick actions
    max_items_per_profile: int = 1000
    max_customers: int = 5000
    enable_compression: bool = True


class POSCacheService:
    """Redis-based caching service for POS data"""

    def __init__(self, redis_client: Optional[Redis] = None, config: Optional[CacheConfig] = None):
        """Initialize cache service"""
        self.redis = redis_client
        self.config = config or CacheConfig()
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0
        }

    async def cache_items(self, tenant_id: str, pos_profile_id: str, items: List[Dict[str, Any]]) -> bool:
        """
        Cache items for a POS profile

        Args:
            tenant_id: Tenant identifier
            pos_profile_id: POS profile identifier
            items: List of item data

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            key = f"pos:items:{tenant_id}:{pos_profile_id}"
            data = {
                'items': items[:self.config.max_items_per_profile],
                'cached_at': datetime.now().isoformat(),
                'count': len(items)
            }

            await self.redis.setex(
                key,
                self.config.ttl_items,
                json.dumps(data)
            )

            self._cache_stats['sets'] += 1
            logger.debug(f"Cached {len(items)} items for profile {pos_profile_id}")
            return True

        except Exception as e:
            logger.warning(f"Failed to cache items for profile {pos_profile_id}: {e}")
            return False

    async def get_cached_items(self, tenant_id: str, pos_profile_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached items for a POS profile

        Args:
            tenant_id: Tenant identifier
            pos_profile_id: POS profile identifier

        Returns:
            Cached items or None if not found
        """
        if not self.redis:
            return None

        try:
            key = f"pos:items:{tenant_id}:{pos_profile_id}"
            data = await self.redis.get(key)

            if data:
                parsed_data = json.loads(data)
                self._cache_stats['hits'] += 1
                logger.debug(f"Cache hit for items: profile {pos_profile_id}")
                return parsed_data.get('items', [])
            else:
                self._cache_stats['misses'] += 1
                logger.debug(f"Cache miss for items: profile {pos_profile_id}")
                return None

        except Exception as e:
            logger.warning(f"Failed to get cached items for profile {pos_profile_id}: {e}")
            return None

    async def cache_customers(self, tenant_id: str, customers: List[Dict[str, Any]]) -> bool:
        """
        Cache customers for a tenant

        Args:
            tenant_id: Tenant identifier
            customers: List of customer data

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            key = f"pos:customers:{tenant_id}"
            data = {
                'customers': customers[:self.config.max_customers],
                'cached_at': datetime.now().isoformat(),
                'count': len(customers)
            }

            await self.redis.setex(
                key,
                self.config.ttl_customers,
                json.dumps(data)
            )

            self._cache_stats['sets'] += 1
            logger.debug(f"Cached {len(customers)} customers for tenant {tenant_id}")
            return True

        except Exception as e:
            logger.warning(f"Failed to cache customers for tenant {tenant_id}: {e}")
            return False

    async def get_cached_customers(self, tenant_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached customers for a tenant

        Args:
            tenant_id: Tenant identifier

        Returns:
            Cached customers or None if not found
        """
        if not self.redis:
            return None

        try:
            key = f"pos:customers:{tenant_id}"
            data = await self.redis.get(key)

            if data:
                parsed_data = json.loads(data)
                self._cache_stats['hits'] += 1
                logger.debug(f"Cache hit for customers: tenant {tenant_id}")
                return parsed_data.get('customers', [])
            else:
                self._cache_stats['misses'] += 1
                logger.debug(f"Cache miss for customers: tenant {tenant_id}")
                return None

        except Exception as e:
            logger.warning(f"Failed to get cached customers for tenant {tenant_id}: {e}")
            return None

    async def cache_pos_profile(self, tenant_id: str, profile_id: str, profile_data: Dict[str, Any]) -> bool:
        """
        Cache POS profile data

        Args:
            tenant_id: Tenant identifier
            profile_id: POS profile identifier
            profile_data: Profile data

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            key = f"pos:profile:{tenant_id}:{profile_id}"
            data = {
                'profile': profile_data,
                'cached_at': datetime.now().isoformat()
            }

            await self.redis.setex(
                key,
                self.config.ttl_pos_profiles,
                json.dumps(data)
            )

            self._cache_stats['sets'] += 1
            logger.debug(f"Cached POS profile {profile_id}")
            return True

        except Exception as e:
            logger.warning(f"Failed to cache POS profile {profile_id}: {e}")
            return False

    async def get_cached_pos_profile(self, tenant_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached POS profile data

        Args:
            tenant_id: Tenant identifier
            profile_id: POS profile identifier

        Returns:
            Cached profile data or None if not found
        """
        if not self.redis:
            return None

        try:
            key = f"pos:profile:{tenant_id}:{profile_id}"
            data = await self.redis.get(key)

            if data:
                parsed_data = json.loads(data)
                self._cache_stats['hits'] += 1
                logger.debug(f"Cache hit for POS profile {profile_id}")
                return parsed_data.get('profile')
            else:
                self._cache_stats['misses'] += 1
                logger.debug(f"Cache miss for POS profile {profile_id}")
                return None

        except Exception as e:
            logger.warning(f"Failed to get cached POS profile {profile_id}: {e}")
            return None

    async def cache_frequent_items(self, tenant_id: str, pos_profile_id: str, frequent_items: List[Dict[str, Any]]) -> bool:
        """
        Cache frequently sold items for quick access

        Args:
            tenant_id: Tenant identifier
            pos_profile_id: POS profile identifier
            frequent_items: List of frequent items

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            key = f"pos:frequent_items:{tenant_id}:{pos_profile_id}"
            data = {
                'frequent_items': frequent_items,
                'cached_at': datetime.now().isoformat(),
                'count': len(frequent_items)
            }

            await self.redis.setex(
                key,
                self.config.ttl_frequent_items,
                json.dumps(data)
            )

            self._cache_stats['sets'] += 1
            logger.debug(f"Cached {len(frequent_items)} frequent items for profile {pos_profile_id}")
            return True

        except Exception as e:
            logger.warning(f"Failed to cache frequent items for profile {pos_profile_id}: {e}")
            return False

    async def get_cached_frequent_items(self, tenant_id: str, pos_profile_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached frequent items

        Args:
            tenant_id: Tenant identifier
            pos_profile_id: POS profile identifier

        Returns:
            Cached frequent items or None if not found
        """
        if not self.redis:
            return None

        try:
            key = f"pos:frequent_items:{tenant_id}:{pos_profile_id}"
            data = await self.redis.get(key)

            if data:
                parsed_data = json.loads(data)
                self._cache_stats['hits'] += 1
                logger.debug(f"Cache hit for frequent items: profile {pos_profile_id}")
                return parsed_data.get('frequent_items', [])
            else:
                self._cache_stats['misses'] += 1
                logger.debug(f"Cache miss for frequent items: profile {pos_profile_id}")
                return None

        except Exception as e:
            logger.warning(f"Failed to get cached frequent items for profile {pos_profile_id}: {e}")
            return None

    async def cache_quick_actions_data(self, tenant_id: str, pos_profile_id: str, data: Dict[str, Any]) -> bool:
        """
        Cache quick actions data (recent customers, last sale, etc.)

        Args:
            tenant_id: Tenant identifier
            pos_profile_id: POS profile identifier
            data: Quick actions data

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            key = f"pos:quick_actions:{tenant_id}:{pos_profile_id}"
            cache_data = {
                'data': data,
                'cached_at': datetime.now().isoformat()
            }

            await self.redis.setex(
                key,
                self.config.ttl_quick_actions,
                json.dumps(cache_data)
            )

            self._cache_stats['sets'] += 1
            logger.debug(f"Cached quick actions data for profile {pos_profile_id}")
            return True

        except Exception as e:
            logger.warning(f"Failed to cache quick actions data for profile {pos_profile_id}: {e}")
            return False

    async def get_cached_quick_actions_data(self, tenant_id: str, pos_profile_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached quick actions data

        Args:
            tenant_id: Tenant identifier
            pos_profile_id: POS profile identifier

        Returns:
            Cached quick actions data or None if not found
        """
        if not self.redis:
            return None

        try:
            key = f"pos:quick_actions:{tenant_id}:{pos_profile_id}"
            data = await self.redis.get(key)

            if data:
                parsed_data = json.loads(data)
                self._cache_stats['hits'] += 1
                logger.debug(f"Cache hit for quick actions: profile {pos_profile_id}")
                return parsed_data.get('data')
            else:
                self._cache_stats['misses'] += 1
                logger.debug(f"Cache miss for quick actions: profile {pos_profile_id}")
                return None

        except Exception as e:
            logger.warning(f"Failed to get cached quick actions data for profile {pos_profile_id}: {e}")
            return None

    async def invalidate_tenant_cache(self, tenant_id: str) -> bool:
        """
        Invalidate all cache entries for a tenant

        Args:
            tenant_id: Tenant identifier

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            # Get all keys matching the tenant pattern
            pattern = f"pos:*:{tenant_id}:*"
            keys = await self.redis.keys(pattern)

            if keys:
                await self.redis.delete(*keys)
                self._cache_stats['deletes'] += len(keys)
                logger.info(f"Invalidated {len(keys)} cache entries for tenant {tenant_id}")

            return True

        except Exception as e:
            logger.warning(f"Failed to invalidate cache for tenant {tenant_id}: {e}")
            return False

    async def invalidate_profile_cache(self, tenant_id: str, pos_profile_id: str) -> bool:
        """
        Invalidate cache entries for a specific POS profile

        Args:
            tenant_id: Tenant identifier
            pos_profile_id: POS profile identifier

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            # Get all keys matching the profile pattern
            patterns = [
                f"pos:items:{tenant_id}:{pos_profile_id}",
                f"pos:frequent_items:{tenant_id}:{pos_profile_id}",
                f"pos:quick_actions:{tenant_id}:{pos_profile_id}",
                f"pos:profile:{tenant_id}:{pos_profile_id}"
            ]

            deleted_count = 0
            for pattern in patterns:
                keys = await self.redis.keys(pattern)
                if keys:
                    await self.redis.delete(*keys)
                    deleted_count += len(keys)

            if deleted_count > 0:
                self._cache_stats['deletes'] += deleted_count
                logger.info(f"Invalidated {deleted_count} cache entries for profile {pos_profile_id}")

            return True

        except Exception as e:
            logger.warning(f"Failed to invalidate cache for profile {pos_profile_id}: {e}")
            return False

    async def warm_cache(self, tenant_id: str, erpnext_adapter=None) -> Dict[str, int]:
        """
        Warm up cache by pre-loading frequently accessed data

        Args:
            tenant_id: Tenant identifier
            erpnext_adapter: ERPNext adapter for fetching data

        Returns:
            Cache warming statistics
        """
        stats = {
            'items_cached': 0,
            'customers_cached': 0,
            'profiles_cached': 0
        }

        if not erpnext_adapter:
            logger.warning("ERPNext adapter not provided for cache warming")
            return stats

        try:
            # Cache customers
            customers_data = await erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Customer",
                method="GET",
                params={"fields": '["name", "customer_name", "customer_type"]', "limit_page_length": 100}
            )

            if customers_data and customers_data.get('data'):
                await self.cache_customers(tenant_id, customers_data['data'])
                stats['customers_cached'] = len(customers_data['data'])

            # Get POS profiles and cache their items
            profiles_data = await erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/POS Profile",
                method="GET",
                params={"fields": '["name", "warehouse"]'}
            )

            if profiles_data and profiles_data.get('data'):
                for profile in profiles_data['data']:
                    profile_id = profile.get('name')
                    if profile_id:
                        # Cache the profile itself
                        await self.cache_pos_profile(tenant_id, profile_id, profile)
                        stats['profiles_cached'] += 1

                        # Cache items for this profile (simplified - would need warehouse filtering)
                        items_data = await erpnext_adapter.proxy_request(
                            tenant_id=tenant_id,
                            path="resource/Item",
                            method="GET",
                            params={
                                "fields": '["name", "item_name", "standard_rate", "item_group"]',
                                "filters": json.dumps([["disabled", "=", 0]]),
                                "limit_page_length": 50
                            }
                        )

                        if items_data and items_data.get('data'):
                            await self.cache_items(tenant_id, profile_id, items_data['data'])
                            stats['items_cached'] += len(items_data['data'])

            logger.info(f"Cache warming completed for tenant {tenant_id}: {stats}")
            return stats

        except Exception as e:
            logger.warning(f"Cache warming failed for tenant {tenant_id}: {e}")
            return stats

    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache performance statistics

        Returns:
            Cache statistics
        """
        if not self.redis:
            return {'redis_available': False}

        try:
            info = await self.redis.info('memory')
            hit_rate = 0
            total_requests = self._cache_stats['hits'] + self._cache_stats['misses']
            if total_requests > 0:
                hit_rate = (self._cache_stats['hits'] / total_requests) * 100

            return {
                'redis_available': True,
                'memory_used': info.get('used_memory_human', 'N/A'),
                'hits': self._cache_stats['hits'],
                'misses': self._cache_stats['misses'],
                'sets': self._cache_stats['sets'],
                'deletes': self._cache_stats['deletes'],
                'hit_rate': round(hit_rate, 2),
                'config': {
                    'ttl_items': self.config.ttl_items,
                    'ttl_customers': self.config.ttl_customers,
                    'ttl_pos_profiles': self.config.ttl_pos_profiles,
                    'max_items_per_profile': self.config.max_items_per_profile
                }
            }

        except Exception as e:
            logger.warning(f"Failed to get cache stats: {e}")
            return {
                'redis_available': False,
                'error': str(e)
            }

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform cache service health check

        Returns:
            Health check results
        """
        if not self.redis:
            return {
                'status': 'unhealthy',
                'message': 'Redis client not configured'
            }

        try:
            # Simple ping test
            pong = await self.redis.ping()
            if pong == 'PONG':
                stats = await self.get_cache_stats()
                return {
                    'status': 'healthy',
                    'message': 'Cache service is operational',
                    'stats': stats
                }
            else:
                return {
                    'status': 'unhealthy',
                    'message': 'Redis ping failed'
                }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Cache service error: {str(e)}'
            }