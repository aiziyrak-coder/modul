import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, Button, Space, Tooltip, Typography } from 'antd';
import { EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useFacultyReportsPaginated } from '../api/reports-api';
import { getReportRejectionComment } from '../api/reports-mapper';
import { useAcademicYearsForSelect } from '../api/work-plan-api';
import { formatSubmittedDate } from '../../hr/model/helper';
import type { PersonalReport, ReportStatus } from '../model/report-types';
import StatusBadge from '../../components/status-badge';
import ReportViewModal from '../components/report-view-modal';

function buildStatusOptions(t: (key: string) => string): { label: string; value: ReportStatus }[] {
  return [
    { label: t('teacher.personalPlan.status.draft'), value: 'draft' },
    { label: t('teacher.personalPlan.status.submitted'), value: 'submitted' },
    { label: t('teacher.personalPlan.status.approved'), value: 'approved' },
    { label: t('teacher.personalPlan.status.rejected'), value: 'rejected' },
  ];
}

const FacultyReportsPage = () => {
  const { t } = useTranslation();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [academicYearFilter, setAcademicYearFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
  const { data: academicYears = [] } = useAcademicYearsForSelect();
  const academicYearOptions = useMemo(
    () => academicYears.map((y) => ({ label: y.title, value: y.id })),
    [academicYears],
  );

  const filter = useMemo(
    () => ({
      page,
      limit: pageSize,
      academicYear: academicYearFilter,
      status: (statusFilter as ReportStatus | undefined) || undefined,
    }),
    [page, pageSize, academicYearFilter, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useFacultyReportsPaginated(filter);

  const handleView = (report: PersonalReport) => {
    showModal({
      title: t('teacher.personalPlan.reports.view.title'),
      body: () => <ReportViewModal report={report} />,
      maxWidth: '545px',
    });
  };

  const columns: ColumnDef<PersonalReport>[] = [
    {
      header: t('teacher.personalPlan.facultyReports.column.fullName'),
      id: 'fullName',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>{row.original.teacherName ?? '—'}</strong>
      ),
    },
    {
      header: t('teacher.personalPlan.facultyReports.column.reportType'),
      id: 'reportType',
      size: 140,
      cell: ({ row }) => t(`teacher.personalPlan.reports.semester.${row.original.semester}`),
    },
    {
      header: t('teacher.personalPlan.facultyReports.column.academicYear'),
      id: 'academicYear',
      size: 130,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.academicYearTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.facultyReports.column.date'),
      id: 'date',
      size: 140,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatSubmittedDate(row.original.createdAt)}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.facultyReports.column.status'),
      id: 'status',
      size: 170,
      cell: ({ row }) => {
        const report = row.original;
        if (report.status !== 'rejected') {
          return <StatusBadge status={report.status} />;
        }
        const rejectionComment = getReportRejectionComment(report);
        return (
          <Space size={4}>
            <StatusBadge status={report.status} />
            <Tooltip title={rejectionComment ?? undefined}>
              <InfoCircleOutlined style={{ color: 'var(--brand-error)' }} />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      header: t('teacher.personalPlan.facultyReports.column.actions'),
      id: 'actions',
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <Tooltip title={t('teacher.common.view')}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            style={{ color: 'var(--brand-primary)' }}
            onClick={() => handleView(row.original)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <PageContainer title={t('teacher.personalPlan.facultyReports.pageTitle')}>
      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('teacher.personalPlan.facultyReports.loadError')}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('teacher.common.retry')}
            </Button>
          }
        />
      ) : null}

      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'academicYear',
            placeholder: t('teacher.personalPlan.facultyReports.filter.allYears'),
            value: academicYearFilter,
            options: academicYearOptions,
            onChange: (v) => {
              setAcademicYearFilter(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: t('teacher.personalPlan.facultyReports.filter.allStatuses'),
            value: statusFilter,
            options: statusOptions,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
          },
        ]}
      />

      <DataTable<PersonalReport>
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

export default FacultyReportsPage;
