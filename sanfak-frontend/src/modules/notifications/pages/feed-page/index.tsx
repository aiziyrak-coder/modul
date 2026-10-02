import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { Badge, Collapse, Pagination, theme } from 'antd';
import { usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import {
  Alert,
  App,
  Button,
  PageContainer,
  Popconfirm,
  Select,
  Spin,
  Tab,
  Typography,
} from '@/shared/ui';
import { useFeed, useMarkAllRead, useMarkRead, useUnreadCount, type FeedFilters } from '../../api/queries';
import { resolveLinkPermission } from '../../lib/resolve-link-permission';
import { COUNCIL_VARIANT_SUFFIX, EVENT_REGISTRY } from '../../model/event-registry';
import { groupByDay, type DayGroupKey, type RollupEntry } from '../../model/group-by-day';
import type { NotificationVM } from '../../model/types';
import { FeedEmpty, FeedError, FeedLoading } from '../../ui/feed-states';
import NotificationDetailDrawer from '../../ui/notification-detail-drawer';
import NotificationItem from '../../ui/notification-item';
import {
  ActionsGroup,
  EntryWrap,
  FiltersRow,
  GroupHeader,
  GroupWrap,
  HeaderRow,
  ListWrap,
  PageWrap,
  PaginationRow,
  RollupList,
  RollupWrap,
  TitleGroup,
} from './style';

const PAGE_SIZE = 20;

const EVENT_TYPE_KEYS = Object.keys(EVENT_REGISTRY).filter((key) => !key.endsWith(COUNCIL_VARIANT_SUFFIX));

function eventLabelKey(eventType: string): string {
  const camel = eventType.replace(/_([a-z])/g, (_match, ch: string) => ch.toUpperCase());
  return `notif.event.${camel}`;
}

function humanizeEventType(eventType: string): string {
  const words = eventType.split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const GROUP_FALLBACK: Record<DayGroupKey, string> = {
  today: 'Bugun',
  yesterday: 'Kecha',
  thisWeek: 'Shu hafta',
  older: 'Oldingi',
};

type TabKey = 'all' | 'unread';

function RollupRow({
  entry,
  onOpen,
  onOpenDetail,
  onMarkRead,
}: {
  entry: RollupEntry<NotificationVM>;
  onOpen: (notification: NotificationVM) => void;
  onOpenDetail: (notification: NotificationVM) => void;
  onMarkRead: (notification: NotificationVM) => void;
}) {
  const { t } = useTranslation();
  return (
    <RollupWrap>
      <Collapse
        expandIconPosition="end"
        items={[
          {
            key: entry.eventType,
            label: t('notif.rollup', {
              defaultValue: `${entry.items.length} ta o'xshash bildirishnoma`,
              count: entry.items.length,
            }),
            children: (
              <RollupList>
                {entry.items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    variant="full"
                    onOpen={onOpen}
                    onOpenDetail={onOpenDetail}
                    onMarkRead={onMarkRead}
                  />
                ))}
              </RollupList>
            ),
          },
        ]}
      />
    </RollupWrap>
  );
}

export default function FeedPage() {
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const can = usePermission();

  const [tab, setTab] = useState<TabKey>('all');
  const [eventType, setEventType] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<NotificationVM | null>(null);

  const filters: FeedFilters = useMemo(() => {
    const f: FeedFilters = {};
    if (tab === 'unread') f.read = false;
    if (eventType) f.eventType = eventType;
    return f;
  }, [tab, eventType]);

  const feed = useFeed(filters, page, PAGE_SIZE);
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const feedDocs = feed.data?.docs;
  const total = feed.data?.totalDocs ?? 0;
  const unreadCount = unread.data ?? 0;
  const items = useMemo(() => feedDocs ?? [], [feedDocs]);
  const groups = useMemo(() => groupByDay(items), [items]);
  const isRefetching = feed.isFetching && !feed.isLoading;

  const changeTab = (value: string) => {
    setTab(value as TabKey);
    setPage(1);
  };
  const changeEventType = (value: string | undefined) => {
    setEventType(value);
    setPage(1);
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
        navigate(notification.safeLink);
        return;
      }
    }
    setDetail(notification);
  };

  const handleOpenDetail = (notification: NotificationVM) => setDetail(notification);

  const handleMarkRead = async (notification: NotificationVM) => {
    try {
      await markRead.mutateAsync(notification.id);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <PageContainer title={t('notif.title', { defaultValue: 'Bildirishnomalar' })}>
      <PageWrap>
        <HeaderRow>
          <TitleGroup>
            <BellOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('notif.title', { defaultValue: 'Bildirishnomalar' })}
            </Typography.Title>
            <Badge count={unreadCount} overflowCount={99} />
            {isRefetching ? <Spin size="small" /> : null}
          </TitleGroup>
          <ActionsGroup>
            <Button icon={<SettingOutlined />} onClick={() => navigate('/bildirishnomalar/sozlamalar')}>
              {t('notif.settings.open', { defaultValue: 'Sozlamalar' })}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void feed.refetch();
                void unread.refetch();
              }}
            >
              {t('notif.refresh', { defaultValue: 'Yangilash' })}
            </Button>
            {unreadCount > 0 ? (
              <Popconfirm
                title={t('notif.markAllConfirm.title', {
                  defaultValue: "Barchasini o'qilgan deb belgilaysizmi?",
                })}
                description={t('notif.markAllConfirm.desc', {
                  defaultValue: "Bu amalni bekor qilib bo'lmaydi.",
                })}
                okText={t('notif.markAllConfirm.ok', { defaultValue: 'Ha' })}
                cancelText={t('notif.markAllConfirm.cancel', { defaultValue: 'Bekor qilish' })}
                onConfirm={handleMarkAll}
              >
                <Button loading={markAllRead.isPending}>
                  {t('notif.markAll', { defaultValue: "Barchasini o'qilgan deb belgilash" })}
                </Button>
              </Popconfirm>
            ) : null}
          </ActionsGroup>
        </HeaderRow>

        <FiltersRow>
          <Tab
            value={tab}
            onChange={changeTab}
            options={[
              { value: 'all', label: t('notif.tab.all', { defaultValue: 'Hammasi' }) },
              { value: 'unread', label: t('notif.tab.unread', { defaultValue: "O'qilmagan" }) },
            ]}
          />
          <Select
            allowClear
            placeholder={t('notif.filter.type', { defaultValue: "Turi bo'yicha" })}
            value={eventType}
            onChange={changeEventType}
            style={{ minWidth: 240 }}
            options={EVENT_TYPE_KEYS.map((key) => ({
              value: key,
              label: t(eventLabelKey(key), { defaultValue: humanizeEventType(key) }),
            }))}
          />
        </FiltersRow>

        {lang !== 'uz' ? (
          <Alert
            type="info"
            showIcon
            message={t('notif.contentUzOnly', {
              defaultValue: "Bildirishnoma matnlari hozircha faqat o'zbek tilida",
            })}
          />
        ) : null}

        {feed.isLoading ? (
          <FeedLoading rows={5} />
        ) : feed.isError ? (
          <FeedError onRetry={() => void feed.refetch()} />
        ) : items.length === 0 ? (
          <FeedEmpty />
        ) : (
          <>
            <ListWrap>
              {groups.map((group) => (
                <GroupWrap key={group.key}>
                  <GroupHeader $color={token.colorTextSecondary}>
                    {t(`notif.group.${group.key}`, { defaultValue: GROUP_FALLBACK[group.key] })}
                  </GroupHeader>
                  <EntryWrap>
                    {group.entries.map((entry) =>
                      entry.kind === 'single' ? (
                        <NotificationItem
                          key={entry.item.id}
                          notification={entry.item}
                          variant="full"
                          onOpen={handleOpen}
                          onOpenDetail={handleOpenDetail}
                          onMarkRead={handleMarkRead}
                        />
                      ) : (
                        <RollupRow
                          key={entry.eventType}
                          entry={entry}
                          onOpen={handleOpen}
                          onOpenDetail={handleOpenDetail}
                          onMarkRead={handleMarkRead}
                        />
                      ),
                    )}
                  </EntryWrap>
                </GroupWrap>
              ))}
            </ListWrap>

            {total > PAGE_SIZE ? (
              <PaginationRow>
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  showSizeChanger={false}
                  disabled={feed.isFetching}
                  onChange={setPage}
                />
              </PaginationRow>
            ) : null}
          </>
        )}
      </PageWrap>

      <NotificationDetailDrawer notification={detail} onClose={() => setDetail(null)} />
    </PageContainer>
  );
}
