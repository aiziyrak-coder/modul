import { useState } from 'react';
import styled from 'styled-components';
import { Button, Empty } from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CommentOutlined,
  FileTextOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';

type NotifType = 'approved' | 'rejected' | 'new_doc' | 'new_review' | 'seminar' | 'revision';

interface Notification {
  id: number;
  type: NotifType;
  titleUz: string;
  titleRu: string;
  bodyUz: string;
  bodyRu: string;
  date: string;
  read: boolean;
  workId?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: 'approved',
    titleUz: 'Ilmiy ish tasdiqlandi',
    titleRu: 'Научная работа утверждена',
    bodyUz: '"Bolalarda bronxial astma..." — seminarga tavsiya etildi',
    bodyRu: '"Иммунологические аспекты бронхиальной астмы..." — рекомендована на семинар',
    date: '2026-02-11T11:25',
    read: false,
    workId: 'work-2',
  },
  {
    id: 2,
    type: 'new_review',
    titleUz: 'Yangi xulosa qoldirildi',
    titleRu: 'Оставлено новое заключение',
    bodyUz: "Prof. Rahimov dissertatsiya bo'yicha xulosa qoldirdi",
    bodyRu: 'Проф. Рахимов оставил заключение по диссертации',
    date: '2026-02-11T10:15',
    read: false,
    workId: 'work-1',
  },
  {
    id: 3,
    type: 'new_doc',
    titleUz: 'Yangi hujjat yuklandi',
    titleRu: 'Загружен новый документ',
    bodyUz: "Toshmatov S.B. antiplagiat to'lov hujjatini yukladi",
    bodyRu: 'Тошматов С.Б. загрузил документ об оплате антиплагиата',
    date: '2026-02-10T14:30',
    read: true,
    workId: 'work-1',
  },
  {
    id: 4,
    type: 'rejected',
    titleUz: 'Hujjat rad etildi',
    titleRu: 'Документ отклонён',
    bodyUz: '"Yurak ishemik kasalligi..." — hujjatlar to\'liq emas',
    bodyRu: '"Эффективность программ реабилитации..." — документы не полные',
    date: '2026-02-09T09:00',
    read: true,
    workId: 'work-3',
  },
  {
    id: 5,
    type: 'revision',
    titleUz: 'Qayta ishlashga qaytarildi',
    titleRu: 'Возвращено на доработку',
    bodyUz: '"Surunkali pielonefrit..." — metodologiya qayta talab etildi',
    bodyRu: '"Ранняя реабилитация при хроническом пиелонефрите..." — требуется доработка',
    date: '2026-01-20T16:45',
    read: true,
    workId: 'work-5',
  },
];

const NOTIF_CONFIG: Record<NotifType, { icon: React.ReactNode; bg: string }> = {
  approved: { icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />, bg: '#f0fdf4' },
  rejected: { icon: <CloseCircleOutlined style={{ color: '#dc2626' }} />, bg: '#fef2f2' },
  new_doc: { icon: <FileTextOutlined style={{ color: '#2563eb' }} />, bg: '#eff6ff' },
  new_review: { icon: <CommentOutlined style={{ color: '#d97706' }} />, bg: '#fffbeb' },
  seminar: { icon: <CalendarOutlined style={{ color: '#0891b2' }} />, bg: '#ecfeff' },
  revision: { icon: <SyncOutlined style={{ color: '#9333ea' }} />, bg: '#faf5ff' },
};

const ToolBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const Card = styled.div`
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--border-secondary, #e5e7eb);
  overflow: hidden;
`;

const NotifRow = styled.div<{ $unread: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
  background: ${({ $unread }) => ($unread ? '#f0fdf4' : 'var(--bg-surface, #fff)')};
  cursor: pointer;
  transition: background 0.15s;

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: var(--bg-muted, #f9fafb);
  }
`;

const IconWrap = styled.div<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${({ $bg }) => $bg};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;

  .notif-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin-bottom: 4px;
  }
  .notif-body {
    font-size: 13px;
    color: var(--color-text-tertiary, #6b7280);
  }
`;

const Meta = styled.div`
  text-align: right;
  flex-shrink: 0;

  .time {
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 6px;
  }
`;

const UnreadDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
  margin: 0 auto;
`;

const MarkAllBtn = styled(Button)`
  border-radius: 10px !important;
  font-weight: 600 !important;
  color: #16a34a !important;
  border-color: #16a34a !important;

  &:hover {
    background: #f0fdf4 !important;
  }
`;

export default function NotificationsPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>(() => [...MOCK_NOTIFICATIONS]);

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <PageContainer title={t('scienceCouncil.nav.notifications')}>
      <ToolBar>
        <div style={{ fontSize: 14, color: 'var(--color-text-tertiary, #6b7280)' }}>
          {unreadCount > 0
            ? t('scienceCouncil.notifications.unreadCount').replace('{count}', String(unreadCount))
            : t('scienceCouncil.notifications.allRead')}
        </div>
        {unreadCount > 0 && (
          <MarkAllBtn onClick={markAllRead}>
            {t('scienceCouncil.notifications.markAllRead')}
          </MarkAllBtn>
        )}
      </ToolBar>

      <Card>
        {notifs.length === 0 ? (
          <Empty
            image={<BellOutlined style={{ fontSize: 48, color: '#e5e7eb' }} />}
            description={t('scienceCouncil.notifications.empty')}
            style={{ padding: 48 }}
          />
        ) : (
          notifs.map((n) => {
            const config = NOTIF_CONFIG[n.type] ?? NOTIF_CONFIG.new_doc;
            return (
              <NotifRow
                key={n.id}
                $unread={!n.read}
                onClick={() => {
                  setNotifs((prev) =>
                    prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
                  );
                  if (n.workId) navigate(`/science-council/works/${n.workId}`);
                }}
              >
                <IconWrap $bg={config.bg}>{config.icon}</IconWrap>
                <Content>
                  <div className="notif-title">{lang === 'ru' ? n.titleRu : n.titleUz}</div>
                  <div className="notif-body">{lang === 'ru' ? n.bodyRu : n.bodyUz}</div>
                </Content>
                <Meta>
                  <div className="time">{n.date.replace('T', ' ')}</div>
                  {!n.read && <UnreadDot />}
                </Meta>
              </NotifRow>
            );
          })
        )}
      </Card>
    </PageContainer>
  );
}
