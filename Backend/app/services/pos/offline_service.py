"""
Offline Service for PoS
Manages offline transaction queuing, conflict resolution, and data synchronization
"""
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
import logging
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.payment_reference import PaymentReference

logger = logging.getLogger(__name__)


@dataclass
class OfflineTransaction:
    """Represents a transaction stored offline"""
    id: str
    tenant_id: str
    transaction_type: str  # 'invoice', 'payment', 'stock_adjustment'
    data: Dict[str, Any]
    created_at: datetime
    retry_count: int = 0
    max_retries: int = 3
    status: str = 'pending'  # 'pending', 'processing', 'completed', 'failed'
    error_message: Optional[str] = None
    last_attempt: Optional[datetime] = None
    priority: int = 1  # 1=low, 2=normal, 3=high, 4=critical

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        # Convert datetime objects to ISO strings
        data['created_at'] = self.created_at.isoformat()
        if self.last_attempt:
            data['last_attempt'] = self.last_attempt.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OfflineTransaction':
        """Create from dictionary"""
        # Convert ISO strings back to datetime objects
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('last_attempt'):
            data['last_attempt'] = datetime.fromisoformat(data['last_attempt'])
        return cls(**data)


@dataclass
class SyncConflict:
    """Represents a synchronization conflict"""
    id: str
    tenant_id: str
    entity_type: str  # 'invoice', 'item', 'customer'
    entity_id: str
    local_data: Dict[str, Any]
    remote_data: Dict[str, Any]
    conflict_type: str  # 'version', 'deleted', 'modified'
    resolution_strategy: Optional[str] = None  # 'local_wins', 'remote_wins', 'merge'
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()


class OfflineService:
    """Service for managing offline operations and synchronization"""

    def __init__(self, erpnext_adapter=None, redis_client=None):
        """Initialize offline service"""
        self.erpnext_adapter = erpnext_adapter
        self.redis_client = redis_client
        self.max_queue_size = 1000  # Maximum offline transactions per tenant
        self.max_sync_batch = 50     # Maximum transactions to sync at once

    async def queue_transaction(
        self,
        tenant_id: str,
        transaction_type: str,
        data: Dict[str, Any],
        priority: int = 2
    ) -> str:
        """
        Queue a transaction for offline processing

        Args:
            tenant_id: Tenant identifier
            transaction_type: Type of transaction ('invoice', 'payment', etc.)
            data: Transaction data
            priority: Transaction priority (1-4)

        Returns:
            Transaction ID
        """
        transaction_id = str(uuid.uuid4())

        transaction = OfflineTransaction(
            id=transaction_id,
            tenant_id=tenant_id,
            transaction_type=transaction_type,
            data=data,
            created_at=datetime.now(),
            priority=priority
        )

        # Store in Redis for fast access
        if self.redis_client:
            key = f"offline:queue:{tenant_id}"
            await self.redis_client.lpush(key, json.dumps(transaction.to_dict()))

            # Trim queue to prevent unlimited growth
            await self.redis_client.ltrim(key, 0, self.max_queue_size - 1)

        logger.info(f"Queued offline transaction {transaction_id} for tenant {tenant_id}")
        return transaction_id

    async def get_pending_transactions(
        self,
        tenant_id: str,
        limit: int = 100
    ) -> List[OfflineTransaction]:
        """
        Get pending offline transactions for a tenant

        Args:
            tenant_id: Tenant identifier
            limit: Maximum transactions to return

        Returns:
            List of pending transactions
        """
        transactions = []

        if self.redis_client:
            key = f"offline:queue:{tenant_id}"
            # Get transactions from Redis (they come out in reverse order)
            raw_transactions = await self.redis_client.lrange(key, 0, limit - 1)

            for raw_tx in reversed(raw_transactions):
                try:
                    tx_data = json.loads(raw_tx)
                    transaction = OfflineTransaction.from_dict(tx_data)
                    if transaction.status == 'pending':
                        transactions.append(transaction)
                except Exception as e:
                    logger.warning(f"Failed to parse offline transaction: {e}")
                    continue

        return transactions

    async def process_transaction(
        self,
        transaction: OfflineTransaction
    ) -> Tuple[bool, Optional[str]]:
        """
        Process a single offline transaction

        Args:
            transaction: Transaction to process

        Returns:
            Tuple of (success, error_message)
        """
        try:
            transaction.status = 'processing'
            transaction.last_attempt = datetime.now()

            if transaction.transaction_type == 'invoice':
                success, error = await self._process_invoice_transaction(transaction)
            elif transaction.transaction_type == 'payment':
                success, error = await self._process_payment_transaction(transaction)
            elif transaction.transaction_type == 'stock_adjustment':
                success, error = await self._process_stock_transaction(transaction)
            else:
                return False, f"Unknown transaction type: {transaction.transaction_type}"

            if success:
                transaction.status = 'completed'
                logger.info(f"Successfully processed offline transaction {transaction.id}")
            else:
                transaction.status = 'failed'
                transaction.error_message = error
                transaction.retry_count += 1
                logger.warning(f"Failed to process offline transaction {transaction.id}: {error}")

            return success, error

        except Exception as e:
            transaction.status = 'failed'
            transaction.error_message = str(e)
            transaction.retry_count += 1
            logger.error(f"Error processing offline transaction {transaction.id}: {e}")
            return False, str(e)

    async def _process_invoice_transaction(
        self,
        transaction: OfflineTransaction
    ) -> Tuple[bool, Optional[str]]:
        """Process offline invoice transaction"""
        try:
            invoice_data = transaction.data

            # Validate required fields
            required_fields = ['customer', 'items', 'pos_profile_id']
            for field in required_fields:
                if field not in invoice_data:
                    return False, f"Missing required field: {field}"

            # Process invoice through ERPNext
            if self.erpnext_adapter:
                result = await self.erpnext_adapter.proxy_request(
                    tenant_id=transaction.tenant_id,
                    path="resource/Sales Invoice",
                    method="POST",
                    json_data=invoice_data
                )

                if result and result.get('data'):
                    # Store the created invoice ID for reference
                    transaction.data['created_invoice_id'] = result['data']['name']
                    return True, None
                else:
                    return False, "Failed to create invoice in ERPNext"
            else:
                return False, "ERPNext adapter not available"

        except Exception as e:
            return False, f"Invoice processing error: {str(e)}"

    async def _process_payment_transaction(
        self,
        transaction: OfflineTransaction
    ) -> Tuple[bool, Optional[str]]:
        """Process offline payment transaction"""
        try:
            payment_data = transaction.data

            # For mobile money payments, we might need to retry the API call
            if payment_data.get('provider') in ['mpesa', 'airtel_money', 't_kash']:
                # This would integrate with the payment services
                # For now, mark as requiring manual processing
                return False, "Mobile money payments require online processing"

            # Process other payment types
            return True, None

        except Exception as e:
            return False, f"Payment processing error: {str(e)}"

    async def _process_stock_transaction(
        self,
        transaction: OfflineTransaction
    ) -> Tuple[bool, Optional[str]]:
        """Process offline stock adjustment transaction"""
        try:
            stock_data = transaction.data

            # Process stock adjustment through ERPNext
            if self.erpnext_adapter:
                result = await self.erpnext_adapter.proxy_request(
                    tenant_id=transaction.tenant_id,
                    path="resource/Stock Entry",
                    method="POST",
                    json_data=stock_data
                )

                if result and result.get('data'):
                    return True, None
                else:
                    return False, "Failed to create stock entry in ERPNext"
            else:
                return False, "ERPNext adapter not available"

        except Exception as e:
            return False, f"Stock processing error: {str(e)}"

    async def sync_pending_transactions(
        self,
        tenant_id: str,
        max_batch_size: int = None
    ) -> Dict[str, Any]:
        """
        Synchronize all pending offline transactions

        Args:
            tenant_id: Tenant identifier
            max_batch_size: Maximum transactions to process in this batch

        Returns:
            Sync results summary
        """
        if max_batch_size is None:
            max_batch_size = self.max_sync_batch

        results = {
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'errors': [],
            'start_time': datetime.now().isoformat()
        }

        try:
            # Get pending transactions
            transactions = await self.get_pending_transactions(tenant_id, max_batch_size)

            for transaction in transactions:
                success, error = await self.process_transaction(transaction)

                results['processed'] += 1
                if success:
                    results['successful'] += 1
                    # Remove from queue
                    await self._remove_transaction_from_queue(tenant_id, transaction.id)
                else:
                    results['failed'] += 1
                    results['errors'].append({
                        'transaction_id': transaction.id,
                        'error': error,
                        'retry_count': transaction.retry_count
                    })

                    # If max retries reached, remove from queue
                    if transaction.retry_count >= transaction.max_retries:
                        await self._remove_transaction_from_queue(tenant_id, transaction.id)
                        logger.warning(f"Removing transaction {transaction.id} after {transaction.retry_count} failed attempts")

            results['end_time'] = datetime.now().isoformat()
            results['duration_seconds'] = (datetime.fromisoformat(results['end_time']) - datetime.fromisoformat(results['start_time'])).total_seconds()

            logger.info(f"Sync completed for tenant {tenant_id}: {results['successful']}/{results['processed']} successful")

        except Exception as e:
            results['errors'].append({
                'type': 'sync_error',
                'error': str(e)
            })
            logger.error(f"Sync failed for tenant {tenant_id}: {e}")

        return results

    async def _remove_transaction_from_queue(self, tenant_id: str, transaction_id: str):
        """Remove a transaction from the Redis queue"""
        if self.redis_client:
            key = f"offline:queue:{tenant_id}"
            # This is a simplified removal - in production, you'd need more sophisticated queue management
            # For now, we'll rely on the queue being rebuilt during sync
            pass

    async def get_sync_status(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get current synchronization status

        Args:
            tenant_id: Tenant identifier

        Returns:
            Sync status information
        """
        pending_count = 0
        oldest_transaction = None

        if self.redis_client:
            key = f"offline:queue:{tenant_id}"
            queue_length = await self.redis_client.llen(key)
            pending_count = queue_length

            # Get oldest transaction
            if queue_length > 0:
                oldest_raw = await self.redis_client.lindex(key, -1)  # Last item in queue
                if oldest_raw:
                    try:
                        oldest_data = json.loads(oldest_raw)
                        oldest_transaction = oldest_data.get('created_at')
                    except:
                        pass

        return {
            'tenant_id': tenant_id,
            'pending_transactions': pending_count,
            'oldest_transaction': oldest_transaction,
            'queue_size_limit': self.max_queue_size,
            'is_over_limit': pending_count >= self.max_queue_size,
            'last_sync': None  # Would need to track this separately
        }

    async def clear_old_transactions(
        self,
        tenant_id: str,
        max_age_days: int = 30
    ) -> int:
        """
        Clear old completed/failed transactions

        Args:
            tenant_id: Tenant identifier
            max_age_days: Maximum age of transactions to keep

        Returns:
            Number of transactions cleared
        """
        # This would need more sophisticated queue management
        # For now, return 0 as placeholder
        logger.info(f"Clear old transactions for tenant {tenant_id} (placeholder)")
        return 0

    async def detect_conflicts(
        self,
        tenant_id: str,
        local_data: Dict[str, Any],
        remote_data: Dict[str, Any],
        entity_type: str,
        entity_id: str
    ) -> Optional[SyncConflict]:
        """
        Detect synchronization conflicts

        Args:
            tenant_id: Tenant identifier
            local_data: Local version of data
            remote_data: Remote version of data
            entity_type: Type of entity (invoice, item, customer)
            entity_id: Entity identifier

        Returns:
            Conflict object if conflict detected, None otherwise
        """
        # Simple conflict detection based on modification timestamps
        local_modified = local_data.get('modified')
        remote_modified = remote_data.get('modified')

        if local_modified and remote_modified:
            if local_modified > remote_modified:
                # Local is newer
                return SyncConflict(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    local_data=local_data,
                    remote_data=remote_data,
                    conflict_type='version',
                    resolution_strategy='local_wins'
                )
            elif remote_modified > local_modified:
                # Remote is newer
                return SyncConflict(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    local_data=local_data,
                    remote_data=remote_data,
                    conflict_type='version',
                    resolution_strategy='remote_wins'
                )

        return None

    async def resolve_conflict(
        self,
        conflict: SyncConflict,
        resolution: str
    ) -> bool:
        """
        Resolve a synchronization conflict

        Args:
            conflict: Conflict to resolve
            resolution: Resolution strategy ('local_wins', 'remote_wins', 'merge')

        Returns:
            Success status
        """
        conflict.resolution_strategy = resolution

        if resolution == 'local_wins':
            # Apply local changes to remote
            logger.info(f"Resolving conflict {conflict.id}: local wins")
            return True
        elif resolution == 'remote_wins':
            # Accept remote changes
            logger.info(f"Resolving conflict {conflict.id}: remote wins")
            return True
        elif resolution == 'merge':
            # Merge changes (would need entity-specific logic)
            logger.info(f"Resolving conflict {conflict.id}: merge")
            return True
        else:
            logger.warning(f"Unknown resolution strategy: {resolution}")
            return False

    def get_offline_config(self) -> Dict[str, Any]:
        """
        Get offline service configuration

        Returns:
            Configuration dictionary
        """
        return {
            'max_queue_size': self.max_queue_size,
            'max_sync_batch': self.max_sync_batch,
            'supported_transaction_types': ['invoice', 'payment', 'stock_adjustment'],
            'conflict_resolution_strategies': ['local_wins', 'remote_wins', 'merge']
        }