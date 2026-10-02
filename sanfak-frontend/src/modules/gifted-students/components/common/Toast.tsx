import { App } from '@/shared/ui';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export function useToast(): { toast: (message: string, type?: ToastType) => void } {
  const { message } = App.useApp();
  return {
    toast: (text: string, type: ToastType = 'success') => {
      message.open({ type, content: text });
    },
  };
}
