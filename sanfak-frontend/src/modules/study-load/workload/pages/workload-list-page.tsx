import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  FileExcelOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission, useSessionStore } from '@/app/session';
import {
  useWorkloads,
  useDeleteWorkload,
  useApproveWorkload,
  useRejectWorkload,
  useDepartmentsRef,
  getApiErrorMessage,
  fetchAllWorkloads,
  type WorkloadsFilter,
} from '../api/workload-api';
import type { Workload } from '../model/types';
import WorkloadForm from '../components/workload-modal';
import PostApprovalEditBadge from '../components/post-approval-edit-badge';
import NeedsRecalcBadge from '../components/needs-recalc-badge';
import {
  canReopenWorkload,
  isWorkloadContentEditable,
} from '../model/content-editable';
import { useHasRole } from '../../lib/use-has-pending-step';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import {
  FIXED_FINAL_STEP,
  finalStepRole,
  useRevokeFinalGate,
} from '../../lib/final-step';
import DeleteConfirm from '../../components/delete-confirm';
import WarningConfirm from '../../components/warning-confirm';
import { workloadVersionLabel } from '../model/versioning';
import { openPdf } from '../../lib/open-pdf';
import { exportWorkloadsToExcel } from '../../lib/excel';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

function buildStatusOptions(t: (key: string) => string) {
  return [
    { label: t('studyLoad.workload.status.draft'), value: 'draft' },
    { label: t('studyLoad.distribution.status.new'), value: 'new' },
    { label: t('studyLoad.distribution.status.inReview'), value: 'in_review' },
    { label: t('studyLoad.distribution.status.approved'), value: 'approved' },
    { label: t('studyLoad.distribution.status.rejected'), value: 'rejected' },
    { label: t('studyLoad.summary.status.superseded'), value: 'superseded' },
  ];
}

const WORKLOAD_STEP_ROLES: Record<string, string> = {
  methodical: 'oquv_uslubiy_boshqarma',
  kafedra: 'kafedra_mudiri',
  financial: 'reja_moliya',
  prorektor: 'prorektor',
  rektor: 'rektor',
};

const WORKLOAD_SUBMIT_ROLE = 'oquv_uslubiy_boshqarma';

const WORKLOAD_STATUS_COLORS: Record<string, string> = {
  draft: '#2E90FA',
  new: '#2E90FA',
  in_review: '#EF6820',
  approved: '#34C18C',
  rejected: '#F04438',
  superseded: 'var(--color-text-soft)',
};

function buildStatusLabels(t: (key: string) => string): Record<string, string> {
  return {
    draft: t('studyLoad.distribution.status.draft'),
    new: t('studyLoad.distribution.status.draft'),
    in_review: t('studyLoad.distribution.status.inReview'),
    approved: t('studyLoad.distribution.status.approved'),
    rejected: t('studyLoad.distribution.status.rejected'),
    superseded: t('studyLoad.summary.status.superseded'),
  };
}

interface IDeleteBodyProps {
  item: Workload;
}

const WorkloadDeleteBody = ({ item }: IDeleteBodyProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const deleteWorkload = useDeleteWorkload();

  const handleConfirm = async () => {
    try {
      await deleteWorkload.mutateAsync(item.id);
      message.success(t('studyLoad.workload.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      title={t('studyLoad.workload.deleteConfirmTitle')}
      subtitle={t('studyLoad.workload.deleteConfirmSubtitle', {
        department: item.departmentTitle ?? t('studyLoad.workload.pageTitleSingular'),
      })}
      loading={deleteWorkload.isPending}
      onConfirm={handleConfirm}
    />
  );
};

const WorkloadListPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();
  const role = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const canReopenRole = useHasRole(WORKLOAD_SUBMIT_ROLE);
  const canRevokeFinalRow = useRevokeFinalGate();
  const showModal = useModalStore((s) => s.showModal);
  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
  const statusLabels = useMemo(() => buildStatusLabels(t), [t]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const filter: WorkloadsFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      status: statusFilter,
      department: departmentId,
    }),
    [page, pageSize, statusFilter, departmentId],
  );

  const { data, isLoading } = useWorkloads(filter);

  const [exporting, setExporting] = useState(false);
  const handleExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAllWorkloads({
        search: filter.search,
        status: filter.status,
        department: filter.department,
      });
      exportWorkloadsToExcel(all);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };
  const { data: departments = [] } = useDepartmentsRef();
  const approveMutation = useApproveWorkload();
  const rejectMutation = useRejectWorkload();

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ label: d.title, value: d.id })),
    [departments],
  );

  const handleOpenPdf = async (item: Workload) => {
    setPdfLoadingId(item.id);
    try {
      await openPdf(`/workloads/${item.id}/pdf`, message, t);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleApprove = (item: Workload) => {
    if (item.status === 'in_review') {
      showModal({
        title: t('studyLoad.workload.approveTitle'),
        body: () => (
          <ApproveModal
            title={t('studyLoad.workload.approveTitle')}
            recordName={item.departmentTitle ?? undefined}
            onConfirm={() => approveMutation.mutateAsync(item.id)}
            loading={approveMutation.isPending}
          />
        ),
        maxWidth: '545px',
      });
    } else {
      showModal({
        withHeader: false,
        maxWidth: '544px',
        body: () => (
          <WarningConfirm
            title={t('studyLoad.workload.approveTitle')}
            subtitle={t('studyLoad.workload.approveSubtitle')}
            confirmText={t('studyLoad.common.confirm')}
            loading={approveMutation.isPending}
            onConfirm={async () => {
              await approveMutation.mutateAsync(item.id);
              message.success(t('studyLoad.workload.approved'));
            }}
          />
        ),
      });
    }
  };

  const handleReopen = (item: Workload) => {
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.workload.reopenTitle')}
          subtitle={t('studyLoad.workload.reopenSubtitle')}
          confirmText={t('studyLoad.workload.action.reopen')}
          loading={approveMutation.isPending}
          onConfirm={async () => {
            await approveMutation.mutateAsync(item.id);
            message.success(t('studyLoad.workload.reopened'));
          }}
        />
      ),
    });
  };

  const handleReject = (item: Workload) => {
    showModal({
      title: t('studyLoad.workload.rejectTitle'),
      body: () => (
        <RejectModal
          title={t('studyLoad.workload.rejectTitle')}
          recordName={item.departmentTitle ?? undefined}
          onConfirm={(comment) => rejectMutation.mutateAsync({ id: item.id, comment })}
          loading={rejectMutation.isPending}
        />
      ),
      maxWidth: '545px',
    });
  };

  const handleRevokeFinal = (item: Workload) => {
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      body: () => (
        <RejectModal
          title={t('studyLoad.revokeFinal.title')}
          recordName={item.departmentTitle ?? undefined}
          onConfirm={(comment) => rejectMutation.mutateAsync({ id: item.id, comment })}
          loading={rejectMutation.isPending}
          confirmLabel={t('studyLoad.revokeFinal.action')}
          successMessage={t('studyLoad.revokeFinal.success')}
        />
      ),
      maxWidth: '545px',
    });
  };

  const handleDelete = (item: Workload) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <WorkloadDeleteBody item={item} />,
    });
  };

  const columns: ColumnDef<Workload>[] = [
    {
      header: t('studyLoad.workload.column.department'),
      id: 'department',
      cell: ({ row }) => {
        const versionLabel = workloadVersionLabel(row.original.version);
        return (
          <Typography.Text style={{ color: 'var(--color-text)' }}>
            {row.original.departmentTitle ?? '—'}
            {versionLabel ? (
              <Tooltip title={t('studyLoad.workload.version.badgeTooltip')}>
                <Tag style={{ marginInlineStart: 'var(--space-2)' }}>{versionLabel}</Tag>
              </Tooltip>
            ) : null}
          </Typography.Text>
        );
      },
    },
    {
      header: t('studyLoad.distribution.column.scienceNumber'),
      id: 'totalLectures',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.totalLectures}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.totalHour'),
      id: 'totalHours',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.totalHours}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.academicYear'),
      id: 'academicYear',
      size: 130,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.academicYearTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.date'),
      id: 'date',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.date ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.status'),
      id: 'status',
      size: 190,
      cell: ({ row }) => {
        const st = row.original.status;
        const color = WORKLOAD_STATUS_COLORS[st] ?? '#aaa';
        const label = statusLabels[st] ?? st;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Tag
              color={color}
              style={{
                borderRadius: 'var(--radius-pill, 20px)',
                color: '#fff',
                borderColor: color,
                marginInlineEnd: 0,
              }}
            >
              {label}
            </Tag>
            <PostApprovalEditBadge
              editedAt={row.original.lastEditedAfterApprovalAt}
              variant="tag"
            />
            <NeedsRecalcBadge needsRecalculation={row.original.needsRecalculation} />
          </div>
        );
      },
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 260,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;

        const isSubmitTurn =
          (item.status === 'draft' || item.status === 'new') &&
          role === WORKLOAD_SUBMIT_ROLE;
        const isChainTurn =
          item.status === 'in_review' &&
          Boolean(item.currentStep) &&
          role === WORKLOAD_STEP_ROLES[item.currentStep as string];
        const canApprove = isSubmitTurn || isChainTurn;
        const canReject = isChainTurn;
        const canDelete =
          item.status === 'draft' ||
          item.status === 'new' ||
          item.status === 'rejected';
        const canEditContent = isWorkloadContentEditable(item.status);
        const canReopen = canReopenWorkload(item.status, canReopenRole);
        const canRevoke = canRevokeFinalRow({
          entity: 'workload',
          status: item.status,
          finalRole: finalStepRole(null, WORKLOAD_STEP_ROLES, FIXED_FINAL_STEP.workload),
        });
        return (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              loading={pdfLoadingId === item.id}
              disabled={pdfLoadingId !== null && pdfLoadingId !== item.id}
              onClick={() => void handleOpenPdf(item)}
            >
              {t('studyLoad.common.view')}
            </Button>

            {canEditContent ? (
              <Can perform="workload:update">
                <Tooltip title={t('studyLoad.common.edit')}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/study-load/workloads/${item.id}`)}
                  />
                </Tooltip>
              </Can>
            ) : null}

            {canReopen ? (
              <Can perform="workload:approve">
                <Button
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={() => handleReopen(item)}
                >
                  {t('studyLoad.workload.action.reopen')}
                </Button>
              </Can>
            ) : null}

            {canApprove ? (
              <Can perform="workload:approve">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleApprove(item)}
                >
                  {t('studyLoad.approval.action.approve')}
                </Button>
              </Can>
            ) : null}

            {canReject ? (
              <Can perform="workload:reject">
                <Button
                  danger
                  type="primary"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleReject(item)}
                >
                  {t('studyLoad.common.reject')}
                </Button>
              </Can>
            ) : null}

            {canRevoke ? (
              <Can perform="workload:reject">
                <Button
                  danger
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => handleRevokeFinal(item)}
                >
                  {t('studyLoad.revokeFinal.action')}
                </Button>
              </Can>
            ) : null}

            {canDelete && can('workload:delete') ? (
              <Tooltip title={t('studyLoad.common.delete')}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(item)}
                />
              </Tooltip>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('studyLoad.nav.workload')}>
      <Filters
        hideSearch
        onSearch={() => {}}
        selects={[
          {
            key: 'status',
            placeholder: t('studyLoad.distribution.filter.allStatuses'),
            value: statusFilter,
            options: statusOptions,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
          },
          {
            key: 'department',
            placeholder: t('studyLoad.workload.filter.allDepartments'),
            value: departmentId,
            options: departmentOptions,
            onChange: (v) => {
              setDepartmentId(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              icon={<FileExcelOutlined />}
              style={{ height: 38 }}
              loading={exporting}
              onClick={() => void handleExcel()}
            >
              Excel
            </Button>
            <Can perform="workload:create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  showModal({
                    title: t('studyLoad.workload.create'),
                    body: () => (
                      <WorkloadForm
                        onOpenWorkload={(id) => navigate(`/study-load/workloads/${id}`)}
                      />
                    ),
                    maxWidth: '545px',
                    bodyPadding: '0',
                    overflow: true,
                  })
                }
                style={{ height: 38 }}
              >
                {t('studyLoad.workload.create')}
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable<Workload>
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

export default WorkloadListPage;
