import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, Empty, Flex, Tag, Tooltip, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import { useApprovalInbox, getApiErrorMessage } from '../api/approval-inbox-api';
import type { ApprovalInboxEntity, ApprovalInboxItem } from '../model/types';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

const ENTITY_ROUTE: Record<ApprovalInboxEntity, string | null> = {
  distribution: '/study-load/distributions',
  workingSchedule: '/study-load/working-schedules',
  workloadSummary: '/study-load/workload-summaries',
  contingentReport: '/study-load/contingent-reports',
  workload: null,
  scienceProgram: null,
  syllabus: null,
};

const ENTITY_READ_PERMISSION: Record<ApprovalInboxEntity, string | null> = {
  distribution: 'workloadDistribution:read',
  workingSchedule: 'workingSchedule:read',
  workloadSummary: 'workloadSummary:read',
  contingentReport: 'contingentReport:read',
  workload: null,
  scienceProgram: null,
  syllabus: null,
};

const ENTITY_LIST_ROUTE: Record<ApprovalInboxEntity, string> = {
  workload: '/study-load/workloads',
  distribution: '/study-load/distributions',
  workingSchedule: '/study-load/working-schedules',
  scienceProgram: '/study-load/science-programs',
  syllabus: '/study-load/syllabi',
  workloadSummary: '/study-load/workload-summaries',
  contingentReport: '/study-load/contingent-reports',
};

const ENTITY_LIST_PERMISSION: Record<ApprovalInboxEntity, string> = {
  workload: 'workload:readAll',
  distribution: 'workloadDistribution:readAll',
  workingSchedule: 'workingSchedule:readAll',
  scienceProgram: 'scienceProgram:readAll',
  syllabus: 'syllabus:readAll',
  workloadSummary: 'workloadSummary:readAll',
  contingentReport: 'contingentReport:readAll',
};

const ENTITY_LABEL_KEY: Record<ApprovalInboxEntity, string> = {
  workload: 'studyLoad.approvalInbox.entity.workload',
  distribution: 'studyLoad.approvalInbox.entity.distribution',
  scienceProgram: 'studyLoad.approvalInbox.entity.scienceProgram',
  syllabus: 'studyLoad.approvalInbox.entity.syllabus',
  workingSchedule: 'studyLoad.approvalInbox.entity.workingSchedule',
  workloadSummary: 'studyLoad.approvalInbox.entity.workloadSummary',
  contingentReport: 'studyLoad.approvalInbox.entity.contingentReport',
};

const ENTITY_OPTIONS: ApprovalInboxEntity[] = [
  'workload',
  'distribution',
  'scienceProgram',
  'syllabus',
  'workingSchedule',
  'workloadSummary',
  'contingentReport',
];

function stepLabelKey(step: string): string {
  return `studyLoad.approval.step.${step}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ');
}

const ApprovalInboxPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [entity, setEntity] = useState<ApprovalInboxEntity | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);

  const { data: items = [], isLoading, isFetching, isError, error } = useApprovalInbox(entity);

  const entityOptions = useMemo(
    () => ENTITY_OPTIONS.map((e) => ({ value: e, label: t(ENTITY_LABEL_KEY[e]) })),
    [t],
  );

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const columns: ColumnDef<ApprovalInboxItem>[] = [
    {
      header: t('studyLoad.approvalInbox.column.documentType'),
      id: 'entity',
      size: 160,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {t(ENTITY_LABEL_KEY[row.original.entity])}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.approvalInbox.column.title'),
      id: 'title',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>{row.original.title ?? '—'}</strong>
      ),
    },
    {
      header: t('studyLoad.approvalInbox.column.step'),
      id: 'step',
      size: 200,
      cell: ({ row }) => <Tag color="processing">{t(stepLabelKey(row.original.step))}</Tag>,
    },
    {
      header: t('studyLoad.approvalInbox.column.department'),
      id: 'department',
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text)' }}>
          {row.original.department?.title ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.approvalInbox.column.academicYear'),
      id: 'academicYear',
      size: 130,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.academicYear?.title ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.approvalInbox.column.totalHour'),
      id: 'totalHour',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.totalHour ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.approvalInbox.column.submittedAt'),
      id: 'submittedAt',
      size: 130,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatDate(row.original.submittedAt)}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.approvalInbox.column.actions'),
      id: 'actions',
      size: 80,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        const detailPath = ENTITY_ROUTE[item.entity];
        const detailPermission = ENTITY_READ_PERMISSION[item.entity];

        const target =
          detailPath && detailPermission
            ? `${detailPath}/${item.id}`
            : ENTITY_LIST_ROUTE[item.entity];
        const permission =
          detailPath && detailPermission
            ? detailPermission
            : ENTITY_LIST_PERMISSION[item.entity];

        if (!target || !permission) return null;
        return (
          <Can perform={permission}>
            <Tooltip title={t('studyLoad.common.view')}>
              <span
                role="button"
                tabIndex={0}
                onClick={() => navigate(target)}
                style={{ cursor: 'pointer', color: 'var(--brand-primary)', display: 'inline-flex' }}
              >
                <EyeOutlined />
              </span>
            </Tooltip>
          </Can>
        );
      },
    },
  ];

  const isEmpty = !isLoading && !isError && items.length === 0;

  return (
    <PageContainer title={t('studyLoad.approvalInbox.pageTitle')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'entity',
            placeholder: t('studyLoad.approvalInbox.filter.allEntities'),
            value: entity,
            options: entityOptions,
            onChange: (v) => {
              setEntity(v as ApprovalInboxEntity | undefined);
              setPage(1);
            },
          },
        ]}
      />

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('studyLoad.common.dataLoadError')}
          description={getApiErrorMessage(error)}
        />
      )}

      {isEmpty ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Empty
            description={
              <Flex vertical gap={4} align="center">
                <Typography.Text strong>
                  {t('studyLoad.approvalInbox.empty.title')}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {t('studyLoad.approvalInbox.empty.description')}
                </Typography.Text>
              </Flex>
            }
          />
        </Flex>
      ) : (
        <DataTable<ApprovalInboxItem>
          data={pageItems}
          columns={columns}
          loading={isLoading || isFetching}
          page={page}
          pageSize={pageSize}
          total={items.length}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}
    </PageContainer>
  );
};

export default ApprovalInboxPage;
