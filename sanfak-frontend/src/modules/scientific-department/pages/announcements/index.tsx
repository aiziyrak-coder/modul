import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Badge, Button, Empty, Spin, Tag, Tooltip } from 'antd';
import { BellOutlined, CheckOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { PageContainer, Flex } from '@/shared/ui';
import FeedPager from '../../components/feed-pager';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../../api/notification-api';

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const { data, isLoading, isFetching } = useNotifications(page, pageSize);
  const { data: unread } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = data?.docs ?? [];
  const unreadCount = unread?.count ?? 0;

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      message.success(t('scientificDepartment.notif.allRead'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleMarkOne = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <PageContainer title={t('scientificDepartment.notif.title')}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 16 }}>
        <Flex align="center" gap={10}>
          <Badge count={unreadCount} size="small">
            <BellOutlined style={{ fontSize: 20, color: 'var(--brand-primary)' }} />
          </Badge>
          <span style={{ fontWeight: 600 }}>{t('scientificDepartment.notif.title')}</span>
        </Flex>
        {unreadCount > 0 ? (
          <Button
            icon={<CheckOutlined />}
            onClick={handleMarkAll}
            loading={markAllRead.isPending}
          >
            {t('scientificDepartment.notif.markAll')}
          </Button>
        ) : null}
      </Flex>

      {isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 200 }}>
          <Spin />
        </Flex>
      ) : items.length === 0 ? (
        <Flex flex={1} align="center" justify="center" style={{ minHeight: 240 }}>
          <Empty description={t('scientificDepartment.notif.empty')} />
        </Flex>
      ) : (
        <FeedPager
          page={page}
          pageSize={pageSize}
          total={data?.totalDocs ?? 0}
          loading={isFetching}
          onChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
        >
          <Flex vertical gap={8}>
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => (n.link ? navigate(n.link) : undefined)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 150px 120px 56px',
                  alignItems: 'center',
                  gap: 10,
                  background: n.read
                    ? 'var(--color-bg-container, #fff)'
                    : 'var(--brand-primary-soft)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  cursor: n.link ? 'pointer' : 'default',
                }}
              >
                <Flex align="center" gap={10} style={{ minWidth: 0 }}>
                  <CheckCircleOutlined
                    style={{
                      fontSize: 18,
                      color: n.read ? 'var(--color-text-mute)' : 'var(--brand-primary)',
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: n.read ? 400 : 600, fontSize: 13 }}>{n.title}</div>
                    {n.body ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-mute)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.body}
                      </div>
                    ) : null}
                  </div>
                </Flex>
                <span style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>{n.date}</span>
                <span>
                  {n.read ? (
                    <span style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
                      {t('scientificDepartment.notif.read')}
                    </span>
                  ) : (
                    <Tag color="blue">{t('scientificDepartment.notif.new')}</Tag>
                  )}
                </span>
                <span style={{ textAlign: 'center' }}>
                  {!n.read ? (
                    <Tooltip title={t('scientificDepartment.notif.markOne')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckOutlined style={{ color: 'var(--brand-primary)' }} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkOne(n.id);
                        }}
                      />
                    </Tooltip>
                  ) : null}
                </span>
              </div>
            ))}
          </Flex>
        </FeedPager>
      )}
    </PageContainer>
  );
}
