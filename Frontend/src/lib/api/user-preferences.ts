// User Preferences API Client
// Handles favorites, recent workspaces, and dashboard settings

import { apiFetch } from './core';

export interface UserPreferences {
    favorite_workspaces: string[];
    recent_workspaces: string[];
    dashboard_view_mode: 'grid' | 'list' | 'compact';
    theme: 'light' | 'dark';
    language: string;
    updated_at: string;
}

export interface UpdatePreferences {
    favorite_workspaces?: string[];
    recent_workspaces?: string[];
    dashboard_view_mode?: 'grid' | 'list' | 'compact';
    theme?: 'light' | 'dark';
    language?: string;
}

/**
 * Get current user's preferences
 */
export async function getPreferences(token?: string): Promise<UserPreferences> {
    return apiFetch<UserPreferences>('/users/preferences', {}, token);
}

/**
 * Update user preferences (partial update)
 */
export async function updatePreferences(updates: UpdatePreferences, token?: string): Promise<UserPreferences> {
    return apiFetch<UserPreferences>('/users/preferences', {
        method: 'PUT',
        body: JSON.stringify(updates),
    }, token);
}

/**
 * Toggle a workspace as favorite
 */
export async function toggleFavorite(tenantId: string, token?: string): Promise<UserPreferences> {
    return apiFetch<UserPreferences>(`/users/preferences/favorites/toggle?tenant_id=${tenantId}`, {
        method: 'POST',
    }, token);
}

/**
 * Add workspace to recent list
 */
export async function addRecent(tenantId: string, token?: string): Promise<UserPreferences> {
    return apiFetch<UserPreferences>(`/users/preferences/recents/add?tenant_id=${tenantId}`, {
        method: 'POST',
    }, token);
}

/**
 * Remove workspace from favorites
 */
export async function removeFavorite(tenantId: string, token?: string): Promise<UserPreferences> {
    return apiFetch<UserPreferences>(`/users/preferences/favorites/${tenantId}`, {
        method: 'DELETE',
    }, token);
}

/**
 * Clear all recent workspaces
 */
export async function clearRecents(token?: string): Promise<UserPreferences> {
    return apiFetch<UserPreferences>('/users/preferences/recents/clear', {
        method: 'DELETE',
    }, token);
}

// Legacy class-based API for backward compatibility
class UserPreferencesApi {
    async getPreferences(token: string): Promise<UserPreferences> {
        return getPreferences(token);
    }

    async updatePreferences(token: string, updates: UpdatePreferences): Promise<UserPreferences> {
        return updatePreferences(updates, token);
    }

    async toggleFavorite(token: string, tenantId: string): Promise<UserPreferences> {
        return toggleFavorite(tenantId, token);
    }

    async addRecent(token: string, tenantId: string): Promise<UserPreferences> {
        return addRecent(tenantId, token);
    }

    async removeFavorite(token: string, tenantId: string): Promise<UserPreferences> {
        return removeFavorite(tenantId, token);
    }

    async clearRecents(token: string): Promise<UserPreferences> {
        return clearRecents(token);
    }
}

export const userPreferencesApi = new UserPreferencesApi();
