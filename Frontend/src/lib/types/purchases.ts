// Purchase Management TypeScript Types

export interface Supplier {
    id: string;
    name: string;
    supplier_group: string;
    country: string;
    currency?: string;
    tax_id?: string;
    disabled?: boolean;
    created_at?: string;
    modified_at?: string;
}

export interface CreateSupplierRequest {
    name: string;
    supplier_group: string;
    country: string;
    currency?: string;
    tax_id?: string;
}

export interface UpdateSupplierRequest {
    name?: string;
    supplier_group?: string;
    country?: string;
    currency?: string;
    tax_id?: string;
}

export interface SuppliersQuery {
    limit?: number;
    offset?: number;
    supplier_group?: string;
    search?: string;
}

export interface PurchaseOrder {
    id: string;
    name?: string;  // ERPNext document name
    supplier_id: string;
    supplier_name?: string;  // Linked supplier name
    order_date: string;
    transaction_date?: string;  // ERPNext transaction date
    currency: string;
    status?: string;
    total_amount?: number;
    grand_total?: number;  // ERPNext grand total
    items: PurchaseOrderItem[];
    created_at?: string;
    modified_at?: string;
}

export interface PurchaseOrderItem {
    item_code: string;
    qty: number;
    rate: number;
    uom: string;
    amount?: number;
}

export interface CreateOrderRequest {
    supplier_id: string;
    order_date: string;
    currency: string;
    items: PurchaseOrderItem[];
}

export interface UpdateOrderRequest {
    order_date?: string;
    items?: PurchaseOrderItem[];
}

export interface OrdersQuery {
    limit?: number;
    offset?: number;
    supplier_id?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
}

export interface PurchaseReceipt {
    id: string;
    supplier_id: string;
    purchase_order_id?: string;
    posting_date: string;
    items: PurchaseReceiptItem[];
    created_at?: string;
}

export interface PurchaseReceiptItem {
    item_code: string;
    qty: number;
    warehouse: string;
    rate?: number;
}

export interface ReceiptRequest {
    supplier_id: string;
    purchase_order_id?: string;
    posting_date?: string;
    items: PurchaseReceiptItem[];
}

export interface ReceiptsQuery {
    limit?: number;
    offset?: number;
    supplier_id?: string;
    from_date?: string;
    to_date?: string;
}

export interface PurchaseInvoice {
    id: string;
    name?: string;  // ERPNext document name
    supplier_id: string;
    supplier_name?: string;  // Linked supplier name
    bill_no: string;
    bill_date: string;
    invoice_date?: string;  // Alternative date field
    posting_date?: string;  // ERPNext posting date
    due_date?: string;
    items: PurchaseInvoiceItem[];
    total_amount?: number;
    grand_total?: number;  // ERPNext grand total
    outstanding_amount?: number;
    status?: string;
    currency?: string;
    created_at?: string;
    modified_at?: string;
}

export interface PurchaseInvoiceItem {
    item_code: string;
    qty: number;
    rate: number;
    amount?: number;
}

export interface InvoiceRequest {
    supplier_id: string;
    bill_no: string;
    bill_date: string;
    items: PurchaseInvoiceItem[];
}

export interface InvoicesQuery {
    limit?: number;
    offset?: number;
    supplier_id?: string;
    from_date?: string;
    to_date?: string;
}
