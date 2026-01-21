/**
 * Central export for all module API clients
 * All clients use the new /api/{module} path structure
 */

export * from './accounting';
export * from './crm';
export * from './hr';
export * from './manufacturing';
export * from './projects';
export * from './sales';
export * from './support';
export * from './assets';
export * from './quality';

// Re-export existing clients
export * from './inventory';
export * from './purchases';
export * from './pos';
