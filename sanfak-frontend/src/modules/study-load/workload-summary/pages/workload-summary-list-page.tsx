import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  RedoOutlined,
  SendOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission, useSessionStore } from '@/app/session';
import StatusBadge from '../../components/status-badge';
import { getStatusMeta } from '../../model/status-workflow';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import {
  FIXED_FINAL_STEP,
  finalStepRole,
  useRevokeFinalGate,
} from '../../lib/final-step';
import WarningConfirm from '../../components/warning-confirm';
import { useAcademicYearsRef } from '../../workload/api/workload-api';
import {
  useApproveWorkloadSummary,
  useRejectWorkloadSummary,
  useWorkloadSummaries,
  type WorkloadSummariesFilter,
} from '../api/workload-summary-api';
import type { WorkloadSummary } from '../model/types';
import { SUMMARY_STEP_ROLES, summaryTurn } from '../model/chain';
import CreateSummaryModal from '../components/create-summary-modal';
import DeleteSummaryConfirm from '../components/delete-summary-confirm';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'superseded'];

const WorkloadSummaryListPage = () => {
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);
  const role = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const isSuper = useSessionStore((s) => s.permissions.includes('*'));
  const canRevokeFinalDoc = useRevokeFinalGate('workloadSummary');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [yearId, setYearId] = useState<string | undefined>(undefined);

  const filter = useMemo<WorkloadSummariesFilter>(
    () => ({ page, limit: pageSize, status, academicYear: yearId }),
    [page, pageSize, status, yearId],
  );
  const { data, isLoading } = useWorkloadSummaries(filter);
  const { data: years = [] } = useAcademicYearsRef();
  const approve = useApproveWorkloadSummary();
  const reject = useRejectWorkloadSummary();

  const statusOptions = STATUSES.map((s) => {
    const meta = getStatusMeta(s);
    return { value: s, label: t(meta.labelKey, { defaultValue: meta.label }) };
  });
  const yearOptions = years.map((y) => ({ value: y.id, label: y.title }));

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const handleSubmit = (item: WorkloadSummary) =>
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.summary.submitTitle')}
          subtitle={t('studyLoad.summary.submitSubtitle')}
          confirmText={t('studyLoad.summary.action.submit')}
          loading={approve.isPending}
          onConfirm={async () => {
            await approve.mutateAsync(item.id);
            message.success(t('studyLoad.summary.submitted'));
          }}
        />
      ),
    });

  const handleApprove = (item: WorkloadSummary) =>
    showModal({
      title: t('studyLoad.summary.approveTitle'),
      maxWidth: '545px',
      body: () => (
        <ApproveModal
          title={t('studyLoad.summary.approveTitle')}
          recordName={item.academicYearTitle}
          onConfirm={async () => {
            await approve.mutateAsync(item.id);
          }}
          loading={approve.isPending}
        />
      ),
    });

  const handleReject = (item: WorkloadSummary) =>
    showModal({
      title: t('studyLoad.summary.rejectTitle'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.summary.rejectTitle')}
          recordName={item.academicYearTitle}
          onConfirm={async (comment) => {
            await reject.mutateAsync({ id: item.id, comment });
          }}
          loading={reject.isPending}
        />
      ),
    });

  const handleRevokeFinal = (item: WorkloadSummary) =>
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.revokeFinal.title')}
          recordName={item.academicYearTitle}
          onConfirm={async (comment) => {
            await reject.mutateAsync({ id: item.id, comment });
          }}
          loading={reject.isPending}
          confirmLabel={t('studyLoad.revokeFinal.action')}
          successMessage={t('studyLoad.revokeFinal.success')}
        />
      ),
    });

  const handleReopen = (item: WorkloadSummary) =>
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.summary.reopenTitle')}
          subtitle={t('studyLoad.summary.reopenSubtitle')}
          confirmText={t('studyLoad.summary.action.reopen')}
          loading={approve.isPending}
          onConfirm={async () => {
            await approve.mutateAsync(item.id);
            message.success(t('studyLoad.summary.reopened'));
          }}
        />
      ),
    });

  const handleDelete = (item: WorkloadSummary) =>
    showModal({ withHeader: false, maxWidth: '460px', body: () => <DeleteSummaryConfirm item={item} /> });

  const iconBtn = (title: string, icon: React.ReactNode, onClick: () => void, danger = false) => (
    <Tooltip title={title}>
      <Button type="text" size="small" danger={danger} icon={icon} onClick={onClick} aria-label={title} />
    </Tooltip>
  );

  const columns: ColumnDef<WorkloadSummary>[] = [
    {
      header: t('studyLoad.summary.column.academicYear'),
      id: 'year',
      cell: ({ row }) => (
        <Typography.Text strong style={{ color: 'var(--color-text)' }}>
          {row.original.academicYearTitle || '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.summary.column.status'),
      id: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: t('studyLoad.summary.column.rowCount'),
      id: 'rowCount',
      meta: { align: 'center' as const },
      cell: ({ row }) => row.original.rowCount,
    },
    {
      header: t('studyLoad.summary.column.totalHours'),
      id: 'totalHours',
      meta: { align: 'center' as const },
      cell: ({ row }) => row.original.totalHours.toLocaleString(lang),
    },
    {
      header: t('studyLoad.summary.column.generatedAt'),
      id: 'generatedAt',
      cell: ({ row }) => fmtDate(row.original.generatedAt ?? row.original.createdAt),
    },
    {
      header: t('studyLoad.summary.column.actions'),
      id: 'actions',
      size: 220,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        const turn = summaryTurn(item.status, item.currentStep, role, isSuper);
        const canRevoke = canRevokeFinalDoc({
          status: item.status,
          finalRole: finalStepRole(null, SUMMARY_STEP_ROLES, FIXED_FINAL_STEP.workloadSummary),
        });
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
            {iconBtn(t('studyLoad.common.view'), <EyeOutlined />, () =>
              navigate(`/study-load/workload-summaries/${item.id}`),
            )}
            {turn.canSubmit && can('workloadSummary:approve')
              ? iconBtn(t('studyLoad.summary.action.submit'), <SendOutlined />, () => handleSubmit(item))
              : null}
            {turn.canApprove && can('workloadSummary:approve')
              ? iconBtn(t('studyLoad.common.confirm'), <CheckOutlined />, () => handleApprove(item))
              : null}
            {turn.canReject && can('workloadSummary:reject')
              ? iconBtn(t('studyLoad.common.reject'), <CloseOutlined />, () => handleReject(item), true)
              : null}
            {canRevoke && can('workloadSummary:reject')
              ? iconBtn(t('studyLoad.revokeFinal.action'), <UndoOutlined />, () => handleRevokeFinal(item), true)
              : null}
            {turn.canReopen && can('workloadSummary:approve')
              ? iconBtn(t('studyLoad.summary.action.reopen'), <RedoOutlined />, () => handleReopen(item))
              : null}
            {turn.canDelete && can('workloadSummary:delete')
              ? iconBtn(t('studyLoad.common.delete'), <DeleteOutlined />, () => handleDelete(item), true)
              : null}
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('studyLoad.nav.workloadSummary')}>
      <Filters
        hideSearch
        onSearch={() => {}}
        selects={[
          {
            key: 'academicYear',
            placeholder: t('studyLoad.summary.filter.allYears'),
            value: yearId,
            options: yearOptions,
            onChange: (v) => {
              setYearId(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: t('studyLoad.distribution.filter.allStatuses'),
            value: status,
            options: statusOptions,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <Can perform="workloadSummary:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ height: 38 }}
              onClick={() =>
                showModal({
                  title: t('studyLoad.summary.create'),
                  body: () => (
                    <CreateSummaryModal
                      onCreated={(id) => navigate(`/study-load/workload-summaries/${id}`)}
                    />
                  ),
                  maxWidth: '520px',
                  bodyPadding: '0',
                })
              }
            >
              {t('studyLoad.summary.create')}
            </Button>
          </Can>
        }
      />
      <DataTable<WorkloadSummary>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </PageContainer>
  );
};

export default WorkloadSummaryListPage;
