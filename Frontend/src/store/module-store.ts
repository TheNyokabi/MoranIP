import { create } from 'zustand';
import { moduleApis } from '@/lib/api-modules'; // Still needed for settings
import { useAuthStore } from './auth-store';

interface ModuleState {
  // CRM
  contacts: any[];
  leads: any[];
  customers: any[];
  opportunities: any[];

  // Accounting
  glEntries: any[];
  journalEntries: any[];
  paymentEntries: any[];
  accounts: any[];
  salesInvoices: any[];

  // HR
  employees: any[];
  attendance: any[];
  leave: any[];
  salaryStructures: any[];

  // Manufacturing
  boms: any[];
  workOrders: any[];
  productionPlans: any[];

  // Projects
  projects: any[];
  tasks: any[];
  timesheets: any[];

  // Settings
  tenantSettings: any | null;
  securitySettings: any | null;
  notificationSettings: any | null;

  // Loading & Error states
  loading: boolean;
  error: string | null;

  // Actions
  fetchContacts: (tenantId: string) => Promise<void>;
  fetchLeads: (tenantId: string) => Promise<void>;
  fetchCustomers: (tenantId: string) => Promise<void>;
  fetchOpportunities: (tenantId: string) => Promise<void>;
  fetchGLEntries: (tenantId: string) => Promise<void>;
  fetchJournalEntries: (tenantId: string) => Promise<void>;
  fetchPaymentEntries: (tenantId: string) => Promise<void>;
  fetchAccounts: (tenantId: string) => Promise<void>;
  fetchSalesInvoices: (tenantId: string) => Promise<void>;
  fetchEmployees: (tenantId: string) => Promise<void>;
  fetchAttendance: (tenantId: string) => Promise<void>;
  fetchLeave: (tenantId: string) => Promise<void>;
  fetchSalaryStructures: (tenantId: string) => Promise<void>;
  fetchBOMs: (tenantId: string) => Promise<void>;
  fetchWorkOrders: (tenantId: string) => Promise<void>;
  fetchProductionPlans: (tenantId: string) => Promise<void>;
  fetchProjects: (tenantId: string) => Promise<void>;
  fetchTasks: (tenantId: string) => Promise<void>;
  fetchTimesheets: (tenantId: string) => Promise<void>;
  fetchTenantSettings: (tenantId: string) => Promise<void>;
  updateTenantSettings: (tenantId: string, data: any) => Promise<void>;
  fetchSecuritySettings: (tenantId: string) => Promise<void>;
  updateSecuritySettings: (tenantId: string, data: any) => Promise<void>;
  fetchNotificationSettings: (tenantId: string) => Promise<void>;
  updateNotificationSettings: (tenantId: string, data: any) => Promise<void>;
  clearError: () => void;
}

export const useModuleStore = create<ModuleState>((set) => ({
  // Initial states
  contacts: [],
  leads: [],
  customers: [],
  opportunities: [],
  glEntries: [],
  journalEntries: [],
  paymentEntries: [],
  accounts: [],
  salesInvoices: [],
  employees: [],
  attendance: [],
  leave: [],
  salaryStructures: [],
  boms: [],
  workOrders: [],
  productionPlans: [],
  projects: [],
  tasks: [],
  timesheets: [],
  tenantSettings: null,
  securitySettings: null,
  notificationSettings: null,
  loading: false,
  error: null,

  // CRM Actions
  fetchContacts: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.crm.listContacts(tenantId);
      const contacts = response.data || [];
      set({ contacts });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchLeads: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.crm.listLeads(tenantId);
      const leads = response.data || [];
      set({ leads });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchCustomers: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.crm.listCustomers(tenantId);
      const customers = response.data || [];
      set({ customers });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchOpportunities: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.crm.listOpportunities(tenantId);
      const opportunities = response.data || [];
      set({ opportunities });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  // Accounting Actions
  fetchGLEntries: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.accounting.listGLEntries(tenantId);
      const glEntries = response.data || [];
      set({ glEntries });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchJournalEntries: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.accounting.listJournalEntries(tenantId);
      const journalEntries = response.data || [];
      set({ journalEntries });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchPaymentEntries: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.accounting.listPaymentEntries(tenantId);
      const paymentEntries = response.data || [];
      set({ paymentEntries });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAccounts: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.accounting.listAccounts(tenantId);
      const accounts = response.data || [];
      set({ accounts });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchSalesInvoices: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.accounting.listSalesInvoices(tenantId);
      const salesInvoices = response.data || [];
      set({ salesInvoices });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  // HR Actions
  fetchEmployees: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.hr.listEmployees(tenantId);
      const employees = response.data || [];
      set({ employees });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAttendance: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.hr.listAttendance(tenantId);
      const attendance = response.data || [];
      set({ attendance });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchLeave: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.hr.listLeave(tenantId);
      const leave = response.data || [];
      set({ leave });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchSalaryStructures: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.hr.listSalaryStructure(tenantId);
      const salaryStructures = response.data || [];
      set({ salaryStructures });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  // Manufacturing Actions
  fetchBOMs: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.manufacturing.listBOM(tenantId);
      const boms = response.data || [];
      set({ boms });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchWorkOrders: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.manufacturing.listWorkOrder(tenantId);
      const workOrders = response.data || [];
      set({ workOrders });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchProductionPlans: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.manufacturing.listProductionPlan(tenantId);
      const productionPlans = response.data || [];
      set({ productionPlans });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  // Projects Actions
  fetchProjects: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.projects.listProjects(tenantId);
      const projects = response.data || [];
      set({ projects });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchTasks: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.projects.listTasks(tenantId);
      const tasks = response.data || [];
      set({ tasks });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchTimesheets: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await moduleApis.projects.listTimesheets(tenantId);
      const timesheets = response.data || [];
      set({ timesheets });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  // Settings Actions
  fetchTenantSettings: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await moduleApis.settings.getTenantSettings(tenantId, token || undefined);
      // Response format: { data: { data: settings } } from api.get wrapper
      // Backend returns: { data: settings }
      // So we need to unwrap: response.data is the backend response, response.data.data is the settings
      const settings = response?.data?.data || response?.data || null;
      set({ tenantSettings: settings });
    } catch (error: any) {
      const errorMessage = error?.message || error?.detail || 'Failed to fetch settings';
      set({ error: errorMessage });
      console.error('Error fetching tenant settings:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateTenantSettings: async (tenantId: string, data: any) => {
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await moduleApis.settings.patchTenantSettings(tenantId, data, token || undefined);
      // api.patch returns { data: backendResponse }
      // backendResponse is { data: settings }
      // So response.data = { data: settings }, and response.data.data = settings
      const settings = response?.data?.data || response?.data || null;
      set({ tenantSettings: settings, loading: false });
      return settings;
    } catch (error: any) {
      const errorMessage = error?.message || error?.detail?.message || error?.detail || 'Failed to update settings';
      set({ error: errorMessage, loading: false });
      console.error('Error updating tenant settings:', error);
      throw new Error(errorMessage); // Re-throw for component to handle with proper message
    }
  },

  // Security Settings Actions
  fetchSecuritySettings: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await moduleApis.settings.getSecuritySettings(tenantId, token || undefined);
      const settings = response?.data?.data || response?.data || null;
      set({ securitySettings: settings });
    } catch (error: any) {
      const errorMessage = error?.message || error?.detail || 'Failed to fetch security settings';
      set({ error: errorMessage });
      console.error('Error fetching security settings:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateSecuritySettings: async (tenantId: string, data: any) => {
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await moduleApis.settings.patchSecuritySettings(tenantId, data, token || undefined);
      const settings = response?.data?.data || response?.data || null;
      set({ securitySettings: settings, loading: false });
      return settings;
    } catch (error: any) {
      const errorMessage = error?.message || error?.detail?.message || error?.detail || 'Failed to update security settings';
      set({ error: errorMessage, loading: false });
      console.error('Error updating security settings:', error);
      throw new Error(errorMessage);
    }
  },

  // Notification Settings Actions
  fetchNotificationSettings: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await moduleApis.settings.getNotificationSettings(tenantId, token || undefined);
      const settings = response?.data?.data || response?.data || null;
      set({ notificationSettings: settings });
    } catch (error: any) {
      const errorMessage = error?.message || error?.detail || 'Failed to fetch notification settings';
      set({ error: errorMessage });
      console.error('Error fetching notification settings:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateNotificationSettings: async (tenantId: string, data: any) => {
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await moduleApis.settings.patchNotificationSettings(tenantId, data, token || undefined);
      const settings = response?.data?.data || response?.data || null;
      set({ notificationSettings: settings, loading: false });
      return settings;
    } catch (error: any) {
      const errorMessage = error?.message || error?.detail?.message || error?.detail || 'Failed to update notification settings';
      set({ error: errorMessage, loading: false });
      console.error('Error updating notification settings:', error);
      throw new Error(errorMessage);
    }
  },

  // Utility
  clearError: () => set({ error: null }),
}));
