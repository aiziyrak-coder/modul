import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, App, Button, Progress, Tooltip, Typography } from 'antd';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useSessionStore } from '@/app/session';
import {
  downloadMonitoringExport,
  getApiErrorMessage,
  useMonitoringRows,
} from '../api/monitoring-api';
import { useAcademicYearsForSelect } from '../api/work-plan-api';
import { useIsVerifier } from '../lib/use-is-verifier';
import type { MonitoringFilter, MonitoringRow } from '../model/monitoring-types';
import type { PersonalPlanStatus } from '../model/types';
import StatusBadge from '../../components/status-badge';

function buildStatusOptions(
  t: (key: string) => string,
): { label: string; value: PersonalPlanStatus }[] {
  return [
    { label: t('teacher.personalPlan.status.draft'), value: 'draft' },
    { label: t('teacher.personalPlan.status.submitted'), value: 'submitted' },
    { label: t('teacher.personalPlan.status.approved'), value: 'approved' },
    { label: t('teacher.personalPlan.status.rejected'), value: 'rejected' },
    { label: t('teacher.personalPlan.status.completed'), value: 'completed' },
  ];
}

const MonitoringPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isVerifier = useIsVerifier();

  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);
  const isIlmiyBolim = permissions.includes('*') || (roles?.some((r) => r.name === 'ilmiy_bolim') ?? false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
  const { data: academicYears = [] } = useAcademicYearsForSelect();
  const academicYearOptions = useMemo(
    () => academicYears.map((y) => ({ label: y.title, value: y.id })),
    [academicYears],
  );

  const filter: MonitoringFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      academicYear: academicYearFilter,
      status: (statusFilter as MonitoringFilter['status']) || undefined,
    }),
    [page, pageSize, search, academicYearFilter, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useMonitoringRows(filter);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadMonitoringExport({
        search: search || undefined,
        academicYear: academicYearFilter,
        status: (statusFilter as MonitoringFilter['status']) || undefined,
      });
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<MonitoringRow>[] = useMemo(() => {
    const base: ColumnDef<MonitoringRow>[] = [
      {
        header: t('teacher.personalPlan.monitoring.column.fullName'),
        id: 'fullName',
        cell: ({ row }) => (
          <strong style={{ color: 'var(--color-text)' }}>{row.original.teacherName ?? '—'}</strong>
        ),
      },
    ];

    if (isIlmiyBolim) {
      base.push({
        header: t('teacher.personalPlan.monitoring.column.department'),
        id: 'department',
        cell: ({ row }) => row.original.departmentTitle ?? '—',
      });
    }

    base.push(
      {
        header: t('teacher.personalPlan.monitoring.column.academicYear'),
        id: 'academicYear',
        size: 120,
        cell: ({ row }) => row.original.academicYearTitle ?? '—',
      },
      {
        header: t('teacher.personalPlan.monitoring.column.status'),
        id: 'status',
        size: 150,
        cell: ({ row }) => <StatusBadge status={row.original.submitStatus} />,
      },
      {
        header: t('teacher.personalPlan.monitoring.column.planned'),
        id: 'totalItems',
        size: 110,
        cell: ({ row }) => (
          <Typography.Text style={{ fontWeight: 500 }}>{row.original.totalItems}</Typography.Text>
        ),
      },
      {
        header: t('teacher.personalPlan.monitoring.column.completed'),
        id: 'completedItems',
        size: 110,
        cell: ({ row }) => (
          <Typography.Text style={{ fontWeight: 500 }}>{row.original.completedItems}</Typography.Text>
        ),
      },
      {
        header: t('teacher.personalPlan.monitoring.column.completionPercent'),
        id: 'completionPercent',
        size: 150,
        cell: ({ row }) => <Progress percent={row.original.completionPercent} size="small" />,
      },
      {
        header: t('teacher.personalPlan.monitoring.column.overdue'),
        id: 'overdueCount',
        size: 110,
        cell: ({ row }) => {
          const count = row.original.overdueCount;
          return count > 0 ? (
            <Typography.Text style={{ color: 'var(--brand-error)', fontWeight: 600 }}>
              {count}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          );
        },
      },
      {
        header: t('actions'),
        id: 'actions',
        size: 90,
        meta: { align: 'right' as const },
        cell: ({ row }) => {
          const planId = row.original.planId;
          return (
            <Tooltip title={t('teacher.common.view')}>
              <Button
                type="text"
                icon={<EyeOutlined />}
                size="small"
                disabled={!planId}
                style={planId ? { color: 'var(--brand-primary)' } : undefined}
                onClick={() => {
                  if (planId) navigate(`/teacher/work-plans/${planId}`);
                }}
              />
            </Tooltip>
          );
        },
      },
    );

    return base;
  }, [t, isIlmiyBolim, navigate]);

  if (!isVerifier) {
    return (
      <PageContainer title={t('teacher.personalPlan.monitoring.pageTitle')}>
        <Alert
          type="warning"
          showIcon
          message={t('teacher.personalPlan.monitoring.roleGate.title')}
          description={t('teacher.personalPlan.monitoring.roleGate.desc')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('teacher.personalPlan.monitoring.pageTitle')}>
      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('teacher.personalPlan.monitoring.loadError')}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('teacher.common.retry')}
            </Button>
          }
        />
      ) : null}

      <Filters
        searchValue={search}
        searchPlaceholder="teacher.personalPlan.monitoring.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'academicYear',
            placeholder: t('teacher.personalPlan.monitoring.filter.allYears'),
            value: academicYearFilter,
            options: academicYearOptions,
            onChange: (v) => {
              setAcademicYearFilter(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: t('teacher.personalPlan.monitoring.filter.allStatuses'),
            value: statusFilter,
            options: statusOptions,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExport()}>
            {t('teacher.personalPlan.monitoring.export')}
          </Button>
        }
      />

      <DataTable<MonitoringRow>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={(p) => setPage(p)}
        pageSizeOptions={[12, 24, 36, 48]}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </PageContainer>
  );
};

export default MonitoringPage;
