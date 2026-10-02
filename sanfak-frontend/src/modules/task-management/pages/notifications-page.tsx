import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Badge } from 'antd';
import { Button, Empty } from '@/shared/ui';
import { BellOutlined, CheckCircleOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { usePermission } from '@/app/session';
import { useNotifications } from '../api/queries';
import { colors } from '../lib/theme';
import type { TaskNotification } from '../model/types';

dayjs.extend(relativeTime);

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;
const PageTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: ${colors.textPrimary};
  margin: 0;
`;
const NotifList = styled.div`
  background: #fff;
  border-radius: 12px;
  border: 1px solid ${colors.border};
  overflow: hidden;
`;
const NotifItem = styled.div<{ $read: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid ${colors.border};
  background: ${({ $read }) => ($read ? '#fff' : '#F0FDF4')};
  cursor: pointer;
  transition: background 0.15s;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${colors.bgGray};
  }
`;
const NotifIcon = styled.div<{ $read: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${({ $read }) => ($read ? colors.bgGray : colors.primaryLight)};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: ${({ $read }) => ($read ? colors.textSecondary : colors.primary)};
  flex-shrink: 0;
`;
const NotifMessage = styled.div<{ $read: boolean }>`
  font-size: 14px;
  color: ${colors.textPrimary};
  font-weight: ${({ $read }) => ($read ? '400' : '500')};
  line-height: 1.5;
`;
const NotifMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const NotifTime = styled.div`
  font-size: 12px;
  color: ${colors.textSecondary};
  margin-top: 4px;
`;
const UnreadDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${colors.primary};
  flex-shrink: 0;
`;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const can = usePermission();
  const { notifications, unreadCount, markRead, markAll } = useNotifications();

  const handleClick = (notif: TaskNotification) => {
    void markRead(notif.id);
    if (notif.taskId) {
      const base = can('task:create') ? '/task-management/tasks' : '/task-management/my-tasks';
      navigate(`${base}/${notif.taskId}`);
    }
  };

  return (
    <div>
      <PageHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PageTitle>Bildirishnomalar</PageTitle>
          {unreadCount > 0 && <Badge count={unreadCount} style={{ background: colors.primary }} />}
        </div>
        {unreadCount > 0 && (
          <Button icon={<CheckOutlined />} onClick={() => void markAll()} style={{ borderRadius: 8 }}>
            Barchasini o&apos;qildi deb belgilash
          </Button>
        )}
      </PageHeader>

      {notifications.length === 0 ? (
        <Empty image={<BellOutlined style={{ fontSize: 48, color: colors.textSecondary }} />} description="Bildirishnomalar yo'q" style={{ padding: '60px 0' }} />
      ) : (
        <NotifList>
          {notifications.map((notif) => (
            <NotifItem key={notif.id} $read={notif.read} onClick={() => handleClick(notif)}>
              <NotifIcon $read={notif.read}>{notif.read ? <CheckCircleOutlined /> : <BellOutlined />}</NotifIcon>
              <div style={{ flex: 1 }}>
                <NotifMessage $read={notif.read}>{notif.message}</NotifMessage>
                <NotifMeta>
                  <NotifTime>{notif.createdAt ? dayjs(notif.createdAt).locale('uz').fromNow() : ''}</NotifTime>
                  {notif.taskCode && <span style={{ fontSize: 12, color: colors.primary, fontWeight: 500 }}>• {notif.taskCode}</span>}
                </NotifMeta>
              </div>
              {!notif.read && <UnreadDot />}
            </NotifItem>
          ))}
        </NotifList>
      )}
    </div>
  );
}
