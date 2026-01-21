// Update inventory API to use secure client

import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type {
    Item,
    CreateItemRequest,
    UpdateItemRequest,
    ItemsQuery,
    Warehouse,
    CreateWarehouseRequest,
    UpdateWarehouseRequest,
    WarehousesQuery,
    StockEntry,
    StockEntryRequest,
    StockEntriesQuery,
    StockReconciliation,
    StockBalance,
    StockBalanceQuery,
} from '../types/inventory';

// ==================== ITEMS ====================

export async function getItems(params?: ItemsQuery): Promise<Item[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.item_group) queryParams.append('item_group', params.item_group);
    if (params?.search) queryParams.append('search', params.search);

    const data = await apiGet<{ items: Item[] }>(`/inventory/items?${queryParams}`);
    return data.items;
}

export async function getItem(code: string): Promise<Item> {
    const data = await apiGet<{ data: Item }>(`/inventory/items/${encodeURIComponent(code)}`);
    return data.data;
}

export async function createItem(data: CreateItemRequest): Promise<Item> {
    const result = await apiPost<{ data: Item }>('/inventory/items', data);
    return result.data;
}

export async function updateItem(code: string, data: UpdateItemRequest): Promise<Item> {
    const result = await apiPut<{ data: Item }>(`/inventory/items/${encodeURIComponent(code)}`, data);
    return result.data;
}

export async function deleteItem(code: string): Promise<void> {
    await apiDelete(`/inventory/items/${encodeURIComponent(code)}`);
}

// ==================== WAREHOUSES ====================

export async function getWarehouses(params?: WarehousesQuery): Promise<Warehouse[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.company) queryParams.append('company', params.company);

    const data = await apiGet<{ warehouses: Warehouse[] }>(`/inventory/warehouses?${queryParams}`);
    return data.warehouses;
}

export async function getWarehouse(name: string): Promise<Warehouse> {
    const data = await apiGet<{ data: Warehouse }>(`/inventory/warehouses/${encodeURIComponent(name)}`);
    return data.data;
}

export async function createWarehouse(data: CreateWarehouseRequest): Promise<Warehouse> {
    const result = await apiPost<{ data: Warehouse }>('/inventory/warehouses', data);
    return result.data;
}

export async function updateWarehouse(name: string, data: UpdateWarehouseRequest): Promise<Warehouse> {
    const result = await apiPut<{ data: Warehouse }>(`/inventory/warehouses/${encodeURIComponent(name)}`, data);
    return result.data;
}

// ==================== STOCK OPERATIONS ====================

export async function createStockEntry(data: StockEntryRequest): Promise<StockEntry> {
    const result = await apiPost<{ data: StockEntry }>('/inventory/stock-entries', data);
    return result.data;
}

export async function submitStockEntry(name: string): Promise<StockEntry> {
    const result = await apiPost<{ data: StockEntry }>(
        `/inventory/stock-entries/${encodeURIComponent(name)}/submit`,
        {}
    );
    return result.data;
}

export async function getStockEntryPosting(name: string, limit = 50): Promise<{ gl_entries: any[]; stock_ledger_entries: any[] }> {
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    return apiGet(`/inventory/stock-entries/${encodeURIComponent(name)}/posting?${queryParams}`);
}

export async function getStockEntries(params?: StockEntriesQuery): Promise<StockEntry[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.stock_entry_type) queryParams.append('stock_entry_type', params.stock_entry_type);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);

    const data = await apiGet<{ entries: StockEntry[] }>(`/inventory/stock-entries?${queryParams}`);
    return data.entries;
}

export async function createStockReconciliation(data: StockReconciliation): Promise<void> {
    await apiPost('/inventory/stock-reconciliations', data);
}

export async function getStockBalance(params: StockBalanceQuery): Promise<StockBalance[]> {
    const queryParams = new URLSearchParams();
    if (params.item_code) queryParams.append('item_code', params.item_code);
    if (params.warehouse) queryParams.append('warehouse', params.warehouse);

    const data = await apiGet<{ balances: StockBalance[] }>(`/inventory/stock-balance?${queryParams}`);
    return data.balances;
}
