import { create } from 'zustand';
import { useEffect } from 'react';

interface PageTitleOptions {
  back?: boolean;
}

interface PageTitleState {
  title: string;
  back: boolean;
  setTitle: (title: string, opts?: PageTitleOptions) => void;
  clearTitle: () => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  title: '',
  back: false,
  setTitle: (title: string, opts?: PageTitleOptions) =>
    set({ title, back: opts?.back ?? false }),
  clearTitle: () => set({ title: '', back: false }),
}));

export function usePageTitle(title: string, opts?: PageTitleOptions): void {
  const setTitle = usePageTitleStore((s) => s.setTitle);
  const clearTitle = usePageTitleStore((s) => s.clearTitle);

  useEffect(() => {
    if (title) {
      setTitle(title, opts);
    }
    return () => {
      clearTitle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}
