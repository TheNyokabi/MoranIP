/**
 * Sales Module API Client
 * Uses new /api/sales path structure
 * Handles full Sales module (not just POS)
 */

import { apiFetch } from './core';

export interface Quotation {
    name: string;
    quotation_to: string;
    party_name: string;
    customer_name?: string;
    transaction_date: string;
    valid_till?: string;
    company: string;
    items: Array<{
        item_code: string;
        qty: number;
        rate: number;
    }>;
    net_total: number;
    grand_total: number;
    status: string;
    docstatus: number;
}

export interface SalesOrder {
    name: string;
    customer: string;
    transaction_date: string;
    delivery_date?: string;
    company: string;
    items: Array<{
        item_code: string;
        qty: number;
        rate: number;
    }>;
    net_total: number;
    grand_total: number;
    status: string;
    docstatus: number;
}

export interface DeliveryNote {
    name: string;
    customer: string;
    posting_date: string;
    posting_time?: string;
    company: string;
    items: Array<{
        item_code: string;
        qty: number;
        rate: number;
    }>;
    net_total: number;
    grand_total: number;
    status: string;
    docstatus: number;
}

export interface SalesInvoice {
    name: string;
    customer: string;
    posting_date: string;
    posting_time?: string;
    company: string;
    items: Array<{
        item_code: string;
        qty: number;
        rate: number;
    }>;
    net_total: number;
    grand_total: number;
    outstanding_amount: number;
    status: string;
    docstatus: number;
    is_pos: number;
}

export const salesApi = {
    // Quotations
    listQuotations: (): Promise<{ data: Quotation[] }> =>
        apiFetch('/api/sales/quotations'),

    createQuotation: (data: Partial<Quotation>): Promise<{ data: Quotation }> =>
        apiFetch('/api/sales/quotations', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getQuotation: (quotationName: string): Promise<{ data: Quotation }> =>
        apiFetch(`/api/sales/quotations/${quotationName}`),

    updateQuotation: (quotationName: string, data: Partial<Quotation>): Promise<{ data: Quotation }> =>
        apiFetch(`/api/sales/quotations/${quotationName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Sales Orders
    listOrders: (): Promise<{ data: SalesOrder[] }> =>
        apiFetch('/api/sales/orders'),

    createOrder: (data: Partial<SalesOrder>): Promise<{ data: SalesOrder }> =>
        apiFetch('/api/sales/orders', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getOrder: (orderName: string): Promise<{ data: SalesOrder }> =>
        apiFetch(`/api/sales/orders/${orderName}`),

    updateOrder: (orderName: string, data: Partial<SalesOrder>): Promise<{ data: SalesOrder }> =>
        apiFetch(`/api/sales/orders/${orderName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Delivery Notes
    listDeliveryNotes: (): Promise<{ data: DeliveryNote[] }> =>
        apiFetch('/api/sales/delivery-notes'),

    createDeliveryNote: (data: Partial<DeliveryNote>): Promise<{ data: DeliveryNote }> =>
        apiFetch('/api/sales/delivery-notes', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getDeliveryNote: (deliveryNoteName: string): Promise<{ data: DeliveryNote }> =>
        apiFetch(`/api/sales/delivery-notes/${deliveryNoteName}`),

    updateDeliveryNote: (deliveryNoteName: string, data: Partial<DeliveryNote>): Promise<{ data: DeliveryNote }> =>
        apiFetch(`/api/sales/delivery-notes/${deliveryNoteName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Sales Invoices (Non-POS)
    listInvoices: (): Promise<{ data: SalesInvoice[] }> =>
        apiFetch('/api/sales/invoices'),

    createInvoice: (data: Partial<SalesInvoice>): Promise<{ data: SalesInvoice }> =>
        apiFetch('/api/sales/invoices', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getInvoice: (invoiceName: string): Promise<{ data: SalesInvoice }> =>
        apiFetch(`/api/sales/invoices/${invoiceName}`),

    updateInvoice: (invoiceName: string, data: Partial<SalesInvoice>): Promise<{ data: SalesInvoice }> =>
        apiFetch(`/api/sales/invoices/${invoiceName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};
