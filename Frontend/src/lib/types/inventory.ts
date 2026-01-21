// Inventory TypeScript Types

export interface Item {
    item_code: string;
    item_name: string;
    item_group: string;
    stock_uom: string;
    standard_rate?: number;
    description?: string;
    disabled?: boolean;
    created_at?: string;
    modified_at?: string;
}

export interface CreateItemRequest {
    item_code: string;
    item_name: string;
    item_group: string;
    stock_uom: string;
    standard_rate?: number;
    description?: string;
}

export interface UpdateItemRequest {
    item_name?: string;
    item_group?: string;
    stock_uom?: string;
    standard_rate?: number;
    description?: string;
}

export interface ItemsQuery {
    limit?: number;
    offset?: number;
    item_group?: string;
    search?: string;
}

export interface Warehouse {
    warehouse_name: string;
    company: string;
    disabled?: boolean;
    warehouse_type?: string;
    parent_warehouse?: string;
    account?: string;
    address_line_1?: string;
    email_id?: string;
    created_at?: string;
    modified_at?: string;
}

export interface CreateWarehouseRequest {
    warehouse_name: string;
    company?: string;  // Optional - auto-resolved by backend from tenant context
    warehouse_type?: string;
    parent_warehouse?: string;
    warehouse_code?: string;
    is_group?: number;
    account?: string;
    disabled?: number;
    address_line_1?: string;
    email_id?: string;
}

export interface UpdateWarehouseRequest {
    company?: string;
    warehouse_type?: string;
    parent_warehouse?: string;
    account?: string;
    disabled?: number;
}

export interface WarehousesQuery {
    limit?: number;
    offset?: number;
    company?: string;
}

export interface StockEntry {
    name: string;
    stock_entry_type: 'Material Receipt' | 'Material Issue' | 'Material Transfer';
    from_warehouse?: string;
    to_warehouse?: string;
    posting_date: string;
    items: StockEntryItem[];
    created_at?: string;
}

export interface StockEntryItem {
    item_code: string;
    qty: number;
    s_warehouse?: string;
    t_warehouse?: string;
    basic_rate?: number;
    uom?: string;
}

export interface StockEntryRequest {
    stock_entry_type: 'Material Receipt' | 'Material Issue' | 'Material Transfer';
    from_warehouse?: string;
    to_warehouse?: string;
    posting_date?: string;
    items: StockEntryItem[];
}

export interface StockEntriesQuery {
    limit?: number;
    offset?: number;
    stock_entry_type?: string;
    from_date?: string;
    to_date?: string;
}

export interface StockReconciliation {
    posting_date: string;
    items: StockReconciliationItem[];
}

export interface StockReconciliationItem {
    item_code: string;
    warehouse: string;
    qty: number;
    valuation_rate?: number;
}

export interface StockBalance {
    item_code: string;
    warehouse: string;
    qty: number;
    valuation_rate?: number;
}

export interface StockBalanceQuery {
    item_code?: string;
    warehouse?: string;
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}
