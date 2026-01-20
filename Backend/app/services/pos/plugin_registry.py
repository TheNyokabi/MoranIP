"""
Plugin Registry for PoS Extensibility
Manages plugin loading, registration, and execution
"""
import importlib
import inspect
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Callable, Type
from dataclasses import dataclass
from pathlib import Path
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class PluginInfo:
    """Plugin metadata"""
    name: str
    version: str
    description: str
    author: str
    hooks: List[str]
    config_schema: Optional[Dict[str, Any]] = None


class PluginInterface(ABC):
    """Base interface for POS plugins"""

    @property
    @abstractmethod
    def info(self) -> PluginInfo:
        """Plugin metadata"""
        pass

    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize plugin with configuration"""
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Cleanup plugin resources"""
        pass


class PaymentProviderPlugin(PluginInterface):
    """Plugin interface for payment providers"""

    @abstractmethod
    async def process_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a payment"""
        pass

    @abstractmethod
    async def refund_payment(self, payment_id: str, amount: float) -> Dict[str, Any]:
        """Process a refund"""
        pass

    @abstractmethod
    async def check_payment_status(self, payment_id: str) -> Dict[str, Any]:
        """Check payment status"""
        pass


class LoyaltyProviderPlugin(PluginInterface):
    """Plugin interface for loyalty programs"""

    @abstractmethod
    async def calculate_points(self, purchase_data: Dict[str, Any]) -> int:
        """Calculate points for a purchase"""
        pass

    @abstractmethod
    async def redeem_points(self, customer_id: str, points: int) -> Dict[str, Any]:
        """Redeem points for rewards"""
        pass

    @abstractmethod
    async def get_customer_points(self, customer_id: str) -> int:
        """Get customer's current points balance"""
        pass


class ReceiptFormatterPlugin(PluginInterface):
    """Plugin interface for receipt formatting"""

    @abstractmethod
    async def format_receipt(self, invoice_data: Dict[str, Any], format_type: str) -> str:
        """Format receipt in specified format (thermal, html, pdf)"""
        pass

    @abstractmethod
    async def get_supported_formats(self) -> List[str]:
        """Get supported receipt formats"""
        pass


class PluginHook:
    """Represents a plugin hook point"""

    def __init__(self, name: str):
        self.name = name
        self.handlers: List[Callable] = []

    async def execute(self, *args, **kwargs) -> List[Any]:
        """Execute all handlers for this hook"""
        results = []
        for handler in self.handlers:
            try:
                result = await handler(*args, **kwargs)
                results.append(result)
            except Exception as e:
                logger.error(f"Plugin hook '{self.name}' handler failed: {e}")
                results.append(None)
        return results

    def register(self, handler: Callable) -> None:
        """Register a handler for this hook"""
        self.handlers.append(handler)

    def unregister(self, handler: Callable) -> None:
        """Unregister a handler for this hook"""
        if handler in self.handlers:
            self.handlers.remove(handler)


class PluginRegistry:
    """Registry for managing POS plugins"""

    def __init__(self):
        self.plugins: Dict[str, PluginInterface] = {}
        self.hooks: Dict[str, PluginHook] = {}
        self.configs: Dict[str, Dict[str, Any]] = {}

        # Initialize standard hooks
        self._init_standard_hooks()

    def _init_standard_hooks(self):
        """Initialize standard plugin hooks"""
        standard_hooks = [
            'before_invoice_create',
            'after_invoice_create',
            'before_payment_process',
            'after_payment_process',
            'before_receipt_generate',
            'after_receipt_generate',
            'customer_created',
            'customer_updated',
            'item_created',
            'item_updated',
            'pos_session_started',
            'pos_session_ended',
            'loyalty_points_earned',
            'loyalty_points_redeemed',
            'layaway_created',
            'layaway_payment_made',
            'layaway_completed'
        ]

        for hook_name in standard_hooks:
            self.hooks[hook_name] = PluginHook(hook_name)

    async def load_plugin(self, plugin_class: Type[PluginInterface], config: Dict[str, Any]) -> bool:
        """
        Load and initialize a plugin

        Args:
            plugin_class: Plugin class to instantiate
            config: Plugin configuration

        Returns:
            Success status
        """
        try:
            plugin_instance = plugin_class()
            plugin_name = plugin_instance.info.name

            # Initialize plugin
            success = await plugin_instance.initialize(config)

            if success:
                self.plugins[plugin_name] = plugin_instance
                self.configs[plugin_name] = config

                # Register plugin hooks
                await self._register_plugin_hooks(plugin_instance)

                logger.info(f"Plugin '{plugin_name}' loaded successfully")
                return True
            else:
                logger.error(f"Failed to initialize plugin '{plugin_name}'")
                return False

        except Exception as e:
            logger.error(f"Failed to load plugin: {e}")
            return False

    async def unload_plugin(self, plugin_name: str) -> bool:
        """
        Unload a plugin

        Args:
            plugin_name: Name of plugin to unload

        Returns:
            Success status
        """
        if plugin_name not in self.plugins:
            logger.warning(f"Plugin '{plugin_name}' not found")
            return False

        try:
            plugin = self.plugins[plugin_name]

            # Shutdown plugin
            await plugin.shutdown()

            # Unregister hooks
            await self._unregister_plugin_hooks(plugin)

            # Remove from registry
            del self.plugins[plugin_name]
            del self.configs[plugin_name]

            logger.info(f"Plugin '{plugin_name}' unloaded successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to unload plugin '{plugin_name}': {e}")
            return False

    async def _register_plugin_hooks(self, plugin: PluginInterface) -> None:
        """Register plugin hook handlers"""
        plugin_info = plugin.info

        for hook_name in plugin_info.hooks:
            if hook_name in self.hooks:
                # Check if plugin has a method for this hook
                hook_method_name = f"on_{hook_name}"
                if hasattr(plugin, hook_method_name):
                    hook_method = getattr(plugin, hook_method_name)
                    if callable(hook_method):
                        self.hooks[hook_name].register(hook_method)
                        logger.debug(f"Registered hook '{hook_name}' for plugin '{plugin_info.name}'")

    async def _unregister_plugin_hooks(self, plugin: PluginInterface) -> None:
        """Unregister plugin hook handlers"""
        plugin_info = plugin.info

        for hook_name in plugin_info.hooks:
            if hook_name in self.hooks:
                hook_method_name = f"on_{hook_name}"
                if hasattr(plugin, hook_method_name):
                    hook_method = getattr(plugin, hook_method_name)
                    self.hooks[hook_name].unregister(hook_method)

    async def execute_hook(self, hook_name: str, *args, **kwargs) -> List[Any]:
        """
        Execute a plugin hook

        Args:
            hook_name: Name of hook to execute
            *args: Positional arguments for hook handlers
            **kwargs: Keyword arguments for hook handlers

        Returns:
            List of results from hook handlers
        """
        if hook_name not in self.hooks:
            logger.warning(f"Hook '{hook_name}' not found")
            return []

        return await self.hooks[hook_name].execute(*args, **kwargs)

    def get_plugin(self, name: str) -> Optional[PluginInterface]:
        """Get a loaded plugin by name"""
        return self.plugins.get(name)

    def get_plugins_by_type(self, plugin_type: Type[PluginInterface]) -> List[PluginInterface]:
        """Get all plugins of a specific type"""
        return [plugin for plugin in self.plugins.values() if isinstance(plugin, plugin_type)]

    def get_payment_providers(self) -> List[PaymentProviderPlugin]:
        """Get all payment provider plugins"""
        return self.get_plugins_by_type(PaymentProviderPlugin)

    def get_loyalty_providers(self) -> List[LoyaltyProviderPlugin]:
        """Get all loyalty provider plugins"""
        return self.get_plugins_by_type(LoyaltyProviderPlugin)

    def get_receipt_formatters(self) -> List[ReceiptFormatterPlugin]:
        """Get all receipt formatter plugins"""
        return self.get_plugins_by_type(ReceiptFormatterPlugin)

    def get_available_hooks(self) -> List[str]:
        """Get list of available hook names"""
        return list(self.hooks.keys())

    def get_plugin_info(self) -> Dict[str, PluginInfo]:
        """Get information about all loaded plugins"""
        return {name: plugin.info for name, plugin in self.plugins.items()}

    async def reload_plugin_config(self, plugin_name: str, new_config: Dict[str, Any]) -> bool:
        """
        Reload configuration for a plugin

        Args:
            plugin_name: Name of plugin
            new_config: New configuration

        Returns:
            Success status
        """
        if plugin_name not in self.plugins:
            logger.warning(f"Plugin '{plugin_name}' not found")
            return False

        try:
            plugin = self.plugins[plugin_name]
            self.configs[plugin_name] = new_config

            # Re-initialize plugin with new config
            success = await plugin.initialize(new_config)

            if success:
                logger.info(f"Plugin '{plugin_name}' configuration reloaded")
                return True
            else:
                logger.error(f"Failed to reload configuration for plugin '{plugin_name}'")
                return False

        except Exception as e:
            logger.error(f"Error reloading plugin config for '{plugin_name}': {e}")
            return False

    async def discover_plugins(self, plugin_directory: str = "plugins") -> List[str]:
        """
        Discover available plugins in a directory

        Args:
            plugin_directory: Directory to scan for plugins

        Returns:
            List of discovered plugin names
        """
        discovered = []

        try:
            plugin_path = Path(plugin_directory)

            if not plugin_path.exists():
                logger.warning(f"Plugin directory '{plugin_directory}' does not exist")
                return discovered

            # Scan for Python files in plugin directory
            for py_file in plugin_path.glob("*.py"):
                try:
                    module_name = py_file.stem
                    module_path = f"{plugin_directory}.{module_name}"

                    # Import module
                    module = importlib.import_module(module_path)

                    # Look for plugin classes
                    for name, obj in inspect.getmembers(module):
                        if (inspect.isclass(obj) and
                            issubclass(obj, PluginInterface) and
                            obj != PluginInterface):

                            discovered.append(f"{module_path}:{name}")
                            logger.debug(f"Discovered plugin: {name} in {module_path}")

                except Exception as e:
                    logger.warning(f"Failed to load plugin from {py_file}: {e}")

        except Exception as e:
            logger.error(f"Plugin discovery failed: {e}")

        return discovered

    async def shutdown_all(self) -> None:
        """Shutdown all loaded plugins"""
        logger.info("Shutting down all plugins...")

        for plugin_name, plugin in self.plugins.items():
            try:
                await plugin.shutdown()
                logger.debug(f"Plugin '{plugin_name}' shut down")
            except Exception as e:
                logger.error(f"Error shutting down plugin '{plugin_name}': {e}")

        self.plugins.clear()
        self.configs.clear()
        logger.info("All plugins shut down")


# Global plugin registry instance
plugin_registry = PluginRegistry()


async def get_plugin_registry() -> PluginRegistry:
    """Get the global plugin registry instance"""
    return plugin_registry