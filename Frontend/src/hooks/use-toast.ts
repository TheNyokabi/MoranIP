import { toast as sonnerToast } from 'sonner';

export type ToastVariant = 'default' | 'destructive';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

export function useToast() {
  const toast = ({ title, description, variant = 'default' }: ToastOptions) => {
    const message = title || '';

    if (variant === 'destructive') {
      sonnerToast.error(message || 'Error', { description });
      return;
    }

    if (message) {
      sonnerToast(message, { description });
    } else if (description) {
      sonnerToast(description);
    }
  };

  return { toast };
}
