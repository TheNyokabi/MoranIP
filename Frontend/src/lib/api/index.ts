/**
 * Central export for all module API clients
 * All clients use the new /api/{module} path structure
 */

export * from './core'; // Core API logic (apiFetch, authApi, etc.)
export * from './accounting';
export * from './crm';
export * from './hr';
export * from './manufacturing';
export * from './projects';
export * from './sales';
export * from './support';
export * from './assets';
export * from './quality';
export * from './permissions'; // Permissions logic

// Re-export existing clients
export * from './inventory';
export * from './purchases';
export * from './pos';
// export * from './client'; // Do NOT export client.ts directly to avoid conflict with core functions if any, unless needed. 
// Inventory uses client.ts but exports functions causing no name clash likely.
