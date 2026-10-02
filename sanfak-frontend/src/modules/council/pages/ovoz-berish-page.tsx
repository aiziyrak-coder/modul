import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { App, Button, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Tab } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { StatusTag } from '../components/status-tag';
import { VotingCreateModal } from '../components/voting-create-modal';
import { VoteModal } from '../components/vote-modal';
import { VotingMonitorModal } from '../components/voting-monitor-modal';
import type { VotingSession, VotingStatus } from '../model/types';
import { useCouncilRole } from '../model/role';
import { useVotingSessions, useVotingTabsCount, useVotingFinalize, useMyVote } from '../api/council-api';

const fmt = (d?: string | null) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const MODE_LABEL: Record<VotingSession['mode'], string> = {
  single: "Ha / Yo'q",
  choice: 'Nomzod tanlash',
};

type TabKey = VotingStatus;
const TABS: { value: TabKey; label: string }[] = [
  { value: 'active', label: 'Faol' },
  { value: 'approved', label: 'Tasdiqlangan' },
  { value: 'rejected', label: 'Rad etilgan' },
];

function AzoVoteCell({ session, onVote }: { session: VotingSession; onVote: () => void }) {
  const { data: myVote } = useMyVote(session.id, session.status === 'active');
  if (!myVote?.hasVoted) {
    return (
      <Button size="small" type="primary" onClick={onVote}>
        Ovoz berish
      </Button>
    );
  }
  if (session.mode === 'choice') {
    const chosen = session.candidates.find((c) => c.user.id === myVote.candidate);
    return (
      <Typography.Text strong style={{ color: 'var(--brand-primary)' }}>
        Ovozingiz: {chosen?.user.fullName || '—'} ✓
      </Typography.Text>
    );
  }
  return myVote.choice === 'against' ? (
    <Typography.Text strong style={{ color: 'var(--brand-error)' }}>
      Ovozingiz: Yo'q ✕
    </Typography.Text>
  ) : (
    <Typography.Text strong style={{ color: 'var(--brand-primary)' }}>
      Ovozingiz: Ha ✓
    </Typography.Text>
  );
}

function ResultSummary({ session }: { session: VotingSession }) {
  const r = session.results;
  if (!r) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <Flex vertical gap={2}>
      <Typography.Text style={{ fontSize: 12 }}>
        Rozi: {r.for ?? 0} · Qarshi: {r.against ?? 0} · Betaraf: {r.abstain ?? 0}
      </Typography.Text>
      {r.winner?.fullName ? (
        <Typography.Text style={{ fontSize: 12, color: 'var(--brand-primary)' }}>
          G'olib: {r.winner.fullName}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}

export default function OvozBerishPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const role = useCouncilRole();
  const isKotib = role === 'ilmiy_kengash_kotibi';

  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [vote, setVote] = useState<{ open: boolean; session: VotingSession | null }>({ open: false, session: null });
  const [monitor, setMonitor] = useState<{ open: boolean; session: VotingSession | null }>({ open: false, session: null });

  const { data, isLoading } = useVotingSessions({ search: search || undefined, status: activeTab });
  const { data: counts } = useVotingTabsCount();
  const finalize = useVotingFinalize();

  const rows = useMemo(() => data ?? [], [data]);

  const groups = useMemo(() => {
    const map = new Map<string, VotingSession[]>();
    for (const s of rows) {
      const dept = s.department?.title ?? 'Boshqa';
      const key = s.rankType ? `${dept} · ${s.rankType}` : dept;
      const bucket = map.get(key);
      if (bucket) bucket.push(s);
      else map.set(key, [s]);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [rows]);

  const tabOptions = useMemo(
    () =>
      TABS.map((t) => ({
        value: t.value,
        label: `${t.label} (${counts?.[t.value] ?? 0})`,
      })),
    [counts],
  );

  const handleFinalize = (s: VotingSession) => {
    modal.confirm({
      title: 'So‘rovnomani yakunlash',
      content: `"${s.title}" yakunlansinmi? Yakunlangach ovoz berib bo'lmaydi.`,
      okText: 'Yakunlash',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await finalize.mutateAsync(s.id);
          message.success('Yakunlandi');
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const renderActions = (s: VotingSession) => {
    if (isKotib) {
      return (
        <Flex gap={8} justify="flex-end">
          <Button size="small" onClick={() => setMonitor({ open: true, session: s })}>
            Jarayonni kuzatish
          </Button>
          {s.status === 'active' ? (
            <Button size="small" type="primary" onClick={() => handleFinalize(s)}>
              Yakunlash
            </Button>
          ) : null}
        </Flex>
      );
    }
    if (s.status !== 'active') return <Typography.Text type="secondary">—</Typography.Text>;
    return <AzoVoteCell session={s} onVote={() => setVote({ open: true, session: s })} />;
  };

  const fixedCol = (w: number) => ({ width: w, minWidth: w, maxWidth: w });
  const columns: ColumnDef<VotingSession, unknown>[] = [
    {
      header: "So'rovnoma",
      id: 'title',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{row.original.title}</div>
          {row.original.department?.title ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-soft, #697586)' }}>
              {row.original.department.title}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: () => <div style={fixedCol(120)}>Turi</div>,
      id: 'mode',
      cell: ({ row }) => <div style={fixedCol(120)}>{MODE_LABEL[row.original.mode]}</div>,
    },
    {
      header: () => <div style={fixedCol(210)}>Muddat</div>,
      id: 'period',
      cell: ({ row }) => (
        <div style={fixedCol(210)}>
          {fmt(row.original.startDate)} — {fmt(row.original.endDate)}
        </div>
      ),
    },
    {
      header: () => <div style={fixedCol(170)}>Natija</div>,
      id: 'result',
      cell: ({ row }) => (
        <div style={fixedCol(170)}>
          {row.original.status === 'active' ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <ResultSummary session={row.original} />
          )}
        </div>
      ),
    },
    {
      header: () => <div style={fixedCol(96)}>Status</div>,
      id: 'status',
      cell: ({ row }) => (
        <div style={fixedCol(96)}>
          <StatusTag status={row.original.status} kind="voting" />
        </div>
      ),
    },
    {
      header: () => <div style={fixedCol(240)}>Amallar</div>,
      id: '_a',
      meta: { align: 'right' as const },
      cell: ({ row }) => <div style={fixedCol(240)}>{renderActions(row.original)}</div>,
    },
  ];

  return (
    <PageContainer title="Ovoz berish">
      <PageHeader
        title="Ovoz berish"
        extra={
          isKotib ? (
            <Flex gap={12} align="center" wrap>
              <Button
                icon={<SettingOutlined />}
                onClick={() => navigate('/kengash/sozlamalar')}
                style={{ height: 40 }}
              >
                Sozlamalar
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateOpen(true)}
                style={{ height: 40 }}
              >
                So'rovnoma yaratish
              </Button>
            </Flex>
          ) : undefined
        }
      />

      <Flex style={{ marginBottom: 16 }}>
        <Tab options={tabOptions} value={activeTab} onChange={(v) => setActiveTab(v as TabKey)} />
      </Flex>

      <Filters searchPlaceholder="So'rovnoma nomi bo'yicha" onSearch={setSearch} />

      {groups.length === 0 ? (
        <DataTable<VotingSession>
          data={rows}
          columns={columns}
          loading={isLoading}
          page={1}
          pageSize={rows.length || 1}
        />
      ) : (
        groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 'var(--space-5)' }}>
            <Typography.Title level={5} style={{ margin: '0 0 var(--space-2)' }}>
              {g.label} ({g.items.length})
            </Typography.Title>
            <DataTable<VotingSession>
              data={g.items}
              columns={columns}
              loading={isLoading}
              page={1}
              pageSize={g.items.length || 1}
            />
          </div>
        ))
      )}

      <VotingCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <VoteModal
        open={vote.open}
        session={vote.session}
        onClose={() => setVote({ open: false, session: null })}
      />
      <VotingMonitorModal
        open={monitor.open}
        session={monitor.session}
        onClose={() => setMonitor({ open: false, session: null })}
      />
    </PageContainer>
  );
}
