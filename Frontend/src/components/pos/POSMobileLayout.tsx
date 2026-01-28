'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Package,
    Palette,
    Clock,
    TrendingUp,
    Receipt,
    ChevronLeft,
    Menu,
    X,
    BarChart3,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import new mobile components
import { ProductCardMobile, ProductGrid, POSItem } from './ProductCardMobile';
import { BottomSheetCart, CartItem } from './BottomSheetCart';
import { FloatingActionButton } from './FloatingActionButton';
import { VoiceSearch } from './VoiceSearch';
import { CashPaymentModal } from './CashPaymentModal';

interface DailySummary {
    total_sales: number;
    total_transactions: number;
    total_commission: number;
    by_payment_mode: {
        cash: number;
        mpesa: number;
        bank: number;
        total: number;
    };
}

interface POSMobileLayoutProps {
    // Data
    items: POSItem[];
    cart: CartItem[];
    summary: DailySummary | null;
    
    // Session
    sessionActive: boolean;
    sessionStartTime: Date | null;
    openingCash: number;
    tenantName: string;
    
    // Cart operations
    onAddToCart: (item: POSItem) => void;
    onUpdateQty: (itemCode: string, delta: number) => void;
    onRemoveItem: (itemCode: string) => void;
    onClearCart: () => void;
    
    // Checkout
    onCheckout: (paymentMethod: string, amountTendered?: number) => void;
    isProcessing?: boolean;
    
    // Navigation
    onEndSession: () => void;
    onAnalyticsClick: () => void;
    onSettingsClick: () => void;
    onBackClick: () => void;
    
    // Search
    searchQuery: string;
    onSearchChange: (query: string) => void;
    
    // Optional handlers
    onBarcodeClick?: () => void;
    onNewCustomerClick?: () => void;
    onDiscountClick?: () => void;
    onHoldSaleClick?: () => void;
    
    // Customization
    currency?: string;
    children?: React.ReactNode; // For paint tab content
}

export function POSMobileLayout({
    items,
    cart,
    summary,
    sessionActive,
    sessionStartTime,
    openingCash,
    tenantName,
    onAddToCart,
    onUpdateQty,
    onRemoveItem,
    onClearCart,
    onCheckout,
    isProcessing = false,
    onEndSession,
    onAnalyticsClick,
    onSettingsClick,
    onBackClick,
    searchQuery,
    onSearchChange,
    onBarcodeClick,
    onNewCustomerClick,
    onDiscountClick,
    onHoldSaleClick,
    currency = 'KES',
    children
}: POSMobileLayoutProps) {
    const [showCashModal, setShowCashModal] = React.useState(false);
    const [showMenu, setShowMenu] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('products');
    
    // Calculate cart totals
    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);
    const cartQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const VAT_RATE = 0.16;
    const cartVat = Math.round(cartTotal * VAT_RATE * 100) / 100;
    const cartGrandTotal = Math.round((cartTotal + cartVat) * 100) / 100;
    
    // Get cart quantity for each item
    const getCartQty = (itemCode: string) => {
        const cartItem = cart.find(c => c.item_code === itemCode);
        return cartItem?.qty || 0;
    };
    
    // Filter items based on search
    const filteredItems = React.useMemo(() => {
        if (!searchQuery.trim()) return items;
        const query = searchQuery.toLowerCase().trim();
        return items.filter(item =>
            item.item_name.toLowerCase().includes(query) ||
            item.item_code.toLowerCase().includes(query)
        );
    }, [items, searchQuery]);
    
    // Handle checkout
    const handleCheckout = (paymentMethod: string) => {
        if (paymentMethod === 'Cash') {
            setShowCashModal(true);
        } else {
            onCheckout(paymentMethod);
        }
    };
    
    const handleCashConfirm = (amountTendered: number) => {
        setShowCashModal(false);
        onCheckout('Cash', amountTendered);
    };
    
    // Format session duration
    const getSessionDuration = () => {
        if (!sessionStartTime) return '';
        const minutes = Math.round((Date.now() - sessionStartTime.getTime()) / 1000 / 60);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return (
        <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
            {/* Mobile Header - Minimal */}
            <header className="flex-shrink-0 px-4 py-3 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800 safe-area-top">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 lg:hidden"
                            onClick={onBackClick}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold text-white">{tenantName}</h1>
                            {sessionActive && (
                                <p className="text-xs text-zinc-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {getSessionDuration()}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Quick Stats - Visible on larger mobile */}
                        {summary && (
                            <div className="hidden sm:flex items-center gap-3 mr-2">
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-500">Today</p>
                                    <p className="text-sm font-bold text-emerald-400">
                                        {currency} {summary.total_sales.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {/* Status Badge */}
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                            Online
                        </Badge>
                        
                        {/* Menu Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setShowMenu(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>
            
            {/* Sticky Search */}
            <div className="flex-shrink-0 px-4 py-3 bg-zinc-900/50 backdrop-blur-sm border-b border-zinc-800/50">
                <VoiceSearch
                    value={searchQuery}
                    onChange={onSearchChange}
                    onBarcodeClick={onBarcodeClick}
                    placeholder="Search products..."
                />
            </div>
            
            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    {/* Tab Navigation */}
                    <div className="flex-shrink-0 px-4 pt-3">
                        <TabsList className="grid w-full grid-cols-2 bg-zinc-800/50 border border-zinc-700/50 h-10">
                            <TabsTrigger 
                                value="products" 
                                className="text-sm data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
                            >
                                <Package className="h-4 w-4 mr-2" />
                                Products
                            </TabsTrigger>
                            <TabsTrigger 
                                value="paint"
                                className="text-sm data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
                            >
                                <Palette className="h-4 w-4 mr-2" />
                                Paint
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    
                    {/* Products Tab */}
                    <TabsContent value="products" className="flex-1 overflow-hidden mt-0 p-4">
                        <ScrollArea className="h-full">
                            {filteredItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                    <Package className="h-12 w-12 mb-3 opacity-50" />
                                    <p className="text-sm">No products found</p>
                                    {searchQuery && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="mt-2 text-emerald-400"
                                            onClick={() => onSearchChange('')}
                                        >
                                            Clear search
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <ProductGrid>
                                    {filteredItems.map(item => (
                                        <ProductCardMobile
                                            key={item.item_code}
                                            item={item}
                                            onAdd={onAddToCart}
                                            cartQty={getCartQty(item.item_code)}
                                            currency={currency}
                                        />
                                    ))}
                                </ProductGrid>
                            )}
                            {/* Bottom padding for FAB and cart peek */}
                            <div className="h-32" />
                        </ScrollArea>
                    </TabsContent>
                    
                    {/* Paint Tab */}
                    <TabsContent value="paint" className="flex-1 overflow-hidden mt-0 p-4">
                        <ScrollArea className="h-full">
                            {children}
                            {/* Bottom padding for FAB and cart peek */}
                            <div className="h-32" />
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </main>
            
            {/* Bottom Sheet Cart */}
            <BottomSheetCart
                cart={cart}
                onUpdateQty={onUpdateQty}
                onRemoveItem={onRemoveItem}
                onClearCart={onClearCart}
                onCheckout={handleCheckout}
                cartTotal={cartTotal}
                cartVat={cartVat}
                cartGrandTotal={cartGrandTotal}
                isProcessing={isProcessing}
                currency={currency}
            />
            
            {/* Floating Action Button - Hidden when cart sheet is open */}
            <div className="lg:hidden">
                <FloatingActionButton
                    cartCount={cartQty}
                    cartTotal={cartGrandTotal}
                    onCartClick={() => {/* Handled by BottomSheetCart peek */}}
                    onBarcodeClick={onBarcodeClick}
                    onNewCustomerClick={onNewCustomerClick}
                    onDiscountClick={onDiscountClick}
                    onHoldSaleClick={onHoldSaleClick}
                    currency={currency}
                />
            </div>
            
            {/* Cash Payment Modal */}
            <CashPaymentModal
                open={showCashModal}
                onClose={() => setShowCashModal(false)}
                onConfirm={handleCashConfirm}
                totalAmount={cartGrandTotal}
                currency={currency}
                isProcessing={isProcessing}
            />
            
            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {showMenu && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            onClick={() => setShowMenu(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed top-0 right-0 bottom-0 w-72 bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <h2 className="text-lg font-bold">Menu</h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowMenu(false)}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                            
                            {/* Session Info */}
                            {sessionActive && summary && (
                                <div className="p-4 border-b border-zinc-800 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-zinc-800/50 rounded-lg p-3">
                                            <p className="text-xs text-zinc-400">Sales Today</p>
                                            <p className="text-lg font-bold text-emerald-400">
                                                {currency} {summary.total_sales.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="bg-zinc-800/50 rounded-lg p-3">
                                            <p className="text-xs text-zinc-400">Transactions</p>
                                            <p className="text-lg font-bold text-white">
                                                {summary.total_transactions}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-zinc-400">Opening Cash</span>
                                        <span className="text-white font-medium">
                                            {currency} {openingCash.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            {/* Menu Items */}
                            <div className="flex-1 p-2">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start gap-3 h-12 text-white hover:bg-zinc-800"
                                    onClick={() => {
                                        setShowMenu(false);
                                        onAnalyticsClick();
                                    }}
                                >
                                    <BarChart3 className="h-5 w-5 text-blue-400" />
                                    Analytics
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start gap-3 h-12 text-white hover:bg-zinc-800"
                                    onClick={() => {
                                        setShowMenu(false);
                                        onSettingsClick();
                                    }}
                                >
                                    <Settings className="h-5 w-5 text-zinc-400" />
                                    Settings
                                </Button>
                            </div>
                            
                            {/* End Session Button */}
                            {sessionActive && (
                                <div className="p-4 border-t border-zinc-800">
                                    <Button
                                        variant="destructive"
                                        className="w-full"
                                        onClick={() => {
                                            setShowMenu(false);
                                            onEndSession();
                                        }}
                                    >
                                        End Session
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export default POSMobileLayout;
