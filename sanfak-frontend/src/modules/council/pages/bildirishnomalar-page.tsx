import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { App, Avatar, Badge, Button, Empty, Flex, List, Tag, Tooltip, Typography, theme } from 'antd';
import type { GlobalToken } from 'antd';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { useNotifications, useMarkRead, useMarkAllRead } from '../api/council-api';
import { notificationCode, notificationLink } from '../api/mapper';
import type { CouncilNotification } from '../model/types';

interface NotifMeta {
  code: string | null;
  color: string;
  bg: string;
  icon: ReactNode;
}

const notifMeta = (n: CouncilNotification, token: GlobalToken): NotifMeta => {
  const t = n.type ?? '';
  let meta: NotifMeta;
  if (t.includes('task')) {
    meta = { code: 'T', color: token.blue6, bg: `${token.blue6}1a`, icon: <FileDoneOutlined /> };
  } else if (t.includes('rank')) {
    meta = { code: 'U', color: token.purple6, bg: `${token.purple6}1a`, icon: <SafetyCertificateOutlined /> };
  } else if (t.includes('voting')) {
    meta = { code: 'V', color: token.colorSuccess, bg: `${token.colorSuccess}1a`, icon: <CheckCircleOutlined /> };
  } else if (t.includes('announcement')) {
    meta = { code: 'E', color: token.gold6, bg: `${token.gold6}1a`, icon: <NotificationOutlined /> };
  } else {
    meta = { code: null, color: token.colorTextSecondary, bg: token.colorFillSecondary, icon: <BellOutlined /> };
  }
  const codeOverride = notificationCode(n);
  return codeOverride ? { ...meta, code: codeOverride } : meta;
};

export default function BildirishnomalarPage() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const items = data ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  const onMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const onMarkAll = async () => {
    try {
      await markAll.mutateAsync();
      message.success('Barchasi o‘qilgan deb belgilandi');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const onItemClick = (n: CouncilNotification) => {
    if (!n.read) void onMarkRead(n.id);
    const link = notificationLink(n);
    if (link) navigate(link);
  };

  return (
    <PageContainer title="Bildirishnomalar">
      <PageHeader
        title={unreadCount > 0 ? `Bildirishnomalar (${unreadCount} yangi)` : 'Bildirishnomalar'}
        extra={
          unreadCount > 0 ? (
            <Button onClick={onMarkAll} loading={markAll.isPending}>
              Barchasini o'qilgan deb belgilash
            </Button>
          ) : undefined
        }
      />
      <List
        loading={isLoading}
        dataSource={items}
        locale={{ emptyText: <Empty description="Bildirishnoma yo'q" /> }}
        renderItem={(n) => {
          const meta = notifMeta(n, token);
          const clickable = !n.read || notificationLink(n) !== null;
          return (
            <List.Item
              onClick={clickable ? () => onItemClick(n) : undefined}
              style={{
                background: n.read ? undefined : token.colorSuccessBg,
                borderRadius: 'var(--radius-md)',
                paddingInline: 'var(--space-3)',
                cursor: clickable ? 'pointer' : undefined,
              }}
              actions={
                n.read
                  ? []
                  : [
                      <Button
                        key="read"
                        type="link"
                        loading={markRead.isPending && markRead.variables === n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onMarkRead(n.id);
                        }}
                      >
                        O'qilgan deb belgilash
                      </Button>,
                    ]
              }
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    shape="square"
                    size={42}
                    icon={meta.icon}
                    style={{
                      color: meta.color,
                      background: meta.bg,
                      borderRadius: 'var(--radius-md, 8px)',
                    }}
                  />
                }
                title={
                  <Flex gap={8} align="center" wrap>
                    {meta.code && (
                      <Tag
                        style={{
                          marginInlineEnd: 0,
                          fontWeight: 700,
                          color: meta.color,
                          background: meta.bg,
                          borderColor: 'transparent',
                        }}
                      >
                        {meta.code}
                      </Tag>
                    )}
                    <span>{n.title}</span>
                    {!n.read && (
                      <Tooltip title="O'qilmagan">
                        <Badge status="success" />
                      </Tooltip>
                    )}
                  </Flex>
                }
                description={
                  <>
                    {n.body && <div>{n.body}</div>}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(n.createdAt).format('DD.MM.YYYY HH:mm')}
                    </Typography.Text>
                  </>
                }
              />
            </List.Item>
          );
        }}
      />
    </PageContainer>
  );
}
