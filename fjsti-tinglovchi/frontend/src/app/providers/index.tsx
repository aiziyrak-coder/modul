import { useEffect, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, setUnauthorizedHandler } from '@/shared/api';
import { buildTheme, useThemeStore } from '@/shared/ui';
import { logout } from '@/app/session';

export function AppProviders({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      if (window.location.pathname !== '/login') window.location.replace('/login');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={buildTheme(mode)}>
          <AntApp>{children}</AntApp>
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
