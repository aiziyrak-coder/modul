import { App, Button, Empty, Flex, List, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/ui';
import { PageHeader } from '../components/page-header';
import { usePracticeRole } from '../model/view-role';
import { useNotifications, useMarkRead, useMarkAllRead } from '../api/practice-api';

export default function BildirishnomalarPage() {
  const { message } = App.useApp();
  const role = usePracticeRole();
  const { data, isLoading } = useNotifications(role);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = data ?? [];
  const hasUnread = items.some((n) => !n.read);

  const onMarkAll = async () => {
    await markAll.mutateAsync(role);
    message.success('Barchasi o‘qilgan deb belgilandi');
  };

  return (
    <PageContainer title="Bildirishnomalar">
      <PageHeader
        title="Bildirishnomalar"
        extra={
          <Flex gap={12} align="center" wrap>
            {hasUnread && (
              <Button onClick={onMarkAll} loading={markAll.isPending}>
                Barchasini o'qilgan deb belgilash
              </Button>
            )}
          </Flex>
        }
      />
      <List
        loading={isLoading}
        dataSource={items}
        locale={{ emptyText: <Empty description="Bildirishnoma yo'q" /> }}
        renderItem={(n) => (
          <List.Item
            actions={
              n.read
                ? []
                : [
                    <Button key="r" type="link" onClick={() => markRead.mutateAsync(n.id)}>
                      O'qilgan deb belgilash
                    </Button>,
                  ]
            }
          >
            <List.Item.Meta
              title={
                <Flex gap={8} align="center">
                  <span>{n.title}</span>
                  {n.read ? <Tag>O'qilgan</Tag> : <Tag color="blue">Yangi</Tag>}
                </Flex>
              }
              description={
                <>
                  <div>{n.body}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(n.createdAt).format('DD.MM.YYYY HH:mm')}
                  </Typography.Text>
                </>
              }
            />
          </List.Item>
        )}
      />
    </PageContainer>
  );
}
