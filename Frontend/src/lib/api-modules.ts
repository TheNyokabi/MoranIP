/**
 * API client for new module endpoints
 * Handles accounting, CRM, HR, manufacturing, and projects modules
 */

import { api } from './api';

export const moduleApis = {
  // ==================== ACCOUNTING ====================
  accounting: {
    // GL Entries
    listGLEntries: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/gl-entries`),
    createGLEntry: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/accounting/gl-entries`, data),
    getGLEntry: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/gl-entries/${name}`),

    // Journal Entries
    listJournalEntries: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/journal-entries`),
    createJournalEntry: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/accounting/journal-entries`, data),
    getJournalEntry: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/journal-entries/${name}`),

    // Payment Entries
    listPaymentEntries: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/payment-entries`),
    createPaymentEntry: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/accounting/payment-entries`, data),
    getPaymentEntry: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/payment-entries/${name}`),

    // Accounts
    listAccounts: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/accounts`),
    getAccount: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/accounts/${name}`),

    // Sales Invoices
    listSalesInvoices: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/sales-invoices`),
    createSalesInvoice: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/accounting/sales-invoices`, data),
    getSalesInvoice: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/accounting/sales-invoices/${name}`),
  },

  // ==================== CRM ====================
  crm: {
    // Contacts
    listContacts: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/contacts`),
    createContact: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/crm/contacts`, data),
    getContact: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/contacts/${name}`),
    updateContact: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/crm/contacts/${name}`, data),

    // Leads
    listLeads: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/leads`),
    createLead: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/crm/leads`, data),
    getLead: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/leads/${name}`),
    updateLead: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/crm/leads/${name}`, data),

    // Customers
    listCustomers: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/customers`),
    createCustomer: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/crm/customers`, data),
    getCustomer: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/customers/${name}`),
    updateCustomer: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/crm/customers/${name}`, data),

    // Opportunities
    listOpportunities: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/opportunities`),
    createOpportunity: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/crm/opportunities`, data),
    getOpportunity: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/crm/opportunities/${name}`),
    updateOpportunity: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/crm/opportunities/${name}`, data),
  },

  // ==================== HR ====================
  hr: {
    // Employees
    listEmployees: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/hr/employees`),
    createEmployee: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/hr/employees`, data),
    getEmployee: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/hr/employees/${name}`),
    updateEmployee: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/hr/employees/${name}`, data),

    // Attendance
    listAttendance: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/hr/attendance`),
    createAttendance: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/hr/attendance`, data),

    // Leave
    listLeave: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/hr/leave`),
    createLeave: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/hr/leave`, data),

    // Salary Structure
    listSalaryStructure: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/hr/salary-structure`),
    getSalaryStructure: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/hr/salary-structure/${name}`),
  },

  // ==================== MANUFACTURING ====================
  manufacturing: {
    // BOM
    listBOM: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/manufacturing/bom`),
    createBOM: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/manufacturing/bom`, data),
    getBOM: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/manufacturing/bom/${name}`),
    updateBOM: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/manufacturing/bom/${name}`, data),

    // Work Order
    listWorkOrder: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/manufacturing/work-order`),
    createWorkOrder: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/manufacturing/work-order`, data),
    getWorkOrder: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/manufacturing/work-order/${name}`),
    updateWorkOrder: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/manufacturing/work-order/${name}`, data),

    // Production Plan
    listProductionPlan: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/manufacturing/production-plan`),
    createProductionPlan: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/manufacturing/production-plan`, data),
    getProductionPlan: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/manufacturing/production-plan/${name}`),
  },

  // ==================== PROJECTS ====================
  projects: {
    // Projects
    listProjects: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/projects/projects`),
    createProject: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/projects/projects`, data),
    getProject: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/projects/projects/${name}`),
    updateProject: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/projects/projects/${name}`, data),

    // Tasks
    listTasks: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/projects/tasks`),
    createTask: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/projects/tasks`, data),
    getTask: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/projects/tasks/${name}`),
    updateTask: (tenantId: string, name: string, data: any) =>
      api.put(`/tenants/${tenantId}/erp/projects/tasks/${name}`, data),

    // Timesheets
    listTimesheets: (tenantId: string) =>
      api.get(`/tenants/${tenantId}/erp/projects/timesheets`),
    createTimesheet: (tenantId: string, data: any) =>
      api.post(`/tenants/${tenantId}/erp/projects/timesheets`, data),
    getTimesheet: (tenantId: string, name: string) =>
      api.get(`/tenants/${tenantId}/erp/projects/timesheets/${name}`),
  },

  // ==================== INVENTORY ====================
  inventory: {
    // Items
    listItems: (tenantId: string, params?: { item_group?: string; is_stock_item?: number; disabled?: number; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.item_group) queryParams.append('item_group', params.item_group);
      if (params?.is_stock_item !== undefined) queryParams.append('is_stock_item', params.is_stock_item.toString());
      if (params?.disabled !== undefined) queryParams.append('disabled', params.disabled.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      const query = queryParams.toString();
      return api.get(`/api/tenants/${tenantId}/erp/inventory/items${query ? `?${query}` : ''}`);
    },
    createItem: (tenantId: string, data: any) =>
      api.post(`/api/tenants/${tenantId}/erp/inventory/items`, data),
    getItem: (tenantId: string, itemCode: string) =>
      api.get(`/api/tenants/${tenantId}/erp/inventory/items/${encodeURIComponent(itemCode)}`),
    updateItem: (tenantId: string, itemCode: string, data: any) =>
      api.put(`/api/tenants/${tenantId}/erp/inventory/items/${encodeURIComponent(itemCode)}`, data),
    deleteItem: (tenantId: string, itemCode: string) =>
      api.delete(`/api/tenants/${tenantId}/erp/inventory/items/${encodeURIComponent(itemCode)}`),

    // Warehouses (company is auto-resolved from tenant context)
    listWarehouses: (tenantId: string, params?: { is_group?: number; company?: string; disabled?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.is_group !== undefined) queryParams.append('is_group', params.is_group.toString());
      if (params?.company) queryParams.append('company', params.company);
      if (params?.disabled !== undefined) queryParams.append('disabled', params.disabled.toString());
      const query = queryParams.toString();
      return api.get(`/api/tenants/${tenantId}/erp/inventory/warehouses${query ? `?${query}` : ''}`);
    },
    createWarehouse: (tenantId: string, data: any) =>
      api.post(`/api/tenants/${tenantId}/erp/inventory/warehouses`, data),
    getWarehouse: (tenantId: string, warehouseName: string) =>
      api.get(`/api/tenants/${tenantId}/erp/inventory/warehouses/${encodeURIComponent(warehouseName)}`),
    updateWarehouse: (tenantId: string, warehouseName: string, data: any) =>
      api.put(`/api/tenants/${tenantId}/erp/inventory/warehouses/${encodeURIComponent(warehouseName)}`, data),

    // Stock Entries
    listStockEntries: (tenantId: string, params?: { stock_entry_type?: string; from_date?: string; to_date?: string; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.stock_entry_type) queryParams.append('stock_entry_type', params.stock_entry_type);
      if (params?.from_date) queryParams.append('from_date', params.from_date);
      if (params?.to_date) queryParams.append('to_date', params.to_date);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      const query = queryParams.toString();
      return api.get(`/api/tenants/${tenantId}/erp/inventory/stock-entries${query ? `?${query}` : ''}`);
    },
    createStockEntry: (tenantId: string, data: any) =>
      api.post(`/api/tenants/${tenantId}/erp/inventory/stock-entries`, data),

    // Stock Balance
    getStockBalance: (tenantId: string, params?: { item_code?: string; warehouse?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.item_code) queryParams.append('item_code', params.item_code);
      if (params?.warehouse) queryParams.append('warehouse', params.warehouse);
      const query = queryParams.toString();
      return api.get(`/api/tenants/${tenantId}/erp/inventory/stock-balance${query ? `?${query}` : ''}`);
    },

    // Stock Reconciliation
    createStockReconciliation: (tenantId: string, data: any) =>
      api.post(`/api/tenants/${tenantId}/erp/inventory/stock-reconciliations`, data),
  },

  // ==================== SETTINGS ====================
  settings: {
    getTenantSettings: (tenantId: string, token?: string) =>
      api.get(`/api/settings/tenant`, token),
    updateTenantSettings: (tenantId: string, data: any, token?: string) =>
      api.post(`/api/settings/tenant`, data, token),
    patchTenantSettings: (tenantId: string, data: any, token?: string) =>
      api.patch(`/api/settings/tenant`, data, token),
    // Security Settings
    getSecuritySettings: (tenantId: string, token?: string) =>
      api.get(`/api/settings/security`, token),
    patchSecuritySettings: (tenantId: string, data: any, token?: string) =>
      api.patch(`/api/settings/security`, data, token),
    // Notification Settings
    getNotificationSettings: (tenantId: string, token?: string) =>
      api.get(`/api/settings/notifications`, token),
    patchNotificationSettings: (tenantId: string, data: any, token?: string) =>
      api.patch(`/api/settings/notifications`, data, token),
  },

  // ==================== POS ENHANCEMENTS ====================
  pos: {
    getSessionSummary: (tenantId: string, sessionId: string) =>
      api.get(`/tenants/${tenantId}/erp/pos/sessions/${sessionId}/summary`),
  },
};
