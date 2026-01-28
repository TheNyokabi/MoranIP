"""
E-commerce Integration Services

Provides connectors and services for:
- Shopify integration
- WooCommerce integration
- Multi-channel inventory management
- Order import/export
- Product sync
"""

from .shopify_connector import (
    ShopifyConnector,
    ShopifyConfig,
    ShopifyProduct,
    ShopifyOrder
)

from .woocommerce_connector import (
    WooCommerceConnector,
    WooCommerceConfig,
    WooProduct,
    WooOrder
)

from .multichannel_inventory import (
    MultiChannelInventoryService,
    SalesChannel,
    AllocationStrategy,
    ChannelInventory,
    InventoryAllocation
)

__all__ = [
    # Shopify
    "ShopifyConnector",
    "ShopifyConfig",
    "ShopifyProduct",
    "ShopifyOrder",
    
    # WooCommerce
    "WooCommerceConnector",
    "WooCommerceConfig",
    "WooProduct",
    "WooOrder",
    
    # Multi-channel
    "MultiChannelInventoryService",
    "SalesChannel",
    "AllocationStrategy",
    "ChannelInventory",
    "InventoryAllocation"
]
