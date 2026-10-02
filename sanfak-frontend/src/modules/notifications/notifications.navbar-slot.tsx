import { Component, lazy, Suspense, useEffect, useId, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Popover, Skeleton } from 'antd';
import { useSessionStore } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { Alert } from '@/shared/ui';
import { notifKeys, useNotificationSocketSync } from './api/queries';
import { NOTIF_BELL_ENABLED } from './lib/config';
import { NotificationBell } from './ui/notification-bell';
import { Panel } from './ui/notification-panel/style';

const NotificationPanel = lazy(() => import('./ui/notification-panel'));

function PanelSkeleton() {
  return (
    <Panel>
      <Skeleton active avatar paragraph={{ rows: 3 }} title={false} />
    </Panel>
  );
}

function PanelErrorFallback() {
  const { t } = useTranslation();
  return (
    <Panel>
      <Alert type="error" showIcon message={t('notif.error.title', { defaultValue: 'Bildirishnomalar yuklanmadi' })} />
    </Panel>
  );
}

class PanelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Notification panel crashed:', error, info.componentStack);
  }
  override render() {
    return this.state.failed ? <PanelErrorFallback /> : this.props.children;
  }
}

export function NotificationBellSlot() {
  if (!NOTIF_BELL_ENABLED) return null;
  return <BellSlotInner />;
}

function BellSlotInner() {
  const user = useSessionStore((s) => s.user);
  const queryClient = useQueryClient();
  const panelId = useId();
  const bellRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useNotificationSocketSync(!!user);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!user) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void queryClient.invalidateQueries({ queryKey: notifKeys.feedRoot });
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
      content={
        <PanelBoundary>
          <Suspense fallback={<PanelSkeleton />}>
            <NotificationPanel onClose={() => setOpen(false)} panelId={panelId} bellRef={bellRef} />
          </Suspense>
        </PanelBoundary>
      }
    >
      <NotificationBell ref={bellRef} open={open} panelId={panelId} />
    </Popover>
  );
}
