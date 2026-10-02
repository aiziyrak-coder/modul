import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, Button, Flex, Tooltip, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { DataTable } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import {
  getApiErrorMessage,
  INBOX_SCAN_LIMIT,
  useWorkPlansAwaitingCompletion,
} from '../../api/inbox-api';
import { toInboxRow, type WorkPlanInboxRow } from '../../model/inbox-types';

const PAGE_SIZE = 12;

const AwaitingCompletion = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, error } = useWorkPlansAwaitingCompletion(true);

  const rows: WorkPlanInboxRow[] = useMemo(
    () => (data?.plans ?? []).map((p) => toInboxRow(p, true)),
    [data],
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const columns: ColumnDef<WorkPlanInboxRow>[] = [
    {
      header: '#',
      id: 'index',
      size: 48,
      cell: ({ row }) => (safePage - 1) * PAGE_SIZE + row.index + 1,
    },
    {
      header: t('teacher.personalPlan.inbox.column.teacher'),
      id: 'teacher',
      cell: ({ row }) => <strong>{row.original.title ?? '—'}</strong>,
    },
    {
      header: t('teacher.personalPlan.inbox.column.academicYear'),
      id: 'academicYear',
      size: 140,
      cell: ({ row }) => row.original.academicYearTitle ?? '—',
    },
    {
      header: t('teacher.personalPlan.inbox.column.totalHour'),
      id: 'totalHour',
      size: 110,
      cell: ({ row }) => row.original.totalHour,
    },
    {
      header: t('teacher.personalPlan.inbox.column.actions'),
      id: 'actions',
      size: 90,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <Can perform="personalWorkPlan:read">
          <Tooltip title={t('teacher.personalPlan.inbox.open')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: 'var(--brand-primary)' }}
              aria-label={t('teacher.personalPlan.inbox.open')}
              onClick={() => navigate(`/teacher/work-plans/${row.original.id}`)}
            />
          </Tooltip>
        </Can>
      ),
    },
  ];

  return (
    <Flex vertical gap={8} style={{ marginTop: 'var(--space-6)' }}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('teacher.personalPlan.inbox.awaitingCompletion.title')}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t('teacher.personalPlan.inbox.awaitingCompletion.description')}
      </Typography.Text>
      {isError ? (
        <Alert
          type="error"
          showIcon
          message={t('teacher.personalPlan.inbox.loadError')}
          description={getApiErrorMessage(error)}
        />
      ) : null}
      {data?.isTruncated ? (
        <Alert
          type="info"
          showIcon
          message={t('teacher.personalPlan.inbox.truncated', {
            limit: INBOX_SCAN_LIMIT,
            total: data.total,
          })}
        />
      ) : null}
      {!isError ? (
        <DataTable<WorkPlanInboxRow>
          data={pageRows}
          columns={columns}
          loading={isLoading || isFetching}
          page={safePage}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPageChange={(p) => setPage(p)}
        />
      ) : null}
    </Flex>
  );
};

export default AwaitingCompletion;
