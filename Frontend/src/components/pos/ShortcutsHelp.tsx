'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POS_SHORTCUTS } from '@/hooks/use-pos-shortcuts';
import { cn } from '@/lib/utils';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  // Group shortcuts by category
  const groupedShortcuts = React.useMemo(() => {
    const groups: Record<string, typeof POS_SHORTCUTS> = {};
    POS_SHORTCUTS.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    return groups;
  }, []);

  const categoryOrder = ['Sales', 'Cart', 'Customer', 'Navigation', 'Session'];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[80vh] overflow-hidden"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Keyboard className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
                    <p className="text-sm text-zinc-400">Quick access to POS functions</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categoryOrder.map(category => {
                    const shortcuts = groupedShortcuts[category];
                    if (!shortcuts) return null;

                    return (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-emerald-400 mb-3">
                          {category}
                        </h3>
                        <div className="space-y-2">
                          {shortcuts.map(shortcut => (
                            <div
                              key={shortcut.key}
                              className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                            >
                              <span className="text-sm text-zinc-300">
                                {shortcut.description}
                              </span>
                              <KeyBadge keys={shortcut.key} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
                <p className="text-xs text-zinc-500 text-center">
                  Press <KeyBadge keys="?" /> anytime to show/hide this help
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Key badge component
function KeyBadge({ keys }: { keys: string }) {
  const keyParts = keys.split('+');
  
  return (
    <div className="flex items-center gap-1">
      {keyParts.map((key, index) => (
        <React.Fragment key={key}>
          <kbd className={cn(
            "px-2 py-1 text-xs font-mono font-medium rounded",
            "bg-zinc-700 text-zinc-200 border border-zinc-600",
            "shadow-[0_2px_0_0_rgb(63_63_70)]"
          )}>
            {key}
          </kbd>
          {index < keyParts.length - 1 && (
            <span className="text-zinc-500 text-xs">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ShortcutsHelp;
