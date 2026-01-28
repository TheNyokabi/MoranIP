'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ShoppingCart, Plus, Minus, Trash2, User, CreditCard,
  Smartphone, Banknote, X, ChevronRight, Grid, List, Filter,
  Barcode, Package, Tag, Percent, Receipt, Clock, RefreshCw,
  ChevronDown, MoreVertical, Star, Heart, History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { StockIndicator, StockLevelDots } from './StockIndicator'
import { useIsMobile } from '@/hooks/use-mobile'

// ==================== Types ====================

export interface POSItem {
  id: string
  code: string
  name: string
  category?: string
  price: number
  stockQty: number
  image?: string
  barcode?: string
  unit?: string
  taxRate?: number
  isFavorite?: boolean
}

export interface CartItem extends POSItem {
  quantity: number
  discount?: number
  discountType?: 'percent' | 'amount'
}

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  avatar?: string
  loyaltyPoints?: number
  creditLimit?: number
  balance?: number
}

// ==================== Product Card ====================

interface ProductCardProps {
  item: POSItem
  onAdd: (item: POSItem) => void
  onToggleFavorite?: (item: POSItem) => void
  viewMode?: 'grid' | 'list'
  currency?: string
  showStock?: boolean
}

function ProductCard({
  item,
  onAdd,
  onToggleFavorite,
  viewMode = 'grid',
  currency = 'KES',
  showStock = true,
}: ProductCardProps) {
  const isOutOfStock = item.stockQty <= 0
  
  if (viewMode === 'list') {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => !isOutOfStock && onAdd(item)}
        disabled={isOutOfStock}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg border bg-card text-left',
          'hover:bg-accent/50 transition-colors',
          isOutOfStock && 'opacity-60 cursor-not-allowed'
        )}
      >
        {/* Image */}
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.code}</p>
        </div>
        
        {/* Price & Stock */}
        <div className="text-right flex-shrink-0">
          <p className="font-semibold">{currency} {item.price.toLocaleString()}</p>
          {showStock && (
            <StockLevelDots quantity={item.stockQty} className="justify-end mt-1" />
          )}
        </div>
      </motion.button>
    )
  }
  
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => !isOutOfStock && onAdd(item)}
      disabled={isOutOfStock}
      className={cn(
        'relative flex flex-col rounded-xl border bg-card overflow-hidden',
        'hover:shadow-md transition-all',
        isOutOfStock && 'opacity-60 cursor-not-allowed'
      )}
    >
      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(item)
          }}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur"
        >
          <Heart
            className={cn(
              'h-4 w-4',
              item.isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
            )}
          />
        </button>
      )}
      
      {/* Image */}
      <div className="aspect-square bg-muted flex items-center justify-center">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      
      {/* Out of stock overlay */}
      {isOutOfStock && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <Badge variant="destructive">Out of Stock</Badge>
        </div>
      )}
      
      {/* Info */}
      <div className="p-3">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="font-bold text-primary">{currency} {item.price.toLocaleString()}</p>
          {showStock && <StockLevelDots quantity={item.stockQty} />}
        </div>
      </div>
    </motion.button>
  )
}

// ==================== Cart Item Row ====================

interface CartItemRowProps {
  item: CartItem
  onUpdateQuantity: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onDiscount?: (id: string) => void
  currency?: string
  compact?: boolean
}

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
  onDiscount,
  currency = 'KES',
  compact = false,
}: CartItemRowProps) {
  const subtotal = item.price * item.quantity
  const discountAmount = item.discount 
    ? item.discountType === 'percent' 
      ? subtotal * (item.discount / 100)
      : item.discount
    : 0
  const total = subtotal - discountAmount
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn('flex gap-3 py-3', !compact && 'border-b')}
    >
      {/* Image (hidden on compact) */}
      {!compact && (
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
      )}
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn('font-medium', compact && 'text-sm')}>{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {currency} {item.price.toLocaleString()} × {item.quantity}
            </p>
            {item.discount && (
              <Badge variant="secondary" className="text-[10px] mt-1">
                -{item.discountType === 'percent' ? `${item.discount}%` : `${currency} ${item.discount}`}
              </Badge>
            )}
          </div>
          
          <p className="font-semibold">{currency} {total.toLocaleString()}</p>
        </div>
        
        {/* Quantity controls */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex items-center gap-1">
            {onDiscount && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onDiscount(item.id)}
              >
                <Percent className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ==================== Cart Summary ====================

interface CartSummaryProps {
  items: CartItem[]
  discount?: number
  discountType?: 'percent' | 'amount'
  taxRate?: number
  currency?: string
  onCheckout: () => void
  onClear: () => void
  loading?: boolean
}

function CartSummary({
  items,
  discount = 0,
  discountType = 'amount',
  taxRate = 16,
  currency = 'KES',
  onCheckout,
  onClear,
  loading = false,
}: CartSummaryProps) {
  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.price * item.quantity
    const itemDiscount = item.discount
      ? item.discountType === 'percent'
        ? itemSubtotal * (item.discount / 100)
        : item.discount
      : 0
    return sum + (itemSubtotal - itemDiscount)
  }, 0)
  
  const orderDiscount = discountType === 'percent' ? subtotal * (discount / 100) : discount
  const taxableAmount = subtotal - orderDiscount
  const tax = taxableAmount * (taxRate / 100)
  const total = taxableAmount + tax
  
  return (
    <div className="space-y-3 pt-4 border-t">
      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{currency} {subtotal.toLocaleString()}</span>
      </div>
      
      {/* Order discount */}
      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Discount</span>
          <span>-{currency} {orderDiscount.toLocaleString()}</span>
        </div>
      )}
      
      {/* Tax */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">VAT ({taxRate}%)</span>
        <span>{currency} {tax.toLocaleString()}</span>
      </div>
      
      <Separator />
      
      {/* Total */}
      <div className="flex justify-between items-center">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-2xl font-bold text-primary">
          {currency} {total.toLocaleString()}
        </span>
      </div>
      
      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button variant="outline" onClick={onClear} disabled={items.length === 0}>
          Clear Cart
        </Button>
        <Button onClick={onCheckout} disabled={items.length === 0 || loading}>
          {loading ? 'Processing...' : 'Checkout'}
        </Button>
      </div>
    </div>
  )
}

// ==================== Payment Method Buttons ====================

interface PaymentMethodButtonsProps {
  onSelect: (method: string) => void
  selectedMethod?: string
}

function PaymentMethodButtons({ onSelect, selectedMethod }: PaymentMethodButtonsProps) {
  const methods = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
  ]
  
  return (
    <div className="grid grid-cols-3 gap-2">
      {methods.map(method => (
        <Button
          key={method.id}
          variant={selectedMethod === method.id ? 'default' : 'outline'}
          className="flex-col h-auto py-3 gap-1"
          onClick={() => onSelect(method.id)}
        >
          <method.icon className="h-5 w-5" />
          <span className="text-xs">{method.label}</span>
        </Button>
      ))}
    </div>
  )
}

// ==================== Category Tabs ====================

interface CategoryTabsProps {
  categories: string[]
  selected: string
  onSelect: (category: string) => void
}

function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        <Button
          variant={selected === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect('all')}
          className="flex-shrink-0"
        >
          All Items
        </Button>
        <Button
          variant={selected === 'favorites' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect('favorites')}
          className="flex-shrink-0 gap-1"
        >
          <Star className="h-3 w-3" />
          Favorites
        </Button>
        {categories.map(cat => (
          <Button
            key={cat}
            variant={selected === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelect(cat)}
            className="flex-shrink-0"
          >
            {cat}
          </Button>
        ))}
      </div>
    </ScrollArea>
  )
}

// ==================== Modern POS Component ====================

interface ModernPOSProps {
  items: POSItem[]
  categories?: string[]
  customer?: Customer | null
  onSelectCustomer?: () => void
  onAddToCart: (item: POSItem) => void
  onCheckout: (items: CartItem[], paymentMethod: string, customer?: Customer) => void
  onToggleFavorite?: (item: POSItem) => void
  currency?: string
  taxRate?: number
  showStock?: boolean
  loading?: boolean
}

export function ModernPOS({
  items,
  categories = [],
  customer,
  onSelectCustomer,
  onAddToCart,
  onCheckout,
  onToggleFavorite,
  currency = 'KES',
  taxRate = 16,
  showStock = true,
  loading = false,
}: ModernPOSProps) {
  const isMobile = useIsMobile()
  const [search, setSearch] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [cart, setCart] = React.useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = React.useState<string>('cash')
  const [cartOpen, setCartOpen] = React.useState(false)
  
  // Filter items
  const filteredItems = React.useMemo(() => {
    let filtered = items
    
    // Category filter
    if (selectedCategory === 'favorites') {
      filtered = filtered.filter(item => item.isFavorite)
    } else if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.code.toLowerCase().includes(searchLower) ||
        item.barcode?.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered
  }, [items, selectedCategory, search])
  
  // Cart operations
  const handleAddToCart = (item: POSItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
    onAddToCart(item)
  }
  
  const handleUpdateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveFromCart(id)
    } else {
      setCart(prev => prev.map(item =>
        item.id === id ? { ...item, quantity: qty } : item
      ))
    }
  }
  
  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }
  
  const handleClearCart = () => {
    setCart([])
  }
  
  const handleCheckout = () => {
    onCheckout(cart, paymentMethod, customer || undefined)
    setCart([])
    setCartOpen(false)
  }
  
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  
  // Render cart content
  const renderCart = () => (
    <div className="flex flex-col h-full">
      {/* Customer */}
      <button
        onClick={onSelectCustomer}
        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors mb-4"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={customer?.avatar} />
          <AvatarFallback>
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-left">
          <p className="font-medium">{customer?.name || 'Walk-in Customer'}</p>
          {customer?.phone && (
            <p className="text-xs text-muted-foreground">{customer.phone}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      
      {/* Cart items */}
      <ScrollArea className="flex-1">
        <AnimatePresence mode="popLayout">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
              <p className="text-sm">Add items to get started</p>
            </div>
          ) : (
            cart.map(item => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveFromCart}
                currency={currency}
              />
            ))
          )}
        </AnimatePresence>
      </ScrollArea>
      
      {/* Payment methods */}
      {cart.length > 0 && (
        <div className="pt-4">
          <p className="text-sm font-medium mb-2">Payment Method</p>
          <PaymentMethodButtons
            selectedMethod={paymentMethod}
            onSelect={setPaymentMethod}
          />
        </div>
      )}
      
      {/* Summary */}
      <CartSummary
        items={cart}
        taxRate={taxRate}
        currency={currency}
        onCheckout={handleCheckout}
        onClear={handleClearCart}
        loading={loading}
      />
    </div>
  )
  
  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Search & View Toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Categories */}
        <CategoryTabs
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
        
        {/* Products Grid/List */}
        <ScrollArea className="flex-1 mt-4 -mx-4 px-4">
          <div className={cn(
            viewMode === 'grid' 
              ? 'grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-2'
          )}>
            {filteredItems.map(item => (
              <ProductCard
                key={item.id}
                item={item}
                onAdd={handleAddToCart}
                onToggleFavorite={onToggleFavorite}
                viewMode={viewMode}
                currency={currency}
                showStock={showStock}
              />
            ))}
            
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No items found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Cart Panel - Desktop */}
      {!isMobile && (
        <div className="w-96 border-l bg-card p-4 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart ({cartCount})
          </h2>
          {renderCart()}
        </div>
      )}
      
      {/* Cart Button - Mobile */}
      {isMobile && (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-20 right-4 h-14 rounded-full shadow-lg gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <>
                  <span className="font-bold">{currency} {cartTotal.toLocaleString()}</span>
                  <Badge variant="secondary" className="ml-1">
                    {cartCount}
                  </Badge>
                </>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh]">
            <SheetHeader className="pb-4">
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cartCount})
              </SheetTitle>
            </SheetHeader>
            {renderCart()}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

export default ModernPOS
