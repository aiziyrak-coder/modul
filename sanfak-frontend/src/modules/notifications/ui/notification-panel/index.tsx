import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { App, Button } from '@/shared/ui';
import { useFeed, useMarkAllRead, useMarkRead, useUnreadCount } from '../../api/queries';
import { resolveLinkPermission } from '../../lib/resolve-link-permission';
import { useOnline } from '../../lib/use-online';
import type { NotificationVM } from '../../model/types';
import { FeedEmpty, FeedError, FeedLoading, FeedOffline } from '../feed-states';
import NotificationItem from '../notification-item';
import { Footer, Header, List, OfflineWrap, Panel, StateWrap, Title } from './style';

export interface NotificationPanelProps {
  onClose: () => void;
  panelId: string;
  bellRef: RefObject<HTMLButtonElement>;
}

const PANEL_LIMIT = 5;

export default function NotificationPanel({ onClose, panelId, bellRef }: NotificationPanelProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();
  const online = useOnline();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const feed = useFeed({}, 1, PANEL_LIMIT);
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = feed.data?.docs ?? [];
  const unreadCount = unread.isError ? 0 : (unread.data ?? 0);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      bellRef.current?.focus();
    }
  };

  const handleOpen = (notification: NotificationVM) => {
    if (!notification.read) {
      markRead.mutate(notification.id, {
        onError: (e) => message.error(getApiErrorMessage(e)),
      });
    }
    if (notification.safeLink) {
      const requiredPermission = resolveLinkPermission(notification.safeLink);
      if (!requiredPermission || can(requiredPermission)) {
        onClose();
        navigate(notification.safeLink);
        return;
      }
      message.info(t('notif.noPermission', { defaultValue: "Ushbu havolani ochish uchun ruxsatingiz yo'q" }));
      return;
    }
    message.info(t('notif.noLink', { defaultValue: 'Havola mavjud emas' }));
  };

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onError: (e) => message.error(getApiErrorMessage(e)),
    });
  };

  return (
    <Panel role="dialog" aria-modal={false} id={panelId} aria-labelledby={`${panelId}-title`} onKeyDown={handleKeyDown}>
      <Header>
        <Title ref={titleRef} id={`${panelId}-title`} tabIndex={-1}>
          {t('notif.title', { defaultValue: 'Bildirishnomalar' })}
        </Title>
        {unreadCount > 0 ? (
          <Button type="link" size="small" loading={markAllRead.isPending} onClick={handleMarkAll}>
            {t('notif.markAll', { defaultValue: "Barchasini o'qilgan deb belgilash" })}
          </Button>
        ) : null}
      </Header>

      {!online ? (
        <OfflineWrap>
          <FeedOffline lastUpdated={feed.dataUpdatedAt ? new Date(feed.dataUpdatedAt) : null} />
        </OfflineWrap>
      ) : null}

      {feed.isLoading ? (
        <StateWrap>
          <FeedLoading rows={3} />
        </StateWrap>
      ) : feed.isError ? (
        <StateWrap>
          <FeedError onRetry={() => void feed.refetch()} />
        </StateWrap>
      ) : items.length === 0 ? (
        <StateWrap>
          <FeedEmpty />
        </StateWrap>
      ) : (
        <List>
          {items.map((item) => (
            <NotificationItem key={item.id} notification={item} variant="compact" onOpen={handleOpen} />
          ))}
        </List>
      )}

      <Footer>
        <Button
          type="primary"
          size="large"
          block
          onClick={() => {
            onClose();
            navigate('/bildirishnomalar');
          }}
        >
          {t('notif.viewAll', { defaultValue: "Barchasini ko'rish" })}
        </Button>
      </Footer>
    </Panel>
  );
}
