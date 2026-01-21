/**
 * Accounting Module API Client
 * Uses new /api/accounting path structure
 */

import { apiFetch } from '../api';

export interface Account {
    name: string;
    account_name: string;
    is_group: number;
    parent_account: string | null;
    root_type: string;
    report_type: string;
    account_type: string | null;
    balance?: number;
}

export interface GLEntry {
    name: string;
    posting_date: string;
    account: string;
    debit: number;
    credit: number;
    voucher_type: string;
    voucher_no: string;
    remarks: string;
}

export interface JournalEntry {
    name: string;
    posting_date: string;
    company: string;
    accounts: Array<{
        account: string;
        debit: number;
        credit: number;
    }>;
    total_debit: number;
    total_credit: number;
    docstatus: number;
}

export interface PaymentEntry {
    name: string;
    posting_date: string;
    party_type: string;
    party: string;
    paid_amount: number;
    received_amount: number;
    payment_type: string;
    mode_of_payment: string;
    docstatus: number;
}

export interface SalesInvoice {
    name: string;
    posting_date: string;
    customer: string;
    grand_total: number;
    outstanding_amount: number;
    status: string;
    docstatus: number;
}

export const accountingApi = {
    // GL Entries
    listGLEntries: (): Promise<{ data: GLEntry[] }> =>
        apiFetch('/api/accounting/gl-entries'),

    createGLEntry: (data: Partial<GLEntry>): Promise<{ data: GLEntry }> =>
        apiFetch('/api/accounting/gl-entries', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getGLEntry: (entryId: string): Promise<{ data: GLEntry }> =>
        apiFetch(`/api/accounting/gl-entries/${entryId}`),

    // Journal Entries
    listJournalEntries: (): Promise<{ data: JournalEntry[] }> =>
        apiFetch('/api/accounting/journal-entries'),

    createJournalEntry: (data: Partial<JournalEntry>): Promise<{ data: JournalEntry }> =>
        apiFetch('/api/accounting/journal-entries', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getJournalEntry: (name: string): Promise<{ data: JournalEntry }> =>
        apiFetch(`/api/accounting/journal-entries/${name}`),

    updateJournalEntry: (name: string, data: Partial<JournalEntry>): Promise<{ data: JournalEntry }> =>
        apiFetch(`/api/accounting/journal-entries/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    submitJournalEntry: (name: string): Promise<{ data: any }> =>
        apiFetch(`/api/accounting/journal-entries/${name}/submit`, {
            method: 'POST',
        }),

    // Payment Entries
    listPaymentEntries: (): Promise<{ data: PaymentEntry[] }> =>
        apiFetch('/api/accounting/payment-entries'),

    createPaymentEntry: (data: Partial<PaymentEntry>): Promise<{ data: PaymentEntry }> =>
        apiFetch('/api/accounting/payment-entries', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getPaymentEntry: (name: string): Promise<{ data: PaymentEntry }> =>
        apiFetch(`/api/accounting/payment-entries/${name}`),

    updatePaymentEntry: (name: string, data: Partial<PaymentEntry>): Promise<{ data: PaymentEntry }> =>
        apiFetch(`/api/accounting/payment-entries/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    submitPaymentEntry: (name: string): Promise<{ data: any }> =>
        apiFetch(`/api/accounting/payment-entries/${name}/submit`, {
            method: 'POST',
        }),

    // Accounts
    listAccounts: (): Promise<{ data: Account[] }> =>
        apiFetch('/api/accounting/accounts'),

    getAccount: (name: string): Promise<{ data: Account }> =>
        apiFetch(`/api/accounting/accounts/${name}`),

    createAccount: (data: Partial<Account>): Promise<{ data: Account }> =>
        apiFetch('/api/accounting/accounts', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateAccount: (name: string, data: Partial<Account>): Promise<{ data: Account }> =>
        apiFetch(`/api/accounting/accounts/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Chart of Accounts
    listChartOfAccounts: (): Promise<{ data: Account[] }> =>
        apiFetch('/api/accounting/chart-of-accounts'),

    // Companies
    listCompanies: (): Promise<{ data: any[] }> =>
        apiFetch('/api/accounting/companies'),

    getCompany: (name: string): Promise<{ data: any }> =>
        apiFetch(`/api/accounting/companies/${name}`),

    createCompany: (data: any): Promise<{ data: any }> =>
        apiFetch('/api/accounting/companies', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateCompany: (name: string, data: any): Promise<{ data: any }> =>
        apiFetch(`/api/accounting/companies/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Sales Invoices
    listSalesInvoices: (): Promise<{ data: SalesInvoice[] }> =>
        apiFetch('/api/accounting/sales-invoices'),

    createSalesInvoice: (data: Partial<SalesInvoice>): Promise<{ data: SalesInvoice }> =>
        apiFetch('/api/accounting/sales-invoices', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getSalesInvoice: (invoiceId: string): Promise<{ data: SalesInvoice }> =>
        apiFetch(`/api/accounting/sales-invoices/${invoiceId}`),

    updateSalesInvoice: (invoiceId: string, data: Partial<SalesInvoice>): Promise<{ data: SalesInvoice }> =>
        apiFetch(`/api/accounting/sales-invoices/${invoiceId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    submitSalesInvoice: (invoiceId: string): Promise<{ data: any }> =>
        apiFetch(`/api/accounting/sales-invoices/${invoiceId}/submit`, {
            method: 'POST',
        }),

    amendSalesInvoice: (invoiceId: string): Promise<{ data: any }> =>
        apiFetch(`/api/accounting/sales-invoices/${invoiceId}/amend`, {
            method: 'POST',
        }),
};
