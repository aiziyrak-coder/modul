import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { Badge, theme } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';
import { useUnreadCount } from '../../api/queries';
import { useOnline } from '../../lib/use-online';
import { BellButton } from './style';

export interface NotificationBellProps extends Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'children'> {
  open: boolean;
  panelId: string;
}

export const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(function NotificationBell(
  { open, panelId, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const online = useOnline();
  const q = useUnreadCount();

  const unreadReal = q.isError ? 0 : (q.data ?? 0);
  const hasUnread = unreadReal > 0;

  const ariaLabel = hasUnread
    ? t('notif.bell.aria', {
        count: unreadReal,
        defaultValue: `Bildirishnomalar, ${unreadReal} ta o'qilmagan`,
      })
    : t('notif.bell.empty', { defaultValue: "Bildirishnomalar, o'qilmagan yo'q" });

  const lastUpdated = q.dataUpdatedAt > 0 ? dayjs(q.dataUpdatedAt).format('HH:mm') : null;
  const tooltipTitle = q.isError
    ? t('notif.badge.stale', { defaultValue: 'Soni yangilanmadi' })
    : !online
      ? lastUpdated
        ? t('notif.offline', {
            defaultValue: `Oflayn — oxirgi yangilanish ${lastUpdated}`,
            time: lastUpdated,
          })
        : t('notif.offlineNoData', { defaultValue: 'Oflayn — ma\'lumot hali yuklanmagan' })
      : undefined;

  return (
    <Badge
      count={unreadReal}
      overflowCount={99}
      size="small"
      offset={[-2, 4]}
      color={token.colorErrorActive}
      styles={{
        indicator: {
          boxShadow: `0 0 0 2px ${token.colorBgContainer}`,
          fontWeight: 500,
        },
      }}
      title=""
    >
      <BellButton
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        title={tooltipTitle}
        {...rest}
      >
        <BellOutlined />
      </BellButton>
    </Badge>
  );
});
