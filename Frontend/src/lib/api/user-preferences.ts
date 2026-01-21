// User Preferences API Client
// Handles favorites, recent workspaces, and dashboard settings

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

class UserPreferencesApi {
    private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

    /**
     * Get current user's preferences
     */
    async getPreferences(token: string): Promise<UserPreferences> {
        const response = await fetch(`${this.baseUrl}/api/users/preferences`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch preferences');
        }

        return response.json();
    }

    /**
     * Update user preferences (partial update)
     */
    async updatePreferences(token: string, updates: UpdatePreferences): Promise<UserPreferences> {
        const response = await fetch(`${this.baseUrl}/api/users/preferences`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            throw new Error('Failed to update preferences');
        }

        return response.json();
    }

    /**
     * Toggle a workspace as favorite
     */
    async toggleFavorite(token: string, tenantId: string): Promise<UserPreferences> {
        const response = await fetch(`${this.baseUrl}/api/users/preferences/favorites/toggle?tenant_id=${tenantId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to toggle favorite');
        }

        return response.json();
    }

    /**
     * Add workspace to recent list
     */
    async addRecent(token: string, tenantId: string): Promise<UserPreferences> {
        const response = await fetch(`${this.baseUrl}/api/users/preferences/recents/add?tenant_id=${tenantId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to add recent workspace');
        }

        return response.json();
    }

    /**
     * Remove workspace from favorites
     */
    async removeFavorite(token: string, tenantId: string): Promise<UserPreferences> {
        const response = await fetch(`${this.baseUrl}/api/users/preferences/favorites/${tenantId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to remove favorite');
        }

        return response.json();
    }

    /**
     * Clear all recent workspaces
     */
    async clearRecents(token: string): Promise<UserPreferences> {
        const response = await fetch(`${this.baseUrl}/api/users/preferences/recents/clear`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to clear recents');
        }

        return response.json();
    }
}

export const userPreferencesApi = new UserPreferencesApi();
