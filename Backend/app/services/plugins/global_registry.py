"""
Global Plugin Registry

Platform-wide plugin management system that extends beyond POS to all modules.
Supports:
- Plugin registration and lifecycle management
- Hook system for extensibility points
- Plugin configuration
- Plugin marketplace integration
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Type
from dataclasses import dataclass, field
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)


class PluginType(str, Enum):
    """Categories of plugins"""
    PAYMENT_PROVIDER = "payment_provider"
    SHIPPING_PROVIDER = "shipping_provider"
    COMMUNICATION = "communication"
    ANALYTICS = "analytics"
    ACCOUNTING = "accounting"
    ECOMMERCE = "ecommerce"
    AI_SERVICE = "ai_service"
    CUSTOM_REPORT = "custom_report"
    INVENTORY = "inventory"
    CRM = "crm"
    WORKFLOW = "workflow"
    INTEGRATION = "integration"
    THEME = "theme"
    WIDGET = "widget"


class PluginStatus(str, Enum):
    """Plugin lifecycle status"""
    REGISTERED = "registered"
    INSTALLED = "installed"
    ENABLED = "enabled"
    DISABLED = "disabled"
    ERROR = "error"
    DEPRECATED = "deprecated"


class HookType(str, Enum):
    """System hook points for plugins"""
    # Order lifecycle
    BEFORE_ORDER_CREATE = "before_order_create"
    AFTER_ORDER_CREATE = "after_order_create"
    BEFORE_ORDER_SUBMIT = "before_order_submit"
    AFTER_ORDER_SUBMIT = "after_order_submit"
    
    # Invoice lifecycle
    BEFORE_INVOICE_CREATE = "before_invoice_create"
    AFTER_INVOICE_CREATE = "after_invoice_create"
    BEFORE_INVOICE_SUBMIT = "before_invoice_submit"
    AFTER_INVOICE_SUBMIT = "after_invoice_submit"
    
    # Payment lifecycle
    BEFORE_PAYMENT = "before_payment"
    AFTER_PAYMENT = "after_payment"
    PAYMENT_FAILED = "payment_failed"
    
    # Inventory
    BEFORE_STOCK_UPDATE = "before_stock_update"
    AFTER_STOCK_UPDATE = "after_stock_update"
    LOW_STOCK_ALERT = "low_stock_alert"
    
    # Customer
    BEFORE_CUSTOMER_CREATE = "before_customer_create"
    AFTER_CUSTOMER_CREATE = "after_customer_create"
    CUSTOMER_UPDATED = "customer_updated"
    
    # User
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    
    # Reports
    BEFORE_REPORT_GENERATE = "before_report_generate"
    AFTER_REPORT_GENERATE = "after_report_generate"
    
    # System
    SYSTEM_STARTUP = "system_startup"
    SYSTEM_SHUTDOWN = "system_shutdown"
    DAILY_CRON = "daily_cron"
    HOURLY_CRON = "hourly_cron"


@dataclass
class PluginMetadata:
    """Plugin metadata and configuration"""
    id: str
    name: str
    version: str
    description: str
    author: str
    plugin_type: PluginType
    
    # Optional metadata
    website: str = ""
    support_email: str = ""
    documentation_url: str = ""
    icon_url: str = ""
    
    # Requirements
    min_platform_version: str = "1.0.0"
    required_permissions: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    
    # Marketplace
    is_marketplace: bool = False
    marketplace_id: Optional[str] = None
    price: float = 0.0
    is_free: bool = True
    
    # Status
    status: PluginStatus = PluginStatus.REGISTERED
    installed_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None


class PluginBase(ABC):
    """Base class for all plugins"""
    
    metadata: PluginMetadata
    
    @abstractmethod
    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the plugin with configuration"""
        pass
    
    @abstractmethod
    def cleanup(self) -> None:
        """Cleanup resources when plugin is disabled/uninstalled"""
        pass
    
    def get_hooks(self) -> Dict[HookType, Callable]:
        """Return hooks this plugin wants to register"""
        return {}
    
    def get_routes(self) -> List[Any]:
        """Return FastAPI routes to register"""
        return []
    
    def get_settings_schema(self) -> Dict[str, Any]:
        """Return JSON schema for plugin settings"""
        return {}
    
    def get_widget(self) -> Optional[Dict[str, Any]]:
        """Return dashboard widget if plugin provides one"""
        return None


@dataclass
class HookRegistration:
    """A registered hook handler"""
    plugin_id: str
    hook_type: HookType
    handler: Callable
    priority: int = 100  # Lower = runs first
    is_async: bool = False


@dataclass
class InstalledPlugin:
    """A plugin installed for a tenant"""
    id: str
    plugin_id: str
    tenant_id: str
    status: PluginStatus
    config: Dict[str, Any]
    installed_at: datetime
    installed_by: str
    last_enabled: Optional[datetime] = None
    last_error: Optional[str] = None


class GlobalPluginRegistry:
    """
    Platform-wide plugin management.
    
    This is a singleton that manages all registered plugins across
    the platform and handles tenant-specific installations.
    """
    
    _instance: Optional['GlobalPluginRegistry'] = None
    
    def __new__(cls) -> 'GlobalPluginRegistry':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # Available plugins (from marketplace or bundled)
        self._available_plugins: Dict[str, PluginMetadata] = {}
        
        # Plugin classes
        self._plugin_classes: Dict[str, Type[PluginBase]] = {}
        
        # Active plugin instances per tenant
        self._active_plugins: Dict[str, Dict[str, PluginBase]] = {}  # tenant_id -> plugin_id -> instance
        
        # Registered hooks
        self._hooks: Dict[HookType, List[HookRegistration]] = {
            hook_type: [] for hook_type in HookType
        }
        
        # Tenant configurations
        self._tenant_configs: Dict[str, Dict[str, Dict]] = {}  # tenant_id -> plugin_id -> config
        
        self._initialized = True
        logger.info("Global Plugin Registry initialized")
    
    # ==================== Plugin Registration ====================
    
    def register_plugin(
        self,
        plugin_class: Type[PluginBase],
        metadata: PluginMetadata
    ) -> bool:
        """Register a plugin with the registry"""
        try:
            plugin_id = metadata.id
            
            if plugin_id in self._available_plugins:
                logger.warning(f"Plugin {plugin_id} already registered, updating...")
            
            self._available_plugins[plugin_id] = metadata
            self._plugin_classes[plugin_id] = plugin_class
            
            logger.info(f"Plugin registered: {metadata.name} v{metadata.version}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to register plugin: {e}")
            return False
    
    def unregister_plugin(self, plugin_id: str) -> bool:
        """Unregister a plugin"""
        if plugin_id not in self._available_plugins:
            return False
        
        # Disable for all tenants first
        for tenant_id in list(self._active_plugins.keys()):
            if plugin_id in self._active_plugins.get(tenant_id, {}):
                self.disable_plugin(tenant_id, plugin_id)
        
        del self._available_plugins[plugin_id]
        del self._plugin_classes[plugin_id]
        
        logger.info(f"Plugin unregistered: {plugin_id}")
        return True
    
    # ==================== Plugin Installation ====================
    
    def install_plugin(
        self,
        tenant_id: str,
        plugin_id: str,
        user_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Optional[InstalledPlugin]:
        """Install a plugin for a tenant"""
        if plugin_id not in self._available_plugins:
            logger.error(f"Plugin {plugin_id} not found")
            return None
        
        metadata = self._available_plugins[plugin_id]
        
        # Check dependencies
        for dep in metadata.dependencies:
            if not self.is_plugin_enabled(tenant_id, dep):
                logger.error(f"Missing dependency: {dep}")
                return None
        
        installed = InstalledPlugin(
            id=str(uuid4()),
            plugin_id=plugin_id,
            tenant_id=tenant_id,
            status=PluginStatus.INSTALLED,
            config=config or {},
            installed_at=datetime.utcnow(),
            installed_by=user_id
        )
        
        # Store tenant config
        if tenant_id not in self._tenant_configs:
            self._tenant_configs[tenant_id] = {}
        self._tenant_configs[tenant_id][plugin_id] = config or {}
        
        logger.info(f"Plugin {plugin_id} installed for tenant {tenant_id}")
        return installed
    
    def uninstall_plugin(self, tenant_id: str, plugin_id: str) -> bool:
        """Uninstall a plugin for a tenant"""
        # Disable first
        self.disable_plugin(tenant_id, plugin_id)
        
        # Remove config
        if tenant_id in self._tenant_configs:
            self._tenant_configs[tenant_id].pop(plugin_id, None)
        
        logger.info(f"Plugin {plugin_id} uninstalled for tenant {tenant_id}")
        return True
    
    # ==================== Plugin Lifecycle ====================
    
    def enable_plugin(
        self,
        tenant_id: str,
        plugin_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Enable a plugin for a tenant"""
        if plugin_id not in self._plugin_classes:
            logger.error(f"Plugin class not found: {plugin_id}")
            return False
        
        try:
            # Get config
            if config is None:
                config = self._tenant_configs.get(tenant_id, {}).get(plugin_id, {})
            
            # Create instance
            plugin_class = self._plugin_classes[plugin_id]
            plugin = plugin_class()
            
            # Initialize
            if not plugin.initialize(config):
                logger.error(f"Plugin {plugin_id} initialization failed")
                return False
            
            # Store instance
            if tenant_id not in self._active_plugins:
                self._active_plugins[tenant_id] = {}
            self._active_plugins[tenant_id][plugin_id] = plugin
            
            # Register hooks
            for hook_type, handler in plugin.get_hooks().items():
                self._register_hook(plugin_id, hook_type, handler)
            
            logger.info(f"Plugin {plugin_id} enabled for tenant {tenant_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to enable plugin {plugin_id}: {e}")
            return False
    
    def disable_plugin(self, tenant_id: str, plugin_id: str) -> bool:
        """Disable a plugin for a tenant"""
        if tenant_id not in self._active_plugins:
            return True
        
        if plugin_id not in self._active_plugins[tenant_id]:
            return True
        
        try:
            plugin = self._active_plugins[tenant_id][plugin_id]
            plugin.cleanup()
            
            # Remove hooks
            self._unregister_hooks(plugin_id)
            
            # Remove instance
            del self._active_plugins[tenant_id][plugin_id]
            
            logger.info(f"Plugin {plugin_id} disabled for tenant {tenant_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to disable plugin {plugin_id}: {e}")
            return False
    
    # ==================== Hook Management ====================
    
    def _register_hook(
        self,
        plugin_id: str,
        hook_type: HookType,
        handler: Callable,
        priority: int = 100
    ) -> None:
        """Register a hook handler"""
        import asyncio
        
        registration = HookRegistration(
            plugin_id=plugin_id,
            hook_type=hook_type,
            handler=handler,
            priority=priority,
            is_async=asyncio.iscoroutinefunction(handler)
        )
        
        self._hooks[hook_type].append(registration)
        # Sort by priority
        self._hooks[hook_type].sort(key=lambda x: x.priority)
    
    def _unregister_hooks(self, plugin_id: str) -> None:
        """Remove all hooks for a plugin"""
        for hook_type in self._hooks:
            self._hooks[hook_type] = [
                h for h in self._hooks[hook_type]
                if h.plugin_id != plugin_id
            ]
    
    async def execute_hook(
        self,
        hook_type: HookType,
        context: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute all registered handlers for a hook.
        
        Handlers can modify the context and it's passed to the next handler.
        If tenant_id is provided, only run hooks for active tenant plugins.
        """
        import asyncio
        
        handlers = self._hooks.get(hook_type, [])
        
        for registration in handlers:
            # Check if plugin is active for tenant
            if tenant_id:
                if tenant_id not in self._active_plugins:
                    continue
                if registration.plugin_id not in self._active_plugins[tenant_id]:
                    continue
            
            try:
                if registration.is_async:
                    result = await registration.handler(context)
                else:
                    result = registration.handler(context)
                
                if result is not None:
                    context = result
            
            except Exception as e:
                logger.error(
                    f"Hook handler error - plugin: {registration.plugin_id}, "
                    f"hook: {hook_type.value}, error: {e}"
                )
        
        return context
    
    def execute_hook_sync(
        self,
        hook_type: HookType,
        context: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Synchronous hook execution (for non-async contexts)"""
        handlers = self._hooks.get(hook_type, [])
        
        for registration in handlers:
            if tenant_id:
                if tenant_id not in self._active_plugins:
                    continue
                if registration.plugin_id not in self._active_plugins[tenant_id]:
                    continue
            
            if registration.is_async:
                logger.warning(f"Skipping async handler in sync context: {registration.plugin_id}")
                continue
            
            try:
                result = registration.handler(context)
                if result is not None:
                    context = result
            except Exception as e:
                logger.error(f"Hook handler error: {e}")
        
        return context
    
    # ==================== Query Methods ====================
    
    def get_available_plugins(
        self,
        plugin_type: Optional[PluginType] = None
    ) -> List[PluginMetadata]:
        """Get all available plugins"""
        plugins = list(self._available_plugins.values())
        
        if plugin_type:
            plugins = [p for p in plugins if p.plugin_type == plugin_type]
        
        return plugins
    
    def get_plugin(self, plugin_id: str) -> Optional[PluginMetadata]:
        """Get a specific plugin's metadata"""
        return self._available_plugins.get(plugin_id)
    
    def get_plugin_instance(
        self,
        tenant_id: str,
        plugin_id: str
    ) -> Optional[PluginBase]:
        """Get active plugin instance for a tenant"""
        return self._active_plugins.get(tenant_id, {}).get(plugin_id)
    
    def get_tenant_plugins(self, tenant_id: str) -> List[str]:
        """Get list of active plugin IDs for a tenant"""
        return list(self._active_plugins.get(tenant_id, {}).keys())
    
    def is_plugin_enabled(self, tenant_id: str, plugin_id: str) -> bool:
        """Check if a plugin is enabled for a tenant"""
        return plugin_id in self._active_plugins.get(tenant_id, {})
    
    def get_plugins_by_type(
        self,
        tenant_id: str,
        plugin_type: PluginType
    ) -> List[PluginBase]:
        """Get all active plugins of a type for a tenant"""
        plugins = []
        
        for plugin_id, plugin in self._active_plugins.get(tenant_id, {}).items():
            metadata = self._available_plugins.get(plugin_id)
            if metadata and metadata.plugin_type == plugin_type:
                plugins.append(plugin)
        
        return plugins


# Global registry instance
plugin_registry = GlobalPluginRegistry()


# Decorator for registering plugins
def register_plugin(metadata: PluginMetadata):
    """Decorator to register a plugin class"""
    def decorator(cls: Type[PluginBase]):
        cls.metadata = metadata
        plugin_registry.register_plugin(cls, metadata)
        return cls
    return decorator
