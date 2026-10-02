import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { Button, DatePicker, Flex, Select, Tag, theme } from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable } from '@/shared/ui';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { StatusTag } from '../components/status-tag';
import type { VotingSession, VotingStatus } from '../model/types';
import { useDocSetting, useVotingReport, useVotingReportPdf } from '../api/council-api';
import { exportCsv } from '../lib/export-csv';

const { RangePicker } = DatePicker;

const fmt = (d?: string) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const STATUS_LABEL: Record<VotingStatus, string> = {
  active: 'Faol',
  approved: 'Tasdiqlandi',
  rejected: 'Rad etildi',
};

const RANK_LABEL: Record<string, string | undefined> = {
  dotsent: 'Dotsent',
  professor: 'Professor',
};

const RANK_TAG_COLOR: Record<string, string | undefined> = {
  dotsent: 'geekblue',
  professor: 'purple',
};

const rankKey = (rt: string) => rt.trim().toLowerCase();

const rankLabel = (rt: string) =>
  RANK_LABEL[rankKey(rt)] ?? rt.charAt(0).toUpperCase() + rt.slice(1);

const rankColor = (rt: string) => RANK_TAG_COLOR[rankKey(rt)] ?? 'blue';

const nameOf = (s: VotingSession) =>
  s.mode === 'single' && s.candidates[0] ? s.candidates[0].user.fullName : s.title;

const dateOf = (s: VotingSession) => s.createdAt ?? s.endDate;

type DateRange = [Dayjs | null, Dayjs | null] | null;

interface ReportFilter {
  range: DateRange;
  rankType?: string;
  result?: VotingStatus;
}

const EMPTY_FILTER: ReportFilter = { range: null, rankType: undefined, result: undefined };

function VoteResults({ session }: { session: VotingSession }) {
  const r = session.results;
  if (!r) return <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>—</span>;
  return (
    <span
      style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
      title="Rozilar / Qarshilar / Qatnashmaganlar"
    >
      <span style={{ color: 'var(--color-success, #16a34a)' }}>{r.for ?? 0}</span>
      <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>/</span>
      <span style={{ color: 'var(--color-error, #dc2626)' }}>{r.against ?? 0}</span>
      <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>/</span>
      <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>{r.abstain ?? 0}</span>
    </span>
  );
}

export default function HisobotlarPage() {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<ReportFilter>(EMPTY_FILTER);
  const [applied, setApplied] = useState<ReportFilter>(EMPTY_FILTER);

  const report = useVotingReport();
  const reportPdf = useVotingReportPdf();
  const docSetting = useDocSetting();

  const raw = useMemo<VotingSession[]>(() => report.data ?? [], [report.data]);

  const totalCount = raw.length;
  const approvedCount = useMemo(() => raw.filter((s) => s.status === 'approved').length, [raw]);
  const rejectedCount = useMemo(() => raw.filter((s) => s.status === 'rejected').length, [raw]);

  const rankOptions = useMemo(() => {
    const fromSetting = docSetting.data?.rankTypes ?? [];
    const source =
      fromSetting.length > 0
        ? fromSetting
        : raw.map((s) => s.rankType).filter((rt): rt is string => !!rt);
    const byKey = new Map<string, string>();
    source.forEach((rt) => {
      const key = rankKey(rt);
      if (key && !byKey.has(key)) byKey.set(key, rt.trim());
    });
    return Array.from(byKey.values()).map((rt) => ({ value: rt, label: rankLabel(rt) }));
  }, [docSetting.data, raw]);

  const rows = useMemo<VotingSession[]>(() => {
    const [from, to] = applied.range ?? [null, null];
    const list = raw.filter((s) => {
      if (applied.result && s.status !== applied.result) return false;
      if (applied.rankType && rankKey(s.rankType ?? '') !== rankKey(applied.rankType)) return false;
      if (from || to) {
        const d = dayjs(dateOf(s));
        if (!d.isValid()) return false;
        if (from && d.isBefore(from, 'day')) return false;
        if (to && d.isAfter(to, 'day')) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => (dateOf(b) ?? '').localeCompare(dateOf(a) ?? ''));
  }, [raw, applied]);

  const isLoading = report.isLoading;

  const handleApply = () => setApplied(draft);
  const handleReset = () => {
    setDraft(EMPTY_FILTER);
    setApplied(EMPTY_FILTER);
  };

  const handleExport = () => {
    exportCsv(
      'kengash-hisobotlar',
      [
        'Ism',
        'Unvon',
        'Kafedra',
        'Tanlov lavozimi',
        'Sana',
        'Rozilar',
        'Qarshilar',
        'Qatnashmaganlar',
        'Natija',
      ],
      rows.map((s) => [
        nameOf(s),
        s.rankType ? rankLabel(s.rankType) : '',
        s.department?.title ?? '',
        s.rankType ? rankLabel(s.rankType) : '',
        fmt(dateOf(s)),
        s.results?.for ?? 0,
        s.results?.against ?? 0,
        s.results?.abstain ?? 0,
        STATUS_LABEL[s.status],
      ]),
    );
  };

  const columns: ColumnDef<VotingSession, unknown>[] = [
    { header: 'Ism', id: 'name', cell: ({ row }) => nameOf(row.original) },
    {
      header: 'Unvon',
      id: 'rankType',
      cell: ({ row }) =>
        row.original.rankType ? (
          <Tag
            color={rankColor(row.original.rankType)}
            style={{ borderRadius: 6, fontWeight: 500, margin: 0 }}
          >
            {rankLabel(row.original.rankType)}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      header: 'Kafedra',
      id: 'department',
      cell: ({ row }) => row.original.department?.title ?? '—',
    },
    {
      header: 'Tanlov lavozimi',
      id: 'position',
      cell: ({ row }) => (row.original.rankType ? rankLabel(row.original.rankType) : '—'),
    },
    {
      header: 'Sana',
      id: 'createdAt',
      cell: ({ row }) => fmt(dateOf(row.original)),
    },
    {
      header: 'Ovoz natijasi',
      id: 'results',
      cell: ({ row }) => <VoteResults session={row.original} />,
    },
    {
      header: 'Natija',
      id: 'status',
      cell: ({ row }) => <StatusTag status={row.original.status} kind="voting" />,
    },
  ];

  return (
    <PageContainer title="Hisobotlar">
      <PageHeader
        title="Ovoz berish tarixi"
        extra={
          <Flex gap={8} wrap>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              loading={reportPdf.isPending}
              disabled={rows.length === 0}
              onClick={() =>
                reportPdf.mutate({
                  rankType: applied.rankType,
                  status: applied.result,
                })
              }
            >
              PDF yuklab olish
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={rows.length === 0}>
              CSV yuklab olish
            </Button>
          </Flex>
        }
      />

      <Flex gap={16} wrap style={{ marginBottom: 18 }}>
        <StatCard
          icon={<AuditOutlined />}
          value={totalCount}
          label="Jami ko'rib chiqildi"
          accent={token.blue6}
        />
        <StatCard
          icon={<CheckCircleOutlined />}
          value={approvedCount}
          label="Tasdiqlandi"
          accent={token.colorSuccess}
        />
        <StatCard
          icon={<CloseCircleOutlined />}
          value={rejectedCount}
          label="Rad etildi"
          accent={token.colorError}
        />
      </Flex>

      <Flex gap={12} wrap align="center" style={{ marginBottom: 20 }}>
        <RangePicker
          value={draft.range}
          onChange={(range) => setDraft((d) => ({ ...d, range }))}
          format="DD.MM.YYYY"
          style={{ height: 38 }}
        />
        <Select
          placeholder="Unvon"
          value={draft.rankType}
          options={rankOptions}
          onChange={(v?: string) => setDraft((d) => ({ ...d, rankType: v }))}
          allowClear
          style={{ minWidth: 160, height: 38 }}
        />
        <Select
          placeholder="Natija"
          value={draft.result}
          options={[
            { value: 'approved', label: 'Tasdiqlandi' },
            { value: 'rejected', label: 'Rad etildi' },
          ]}
          onChange={(v?: VotingStatus) => setDraft((d) => ({ ...d, result: v }))}
          allowClear
          style={{ minWidth: 160, height: 38 }}
        />
        <Button type="primary" icon={<FilterOutlined />} onClick={handleApply}>
          Filter
        </Button>
        <Button icon={<ClearOutlined />} onClick={handleReset}>
          Tozalash
        </Button>
      </Flex>

      <DataTable<VotingSession>
        data={rows}
        columns={columns}
        loading={isLoading}
        page={1}
        pageSize={rows.length || 1}
        onPageChange={() => undefined}
      />
    </PageContainer>
  );
}
