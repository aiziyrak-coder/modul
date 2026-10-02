import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FileProtectOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Tag } from 'antd';
import dayjs from 'dayjs';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { StatusTag } from '../components/status-tag';
import { RankSubmitModal } from '../components/rank-submit-modal';
import { RankReturnModal } from '../components/rank-return-modal';
import { RankDrawer } from '../components/rank-drawer';
import { RankDiplomaModal } from '../components/rank-diploma-modal';
import type { RankApplication, RankStatus, RankTab } from '../model/types';
import { RANK_STATUS_META } from '../model/status';
import { useCouncilRole } from '../model/role';
import {
  fetchRankAppsPage,
  useDocSetting,
  useRankAccept,
  useRankArchive,
  useRankRemove,
  useRankTabsCount,
  useRankUpdate,
} from '../api/council-api';
import { useServerTable } from '../lib/use-server-table';

const fmt = (d?: string | null) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const RANK_TYPE_LABEL: Record<string, string | undefined> = {
  dotsent: 'Dotsent',
  professor: 'Professor',
};

const rankTypeLabel = (rt?: string | null) => (rt ? (RANK_TYPE_LABEL[rt.toLowerCase()] ?? rt) : '—');

type TabKey = RankTab;

const CATEGORY_UI = {
  rank: {
    basePath: '/kengash/unvonlar',
    pageTitle: 'Unvon arizalari',
    typeLabel: 'Unvon turi',
    ofLabel: 'unvoni',
  },
  position: {
    basePath: '/kengash/lavozimlar',
    pageTitle: 'Lavozim arizalari',
    typeLabel: 'Lavozim turi',
    ofLabel: 'lavozimi',
  },
} as const;

type CategoryKey = keyof typeof CATEGORY_UI;

const tabPathsOf = (basePath: string): Record<TabKey, string> => ({
  documents: `${basePath}/hujjatlar`,
  accepted: `${basePath}/tasdiqlangan`,
  archive: `${basePath}/arxiv`,
});

const TAB_STATUSES: Record<TabKey, RankStatus[]> = {
  documents: ['new'],
  accepted: ['accepted'],
  archive: ['accepted', 'returned'],
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'documents', label: 'Hujjatlar' },
  { key: 'accepted', label: 'Tasdiqlangan' },
  { key: 'archive', label: 'Arxiv' },
];

export default function UnvonlarPage() {
  const { message, modal } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const role = useCouncilRole();
  const isKotib = role === 'ilmiy_kengash_kotibi';
  const isTeacher = role === 'oqituvchi';

  const pathname = location.pathname.replace(/\/+$/, '');

  const category: CategoryKey = pathname.startsWith(CATEGORY_UI.position.basePath)
    ? 'position'
    : 'rank';
  const ui = CATEGORY_UI[category];
  const BASE_PATH = ui.basePath;
  const TAB_PATH = tabPathsOf(BASE_PATH);
  const activeTab: TabKey = pathname.endsWith('/arxiv')
    ? 'archive'
    : pathname.endsWith('/tasdiqlangan')
      ? 'accepted'
      : 'documents';

  const [search, setSearch] = useState('');
  const [rankTypeFilter, setRankTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<RankStatus | undefined>();
  const [diplomaFilter, setDiplomaFilter] = useState<string | undefined>();
  const [filtersKey, setFiltersKey] = useState(0);
  const [viewId, setViewId] = useState<string | null>(null);
  const [submit, setSubmit] = useState<{ open: boolean; application: RankApplication | null }>({
    open: false,
    application: null,
  });
  const [diplomaApp, setDiplomaApp] = useState<RankApplication | null>(null);
  const [returnApp, setReturnApp] = useState<RankApplication | null>(null);

  const activeStatuses = TAB_STATUSES[activeTab];

  const { data: counts } = useRankTabsCount(category);
  const { data: docSetting } = useDocSetting();

  const removeMut = useRankRemove();
  const archiveMut = useRankArchive();
  const acceptMut = useRankAccept();
  const updateMut = useRankUpdate();

  const { rows, total, page, limit, loading, setPage, setLimit, resetFilters, reload } =
    useServerTable<RankApplication>(fetchRankAppsPage, { initialLimit: 12 });

  useEffect(() => {
    resetFilters({
      tab: activeTab,
      category,
      search: search || undefined,
      rankType: rankTypeFilter,
      status: statusFilter,
      hasDiploma: diplomaFilter,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, category, search, rankTypeFilter, statusFilter, diplomaFilter]);

  const viewApp = useMemo(() => rows.find((a) => a.id === viewId) ?? null, [rows, viewId]);

  const rankTypeOptions = useMemo(
    () =>
      ((category === 'position' ? docSetting?.positionTypes : docSetting?.rankTypes) ?? []).map(
        (r) => ({ value: r, label: rankTypeLabel(r) }),
      ),
    [docSetting, category],
  );

  const statusOptions = activeStatuses.map((s) => ({
    value: s,
    label: RANK_STATUS_META[s].label,
  }));

  const hasActiveFilters = Boolean(search.trim() || rankTypeFilter || statusFilter || diplomaFilter);
  const clearFilters = () => {
    setSearch('');
    setRankTypeFilter(undefined);
    setStatusFilter(undefined);
    setDiplomaFilter(undefined);
    setFiltersKey((k) => k + 1);
  };

  const afterMutation = () => {
    if (page > 1 && rows.length === 1) setPage(page - 1);
    else void reload();
  };

  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      afterMutation();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = (a: RankApplication) => {
    modal.confirm({
      title: "Arizani o'chirish",
      content: `${rankTypeLabel(a.rankType)} ${ui.ofLabel} arizasi o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => removeMut.mutateAsync(a.id), "Ariza o'chirildi"),
    });
  };

  const handleArchive = (a: RankApplication) => {
    modal.confirm({
      title: 'Arxivga ko\'chirish',
      content: `${a.applicant.fullName || '—'} — ${rankTypeLabel(a.rankType)} arizasi Arxiv bo'limiga ko'chirilsinmi?`,
      okText: 'Arxivga ko\'chirish',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => archiveMut.mutateAsync(a.id), 'Ariza arxivga ko\'chirildi'),
    });
  };

  const handleAccept = (a: RankApplication) => {
    modal.confirm({
      title: 'Arizani tasdiqlash',
      content: `${a.applicant.fullName || '—'} — ${rankTypeLabel(a.rankType)} arizasi tasdiqlansinmi?`,
      okText: 'Tasdiqlash',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => acceptMut.mutateAsync(a.id), 'Ariza tasdiqlandi'),
    });
  };

  const handleDeleteDoc = (docName: string) => {
    if (!viewApp || updateMut.isPending) return;
    const submittedDocs = viewApp.submittedDocs
      .filter((d) => d.name !== docName)
      .map((d) => ({ name: d.name, fileUrl: d.fileUrl ?? undefined }));
    void guard(
      () => updateMut.mutateAsync({ id: viewApp.id, input: { submittedDocs } }),
      "Hujjat o'chirildi",
    );
  };

  const renderActions = (a: RankApplication) => {
    if (a.status === 'returned' && isTeacher) {
      return (
        <ActionButtons
          onView={() => setViewId(a.id)}
          onEdit={() => setSubmit({ open: true, application: a })}
          hideToggle
          hideDelete
        />
      );
    }
    if (a.status === 'new' && isTeacher) {
      return (
        <ActionButtons
          onView={() => setViewId(a.id)}
          onEdit={() => setSubmit({ open: true, application: a })}
          onDelete={() => handleDelete(a)}
          hideToggle
        />
      );
    }
    if (a.status === 'accepted' && !a.archived && isKotib) {
      return (
        <Flex gap={4} align="center">
          {category === 'rank' && (
          <Button
            type="link"
            size="small"
            icon={<FileProtectOutlined />}
            onClick={() => setDiplomaApp(a)}
            style={{ padding: 0, height: 'auto' }}
          >
            {a.diploma ? 'Diplom' : 'Diplom yuklash'}
          </Button>
          )}
          <ActionButtons
            onView={() => setViewId(a.id)}
            onDelete={() => handleArchive(a)}
            hideToggle
            hideEdit
          />
        </Flex>
      );
    }
    if (a.status === 'new' && isKotib) {
      return (
        <ActionButtons
          onView={() => setViewId(a.id)}
          onConfirm={() => handleAccept(a)}
          onReturn={() => setReturnApp(a)}
          confirmLabel="Qabul qilish"
          returnLabel="Qaytarish"
          hideToggle
          hideEdit
          hideDelete
        />
      );
    }
    return <ActionButtons onView={() => setViewId(a.id)} hideToggle hideEdit hideDelete />;
  };

  const columns: ColumnDef<RankApplication>[] = [
    { header: '#', id: '_i', size: 44, cell: ({ row }) => row.index + 1 },
    {
      header: "O'qituvchi",
      id: 'applicant',
      cell: ({ row }) => (
        <Button
          type="link"
          onClick={() => setViewId(row.original.id)}
          style={{ padding: 0, height: 'auto', fontWeight: 500 }}
        >
          {row.original.applicant.fullName || '—'}
        </Button>
      ),
    },
    {
      header: ui.typeLabel,
      id: 'rankType',
      cell: ({ row }) => (
        <Tag style={{ borderRadius: 6, margin: 0 }}>{rankTypeLabel(row.original.rankType)}</Tag>
      ),
    },
    {
      header: 'Kafedra',
      id: 'department',
      cell: ({ row }) => row.original.department?.title ?? '—',
    },
    {
      header: 'Topshirilgan sana',
      id: 'submittedAt',
      size: 140,
      cell: ({ row }) => fmt(row.original.submittedAt),
    },
    {
      header: 'Holat',
      id: 'status',
      cell: ({ row }) => <StatusTag status={row.original.status} kind="rank" />,
    },
    {
      header: 'Amallar',
      id: '_a',
      size: 150,
      meta: { align: 'right' as const },
      cell: ({ row }) => renderActions(row.original),
    },
  ];

  if (pathname === BASE_PATH) return <Navigate to={TAB_PATH.documents} replace />;

  return (
    <PageContainer title={ui.pageTitle}>
      <PageHeader
        title={ui.pageTitle}
        extra={
          isTeacher ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setSubmit({ open: true, application: null })}
              style={{ height: 40 }}
            >
              Hujjat topshirish
            </Button>
          ) : undefined
        }
      />

      <Flex gap={8} wrap style={{ marginBottom: 16 }}>
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          const count = counts?.[t.key === 'documents' ? 'new' : t.key] ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setStatusFilter(undefined);
                navigate(TAB_PATH[t.key]);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 14px',
                borderRadius: 'var(--radius-pill, 999px)',
                border: '1px solid',
                borderColor: isActive ? 'var(--brand-primary)' : 'var(--color-border)',
                background: isActive ? 'var(--brand-primary)' : 'var(--color-bg-elevate, #fff)',
                color: isActive ? '#fff' : 'var(--color-text)',
                fontWeight: 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all .15s ease',
              }}
            >
              {t.label}
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 10,
                  fontSize: 12,
                  lineHeight: '20px',
                  textAlign: 'center',
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--color-border-soft, #eef2f6)',
                  color: isActive ? '#fff' : 'var(--color-text-soft, #697586)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </Flex>

      <Filters
        key={filtersKey}
        searchPlaceholder="F.I.SH bo'yicha qidirish"
        onSearch={setSearch}
        selects={[
          {
            key: 'rankType',
            placeholder: ui.typeLabel,
            value: rankTypeFilter,
            options: rankTypeOptions,
            onChange: (v) => setRankTypeFilter(v as string | undefined),
          },
          {
            key: 'status',
            placeholder: 'Holat',
            value: statusFilter,
            options: statusOptions,
            onChange: (v) => setStatusFilter(v as RankStatus | undefined),
          },
          ...(activeTab === 'accepted' && category === 'rank'
            ? [
                {
                  key: 'hasDiploma',
                  placeholder: 'Diplom',
                  value: diplomaFilter,
                  options: [
                    { value: 'true', label: 'Diplom bor' },
                    { value: 'false', label: "Diplom yo'q" },
                  ],
                  onChange: (v: unknown) => setDiplomaFilter(v as string | undefined),
                },
              ]
            : []),
        ]}
        extra={
          hasActiveFilters ? (
            <Button onClick={clearFilters} style={{ height: 38 }}>
              Tozalash
            </Button>
          ) : undefined
        }
      />

      <DataTable<RankApplication>
        data={rows}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => setLimit(size)}
      />

      <RankDrawer
        open={Boolean(viewId && viewApp)}
        application={viewApp}
        role={role}
        onClose={() => setViewId(null)}
        onAccept={(a) => handleAccept(a)}
        onReturn={(a) => setReturnApp(a)}
        onDeleteDoc={handleDeleteDoc}
      />

      <RankSubmitModal
        open={submit.open}
        application={submit.application}
        category={category}
        onClose={() => setSubmit({ open: false, application: null })}
        onSuccess={reload}
      />
      <RankDiplomaModal
        application={diplomaApp}
        onClose={() => setDiplomaApp(null)}
        onSuccess={afterMutation}
      />
      <RankReturnModal
        open={!!returnApp}
        application={returnApp}
        onClose={() => setReturnApp(null)}
        onSuccess={afterMutation}
      />
    </PageContainer>
  );
}
