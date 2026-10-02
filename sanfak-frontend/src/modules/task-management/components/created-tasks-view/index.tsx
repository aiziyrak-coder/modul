import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Radio, Segmented } from 'antd';
import {
  App,
  Avatar,
  Button,
  Empty,
  Input,
  Modal,
  RangePicker,
  Select,
  Space,
  Table,
  Textarea,
  Tooltip,
} from '@/shared/ui';
import type { TableProps } from '@/shared/ui';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  PlusOutlined,
  RedoOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePermission, useSessionStore } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import { useServerTable } from '../../lib/use-server-table';
import { useDebouncedSearch } from '../../lib/use-debounced';
import { fetchTasksPage } from '../../api/task-management-api';
import { useCategoriesData, useTaskActions, useTaskStats } from '../../api/queries';
import { toEnPriority, toEnStatus } from '../../api/mapper';
import { priorities, statusTabs } from '../../lib/constants';
import {
  currentMonthRangeIso,
  displayToIso,
  isSameIsoRange,
  parseUrlDateIso,
  RANGE_DISPLAY_FORMAT,
  utcDayEnd,
  utcDayStart,
  type IsoDateRange,
} from '../../lib/date-range';
import { colors } from '../../lib/theme';
import StatusBadge from '../status-badge';
import PriorityBadge from '../priority-badge';
import CreateTaskModal from '../create-task-modal';
import TaskBoard from '../task-board';
import { useViewMode, type ViewMode } from '../../lib/use-view-mode';
import type { Task, TaskStatusUz } from '../../model/types';

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;
const TabRow = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;
const TabChip = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1.5px solid ${({ $active }) => ($active ? colors.primary : colors.border)};
  background: ${({ $active }) => ($active ? colors.primaryLight : '#fff')};
  cursor: pointer;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? '600' : '500')};
  color: ${({ $active }) => ($active ? colors.primary : colors.textSecondary)};
  transition: all 0.15s;
  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
`;
const ChipCount = styled.span<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? colors.primary : '#E4E7EC')};
  color: ${({ $active }) => ($active ? '#fff' : colors.textSecondary)};
  font-size: 12px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
`;
const TaskTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.textPrimary};
  cursor: pointer;
  transition: color 0.15s;
  &:hover {
    color: ${colors.primary};
  }
`;
const TaskId = styled.span`
  font-size: 12px;
  color: ${colors.textSecondary};
  display: block;
  margin-top: 2px;
`;
const DeadlineCell = styled.div<{ $overdue: boolean }>`
  font-size: 13px;
  color: ${({ $overdue }) => ($overdue ? colors.danger : colors.textPrimary)};
  font-weight: ${({ $overdue }) => ($overdue ? '600' : '400')};
`;
const ActionBtn = styled(Button)`
  border-radius: 6px;
  padding: 0 8px;
  height: 28px;
  font-size: 12px;
`;
const ClearAllBtn = styled.button`
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #f59e0b;
  background: #fff;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 40px;
  &:hover {
    background: #fef3c7;
  }
`;

const DETAIL_BASE = '/task-management/tasks';

export default function CreatedTasksView() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const can = usePermission();
  const [view, setView] = useViewMode('created');

  const { deleteTask, completeTask, reassignTask } = useTaskActions();
  const { categories, categoryId } = useCategoriesData();

  const initialStatus = (location.state as { statusFilter?: TaskStatusUz | '' } | null)?.statusFilter ?? '';

  const defaultRange = useMemo(currentMonthRangeIso, []);
  const initialRange = useMemo<IsoDateRange>(() => {
    const from = parseUrlDateIso(searchParams.get('deadlineFrom'));
    const to = parseUrlDateIso(searchParams.get('deadlineTo'));
    return from && to ? [from, to] : defaultRange;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialFilters = useMemo<Record<string, string>>(() => {
    const f: Record<string, string> = {
      deadlineFrom: utcDayStart(dayjs(initialRange[0])),
      deadlineTo: utcDayEnd(dayjs(initialRange[1])),
    };
    if (initialStatus) {
      const en = toEnStatus(initialStatus);
      if (en) f.status = en;
    }
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { rows, total, page, limit, sort, loading, error, setPage, setLimit, resetFilters, setSort, reload } =
    useServerTable<Task>(fetchTasksPage, { initialLimit: 10, initialFilters });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search);
  const [statusFilter, setStatusFilter] = useState<TaskStatusUz | ''>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState<IsoDateRange | null>(initialRange);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [closeStatus, setCloseStatus] = useState<'bajarildi' | 'bajarilmadi'>('bajarildi');
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Task | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [submitting, setSubmitting] = useState(false);


  const canCreate = can('task:create');
  const canUpdate = can('task:update');
  const canChangeStatus = can('task:changeStatus');
  const canDelete = can('task:delete');
  const isLeader = can('task:export');
  const myId = useSessionStore((s) => s.user?.id);

  const openComplete = (record: Task) => {
    setCloseStatus(record.status === 'kechikdi' ? 'bajarilmadi' : 'bajarildi');
    setCompleteTarget(record);
  };

  const filterParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (statusFilter) {
      const en = toEnStatus(statusFilter);
      if (en) p.status = en;
    }
    if (priorityFilter) p.priority = toEnPriority(priorityFilter);
    if (categoryFilter) {
      const cid = categoryId(categoryFilter);
      if (cid) p.category = cid;
    }
    let from: dayjs.Dayjs | undefined;
    let to: dayjs.Dayjs | undefined;
    if (dateRange && dateRange[0] && dateRange[1]) {
      from = dayjs(dateRange[0]);
      to = dayjs(dateRange[1]);
    }
    if (from?.isValid()) p.deadlineFrom = utcDayStart(from);
    if (to?.isValid()) p.deadlineTo = utcDayEnd(to);
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, priorityFilter, categoryFilter, dateRange]);

  useEffect(() => {
    resetFilters(filterParams);
  }, [filterParams, resetFilters]);

  const statsParams = useMemo(() => {
    const { status: _s, ...rest } = filterParams;
    return rest;
  }, [filterParams]);
  const { statsCreated } = useTaskStats(statsParams);

  const tabCounts: Record<string, number> = {
    '': statsCreated.total,
    yangi: statsCreated.yangi,
    jarayonda: statsCreated.jarayonda,
    tekshiruvda: statsCreated.tekshiruvda,
    bajarildi: statsCreated.bajarildi,
    kechikdi: statsCreated.kechikdi,
    'rad etildi': statsCreated['rad etildi'],
    bajarilmadi: statsCreated.bajarilmadi,
  };

  const hasActiveFilter =
    !!search ||
    !!priorityFilter ||
    !!categoryFilter ||
    !isSameIsoRange(dateRange, defaultRange);

  const clearAllFilters = () => {
    setSearch('');
    setPriorityFilter('');
    setCategoryFilter('');
    setDateRange(defaultRange);
  };

  const onTableChange: TableProps<Task>['onChange'] = (pag, _f, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const order = s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : null;
    const nextField = order ? 'deadline' : null;
    const changed = (sort?.field ?? null) !== nextField || (sort?.order ?? null) !== order;
    if (changed) setSort(nextField, order);
    else {
      setPage(pag.current ?? 1);
      setLimit(pag.pageSize ?? limit);
    }
  };

  const handleDelete = async () => {
    if (submitting || !deleteTarget) return;
    setSubmitting(true);
    try {
      await deleteTask(deleteTarget.id);
      message.success("Topshiriq o'chirildi");
      setDeleteTarget(null);
      if (page > 1 && rows.length === 1) setPage(page - 1);
      else void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e, "O'chirishda xatolik"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (submitting || !completeTarget) return;
    setSubmitting(true);
    try {
      await completeTask(completeTarget.id, closeStatus);
      message.success('Topshiriq yakunlandi');
      setCompleteTarget(null);
      if (page > 1 && rows.length === 1) setPage(page - 1);
      else void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Yakunlashda xatolik'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignReason.trim() || submitting || !reassignTarget) return;
    setSubmitting(true);
    try {
      await reassignTask(reassignTarget.id, reassignReason.trim());
      message.success('Topshiriq qayta topshirildi');
      setReassignTarget(null);
      setReassignReason('');
      void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Qayta topshirishda xatolik'));
    } finally {
      setSubmitting(false);
    }
  };

  const closeMeta =
    closeStatus === 'bajarildi'
      ? { color: colors.primary, text: 'Bajarildi deb yakunlash' }
      : { color: '#cf1322', text: 'Bajarilmadi deb yopish' };

  const columns: TableProps<Task>['columns'] = [
    {
      title: 'Topshiriq',
      dataIndex: 'title',
      key: 'title',
      width: '30%',
      render: (text: string, record) => (
        <div>
          <TaskTitle onClick={() => navigate(`${DETAIL_BASE}/${record.id}`)}>{text}</TaskTitle>
          <TaskId>
            {record.code || record.id} • {record.category}
          </TaskId>
        </div>
      ),
    },
    {
      title: 'Ijrochi',
      dataIndex: 'assignees',
      key: 'assignees',
      width: '18%',
      render: (_, record) => {
        const a = record.assignees[0];
        if (!a) return '—';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar size={28} style={{ background: colors.primary, fontSize: 12, flexShrink: 0 }}>
              {a.name.charAt(0)}
            </Avatar>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary, lineHeight: 1.3 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: colors.textSecondary }}>{a.position}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Muddat',
      dataIndex: 'deadline',
      key: 'deadline',
      width: '14%',
      render: (deadline: string) => {
        const overdue = dayjs(deadline).isBefore(dayjs(), 'day');
        return (
          <DeadlineCell $overdue={overdue}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(deadline).format('DD.MM.YYYY')}
          </DeadlineCell>
        );
      },
      sorter: true,
    },
    {
      title: 'Muhimlik',
      dataIndex: 'priority',
      key: 'priority',
      width: '10%',
      render: (p: Task['priority']) => <PriorityBadge priority={p} />,
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      key: 'status',
      width: '12%',
      render: (s: Task['status']) => <StatusBadge status={s} />,
    },
    {
      title: 'Javob',
      key: 'responses',
      width: '7%',
      render: (_, r) => (
        <span
          style={{ fontSize: 13, color: r.responseCount ? colors.primary : colors.textSecondary, cursor: 'pointer' }}
          onClick={() => navigate(`${DETAIL_BASE}/${r.id}`)}
        >
          💬 {r.responseCount}
        </span>
      ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: '10%',
      render: (_, record) => {
        const canManage = isLeader || (!!record.createdBy?.id && record.createdBy.id === myId);
        return (
          <Space size={4}>
            <ActionBtn icon={<EyeOutlined />} onClick={() => navigate(`${DETAIL_BASE}/${record.id}`)} type="text">
              Ko&apos;rish
            </ActionBtn>
            {canManage && canUpdate && ['yangi', 'jarayonda', 'kechikdi'].includes(record.status) && (
              <ActionBtn icon={<EditOutlined />} type="text" style={{ color: colors.primary }} onClick={() => setEditTarget(record)} />
            )}
            {canManage && canChangeStatus && record.status === 'tekshiruvda' && (
              <Tooltip title="Ijrochiga qayta topshirish (jarayondaga qaytarish)">
                <ActionBtn
                  icon={<RedoOutlined />}
                  type="text"
                  style={{ color: '#fa8c16' }}
                  onClick={() => {
                    setReassignReason('');
                    setReassignTarget(record);
                  }}
                />
              </Tooltip>
            )}
            {canManage && canChangeStatus && ['jarayonda', 'kechikdi', 'tekshiruvda'].includes(record.status) && (
              <ActionBtn icon={<CheckOutlined />} type="primary" style={{ background: colors.primary, borderColor: colors.primary }} onClick={() => openComplete(record)}>
                Yakunlash
              </ActionBtn>
            )}
            {canManage && canDelete && (
              <ActionBtn icon={<DeleteOutlined />} type="text" danger onClick={() => setDeleteTarget(record)} />
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Toolbar>
        <Input
          prefix={<SearchOutlined style={{ color: colors.textSecondary }} />}
          placeholder="Topshiriq qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 240, borderRadius: 8 }}
        />
        <Select
          placeholder="Muhimlik"
          value={priorityFilter || undefined}
          onChange={(v) => setPriorityFilter(v ?? '')}
          allowClear
          style={{ width: 140 }}
          options={priorities.map((p) => ({ value: p.value, label: p.label }))}
        />
        <Select
          placeholder="Kategoriya"
          value={categoryFilter || undefined}
          onChange={(v) => setCategoryFilter(v ?? '')}
          allowClear
          style={{ width: 150 }}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <RangePicker
          value={dateRange}
          onChange={(range) => {
            const from = displayToIso(range?.[0]);
            const to = displayToIso(range?.[1]);
            setDateRange(from && to ? [from, to] : null);
          }}
          format={RANGE_DISPLAY_FORMAT}
          placeholder={['Dan', 'Gacha']}
          style={{ borderRadius: 8, height: 40 }}
        />
        {hasActiveFilter && (
          <ClearAllBtn onClick={clearAllFilters}>
            <CloseOutlined /> Tozalash
          </ClearAllBtn>
        )}
        <Segmented
          value={view}
          onChange={(v) => setView(v as ViewMode)}
          style={{ marginLeft: 'auto' }}
          options={[
            { value: 'table', icon: <UnorderedListOutlined />, label: 'Jadval' },
            { value: 'board', icon: <AppstoreOutlined />, label: 'Doska' },
          ]}
        />
        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setCreateOpen(true)}
            style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8, height: 40 }}
          >
            Yangi topshiriq
          </Button>
        )}
      </Toolbar>

      {view === 'table' && (
        <TabRow>
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <TabChip key={tab.key} $active={active} onClick={() => setStatusFilter(tab.key)}>
                {tab.label}
                <ChipCount $active={active}>{tabCounts[tab.key] || 0}</ChipCount>
              </TabChip>
            );
          })}
        </TabRow>
      )}

      {view === 'board' ? (
        <TaskBoard
          fetcher={fetchTasksPage}
          filters={statsParams}
          detailBase={DETAIL_BASE}
          personField="assignee"
        />
      ) : (
        <Table<Task>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          onChange={onTableChange}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: (t) => `Jami: ${t} ta topshiriq`,
          }}
          style={{ background: '#fff', borderRadius: 12, border: `1px solid ${colors.border}` }}
          locale={{
            emptyText: loading ? (
              <Empty description="Yuklanmoqda..." />
            ) : error ? (
              <Empty description={error} />
            ) : (
              <Empty description="Topshiriqlar topilmadi" />
            ),
          }}
        />
      )}

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={reload} />
      <CreateTaskModal open={!!editTarget} editTask={editTarget} onClose={() => setEditTarget(null)} onSuccess={reload} />

      <Modal
        open={!!completeTarget}
        onCancel={() => setCompleteTarget(null)}
        onOk={handleComplete}
        okText={closeMeta.text}
        cancelText="Bekor qilish"
        okButtonProps={{ style: { background: closeMeta.color, borderColor: closeMeta.color, borderRadius: 8 } }}
        confirmLoading={submitting}
        cancelButtonProps={{ style: { borderRadius: 8 }, disabled: submitting }}
        width={440}
        centered
        closable={false}
        styles={{ body: { padding: '24px 24px 8px' } }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <ExclamationCircleFilled style={{ fontSize: 24, color: closeMeta.color, marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#101828', marginBottom: 8 }}>Topshiriqni yakunlash</div>
            <div style={{ fontSize: 13, color: '#667085', marginBottom: 14 }}>
              <strong style={{ color: '#101828' }}>&quot;{completeTarget?.title}&quot;</strong> — qanday holda yopasiz?
            </div>
            <Radio.Group value={closeStatus} onChange={(e) => setCloseStatus(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Radio value="bajarildi" style={{ padding: '10px 14px', border: `1.5px solid ${closeStatus === 'bajarildi' ? colors.primary : colors.border}`, borderRadius: 8, background: closeStatus === 'bajarildi' ? '#f0fdf4' : '#fff', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: colors.primary }}>✓ Bajarildi</span>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Ish qoniqarli — topshiriq muvaffaqiyatli yakunlandi</div>
              </Radio>
              <Radio value="bajarilmadi" style={{ padding: '10px 14px', border: `1.5px solid ${closeStatus === 'bajarilmadi' ? '#cf1322' : colors.border}`, borderRadius: 8, background: closeStatus === 'bajarilmadi' ? '#fff1f0' : '#fff', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#cf1322' }}>✗ Bajarilmadi</span>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Topshiriq bajarilmadi — butunlay yopiladi</div>
              </Radio>
            </Radio.Group>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!reassignTarget}
        onCancel={() => {
          setReassignTarget(null);
          setReassignReason('');
        }}
        onOk={handleReassign}
        okText="Qayta topshirish"
        cancelText="Bekor qilish"
        confirmLoading={submitting}
        okButtonProps={{ disabled: !reassignReason.trim() || submitting, style: { ...(reassignReason.trim() ? { background: '#fa8c16', borderColor: '#fa8c16' } : {}), borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 }, disabled: submitting }}
        width={440}
        centered
        closable={false}
        styles={{ body: { padding: '24px 24px 8px' } }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <RedoOutlined style={{ fontSize: 22, color: '#fa8c16', marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#101828', marginBottom: 6 }}>Ijrochiga qayta topshirish</div>
            <div style={{ fontSize: 14, color: '#667085', lineHeight: 1.6, marginBottom: 14 }}>
              <strong style={{ color: '#101828' }}>&quot;{reassignTarget?.title}&quot;</strong> topshirig&apos;i
              <strong style={{ color: '#fa8c16' }}> jarayonda</strong> holatiga qaytariladi. Ijrochiga sababini yozing:
            </div>
            <Textarea placeholder="Nima uchun qayta topshirilyapti?" rows={3} value={reassignReason} onChange={(v) => setReassignReason(v)} style={{ borderRadius: 8 }} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDelete}
        okText="Ha, o'chirish"
        cancelText="Bekor qilish"
        confirmLoading={submitting}
        okButtonProps={{ danger: true, style: { borderRadius: 8 }, disabled: submitting }}
        cancelButtonProps={{ style: { borderRadius: 8 }, disabled: submitting }}
        width={420}
        centered
        closable={false}
        styles={{ body: { padding: '24px 24px 8px' } }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <ExclamationCircleFilled style={{ fontSize: 24, color: '#F04438', marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#101828', marginBottom: 6 }}>Topshiriqni o&apos;chirish</div>
            <div style={{ fontSize: 14, color: '#667085', lineHeight: 1.6 }}>
              <strong style={{ color: '#101828' }}>&quot;{deleteTarget?.title}&quot;</strong> topshirig&apos;i arxivlanadi — ro&apos;yxat va hisobotlardan chiqadi, lekin tarixi saqlanib qoladi.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
