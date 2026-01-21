/**
 * Point of Sale TypeScript Types
 */

// ==================== Profile Types ====================

export interface PaymentMethod {
    type: 'Cash' | 'M-Pesa' | 'Card' | 'Bank' | 'Credit'
    enabled: boolean
    account?: string
}

export interface SessionSettings {
    allow_concurrent: boolean
    allow_handover: boolean
    auto_close_hours: number
    require_opening_cash: boolean
}

export interface InventorySettings {
    stock_deduction: 'immediate' | 'pending' | 'manual'
    allow_backorders: boolean
    low_stock_warning: boolean
    reserve_stock: boolean
}

export interface ReceiptSettings {
    company_logo?: string
    footer_text: string
    auto_print: boolean
    email_receipt: boolean
}

export interface PosProfile {
    id: string
    name: string
    warehouse: string
    payment_methods: PaymentMethod[]
    session_settings: SessionSettings
    inventory_settings: InventorySettings
    receipt_settings: ReceiptSettings
    created_at: string
    updated_at: string
}

export interface PosProfileCreate {
    name: string
    warehouse: string
    payment_methods?: PaymentMethod[]
    session_settings?: SessionSettings
    inventory_settings?: InventorySettings
    receipt_settings?: ReceiptSettings
}

export interface PosProfileUpdate {
    name?: string
    warehouse?: string
    payment_methods?: PaymentMethod[]
    session_settings?: SessionSettings
    inventory_settings?: InventorySettings
    receipt_settings?: ReceiptSettings
}

// ==================== Session Types ====================

export interface PosSession {
    id: string
    profile_id: string
    user: string
    opening_time: string
    closing_time?: string
    status: 'Open' | 'Closed'
    opening_cash?: number
    closing_cash?: number
    total_sales: number
    total_orders: number
}

export interface PosSessionCreate {
    profile_id: string
    opening_cash?: number
}

export interface PosSessionClose {
    closing_cash?: number
}

// ==================== Order Types ====================

export interface OrderItem {
    item_code: string
    item_name?: string
    qty: number
    rate?: number
    amount?: number
}

export interface PosOrder {
    id: string
    session_id: string
    customer?: string
    items: OrderItem[]
    subtotal: number
    tax: number
    discount: number
    total: number
    payment_method?: string
    status: 'Draft' | 'Paid' | 'Cancelled'
    created_at: string
}

export interface PosOrderCreate {
    session_id: string
    customer?: string
    items: OrderItem[]
}

export interface PosOrderUpdate {
    items: OrderItem[]
}

export interface PaymentRequest {
    payment_method: string
    amount: number
}

export interface Receipt {
    order_id: string
    receipt_number: string
    customer?: string
    items: OrderItem[]
    subtotal: number
    tax: number
    discount: number
    total: number
    payment_method: string
    amount_paid: number
    change: number
    timestamp: string
    footer_text: string
}

// ==================== Quick Actions Types ====================

export interface FrequentItem {
    item_code: string
    item_name: string
    standard_rate: number
    sales_count: number
    image?: string
}

export interface RecentCustomer {
    customer: string
    customer_name: string
    last_purchase_date: string
}

export interface QuickSaleRequest {
    pos_profile_id: string
    item_code: string
    qty: number
    customer?: string
}

export interface RepeatLastSaleRequest {
    customer: string
    pos_profile_id: string
}

export interface BulkAddRequest {
    pos_profile_id: string
    barcodes: string[]
}

// ==================== Loyalty Types ====================

export interface LoyaltyPoints {
    customer: string
    points_balance: number
    tier: 'Bronze' | 'Silver' | 'Gold'
    points_value_kes: number
}

export interface PointsCalculation {
    base_points: number
    tier_multiplier: number
    total_points: number
    tier: string
    is_birthday: boolean
}

export interface PointsRedemption {
    points_redeemed: number
    discount_amount: number
    remaining_points: number
    new_tier: string
}

export interface ReferralRequest {
    referrer_customer: string
    referred_customer: string
    first_purchase_amount: number
}

// ==================== Layaway Types ====================

export interface PaymentSchedule {
    period: number
    due_date: string
    amount: number
    status: 'pending' | 'paid' | 'overdue'
}

export interface Layaway {
    layaway_id: string
    customer: string
    items: OrderItem[]
    total_amount: number
    down_payment: number
    remaining_balance: number
    installment_periods: number
    installment_amount: number
    payment_schedule: 'weekly' | 'bi_weekly' | 'monthly'
    schedule: PaymentSchedule[]
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'defaulted'
    created_at: string
}

export interface CreateLayawayRequest {
    customer: string
    items: OrderItem[]
    total_amount: number
    down_payment: number
    installment_periods: number
    payment_schedule: 'weekly' | 'bi_weekly' | 'monthly'
}

export interface RecordPaymentRequest {
    layaway_id: string
    amount: number
    payment_date?: string
}

// ==================== M-Pesa Types ====================

export interface STKPushRequest {
    phone_number: string
    amount: number
    account_reference: string
    transaction_desc?: string
    invoice_id?: string
}

export interface STKPushResponse {
    status: string
    checkout_request_id: string
    customer_message: string
    invoice_id?: string
}

export interface PaymentConfirmationRequest {
    checkout_request_id: string
    invoice_id?: string
}

// ==================== Analytics Types ====================

export interface DailySales {
    date: string
    total_sales: number
    total_net: number
    total_tax: number
    transaction_count: number
    average_transaction: number
    payment_methods: Record<string, any>
}

export interface ProductPerformance {
    from_date: string
    to_date: string
    products: Array<{
        item_code: string
        item_name: string
        total_qty: number
        total_amount: number
        transaction_count: number
    }>
    total_products: number
}

export interface PaymentAnalysis {
    from_date: string
    to_date: string
    payment_methods: Array<{
        mode: string
        total_amount: number
        transaction_count: number
        percentage: number
    }>
    total_amount: number
}

export interface StaffPerformance {
    from_date: string
    to_date: string
    staff: Array<{
        staff_member: string
        total_sales: number
        transaction_count: number
        average_transaction: number
    }>
}

export interface CustomerInsights {
    from_date: string
    to_date: string
    customers: Array<{
        customer: string
        customer_name: string
        total_spent: number
        transaction_count: number
        last_purchase_date: string
    }>
    total_customers: number
}

// ==================== Offline Sync Types ====================

export interface SyncStatus {
    pending: number
    syncing: number
    completed: number
    failed: number
    conflicts: number
    total: number
}

export interface PendingTransaction {
    transaction_id: string
    data: any
    status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict'
    created_at: string
    synced_at?: string
    retry_count: number
    error?: string
}

export interface SyncResult {
    total: number
    synced: number
    failed: number
    conflicts: number
    errors: Array<{
        transaction_id: string
        error: string
    }>
}

export interface ResolveConflictRequest {
    transaction_id: string
    resolution: 'keep_local' | 'use_server' | 'merge'
    server_data?: any
}
