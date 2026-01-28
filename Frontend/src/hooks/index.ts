/**
 * Custom Hooks Index
 * 
 * Central export for all custom hooks used in the application.
 */

// Tenant Context
export {
  useTenantContext,
  useRequiredTenantContext,
  useTenantHeaders,
  useTenantLink,
} from './use-tenant-context'

// Mobile / Responsive
export {
  useIsMobile,
  useViewport,
  useIsTouch,
  useOrientation,
  useSafeArea,
  useScrollDirection,
  useOnlineStatus,
  useKeyboardVisible,
  useLongPress,
  useSwipe,
} from './use-mobile'

// Module CRUD
export {
  useModuleCrud,
  type CrudOptions,
  type UseModuleCrudResult,
} from './use-module-crud'

// Offline Sync
export {
  useOfflineSync,
  type OfflineSyncState,
  type UseOfflineSyncResult,
} from './use-offline-sync'

// POS Keyboard Shortcuts
export {
  usePOSShortcuts,
  POS_SHORTCUTS,
  type POSShortcut,
} from './use-pos-shortcuts'
