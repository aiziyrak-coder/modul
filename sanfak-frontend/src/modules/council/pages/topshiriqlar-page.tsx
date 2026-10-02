import { useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircleOutlined,
  CheckSquareOutlined,
  DownloadOutlined,
  FileAddOutlined,
  FileDoneOutlined,
  PlusOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { App, Button, DatePicker, Flex, Tabs, theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { StatusTag } from '../components/status-tag';
import { exportCsv } from '../lib/export-csv';
import { TaskDrawer } from '../components/task-drawer';
import { TaskDetailDrawer } from '../components/task-detail-drawer';
import { TaskRejectModal } from '../components/task-reject-modal';
import { TaskResultModal } from '../components/task-result-modal';
import type { CouncilTask, TaskStatus } from '../model/types';
import { TASK_STATUS_META, TASK_STATUS_ORDER } from '../model/status';
import { useCouncilRole } from '../model/role';
import {
  useTasks,
  useTaskTabsCount,
  useTaskRemove,
  useTaskApprove,
  useTaskReject,
  useTaskSubmit,
  useTaskDeleteResult,
} from '../api/council-api';

const fmt = (d?: string | null) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

type TabKey = 'all' | TaskStatus;

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  ...TASK_STATUS_ORDER.map((s) => ({ key: s, label: TASK_STATUS_META[s].label })),
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Barcha holatlar' },
  ...TASK_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_META[s].label })),
];

export default function TopshiriqlarPage() {
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const role = useCouncilRole();
  const isKotib = role === 'ilmiy_kengash_kotibi';
  const isAzo = role === 'ilmiy_kengash_azosi';
  const isRektor = role === 'rektor';

  const [activeKey, setActiveKey] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [deadlineRange, setDeadlineRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [drawer, setDrawer] = useState<{ open: boolean; task: CouncilTask | null }>({ open: false, task: null });
  const [detail, setDetail] = useState<{ open: boolean; task: CouncilTask | null }>({ open: false, task: null });
  const [reject, setReject] = useState<{ open: boolean; task: CouncilTask | null }>({ open: false, task: null });
  const [result, setResult] = useState<{ open: boolean; task: CouncilTask | null }>({ open: false, task: null });

  const statusFilter = activeKey === 'all' ? undefined : activeKey;
  const deadlineFrom = deadlineRange?.[0]?.format('YYYY-MM-DD');
  const deadlineTo = deadlineRange?.[1]?.format('YYYY-MM-DD');
  const { data, isLoading } = useTasks({
    search: search || undefined,
    status: statusFilter,
    deadlineFrom,
    deadlineTo,
  });
  const { data: counts } = useTaskTabsCount();

  const removeMut = useTaskRemove();
  const approveMut = useTaskApprove();
  const rejectMut = useTaskReject();
  const submitMut = useTaskSubmit();
  const deleteResultMut = useTaskDeleteResult();

  const rows = data ?? [];

  const tabItems = useMemo(
    () =>
      TAB_ITEMS.map((t) => {
        const count = t.key === 'all' ? undefined : counts?.[t.key];
        return {
          key: t.key,
          label: count !== undefined && count > 0 ? `${t.label} (${count})` : t.label,
        };
      }),
    [counts],
  );

  const statCards = useMemo<
    { key: string; icon: ReactNode; value: number; label: string; accent: string; sub?: ReactNode }[]
  >(() => {
    const n = (s: TaskStatus) => counts?.[s] ?? 0;
    const total = TASK_STATUS_ORDER.reduce((acc, s) => acc + n(s), 0);
    return [
      {
        key: 'total',
        icon: <FileDoneOutlined />,
        value: total,
        label: 'Jami',
        accent: token.colorPrimary,
        sub: "Barcha holatlar yig'indisi",
      },
      { key: 'new', icon: <FileAddOutlined />, value: n('new'), label: 'Yangi', accent: token.blue },
      { key: 'in_progress', icon: <SyncOutlined />, value: n('in_progress'), label: 'Jarayonda', accent: token.orange },
      { key: 'done', icon: <CheckSquareOutlined />, value: n('done'), label: 'Bajarildi', accent: token.cyan },
      { key: 'approved', icon: <CheckCircleOutlined />, value: n('approved'), label: 'Tasdiqlandi', accent: token.green },
      { key: 'overdue', icon: <WarningOutlined />, value: n('overdue'), label: "Muddati o'tdi", accent: token.red },
    ];
  }, [counts, token]);

  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = (task: CouncilTask) => {
    modal.confirm({
      title: 'Topshiriqni tasdiqlash',
      content: `"${task.title}" natijasi tasdiqlansinmi?`,
      okText: 'Tasdiqlash',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => approveMut.mutateAsync(task.id), 'Tasdiqlandi'),
    });
  };

  const handleDelete = (task: CouncilTask) => {
    modal.confirm({
      title: "Topshiriqni o'chirish",
      content: `"${task.title}" o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => removeMut.mutateAsync(task.id), "O'chirildi"),
    });
  };

  const handleDeleteResult = (task: CouncilTask) => {
    modal.confirm({
      title: "Natijani o'chirish",
      content: `"${task.title}" natijasi o'chirilsinmi? Topshiriq "Jarayonda" holatiga qaytadi.`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => deleteResultMut.mutateAsync(task.id), "Natija o'chirildi"),
    });
  };

  const hasFilters = Boolean(search) || activeKey !== 'all' || deadlineRange !== null;

  const handleResetFilters = () => {
    setSearch('');
    setActiveKey('all');
    setDeadlineRange(null);
    setResetCounter((c) => c + 1);
  };

  const onRejectConfirm = async (reason: string) => {
    if (!reject.task) return;
    await guard(() => rejectMut.mutateAsync({ id: reject.task!.id, reason }), 'Rad etildi');
    setReject({ open: false, task: null });
  };

  const onResultConfirm = async (files: File[]) => {
    if (!result.task) return;
    await guard(() => submitMut.mutateAsync({ id: result.task!.id, files }), 'Natija yuborildi');
    setResult({ open: false, task: null });
  };

  const handleExportCsv = () => {
    exportCsv(
      `topshiriqlar-${dayjs().format('YYYY-MM-DD')}`,
      ['Topshiriq', "A'zo", 'Muddat', 'Holat'],
      rows.map((t) => [
        t.title,
        t.assignee.fullName || '—',
        fmt(t.deadline),
        TASK_STATUS_META[t.status].label,
      ]),
    );
  };

  const openDetail = (task: CouncilTask) => setDetail({ open: true, task });

  const renderActions = (task: CouncilTask) => {
    if (isKotib) {
      if (task.status === 'new' || task.status === 'in_progress' || task.status === 'overdue')
        return (
          <ActionButtons
            onView={() => openDetail(task)}
            onEdit={() => setDrawer({ open: true, task })}
            onDelete={() => handleDelete(task)}
            hideToggle
          />
        );
      if (task.status === 'done')
        return (
          <ActionButtons
            onView={() => openDetail(task)}
            onConfirm={() => handleApprove(task)}
            onReturn={() => setReject({ open: true, task })}
            confirmLabel="Tasdiqlash"
            returnLabel="Rad etish"
            hideToggle
            hideEdit
            hideDelete
          />
        );
      return <ActionButtons onView={() => openDetail(task)} hideToggle hideEdit hideDelete />;
    }
    if (isAzo) {
      if (task.status === 'new' || task.status === 'in_progress' || task.status === 'overdue')
        return (
          <Flex gap={8} align="center" justify="flex-end">
            <Button size="small" type="primary" onClick={() => setResult({ open: true, task })}>
              Natija yuklash
            </Button>
            <ActionButtons onView={() => openDetail(task)} hideToggle hideEdit hideDelete />
          </Flex>
        );
      if (task.status === 'done')
        return (
          <ActionButtons
            onView={() => openDetail(task)}
            onEdit={() => setResult({ open: true, task })}
            onDelete={() => handleDeleteResult(task)}
            editLabel="Tahrirlash"
            hideToggle
          />
        );
      return <ActionButtons onView={() => openDetail(task)} hideToggle hideEdit hideDelete />;
    }
    return <ActionButtons onView={() => openDetail(task)} hideToggle hideEdit hideDelete />;
  };

  const columns: ColumnDef<CouncilTask, unknown>[] = [
    ...(isRektor
      ? ([
          { header: '№', id: '_n', size: 48, cell: ({ row }) => row.index + 1 },
        ] satisfies ColumnDef<CouncilTask, unknown>[])
      : []),
    {
      header: 'Topshiriq',
      id: 'title',
      cell: ({ row }) => <span style={{ fontWeight: 500 }}>{row.original.title}</span>,
    },
    {
      header: "A'zo",
      id: 'assignee',
      cell: ({ row }) => row.original.assignee.fullName || '—',
    },
    { header: 'Muddat', id: 'deadline', cell: ({ row }) => fmt(row.original.deadline) },
    {
      header: 'Holat',
      id: 'status',
      cell: ({ row }) => <StatusTag status={row.original.status} kind="task" />,
    },
    ...(isRektor
      ? ([
          {
            header: 'Natija',
            id: '_result',
            size: 150,
            cell: ({ row }) => {
              const file = row.original.resultFiles[0];
              if (!file) return <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>—</span>;
              return (
                <a href={file} target="_blank" rel="noreferrer">
                  <DownloadOutlined style={{ marginRight: 6 }} />
                  Yuklab olish
                </a>
              );
            },
          },
        ] satisfies ColumnDef<CouncilTask, unknown>[])
      : []),
    {
      header: 'Amallar',
      id: '_a',
      size: 170,
      meta: { align: 'right' as const },
      cell: ({ row }) => renderActions(row.original),
    },
  ];

  return (
    <PageContainer title="Topshiriqlar">
      <PageHeader
        title={isAzo ? 'Topshiriqlar — mening topshiriqlarim' : 'Topshiriqlar'}
        extra={
          isKotib ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDrawer({ open: true, task: null })}
              style={{ height: 40 }}
            >
              Topshiriq berish
            </Button>
          ) : role === 'rektor' ? (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              style={{ height: 40 }}
            >
              CSV yuklab olish
            </Button>
          ) : undefined
        }
      />

      {isRektor && (
        <Flex gap={16} wrap style={{ marginBottom: 18 }}>
          {statCards.map((c) => (
            <StatCard
              key={c.key}
              icon={c.icon}
              value={c.value}
              label={c.label}
              accent={c.accent}
              sub={c.sub}
            />
          ))}
        </Flex>
      )}

      <Tabs
        activeKey={activeKey}
        items={tabItems}
        onChange={(key) => setActiveKey(key as TabKey)}
      />

      <Filters
        key={resetCounter}
        searchPlaceholder="Topshiriq nomi bo'yicha"
        onSearch={setSearch}
        selects={[
          {
            key: 'status',
            placeholder: 'Barcha holatlar',
            value: activeKey,
            options: STATUS_OPTIONS,
            onChange: (v) => setActiveKey((v ?? 'all') as TabKey),
          },
        ]}
        extra={
          <Flex gap="small" align="center" wrap>
            <DatePicker.RangePicker
              value={deadlineRange}
              format="DD.MM.YYYY"
              placeholder={['Muddat (dan)', 'Muddat (gacha)']}
              onChange={(v) => setDeadlineRange(v)}
              style={{ height: 38 }}
            />
            {hasFilters && (
              <Button onClick={handleResetFilters} style={{ height: 38 }}>
                Tozalash
              </Button>
            )}
          </Flex>
        }
      />

      <DataTable<CouncilTask>
        data={rows}
        columns={columns}
        loading={isLoading}
        page={1}
        pageSize={rows.length || 1}
      />

      <TaskDrawer
        open={drawer.open}
        task={drawer.task}
        onClose={() => setDrawer({ open: false, task: null })}
      />
      <TaskDetailDrawer
        open={detail.open}
        task={detail.task}
        isKotib={isKotib}
        onClose={() => setDetail({ open: false, task: null })}
        onApprove={(t) => {
          setDetail({ open: false, task: null });
          handleApprove(t);
        }}
        onReject={(t) => {
          setDetail({ open: false, task: null });
          setReject({ open: true, task: t });
        }}
      />
      <TaskRejectModal
        open={reject.open}
        loading={rejectMut.isPending}
        onCancel={() => setReject({ open: false, task: null })}
        onConfirm={onRejectConfirm}
      />
      <TaskResultModal
        open={result.open}
        task={result.task}
        loading={submitMut.isPending}
        onCancel={() => setResult({ open: false, task: null })}
        onConfirm={onResultConfirm}
      />
    </PageContainer>
  );
}
