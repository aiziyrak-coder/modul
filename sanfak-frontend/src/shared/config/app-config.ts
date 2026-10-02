export type ThemeMode = 'light' | 'dark';

export interface AppConfig {
  appName: string;
  apiUrl: string;
  ui: {
    primaryColor: string;
    defaultThemeMode: ThemeMode;
  };
}

const env = import.meta.env;

export const appConfig: AppConfig = {
  appName: env.VITE_APP_NAME ?? 'Farg‘ona jamoat salomatligi tibbiyot instituti',
  apiUrl: env.VITE_API_URL ?? 'http://localhost:4000/api',
  ui: {
    primaryColor: env.VITE_PRIMARY_COLOR || '#34C18C',
    defaultThemeMode: (env.VITE_THEME_MODE as ThemeMode) ?? 'light',
  },
};
