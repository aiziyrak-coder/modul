import { useState } from 'react';
import { Alert, App, Button, Tag, Tooltip } from 'antd';
import { BellOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageContainer, Table } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  getApiErrorMessage,
  useHrNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../api/notifications-api';
import { formatNotificationTime, isNegativeNotification } from '../model/helper';
import type { HrNotification } from '../model/notification-types';
import {
  EmptyBadge,
  EmptyIconWrap,
  EmptyText,
  EmptyWrap,
  NotifBody,
  NotifCell,
  NotifIcon,
  NotifTextCol,
  NotifTitle,
  TableWrap,
} from './notifications-style';

const NotificationsPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useHrNotifications(page);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const total = data?.meta.total ?? 0;

  const handleMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAll.mutateAsync();
      message.success(t('teacher.hr.notifications.markAllSuccess'));
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const columns: ColumnsType<HrNotification> = [
    {
      title: t('teacher.hr.notifications.column.notification'),
      key: 'notification',
      render: (_, n) => {
        const negative = isNegativeNotification(n.eventType);
        return (
          <NotifCell>
            <NotifIcon $negative={negative}>
              {negative ? <CloseOutlined /> : <CheckOutlined />}
            </NotifIcon>
            <NotifTextCol>
              <NotifTitle>{n.title}</NotifTitle>
              {n.body ? <NotifBody>{n.body}</NotifBody> : null}
            </NotifTextCol>
          </NotifCell>
        );
      },
    },
    {
      title: t('teacher.hr.notifications.column.time'),
      key: 'time',
      width: 180,
      render: (_, n) => formatNotificationTime(n.createdAt),
    },
    {
      title: t('teacher.hr.notifications.column.status'),
      key: 'status',
      width: 140,
      render: (_, n) =>
        n.read ? (
          <Tag>{t('teacher.hr.notifications.status.read')}</Tag>
        ) : (
          <Tag color="blue">{t('teacher.hr.notifications.status.new')}</Tag>
        ),
    },
    {
      title: t('actions'),
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, n) =>
        n.read ? null : (
          <Tooltip title={t('teacher.hr.notifications.action.markRead')}>
            <Button
              type="text"
              icon={<CheckOutlined />}
              size="small"
              style={{ color: 'var(--brand-primary)' }}
              loading={markRead.isPending && markRead.variables === n.id}
              onClick={() => void handleMarkRead(n.id)}
            />
          </Tooltip>
        ),
    },
  ];

  return (
    <PageContainer
      title={t('teacher.hr.notifications.pageTitle')}
      extra={
        <Button
          type="primary"
          icon={<CheckOutlined />}
          loading={markAll.isPending}
          onClick={() => void handleMarkAll()}
        >
          {t('teacher.hr.notifications.markAll')}
        </Button>
      }
    >
      {isError ? (
        <Alert
          type="error"
          showIcon
          message={t('teacher.hr.notifications.loadError')}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('teacher.hr.staff.retry')}
            </Button>
          }
        />
      ) : !isLoading && items.length === 0 ? (
        <EmptyWrap>
          <EmptyIconWrap>
            <BellOutlined style={{ fontSize: 96, opacity: 0.15 }} />
            <EmptyBadge>0</EmptyBadge>
          </EmptyIconWrap>
          <EmptyText>{t('teacher.hr.notifications.empty')}</EmptyText>
        </EmptyWrap>
      ) : (
        <TableWrap>
          <Table<HrNotification>
            rowKey="id"
            loading={isLoading}
            dataSource={items}
            columns={columns}
            rowClassName={(n) => (n.read ? '' : 'hr-notif-unread')}
            pagination={
              total > 0
                ? { current: page, pageSize: 20, total, onChange: setPage, showSizeChanger: false }
                : false
            }
          />
        </TableWrap>
      )}
    </PageContainer>
  );
};

export default NotificationsPage;
