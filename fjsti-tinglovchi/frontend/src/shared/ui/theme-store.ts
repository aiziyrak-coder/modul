import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appConfig, type ThemeMode } from '../config';

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: appConfig.ui.defaultThemeMode,
      toggle: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
      setMode: (mode) => set({ mode }),
    }),
    { name: 'platform-theme' },
  ),
);
