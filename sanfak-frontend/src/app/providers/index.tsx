import { useEffect, type ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import type { Locale } from 'antd/es/locale';
import enUS from 'antd/locale/en_US';
import ruRU from 'antd/locale/ru_RU';
import uzUZ from 'antd/locale/uz_UZ';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { queryClient, setUnauthorizedHandler } from '@/shared/api';
import { buildTheme, useThemeStore, ModalHost } from '@/shared/ui';
import { useTranslation, type Lang } from '@/shared/lib/i18n';
import { useSessionStore } from '@/app/session';
import { useAuth } from '@/app/auth';

const ANTD_LOCALE: Record<Lang, Locale> = {
  uz: uzUZ,
  ru: ruRU,
  en: enUS,
};

function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const clear = useSessionStore((s) => s.clear);
  const { bootstrap } = useAuth();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
      navigate('/login', { replace: true });
    });
    void bootstrap();

    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const { lang } = useTranslation();
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={buildTheme(mode)} locale={ANTD_LOCALE[lang] ?? uzUZ}>
        <AntdApp>
          <BrowserRouter>
            <AuthGate>{children}</AuthGate>
          </BrowserRouter>
          <ModalHost />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
