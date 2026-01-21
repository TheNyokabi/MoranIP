/**
 * CRM Module API Client
 * Uses new /api/crm path structure
 */

import { apiFetch } from '../api';

export interface Contact {
    name: string;
    first_name: string;
    last_name?: string;
    email_id?: string;
    mobile_no?: string;
    phone?: string;
    status: string;
    salutation?: string;
    designation?: string;
    company_name?: string;
}

export interface Lead {
    name: string;
    lead_name: string;
    company_name?: string;
    email_id?: string;
    mobile_no?: string;
    status: string;
    source?: string;
    industry?: string;
}

export interface Customer {
    name: string;
    customer_name: string;
    customer_type: string;
    customer_group: string;
    territory?: string;
    email_id?: string;
    mobile_no?: string;
    status: string;
}

export interface Opportunity {
    name: string;
    opportunity_type: string;
    party_name: string;
    opportunity_from: string;
    status: string;
    probability: number;
    expected_closing?: string;
    opportunity_amount?: number;
}

export interface CustomerGroup {
    name: string;
    customer_group_name: string;
    is_group: number;
    parent_customer_group?: string;
}

export interface Territory {
    name: string;
    territory_name: string;
    is_group: number;
    parent_territory?: string;
}

export interface SalesPerson {
    name: string;
    sales_person_name: string;
    employee?: string;
    enabled: number;
}

export const crmApi = {
    // Contacts
    listContacts: (): Promise<{ data: Contact[] }> =>
        apiFetch('/api/crm/contacts'),

    createContact: (data: Partial<Contact>): Promise<{ data: Contact }> =>
        apiFetch('/api/crm/contacts', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getContact: (contactName: string): Promise<{ data: Contact }> =>
        apiFetch(`/api/crm/contacts/${contactName}`),

    updateContact: (contactName: string, data: Partial<Contact>): Promise<{ data: Contact }> =>
        apiFetch(`/api/crm/contacts/${contactName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Leads
    listLeads: (): Promise<{ data: Lead[] }> =>
        apiFetch('/api/crm/leads'),

    createLead: (data: Partial<Lead>): Promise<{ data: Lead }> =>
        apiFetch('/api/crm/leads', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getLead: (leadName: string): Promise<{ data: Lead }> =>
        apiFetch(`/api/crm/leads/${leadName}`),

    updateLead: (leadName: string, data: Partial<Lead>): Promise<{ data: Lead }> =>
        apiFetch(`/api/crm/leads/${leadName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    convertLead: (leadName: string, data: any): Promise<{ data: any }> =>
        apiFetch(`/api/crm/leads/${leadName}/convert`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Customers
    listCustomers: (): Promise<{ data: Customer[] }> =>
        apiFetch('/api/crm/customers'),

    createCustomer: (data: Partial<Customer>): Promise<{ data: Customer }> =>
        apiFetch('/api/crm/customers', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getCustomer: (customerName: string): Promise<{ data: Customer }> =>
        apiFetch(`/api/crm/customers/${customerName}`),

    updateCustomer: (customerName: string, data: Partial<Customer>): Promise<{ data: Customer }> =>
        apiFetch(`/api/crm/customers/${customerName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Opportunities
    listOpportunities: (): Promise<{ data: Opportunity[] }> =>
        apiFetch('/api/crm/opportunities'),

    createOpportunity: (data: Partial<Opportunity>): Promise<{ data: Opportunity }> =>
        apiFetch('/api/crm/opportunities', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getOpportunity: (opportunityName: string): Promise<{ data: Opportunity }> =>
        apiFetch(`/api/crm/opportunities/${opportunityName}`),

    updateOpportunity: (opportunityName: string, data: Partial<Opportunity>): Promise<{ data: Opportunity }> =>
        apiFetch(`/api/crm/opportunities/${opportunityName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Customer Groups
    listCustomerGroups: (): Promise<{ data: CustomerGroup[] }> =>
        apiFetch('/api/crm/customer-groups'),

    createCustomerGroup: (data: Partial<CustomerGroup>): Promise<{ data: CustomerGroup }> =>
        apiFetch('/api/crm/customer-groups', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getCustomerGroup: (name: string): Promise<{ data: CustomerGroup }> =>
        apiFetch(`/api/crm/customer-groups/${name}`),

    updateCustomerGroup: (name: string, data: Partial<CustomerGroup>): Promise<{ data: CustomerGroup }> =>
        apiFetch(`/api/crm/customer-groups/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Territories
    listTerritories: (): Promise<{ data: Territory[] }> =>
        apiFetch('/api/crm/territories'),

    createTerritory: (data: Partial<Territory>): Promise<{ data: Territory }> =>
        apiFetch('/api/crm/territories', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTerritory: (name: string): Promise<{ data: Territory }> =>
        apiFetch(`/api/crm/territories/${name}`),

    updateTerritory: (name: string, data: Partial<Territory>): Promise<{ data: Territory }> =>
        apiFetch(`/api/crm/territories/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Sales Persons
    listSalesPersons: (): Promise<{ data: SalesPerson[] }> =>
        apiFetch('/api/crm/sales-persons'),

    createSalesPerson: (data: Partial<SalesPerson>): Promise<{ data: SalesPerson }> =>
        apiFetch('/api/crm/sales-persons', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getSalesPerson: (name: string): Promise<{ data: SalesPerson }> =>
        apiFetch(`/api/crm/sales-persons/${name}`),

    updateSalesPerson: (name: string, data: Partial<SalesPerson>): Promise<{ data: SalesPerson }> =>
        apiFetch(`/api/crm/sales-persons/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};
