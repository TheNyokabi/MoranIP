/**
 * API Route Constants
 * 
 * Centralized route definitions for consistent API calls across the application.
 * All routes automatically include tenant context when needed.
 */

// ==================== Route Builders ====================

/**
 * Build a tenant-scoped API route
 */
export function buildTenantRoute(tenantId: string, path: string): string {
  return `/tenants/${tenantId}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Build an ERP module route (goes through ERPNext/Odoo)
 */
export function buildErpRoute(tenantId: string, module: string, path: string = ''): string {
  return `/tenants/${tenantId}/erp/${module}${path ? (path.startsWith('/') ? path : `/${path}`) : ''}`
}

/**
 * Build a navigation route for the frontend
 */
export function buildNavRoute(tenantSlug: string, path: string): string {
  return `/w/${tenantSlug}${path.startsWith('/') ? path : `/${path}`}`
}

// ==================== Module Route Factories ====================

/**
 * Inventory module routes
 */
export const inventoryRoutes = (tenantId: string) => ({
  items: () => buildErpRoute(tenantId, 'inventory', '/items'),
  item: (itemCode: string) => buildErpRoute(tenantId, 'inventory', `/items/${itemCode}`),
  warehouses: () => buildErpRoute(tenantId, 'inventory', '/warehouses'),
  warehouse: (name: string) => buildErpRoute(tenantId, 'inventory', `/warehouses/${name}`),
  stock: () => buildErpRoute(tenantId, 'inventory', '/stock'),
  stockEntry: () => buildErpRoute(tenantId, 'inventory', '/stock-entry'),
  stockLedger: () => buildErpRoute(tenantId, 'inventory', '/stock-ledger'),
  bins: () => buildErpRoute(tenantId, 'inventory', '/bins'),
})

/**
 * POS module routes
 */
export const posRoutes = (tenantId: string) => ({
  items: () => buildErpRoute(tenantId, 'pos', '/items'),
  item: (itemCode: string) => buildErpRoute(tenantId, 'pos', `/items/${itemCode}`),
  profiles: () => buildErpRoute(tenantId, 'pos', '/profiles'),
  profile: (id: string) => buildErpRoute(tenantId, 'pos', `/profiles/${id}`),
  invoice: () => buildErpRoute(tenantId, 'pos', '/invoice'),
  invoices: () => buildErpRoute(tenantId, 'pos', '/invoices'),
  customers: () => buildErpRoute(tenantId, 'pos', '/customers'),
  paymentModes: () => buildErpRoute(tenantId, 'pos', '/payment-modes'),
  warehouses: () => buildErpRoute(tenantId, 'pos', '/warehouses'),
  salesPersons: () => buildErpRoute(tenantId, 'pos', '/sales-persons'),
  receipts: (invoiceId: string) => buildErpRoute(tenantId, 'pos', `/receipts/${invoiceId}`),
  cashSummary: () => buildErpRoute(tenantId, 'pos', '/reports/cash-summary'),
  dailySummary: () => buildErpRoute(tenantId, 'pos', '/reports/daily-summary'),
})

/**
 * Purchases module routes
 */
export const purchasesRoutes = (tenantId: string) => ({
  suppliers: () => buildErpRoute(tenantId, 'purchases', '/suppliers'),
  supplier: (name: string) => buildErpRoute(tenantId, 'purchases', `/suppliers/${name}`),
  orders: () => buildErpRoute(tenantId, 'purchases', '/orders'),
  order: (id: string) => buildErpRoute(tenantId, 'purchases', `/orders/${id}`),
  receipts: () => buildErpRoute(tenantId, 'purchases', '/receipts'),
  receipt: (id: string) => buildErpRoute(tenantId, 'purchases', `/receipts/${id}`),
  invoices: () => buildErpRoute(tenantId, 'purchases', '/invoices'),
  invoice: (id: string) => buildErpRoute(tenantId, 'purchases', `/invoices/${id}`),
})

/**
 * Sales module routes
 */
export const salesRoutes = (tenantId: string) => ({
  customers: () => buildErpRoute(tenantId, 'sales', '/customers'),
  customer: (name: string) => buildErpRoute(tenantId, 'sales', `/customers/${name}`),
  orders: () => buildErpRoute(tenantId, 'sales', '/orders'),
  order: (id: string) => buildErpRoute(tenantId, 'sales', `/orders/${id}`),
  invoices: () => buildErpRoute(tenantId, 'sales', '/invoices'),
  invoice: (id: string) => buildErpRoute(tenantId, 'sales', `/invoices/${id}`),
  quotations: () => buildErpRoute(tenantId, 'sales', '/quotations'),
  quotation: (id: string) => buildErpRoute(tenantId, 'sales', `/quotations/${id}`),
})

/**
 * Accounting module routes
 */
export const accountingRoutes = (tenantId: string) => ({
  accounts: () => buildErpRoute(tenantId, 'accounting', '/accounts'),
  account: (name: string) => buildErpRoute(tenantId, 'accounting', `/accounts/${name}`),
  journalEntries: () => buildErpRoute(tenantId, 'accounting', '/journal-entries'),
  journalEntry: (name: string) => buildErpRoute(tenantId, 'accounting', `/journal-entries/${name}`),
  paymentEntries: () => buildErpRoute(tenantId, 'accounting', '/payment-entries'),
  paymentEntry: (name: string) => buildErpRoute(tenantId, 'accounting', `/payment-entries/${name}`),
  glEntries: () => buildErpRoute(tenantId, 'accounting', '/gl-entries'),
})

/**
 * HR module routes
 */
export const hrRoutes = (tenantId: string) => ({
  employees: () => buildErpRoute(tenantId, 'hr', '/employees'),
  employee: (id: string) => buildErpRoute(tenantId, 'hr', `/employees/${id}`),
  leaveApplications: () => buildErpRoute(tenantId, 'hr', '/leave-applications'),
  leaveApplication: (id: string) => buildErpRoute(tenantId, 'hr', `/leave-applications/${id}`),
  attendances: () => buildErpRoute(tenantId, 'hr', '/attendances'),
  payroll: () => buildErpRoute(tenantId, 'hr', '/payroll'),
})

/**
 * CRM module routes
 */
export const crmRoutes = (tenantId: string) => ({
  leads: () => buildErpRoute(tenantId, 'crm', '/leads'),
  lead: (id: string) => buildErpRoute(tenantId, 'crm', `/leads/${id}`),
  opportunities: () => buildErpRoute(tenantId, 'crm', '/opportunities'),
  opportunity: (id: string) => buildErpRoute(tenantId, 'crm', `/opportunities/${id}`),
  contacts: () => buildErpRoute(tenantId, 'crm', '/contacts'),
  contact: (id: string) => buildErpRoute(tenantId, 'crm', `/contacts/${id}`),
})

/**
 * Projects module routes
 */
export const projectsRoutes = (tenantId: string) => ({
  projects: () => buildErpRoute(tenantId, 'projects', '/projects'),
  project: (name: string) => buildErpRoute(tenantId, 'projects', `/projects/${name}`),
  tasks: () => buildErpRoute(tenantId, 'projects', '/tasks'),
  task: (name: string) => buildErpRoute(tenantId, 'projects', `/tasks/${name}`),
  timesheets: () => buildErpRoute(tenantId, 'projects', '/timesheets'),
  templates: () => buildErpRoute(tenantId, 'projects', '/templates'),
})

/**
 * Manufacturing module routes
 */
export const manufacturingRoutes = (tenantId: string) => ({
  workOrders: () => buildErpRoute(tenantId, 'manufacturing', '/work-orders'),
  workOrder: (id: string) => buildErpRoute(tenantId, 'manufacturing', `/work-orders/${id}`),
  bom: () => buildErpRoute(tenantId, 'manufacturing', '/bom'),
  bomItem: (name: string) => buildErpRoute(tenantId, 'manufacturing', `/bom/${name}`),
  workCenters: () => buildErpRoute(tenantId, 'manufacturing', '/work-centers'),
  productionPlans: () => buildErpRoute(tenantId, 'manufacturing', '/production-plans'),
})

/**
 * Quality module routes
 */
export const qualityRoutes = (tenantId: string) => ({
  inspections: () => buildErpRoute(tenantId, 'quality', '/inspections'),
  inspection: (id: string) => buildErpRoute(tenantId, 'quality', `/inspections/${id}`),
  procedures: () => buildErpRoute(tenantId, 'quality', '/procedures'),
  goals: () => buildErpRoute(tenantId, 'quality', '/goals'),
  reviews: () => buildErpRoute(tenantId, 'quality', '/reviews'),
})

/**
 * Support module routes
 */
export const supportRoutes = (tenantId: string) => ({
  issues: () => buildErpRoute(tenantId, 'support', '/issues'),
  issue: (id: string) => buildErpRoute(tenantId, 'support', `/issues/${id}`),
})

/**
 * Assets module routes
 */
export const assetsRoutes = (tenantId: string) => ({
  assets: () => buildErpRoute(tenantId, 'assets', '/assets'),
  asset: (name: string) => buildErpRoute(tenantId, 'assets', `/assets/${name}`),
  categories: () => buildErpRoute(tenantId, 'assets', '/categories'),
  maintenances: () => buildErpRoute(tenantId, 'assets', '/maintenances'),
})

/**
 * Paint module routes
 */
export const paintRoutes = (tenantId: string) => ({
  colorCodes: () => buildErpRoute(tenantId, 'paint', '/color-codes'),
  colorCode: (id: string) => buildErpRoute(tenantId, 'paint', `/color-codes/${id}`),
  formulas: () => buildErpRoute(tenantId, 'paint', '/formulas'),
  formula: (id: string) => buildErpRoute(tenantId, 'paint', `/formulas/${id}`),
  sell: () => buildErpRoute(tenantId, 'paint', '/sell'),
})

// ==================== Non-Module Routes ====================

/**
 * Settings routes
 */
export const settingsRoutes = (tenantId: string) => ({
  tenant: () => buildTenantRoute(tenantId, '/settings'),
  modules: () => buildTenantRoute(tenantId, '/settings/modules'),
  branding: () => buildTenantRoute(tenantId, '/settings/branding'),
})

/**
 * Provisioning routes
 */
export const provisioningRoutes = (tenantId: string) => ({
  start: () => `/provisioning/tenants/${tenantId}/start`,
  status: () => `/provisioning/tenants/${tenantId}/status`,
  retry: () => `/provisioning/tenants/${tenantId}/retry`,
  continue: () => `/provisioning/tenants/${tenantId}/continue`,
  logs: () => `/provisioning/tenants/${tenantId}/logs`,
})

/**
 * IAM routes (not tenant-scoped)
 */
export const iamRoutes = {
  tenants: () => '/iam/tenants',
  tenant: (id: string) => `/iam/tenants/${id}`,
  tenantUsers: (id: string) => `/iam/tenants/${id}/users`,
  tenantUser: (tenantId: string, userId: string) => `/iam/tenants/${tenantId}/users/${userId}`,
  invite: (tenantId: string) => `/iam/tenants/${tenantId}/invite`,
  createUser: (tenantId: string) => `/iam/tenants/${tenantId}/users/create`,
}

/**
 * Auth routes (not tenant-scoped)
 */
export const authRoutes = {
  login: () => '/auth/login',
  loginWithTenant: () => '/auth/v1/login-with-tenant',
  memberships: () => '/auth/me/memberships',
  engineHealth: () => '/auth/engine-health',
}

// ==================== Navigation Routes ====================

/**
 * Frontend navigation route builders
 */
export const navRoutes = (tenantSlug: string) => ({
  // Dashboard
  dashboard: () => buildNavRoute(tenantSlug, ''),
  
  // Core modules
  pos: () => buildNavRoute(tenantSlug, '/pos'),
  inventory: () => buildNavRoute(tenantSlug, '/inventory'),
  sales: () => buildNavRoute(tenantSlug, '/sales'),
  purchases: () => buildNavRoute(tenantSlug, '/purchasing'),
  
  // Financial
  finance: () => buildNavRoute(tenantSlug, '/finance'),
  accounting: () => buildNavRoute(tenantSlug, '/modules/accounting'),
  
  // Operations
  hr: () => buildNavRoute(tenantSlug, '/hr'),
  hrEmployees: () => buildNavRoute(tenantSlug, '/hr/employees'),
  projects: () => buildNavRoute(tenantSlug, '/projects'),
  manufacturing: () => buildNavRoute(tenantSlug, '/manufacturing'),
  quality: () => buildNavRoute(tenantSlug, '/quality'),
  assets: () => buildNavRoute(tenantSlug, '/assets'),
  support: () => buildNavRoute(tenantSlug, '/support'),
  
  // CRM
  crm: () => buildNavRoute(tenantSlug, '/crm'),
  
  // Settings
  settings: () => buildNavRoute(tenantSlug, '/settings'),
  settingsMembers: () => buildNavRoute(tenantSlug, '/settings/members'),
  settingsMasterData: () => buildNavRoute(tenantSlug, '/settings/master-data'),
  
  // Reports
  reports: () => buildNavRoute(tenantSlug, '/reports'),
})

// ==================== All Routes Combined ====================

/**
 * Get all API routes for a tenant
 */
export function getApiRoutes(tenantId: string) {
  return {
    inventory: inventoryRoutes(tenantId),
    pos: posRoutes(tenantId),
    purchases: purchasesRoutes(tenantId),
    sales: salesRoutes(tenantId),
    accounting: accountingRoutes(tenantId),
    hr: hrRoutes(tenantId),
    crm: crmRoutes(tenantId),
    projects: projectsRoutes(tenantId),
    manufacturing: manufacturingRoutes(tenantId),
    quality: qualityRoutes(tenantId),
    support: supportRoutes(tenantId),
    assets: assetsRoutes(tenantId),
    paint: paintRoutes(tenantId),
    settings: settingsRoutes(tenantId),
    provisioning: provisioningRoutes(tenantId),
  }
}

/**
 * Get all navigation routes for a tenant
 */
export function getNavRoutes(tenantSlug: string) {
  return navRoutes(tenantSlug)
}
