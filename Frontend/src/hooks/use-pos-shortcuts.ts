'use client';

import { useCallback, useEffect, useState } from 'react';

export interface POSShortcut {
  key: string;
  description: string;
  action: () => void;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

interface UsePOSShortcutsOptions {
  enabled?: boolean;
  onNewSale?: () => void;
  onHoldSale?: () => void;
  onRetrieveHeld?: () => void;
  onSelectCustomer?: () => void;
  onApplyDiscount?: () => void;
  onOpenDrawer?: () => void;
  onCompleteSale?: () => void;
  onEndSession?: () => void;
  onFocusSearch?: () => void;
  onToggleHelp?: () => void;
  onIncreaseQty?: () => void;
  onDecreaseQty?: () => void;
  onClearCart?: () => void;
  onOpenScanner?: () => void;
}

export function usePOSShortcuts({
  enabled = true,
  onNewSale,
  onHoldSale,
  onRetrieveHeld,
  onSelectCustomer,
  onApplyDiscount,
  onOpenDrawer,
  onCompleteSale,
  onEndSession,
  onFocusSearch,
  onToggleHelp,
  onIncreaseQty,
  onDecreaseQty,
  onClearCart,
  onOpenScanner,
}: UsePOSShortcutsOptions) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    const isInputField = 
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable;

    // Allow some shortcuts even in input fields
    const allowInInput = ['Escape', 'F1', 'F2', 'F3', 'F10', 'F12'];
    
    if (isInputField && !allowInInput.includes(event.key)) {
      // Only allow / to focus search from outside inputs
      if (event.key === '/' && !isInputField) {
        event.preventDefault();
        onFocusSearch?.();
      }
      return;
    }

    // Handle shortcuts
    switch (event.key) {
      case 'F1':
        event.preventDefault();
        onNewSale?.();
        break;

      case 'F2':
        event.preventDefault();
        onHoldSale?.();
        break;

      case 'F3':
        event.preventDefault();
        onRetrieveHeld?.();
        break;

      case 'F4':
        event.preventDefault();
        onSelectCustomer?.();
        break;

      case 'F5':
        event.preventDefault();
        onApplyDiscount?.();
        break;

      case 'F8':
        event.preventDefault();
        onOpenDrawer?.();
        break;

      case 'F10':
        event.preventDefault();
        onCompleteSale?.();
        break;

      case 'F12':
        event.preventDefault();
        onEndSession?.();
        break;

      case '/':
        event.preventDefault();
        onFocusSearch?.();
        break;

      case '?':
        if (event.shiftKey) {
          event.preventDefault();
          setShowHelp(prev => !prev);
          onToggleHelp?.();
        }
        break;

      case '+':
      case '=':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          onIncreaseQty?.();
        }
        break;

      case '-':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          onDecreaseQty?.();
        }
        break;

      case 'Escape':
        event.preventDefault();
        if (showHelp) {
          setShowHelp(false);
        }
        break;

      case 'Delete':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onClearCart?.();
        }
        break;

      case 'b':
      case 'B':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onOpenScanner?.();
        }
        break;

      default:
        break;
    }
  }, [
    enabled,
    showHelp,
    onNewSale,
    onHoldSale,
    onRetrieveHeld,
    onSelectCustomer,
    onApplyDiscount,
    onOpenDrawer,
    onCompleteSale,
    onEndSession,
    onFocusSearch,
    onToggleHelp,
    onIncreaseQty,
    onDecreaseQty,
    onClearCart,
    onOpenScanner,
  ]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return {
    showHelp,
    setShowHelp,
  };
}

// Keyboard shortcuts reference for help modal
export const POS_SHORTCUTS: Array<{ key: string; description: string; category: string }> = [
  // Sales
  { key: 'F1', description: 'New sale (clear cart)', category: 'Sales' },
  { key: 'F2', description: 'Hold current sale', category: 'Sales' },
  { key: 'F3', description: 'Retrieve held sale', category: 'Sales' },
  { key: 'F10', description: 'Complete sale', category: 'Sales' },
  
  // Cart
  { key: '+', description: 'Increase quantity of last item', category: 'Cart' },
  { key: '-', description: 'Decrease quantity of last item', category: 'Cart' },
  { key: 'Ctrl+Delete', description: 'Clear cart', category: 'Cart' },
  
  // Customer & Discounts
  { key: 'F4', description: 'Select customer', category: 'Customer' },
  { key: 'F5', description: 'Apply discount', category: 'Customer' },
  
  // Other
  { key: '/', description: 'Focus search', category: 'Navigation' },
  { key: 'Ctrl+B', description: 'Open barcode scanner', category: 'Navigation' },
  { key: '?', description: 'Show/hide shortcuts help', category: 'Navigation' },
  { key: 'Esc', description: 'Close modals', category: 'Navigation' },
  
  // Session
  { key: 'F8', description: 'Open cash drawer', category: 'Session' },
  { key: 'F12', description: 'End session', category: 'Session' },
];

export default usePOSShortcuts;
