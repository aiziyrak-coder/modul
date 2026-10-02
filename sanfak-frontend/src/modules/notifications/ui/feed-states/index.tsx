import { BellOutlined } from '@ant-design/icons';
import { Skeleton, theme } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';
import { Alert, Button, Typography } from '@/shared/ui';
import { EmptyIconWrap, EmptyWrap, SkeletonRow, SkeletonWrap } from './style';

export interface FeedLoadingProps {
  rows?: number;
  className?: string;
}

export function FeedLoading({ rows = 3, className }: FeedLoadingProps) {
  return (
    <SkeletonWrap className={className}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index}>
          <Skeleton active avatar paragraph={{ rows: 1 }} title={false} />
        </SkeletonRow>
      ))}
    </SkeletonWrap>
  );
}

export interface FeedEmptyProps {
  className?: string;
}

export function FeedEmpty({ className }: FeedEmptyProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  return (
    <EmptyWrap className={className}>
      <EmptyIconWrap $color={token.colorTextTertiary} $bg={token.colorFillTertiary}>
        <BellOutlined style={{ fontSize: 40 }} />
      </EmptyIconWrap>
      <Typography.Text strong>{t('notif.empty.title', { defaultValue: "Bildirishnoma yo'q" })}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {t('notif.empty.hint', { defaultValue: "Yangi bildirishnomalar shu yerda ko'rinadi" })}
      </Typography.Text>
    </EmptyWrap>
  );
}

export interface FeedErrorProps {
  onRetry: () => void;
  className?: string;
}

export function FeedError({ onRetry, className }: FeedErrorProps) {
  const { t } = useTranslation();
  return (
    <Alert
      className={className}
      type="error"
      showIcon
      message={t('notif.error.title', { defaultValue: 'Bildirishnomalar yuklanmadi' })}
      action={
        <Button size="small" onClick={onRetry}>
          {t('notif.retry', { defaultValue: 'Qayta urinish' })}
        </Button>
      }
    />
  );
}

export interface FeedOfflineProps {
  lastUpdated: Date | null;
  className?: string;
}

export function FeedOffline({ lastUpdated, className }: FeedOfflineProps) {
  const { t } = useTranslation();
  const time = lastUpdated ? dayjs(lastUpdated).format('HH:mm') : '—';
  return (
    <Alert
      className={className}
      type="warning"
      showIcon
      message={t('notif.offline', { defaultValue: `Oflayn — oxirgi yangilanish ${time}`, time })}
    />
  );
}
