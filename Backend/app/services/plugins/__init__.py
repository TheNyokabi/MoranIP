"""
Plugin System

Provides platform-wide extensibility through:
- Global plugin registry
- Webhook management
- Hook system
- Plugin marketplace integration
"""

from .global_registry import (
    GlobalPluginRegistry,
    PluginBase,
    PluginMetadata,
    PluginType,
    PluginStatus,
    HookType,
    plugin_registry,
    register_plugin
)

from .webhook_manager import (
    WebhookManager,
    WebhookConfig,
    WebhookEvent,
    WebhookStatus,
    WebhookDelivery,
    DeliveryStatus,
    webhook_manager
)

__all__ = [
    # Registry
    "GlobalPluginRegistry",
    "PluginBase",
    "PluginMetadata",
    "PluginType",
    "PluginStatus",
    "HookType",
    "plugin_registry",
    "register_plugin",
    
    # Webhooks
    "WebhookManager",
    "WebhookConfig",
    "WebhookEvent",
    "WebhookStatus",
    "WebhookDelivery",
    "DeliveryStatus",
    "webhook_manager"
]
