// Update purchases API to use secure client

import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type {
    Supplier,
    CreateSupplierRequest,
    UpdateSupplierRequest,
    SuppliersQuery,
    PurchaseOrder,
    CreateOrderRequest,
    UpdateOrderRequest,
    OrdersQuery,
    PurchaseReceipt,
    ReceiptRequest,
    ReceiptsQuery,
    PurchaseInvoice,
    InvoiceRequest,
    InvoicesQuery,
} from '../types/purchases';

// ==================== SUPPLIERS ====================

export async function getSuppliers(params?: SuppliersQuery): Promise<Supplier[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.supplier_group) queryParams.append('supplier_group', params.supplier_group);
    if (params?.search) queryParams.append('search', params.search);

    const data = await apiGet<{ suppliers: Supplier[] }>(`/purchases/suppliers?${queryParams}`);
    return data.suppliers;
}

export async function getSupplier(id: string): Promise<Supplier> {
    const data = await apiGet<{ data: Supplier }>(`/purchases/suppliers/${encodeURIComponent(id)}`);
    return data.data;
}

export async function createSupplier(data: CreateSupplierRequest): Promise<Supplier> {
    const result = await apiPost<{ data: Supplier }>('/purchases/suppliers', data);
    return result.data;
}

export async function updateSupplier(id: string, data: UpdateSupplierRequest): Promise<Supplier> {
    const result = await apiPut<{ data: Supplier }>(`/purchases/suppliers/${encodeURIComponent(id)}`, data);
    return result.data;
}

export async function deleteSupplier(id: string): Promise<void> {
    await apiDelete(`/purchases/suppliers/${encodeURIComponent(id)}`);
}

// ==================== PURCHASE ORDERS ====================

export async function getPurchaseOrders(params?: OrdersQuery): Promise<PurchaseOrder[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.supplier_id) queryParams.append('supplier_id', params.supplier_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);

    const data = await apiGet<{ orders: PurchaseOrder[] }>(`/purchases/orders?${queryParams}`);
    return data.orders;
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const data = await apiGet<{ data: PurchaseOrder }>(`/purchases/orders/${encodeURIComponent(id)}`);
    return data.data;
}

export async function createPurchaseOrder(data: CreateOrderRequest): Promise<PurchaseOrder> {
    const result = await apiPost<{ data: PurchaseOrder }>('/purchases/orders', data);
    return result.data;
}

export async function updatePurchaseOrder(id: string, data: UpdateOrderRequest): Promise<PurchaseOrder> {
    const result = await apiPut<{ data: PurchaseOrder }>(`/purchases/orders/${encodeURIComponent(id)}`, data);
    return result.data;
}

export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const result = await apiPost<{ data: PurchaseOrder }>(`/purchases/orders/${encodeURIComponent(id)}/submit`, {});
    return result.data;
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const result = await apiPost<{ data: PurchaseOrder }>(`/purchases/orders/${encodeURIComponent(id)}/cancel`, {});
    return result.data;
}

// ==================== PURCHASE RECEIPTS ====================

export async function createPurchaseReceipt(data: ReceiptRequest): Promise<PurchaseReceipt> {
    const result = await apiPost<{ data: PurchaseReceipt }>('/purchases/receipts', data);
    return result.data;
}

export async function getPurchaseReceipts(params?: ReceiptsQuery): Promise<PurchaseReceipt[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.supplier_id) queryParams.append('supplier_id', params.supplier_id);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);

    const data = await apiGet<{ receipts: PurchaseReceipt[] }>(`/purchases/receipts?${queryParams}`);
    return data.receipts;
}

export async function getPurchaseReceipt(id: string): Promise<PurchaseReceipt> {
    const data = await apiGet<{ data: PurchaseReceipt }>(`/purchases/receipts/${encodeURIComponent(id)}`);
    return data.data;
}

export async function updatePurchaseReceipt(id: string, data: Partial<ReceiptRequest>): Promise<PurchaseReceipt> {
    const result = await apiPut<{ data: PurchaseReceipt }>(`/purchases/receipts/${encodeURIComponent(id)}`, data);
    return result.data;
}

export async function deletePurchaseReceipt(id: string): Promise<void> {
    await apiDelete(`/purchases/receipts/${encodeURIComponent(id)}`);
}

export async function submitPurchaseReceipt(id: string): Promise<{ message: string; receipt_id: string; status: string; inventory_updated: boolean }> {
    const result = await apiPost<{ message: string; receipt_id: string; status: string; inventory_updated: boolean }>(
        `/purchases/receipts/${encodeURIComponent(id)}/submit`, 
        {}
    );
    return result;
}

export async function cancelPurchaseReceipt(id: string): Promise<{ message: string; receipt_id: string; status: string; inventory_reversed: boolean }> {
    const result = await apiPost<{ message: string; receipt_id: string; status: string; inventory_reversed: boolean }>(
        `/purchases/receipts/${encodeURIComponent(id)}/cancel`, 
        {}
    );
    return result;
}

// ==================== PURCHASE INVOICES ====================

export async function createPurchaseInvoice(data: InvoiceRequest): Promise<PurchaseInvoice> {
    const result = await apiPost<{ data: PurchaseInvoice }>('/purchases/invoices', data);
    return result.data;
}

export async function getPurchaseInvoices(params?: InvoicesQuery): Promise<PurchaseInvoice[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.supplier_id) queryParams.append('supplier_id', params.supplier_id);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);

    const data = await apiGet<{ invoices: PurchaseInvoice[] }>(`/purchases/invoices?${queryParams}`);
    return data.invoices;
}

export async function getPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
    const data = await apiGet<{ data: PurchaseInvoice }>(`/purchases/invoices/${encodeURIComponent(id)}`);
    return data.data;
}

export async function updatePurchaseInvoice(id: string, data: Partial<InvoiceRequest>): Promise<PurchaseInvoice> {
    const result = await apiPut<{ data: PurchaseInvoice }>(`/purchases/invoices/${encodeURIComponent(id)}`, data);
    return result.data;
}

export async function deletePurchaseInvoice(id: string): Promise<void> {
    await apiDelete(`/purchases/invoices/${encodeURIComponent(id)}`);
}

export async function deletePurchaseOrder(id: string): Promise<void> {
    await apiDelete(`/purchases/orders/${encodeURIComponent(id)}`);
}
