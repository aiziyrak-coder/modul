import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DownloadOutlined, FilePdfOutlined, PaperClipOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Space, Tag, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { PageHeader } from '../../components/page-header';
import {
  useAuditLogs,
  useAuditLogModules,
  useSectionTitles,
  downloadAuditLogExcel,
  downloadAuditLogPdf,
  type AuditLogEntry,
} from '../api/audit-log-api';
import { cleanSegment, humanizeAction, isDenied, toSectionKey } from '../lib/humanize';

const LIMIT = 24;

const METHOD_COLOR: Record<string, string> = {
  GET: 'default',
  POST: 'green',
  PUT: 'blue',
  PATCH: 'cyan',
  DELETE: 'red',
};

const statusColor = (code: number | null): string => {
  if (code == null) return 'default';
  if (code >= 500) return 'red';
  if (code === 403 || code === 401) return 'orange';
  if (code >= 400) return 'gold';
  return 'green';
};

export default function AuditLogsListPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState<string | undefined>();
  const [method, setMethod] = useState<string | undefined>();
  const [onlyMutations, setOnlyMutations] = useState(false);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const filter = {
    page,
    limit: pageSize,
    ...(search ? { search } : {}),
    ...(module ? { module } : {}),
    ...(method ? { method } : {}),
    ...(onlyMutations ? { onlyMutations: true } : {}),
    ...(range?.[0] ? { dateFrom: range[0].format('YYYY-MM-DD') } : {}),
    ...(range?.[1] ? { dateTo: range[1].format('YYYY-MM-DD') } : {}),
  };

  const { data, isLoading } = useAuditLogs(filter);
  const { data: modules } = useAuditLogModules();
  const { data: titles } = useSectionTitles();

  const resetPage = () => setPage(1);

  const handleExport = async (kind: 'xlsx' | 'pdf') => {
    setExporting(kind);
    try {
      if (kind === 'pdf') await downloadAuditLogPdf(filter);
      else await downloadAuditLogExcel(filter);
      message.success(kind === 'pdf' ? t('admin.auditLog.pdfDownloaded') : t('admin.auditLog.excelDownloaded'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      header: t('admin.auditLog.columns.createdAt'),
      id: 'createdAt',
      size: 160,
      cell: ({ row }) =>
        row.original.createdAt
          ? dayjs(row.original.createdAt).format('DD.MM.YYYY HH:mm:ss')
          : '—',
    },
    {
      header: t('admin.auditLog.columns.userName'),
      id: 'userName',
      size: 200,
      cell: ({ row }) => {
        const { userName, user } = row.original;
        const name =
          userName || [user?.lastName, user?.firstName].filter(Boolean).join(' ');
        if (!name) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;
        return (
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 500 }}>{name}</span>
          </Space>
        );
      },
    },
    {
      header: t('admin.auditLog.columns.action'),
      id: 'action',
      cell: ({ row }) => {
        const h = humanizeAction(row.original, titles ?? {}, t);
        const denied = isDenied(row.original.statusCode);
        const technical = `${row.original.method} ${row.original.path}`;
        return (
          <Tooltip title={technical}>
            <span>
              {h.text}
              {denied ? (
                <Tag color="orange" style={{ marginLeft: 8 }}>
                  {t('admin.auditLog.denied')}
                </Tag>
              ) : null}
            </span>
          </Tooltip>
        );
      },
    },
    {
      header: t('admin.auditLog.columns.method'),
      id: 'method',
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Tag color={METHOD_COLOR[row.original.method] ?? 'default'}>
          {row.original.method || '—'}
        </Tag>
      ),
    },
    {
      header: t('admin.auditLog.columns.files'),
      id: 'files',
      size: 80,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const files = row.original.files;
        if (!files.length) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;
        return (
          <Tooltip title={files.join(', ')}>
            <Tag color="blue">
              <PaperClipOutlined /> {files.length}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      header: t('admin.auditLog.columns.ip'),
      id: 'ip',
      size: 130,
      cell: ({ row }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {row.original.ip || '—'}
        </span>
      ),
    },
    {
      header: t('admin.auditLog.columns.statusCode'),
      id: 'statusCode',
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Tag color={statusColor(row.original.statusCode)}>
          {row.original.statusCode ?? '—'}
        </Tag>
      ),
    },
    {
      header: t('admin.auditLog.columns.responseTime'),
      id: 'responseTime',
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ row }) =>
        row.original.responseTime != null ? `${row.original.responseTime} ms` : '—',
    },
  ];

  return (
    <PageContainer title="">
      <PageHeader title={t('admin.auditLog.pageTitle')} />

      <Filters
        searchPlaceholder={t('admin.auditLog.searchPlaceholder')}
        onSearch={(v) => {
          setSearch(v);
          resetPage();
        }}
        selects={[
          {
            key: 'module',
            placeholder: t('admin.auditLog.allModules'),
            value: module,
            options: Object.entries(
              (modules ?? []).reduce<Record<string, string>>((acc, m) => {
                const clean = cleanSegment(m);
                if (clean && !acc[clean]) {
                  acc[clean] = titles?.[toSectionKey(clean)] ?? clean;
                }
                return acc;
              }, {}),
            )
              .map(([value, label]) => ({ label, value }))
              .sort((a, b) => a.label.localeCompare(b.label)),
            onChange: (v) => {
              setModule(v);
              resetPage();
            },
          },
          {
            key: 'method',
            placeholder: t('admin.auditLog.allMethods'),
            value: method,
            options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({
              label: m,
              value: m,
            })),
            onChange: (v) => {
              setMethod(v);
              resetPage();
            },
          },
        ]}
        extra={
          <Space>
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => {
                setRange(v as [Dayjs | null, Dayjs | null] | null);
                resetPage();
              }}
              format="DD.MM.YYYY"
              style={{ height: 40 }}
            />
            <Button
              type={onlyMutations ? 'primary' : 'default'}
              onClick={() => {
                setOnlyMutations((v) => !v);
                resetPage();
              }}
              style={{ height: 40 }}
            >
              {t('admin.auditLog.onlyMutations')}
            </Button>
            <Can perform="auditLog:export">
              <Button
                icon={<DownloadOutlined />}
                loading={exporting === 'xlsx'}
                onClick={() => void handleExport('xlsx')}
                style={{ height: 40 }}
              >
                {t('admin.auditLog.excelButton')}
              </Button>
            </Can>
            <Can perform="auditLog:export">
              <Button
                icon={<FilePdfOutlined />}
                loading={exporting === 'pdf'}
                onClick={() => void handleExport('pdf')}
                style={{ height: 40 }}
              >
                {t('admin.auditLog.pdfButton')}
              </Button>
            </Can>
          </Space>
        }
      />

      <DataTable<AuditLogEntry>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          resetPage();
        }}
      />
    </PageContainer>
  );
}
