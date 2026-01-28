/**
 * POS Components Index
 */

export { StockIndicator, StockLevelDots, StockProgress, getStockStatus, getStatusLabel } from './StockIndicator'
export type { StockStatus } from './StockIndicator'

export { ModernPOS } from './modern-pos'
export type { POSItem, CartItem, Customer } from './modern-pos'

// Re-export existing components
export { AccessibilityTools } from './AccessibilityTools'
export { AnalyticsDashboard } from './AnalyticsDashboard'
export { BarcodeScanner } from './BarcodeScanner'
export { MpesaPaymentModal } from './MpesaPaymentModal'
export { QuickActionsPanel } from './QuickActionsPanel'
export { ReceiptPreview } from './ReceiptPreview'

// New Mobile-First Components
export { BottomSheetCart } from './BottomSheetCart'
export type { CartItem as BottomSheetCartItem } from './BottomSheetCart'

export { ProductCardMobile, ProductGrid } from './ProductCardMobile'
export type { POSItem as ProductCardPOSItem } from './ProductCardMobile'

export { FloatingActionButton } from './FloatingActionButton'

export { CashPaymentModal } from './CashPaymentModal'

export { VoiceSearch } from './VoiceSearch'

export { POSMobileLayout } from './POSMobileLayout'

// Animations
export { 
    SuccessConfetti, 
    AnimatedCounter, 
    FlyingItem, 
    PulseWrapper, 
    ShakeWrapper 
} from './SuccessConfetti'

// Modals
export { SaleConfirmationModal } from './sale-confirmation-modal'
export { SaleSuccessModal } from './sale-success-modal'
export { EndSessionModal } from './end-session-modal'
export { LoyaltyPointsDisplay } from './LoyaltyPointsDisplay'
export { OfflineSyncStatus } from './OfflineSyncStatus'

// Keyboard Shortcuts
export { ShortcutsHelp } from './ShortcutsHelp'
