import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Tooltip, Typography } from 'antd';
import {
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  ClearOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission, useSessionStore } from '@/app/session';
import StatusBadge from '../../components/status-badge';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import {
  FIXED_FINAL_STEP,
  finalStepRole,
  useRevokeFinalGate,
} from '../../lib/final-step';
import WarningConfirm from '../../components/warning-confirm';
import { exportWorkingSchedulesToExcel } from '../../lib/excel';
import { openPdf } from '../../lib/open-pdf';
import { fetchUnfilledSlots } from '../../working-plan/api/working-plan-api';
import {
  isStepMine,
  useHasRole,
  WORKING_SCHEDULE_STEP_ROLES,
} from '../../lib/use-has-pending-step';
import {
  useWorkingSchedules,
  useDeleteWorkingSchedule,
  useApproveWorkingSchedule,
  useRejectWorkingSchedule,
  getApiErrorMessage,
  fetchAllWorkingSchedules,
  type WorkingSchedulesFilter,
} from '../api/working-schedule-api';
import {
  useDirectionsRef,
  useCourseRefsRef,
} from '../api/references-api';
import type { WorkingSchedule, WorkingScheduleStatus } from '../model/types';

function buildStatusOptions(
  t: (key: string) => string,
): { label: string; value: WorkingScheduleStatus }[] {
  return [
    { label: t('studyLoad.workingSchedule.status.draft'), value: 'draft' },
    { label: t('studyLoad.distribution.status.inReview'), value: 'in_review' },
    { label: t('studyLoad.distribution.status.approved'), value: 'approved' },
    { label: t('studyLoad.distribution.status.rejected'), value: 'rejected' },
  ];
}

const WorkingScheduleListPage = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const showModal = useModalStore((s) => s.showModal);
  const sessionRoles = useSessionStore((s) => s.user?.roles);
  const sessionPermissions = useSessionStore((s) => s.permissions);
  const isUslubiyBoshqarma = useHasRole('oquv_uslubiy_boshqarma');
  const canRevokeFinalRow = useRevokeFinalGate();
  const navigate = useNavigate();
  const can = usePermission();
  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkingScheduleStatus | ''>('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [courseRefFilter, setCourseRefFilter] = useState('');
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const { data: directions } = useDirectionsRef();
  const { data: courseRefs } = useCourseRefsRef();

  const filter: WorkingSchedulesFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      status: statusFilter || undefined,
      direction: directionFilter || undefined,
      courseRef: courseRefFilter || undefined,
    }),
    [page, pageSize, search, statusFilter, directionFilter, courseRefFilter],
  );

  const { data, isLoading } = useWorkingSchedules(filter);

  useEffect(() => {
    const totalPages = data?.meta.totalPages;
    if (totalPages !== undefined && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.meta.totalPages, page]);

  const deleteSchedule = useDeleteWorkingSchedule();
  const approveMutation = useApproveWorkingSchedule();
  const rejectMutation = useRejectWorkingSchedule();

  const handleDelete = (ws: WorkingSchedule) => {
    modal.confirm({
      title: t('studyLoad.workingSchedule.deleteTitle'),
      content: t('studyLoad.workingSchedule.deleteContent', {
        title: ws.title ?? t('studyLoad.workingPlan.title'),
      }),
      okText: t('studyLoad.common.delete'),
      okType: 'danger',
      cancelText: t('studyLoad.common.cancel'),
      centered: true,
      onOk: async () => {
        try {
          await deleteSchedule.mutateAsync(ws.id);
          message.success(t('studyLoad.workingSchedule.deleted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleViewFile = async (ws: WorkingSchedule) => {
    setPdfLoadingId(ws.id);
    try {
      await openPdf(`/working-schedules/${ws.id}/pdf`, message, t);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const [exporting, setExporting] = useState(false);
  const handleExcel = async () => {
    setExporting(true);
    try {
      const items = await fetchAllWorkingSchedules({
        search: filter.search,
        status: filter.status,
        direction: filter.direction,
        courseRef: filter.courseRef,
      });
      exportWorkingSchedulesToExcel(items, "Ishchi_oquv_reja.xlsx");
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const handleApprove = async (ws: WorkingSchedule) => {
    const recordName = ws.title ?? undefined;
    const unfilled = ws.status === 'draft' ? await fetchUnfilledSlots(qc, ws.id) : [];
    const ModalBody = () => (
      <>
        {unfilled.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 'var(--space-3)' }}
            message={t('studyLoad.workingPlan.electiveSlot.unfilledWarning', {
              count: unfilled.length,
            })}
          />
        ) : null}
        <ApproveModal
          title={t('studyLoad.workingSchedule.approveTitle')}
          onConfirm={async () => {
            const res = await approveMutation.mutateAsync(ws.id);
            if (res?.warning) message.warning(res.warning, 8);
          }}
          loading={approveMutation.isPending}
          recordName={recordName}
        />
      </>
    );
    showModal({
      title: t('studyLoad.workingSchedule.approveTitle'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  const handleReject = (ws: WorkingSchedule) => {
    const recordName = ws.title ?? undefined;
    const ModalBody = () => (
      <RejectModal
        title={t('studyLoad.workingSchedule.rejectTitle')}
        onConfirm={(comment) => rejectMutation.mutateAsync({ id: ws.id, comment })}
        loading={rejectMutation.isPending}
        recordName={recordName}
      />
    );
    showModal({
      title: t('studyLoad.workingSchedule.rejectTitle'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  const handleRevokeFinal = (ws: WorkingSchedule) => {
    const ModalBody = () => (
      <RejectModal
        title={t('studyLoad.revokeFinal.title')}
        onConfirm={(comment) => rejectMutation.mutateAsync({ id: ws.id, comment })}
        loading={rejectMutation.isPending}
        recordName={ws.title ?? undefined}
        confirmLabel={t('studyLoad.revokeFinal.action')}
        successMessage={t('studyLoad.revokeFinal.success')}
      />
    );
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  const handleReopen = (ws: WorkingSchedule) => {
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.workingSchedule.reopenTitle')}
          subtitle={t('studyLoad.workingSchedule.reopenSubtitle')}
          confirmText={t('studyLoad.workingSchedule.action.reopen')}
          loading={approveMutation.isPending}
          onConfirm={async () => {
            await approveMutation.mutateAsync(ws.id);
            message.success(t('studyLoad.workingSchedule.reopened'));
          }}
        />
      ),
    });
  };

  const columns: ColumnDef<WorkingSchedule>[] = [
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
      header: t('studyLoad.progress.step.direction'),
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
      header: t('studyLoad.workingSchedule.column.createdDate'),
      id: 'date',
      size: 160,
      cell: ({ row }) =>
        row.original.date
          ? dayjs(row.original.date).format('DD/MM/YYYY HH:mm')
          : row.original.createdAt
            ? dayjs(row.original.createdAt).format('DD/MM/YYYY HH:mm')
            : '—',
    },
    {
      header: t('studyLoad.distribution.column.status'),
      id: 'status',
      size: 130,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 240,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const ws = row.original;
        const isMyTurn = isStepMine(
          ws.currentStep,
          WORKING_SCHEDULE_STEP_ROLES,
          sessionRoles,
          sessionPermissions,
        );
        const canApproveStep = ws.status === 'in_review' && isMyTurn;
        const canSubmit = ws.status === 'draft' && isUslubiyBoshqarma;
        const canApprove = canSubmit || canApproveStep;
        const canReject = canApproveStep;
        const canEdit = ws.status === 'draft' || ws.status === 'rejected';
        const canDelete = ws.status === 'draft' || ws.status === 'rejected';
        const canReopen = ws.status === 'rejected' && isUslubiyBoshqarma;
        const canRevoke = canRevokeFinalRow({
          status: ws.status,
          finalRole: finalStepRole(
            ws.approvalHistory,
            WORKING_SCHEDULE_STEP_ROLES,
            FIXED_FINAL_STEP.workingSchedule,
          ),
        });
        return (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
            {canApprove ? (
              <Can perform="workingSchedule:approve">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => void handleApprove(ws)}
                >
                  {t('studyLoad.approval.action.approve')}
                </Button>
              </Can>
            ) : null}

            {canReject ? (
              <Can perform="workingSchedule:reject">
                <Button
                  danger
                  type="primary"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleReject(ws)}
                >
                  {t('studyLoad.common.reject')}
                </Button>
              </Can>
            ) : null}

            {canRevoke ? (
              <Can perform="workingSchedule:reject">
                <Button
                  danger
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => handleRevokeFinal(ws)}
                >
                  {t('studyLoad.revokeFinal.action')}
                </Button>
              </Can>
            ) : null}

            {canReopen ? (
              <Can perform="workingSchedule:approve">
                <Button
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={() => handleReopen(ws)}
                >
                  {t('studyLoad.workingSchedule.action.reopen')}
                </Button>
              </Can>
            ) : null}

            <Can perform="workingSchedule:read">
              <Button
                size="small"
                icon={<EyeOutlined />}
                loading={pdfLoadingId === ws.id}
                onClick={() => handleViewFile(ws)}
              >
                {t('studyLoad.common.view')}
              </Button>
            </Can>

            {canEdit ? (
              <Can perform="workingSchedule:update">
                <Tooltip title={t('studyLoad.common.edit')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/study-load/working-schedules/${ws.id}`)}
                  />
                </Tooltip>
              </Can>
            ) : null}

            {canDelete ? (
              <Can perform="workingSchedule:delete">
                <Tooltip title={t('studyLoad.common.delete')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(ws)}
                  />
                </Tooltip>
              </Can>
            ) : null}
          </div>
        );
      },
    },
  ];

  const hasActiveFilter =
    Boolean(search) ||
    Boolean(directionFilter) ||
    Boolean(courseRefFilter) ||
    Boolean(statusFilter);

  const handleResetFilters = () => {
    setSearch('');
    setDirectionFilter('');
    setCourseRefFilter('');
    setStatusFilter('');
    setPage(1);
  };

  return (
    <PageContainer title={t('studyLoad.workingSchedule.pageTitle')}>
      <Filters
        hideSearch={!can('workingSchedule:readAll')}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'direction',
            placeholder: t('studyLoad.workingSchedule.filter.allDirections'),
            value: directionFilter || undefined,
            options: (directions ?? []).map((d) => ({ label: d.title, value: d.id })),
            onChange: (v) => {
              setDirectionFilter(v ?? '');
              setPage(1);
            },
          },
          {
            key: 'courseRef',
            placeholder: t('studyLoad.workingSchedule.filter.allCourses'),
            value: courseRefFilter || undefined,
            options: (courseRefs ?? []).map((c) => ({ label: c.title, value: c.id })),
            onChange: (v) => {
              setCourseRefFilter(v ?? '');
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: t('studyLoad.distribution.filter.allStatuses'),
            value: statusFilter || undefined,
            options: statusOptions,
            onChange: (v) => {
              setStatusFilter((v as WorkingScheduleStatus | undefined) ?? '');
              setPage(1);
            },
          },
        ]}
        extra={
          <>
            {hasActiveFilter ? (
              <Button
                icon={<ClearOutlined />}
                onClick={handleResetFilters}
                style={{ color: 'var(--color-text-soft)' }}
              >
                {t('studyLoad.workingSchedule.clearFilters')}
              </Button>
            ) : null}
            <Can perform="workingSchedule:readAll">
              <Button
                icon={<FileExcelOutlined />}
                loading={exporting}
                onClick={() => void handleExcel()}
                style={{ color: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' }}
              >
                {t('studyLoad.workingSchedule.excel')}
              </Button>
            </Can>
          </>
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
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        pageSizeOptions={[10, 20, 50, 100, 200]}
      />
    </PageContainer>
  );
};

export default WorkingScheduleListPage;
