import { create } from 'zustand';
import { api } from '@/lib/api';

export interface ERPModule {
    code: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    is_enabled: boolean;
    configuration?: any;
    enabled_at?: string;
}

interface ERPStore {
    modules: ERPModule[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchModules: (tenantId: string) => Promise<void>;
    enableModule: (tenantId: string, moduleCode: string) => Promise<void>;
    disableModule: (tenantId: string, moduleCode: string) => Promise<void>;
    configureModule: (tenantId: string, moduleCode: string, config: any) => Promise<void>;
    setupERP: (tenantId: string) => Promise<void>;
}

export const useERPStore = create<ERPStore>((set, get) => ({
    modules: [],
    isLoading: false,
    error: null,

    fetchModules: async (tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get(`/iam/tenants/${tenantId}/erp/modules`);
            set({ modules: response.data.modules, isLoading: false });
        } catch (error) {
            set({ error: 'Failed to fetch ERP modules', isLoading: false });
            console.error(error);
        }
    },

    enableModule: async (tenantId: string, moduleCode: string) => {
        try {
            const response = await api.post(`/iam/tenants/${tenantId}/erp/modules`, {
                module_code: moduleCode
            });

            // Update local state
            set(state => ({
                modules: state.modules.map(m =>
                    m.code === moduleCode
                        ? { ...m, is_enabled: true, enabled_at: response.data.module.enabled_at }
                        : m
                )
            }));
        } catch (error) {
            console.error('Failed to enable module:', error);
            throw error;
        }
    },

    disableModule: async (tenantId: string, moduleCode: string) => {
        try {
            await api.delete(`/iam/tenants/${tenantId}/erp/modules/${moduleCode}`);

            // Update local state
            set(state => ({
                modules: state.modules.map(m =>
                    m.code === moduleCode
                        ? { ...m, is_enabled: false, enabled_at: undefined }
                        : m
                )
            }));
        } catch (error) {
            console.error('Failed to disable module:', error);
            throw error;
        }
    },

    configureModule: async (tenantId: string, moduleCode: string, config: any) => {
        try {
            const response = await api.patch(`/iam/tenants/${tenantId}/erp/modules/${moduleCode}/configure`, config);

            // Update local state
            set(state => ({
                modules: state.modules.map(m =>
                    m.code === moduleCode
                        ? { ...m, configuration: response.data.module.configuration }
                        : m
                )
            }));
        } catch (error) {
            console.error('Failed to configure module:', error);
            throw error;
        }
    },

    setupERP: async (tenantId: string) => {
        try {
            await api.post(`/iam/tenants/${tenantId}/erp/setup`);
        } catch (error) {
            console.error('Failed to setup ERP:', error);
            throw error;
        }
    }
}));
