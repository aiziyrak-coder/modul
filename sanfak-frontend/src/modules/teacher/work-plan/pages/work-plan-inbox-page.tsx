import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, Button, Empty, Flex, Tag, Tooltip, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { PageContainer, DataTable } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import {
  useWorkPlanApprovalInbox,
  getApiErrorMessage,
  INBOX_SCAN_LIMIT,
} from '../api/inbox-api';
import { useMyApprovalStepKeys } from '../lib/use-my-pending-step';
import AwaitingCompletion from '../components/awaiting-completion';
import { toInboxRow, type WorkPlanInboxRow } from '../model/inbox-types';
import type { ApprovalStepKey } from '../model/types';

const PAGE_SIZE_OPTIONS = [12, 24, 36, 48];
const DEFAULT_PAGE_SIZE = 12;

const STEP_TITLE_KEY: Record<ApprovalStepKey, string> = {
  teacher: 'teacher.personalPlan.timeline.step.teacher',
  kafedraUslubiy: 'teacher.personalPlan.timeline.step.kafedraUslubiy',
  kafedraIlmiy: 'teacher.personalPlan.timeline.step.kafedraIlmiy',
  kafedraUstozShogird: 'teacher.personalPlan.timeline.step.kafedraUstozShogird',
  kafedraMudiri: 'teacher.personalPlan.timeline.step.kafedraMudiri',
  oquvUslubiy: 'teacher.personalPlan.timeline.step.oquvUslubiy',
  dekan: 'teacher.personalPlan.timeline.step.dekan',
  ichkiNazorat: 'teacher.personalPlan.timeline.step.ichkiNazorat',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const WorkPlanInboxPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data, isLoading, isFetching, isError, error } = useWorkPlanApprovalInbox();
  const { stepKeys, showAll } = useMyApprovalStepKeys();
  const showAwaitingCompletion = showAll || stepKeys.includes('ichkiNazorat');

  const rows: WorkPlanInboxRow[] = useMemo(() => {
    const plans = data?.plans ?? [];
    return plans
      .filter((p) => p.status === 'submitted')
      .map((p) => ({
        plan: p,
        canAct: p.currentStep !== null && stepKeys.includes(p.currentStep),
      }))
      .filter(({ canAct }) => showAll || canAct)
      .map(({ plan, canAct }) => toInboxRow(plan, canAct));
  }, [data, stepKeys, showAll]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );

  const columns: ColumnDef<WorkPlanInboxRow>[] = [
    {
      header: '#',
      id: 'index',
      size: 48,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(safePage - 1) * pageSize + row.index + 1}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.inbox.column.teacher'),
      id: 'teacher',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>{row.original.title ?? '—'}</strong>
      ),
    },
    {
      header: t('teacher.personalPlan.inbox.column.academicYear'),
      id: 'academicYear',
      size: 140,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.academicYearTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.inbox.column.totalHour'),
      id: 'totalHour',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>{row.original.totalHour}</Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.inbox.column.currentStep'),
      id: 'currentStep',
      size: 260,
      cell: ({ row }) => {
        const { currentStep, currentStepLabel, canAct } = row.original;
        if (!currentStep) return <Typography.Text type="secondary">—</Typography.Text>;
        const titleKey = STEP_TITLE_KEY[currentStep];
        return (
          <Tag color={canAct ? 'processing' : 'default'} style={{ whiteSpace: 'normal' }}>
            {titleKey ? t(titleKey) : (currentStepLabel ?? currentStep)}
          </Tag>
        );
      },
    },
    {
      header: t('teacher.personalPlan.inbox.column.submittedAt'),
      id: 'submittedAt',
      size: 140,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatDate(row.original.submittedAt)}
        </Typography.Text>
      ),
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

  const isEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <PageContainer title={t('teacher.personalPlan.inbox.pageTitle')}>
      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('teacher.personalPlan.inbox.loadError')}
          description={getApiErrorMessage(error)}
        />
      ) : null}

      {data?.isTruncated ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('teacher.personalPlan.inbox.truncated', {
            limit: INBOX_SCAN_LIMIT,
            total: data.totalSubmitted,
          })}
        />
      ) : null}

      {isEmpty ? (
        <Flex justify="center" style={{ padding: 'var(--space-8)' }}>
          <Empty
            description={
              <Flex vertical gap={4} align="center">
                <Typography.Text strong>
                  {t('teacher.personalPlan.inbox.empty.title')}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {t('teacher.personalPlan.inbox.empty.description')}
                </Typography.Text>
              </Flex>
            }
          />
        </Flex>
      ) : (
        <DataTable<WorkPlanInboxRow>
          data={pageRows}
          columns={columns}
          loading={isLoading || isFetching}
          page={safePage}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}
      {showAwaitingCompletion ? <AwaitingCompletion /> : null}
    </PageContainer>
  );
};

export default WorkPlanInboxPage;
