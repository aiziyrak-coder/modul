import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, Select, Tooltip, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import StatusBadge from '../../components/status-badge';
import {
  useWorkingSchedules,
  type WorkingSchedulesFilter,
} from '../../working-schedule/api/working-schedule-api';
import type { WorkingSchedule, WorkingScheduleStatus } from '../../working-schedule/model/types';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

const WorkingPlanListPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const STATUS_OPTIONS: { label: string; value: WorkingScheduleStatus }[] = [
    { label: t('studyLoad.workingSchedule.status.draft'), value: 'draft' },
    { label: t('studyLoad.distribution.status.inReview'), value: 'in_review' },
    { label: t('studyLoad.distribution.status.approved'), value: 'approved' },
    { label: t('studyLoad.distribution.status.rejected'), value: 'rejected' },
  ];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkingScheduleStatus | ''>('');

  const filter: WorkingSchedulesFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
    [page, pageSize, search, statusFilter],
  );

  const { data, isLoading } = useWorkingSchedules(filter);

  const handleViewDetail = (ws: WorkingSchedule) => {
    navigate(`/study-load/working-plans/${ws.id}`);
  };

  const columns: ColumnDef<WorkingSchedule>[] = [
    {
      header: '#',
      id: 'index',
      size: 48,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.title'),
      id: 'title',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>
          {row.original.title ?? '—'}
        </strong>
      ),
    },
    {
      header: t('studyLoad.workingPlan.column.direction'),
      id: 'direction',
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.directionTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.course'),
      id: 'courseRef',
      size: 100,
      cell: ({ row }) => row.original.courseTitle ?? row.original.stage ?? '—',
    },
    {
      header: t('studyLoad.distribution.column.academicYear'),
      id: 'academicYear',
      size: 140,
      cell: ({ row }) => row.original.academicYearTitle ?? '—',
    },
    {
      header: t('studyLoad.distribution.column.date'),
      id: 'date',
      size: 130,
      cell: ({ row }) =>
        row.original.date
          ? dayjs(row.original.date).format('DD-MMM. YYYY')
          : row.original.createdAt
            ? dayjs(row.original.createdAt).format('DD-MMM. YYYY')
            : '—',
    },
    {
      header: t('studyLoad.teacherLeave.column.status'),
      id: 'status',
      size: 130,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 120,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const ws = row.original;
        return (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <Can perform="workingPlan:read">
              <Tooltip title={t('studyLoad.workingPlan.viewTooltip')}>
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  size="small"
                  style={{ color: 'var(--brand-primary)' }}
                  onClick={() => handleViewDetail(ws)}
                />
              </Tooltip>
            </Can>
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('studyLoad.workingSchedule.pageTitle')}>
      <Filters
        searchPlaceholder={t('studyLoad.studyPlan.searchPlaceholder')}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        extra={
          <Select
            allowClear
            placeholder={t('studyLoad.distribution.filter.allStatuses')}
            style={{ width: 200 }}
            value={statusFilter || undefined}
            options={STATUS_OPTIONS}
            onChange={(v: WorkingScheduleStatus | undefined) => {
              setStatusFilter(v ?? '');
              setPage(1);
            }}
          />
        }
      />

      <DataTable<WorkingSchedule>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </PageContainer>
  );
};

export default WorkingPlanListPage;
