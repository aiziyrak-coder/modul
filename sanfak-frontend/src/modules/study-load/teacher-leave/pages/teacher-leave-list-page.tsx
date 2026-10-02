import { useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Tooltip, Typography } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PlusOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import StatusBadge from '../../components/status-badge';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import DeleteConfirm from '../../components/delete-confirm';
import CreateLeaveModal from '../components/create-leave-modal';
import ReassignModal from '../components/reassign-modal';
import { openPdf } from '../../lib/open-pdf';
import {
  useTeacherLeaves,
  useApproveTeacherLeave,
  useRejectTeacherLeave,
  useDeleteTeacherLeave,
  getApiErrorMessage,
  type TeacherLeaveFilter,
} from '../api/teacher-leave-api';
import type { TeacherLeave, TeacherLeaveType } from '../model/types';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

function buildTeacherLeaveTypeLabels(t: (key: string) => string): Record<TeacherLeaveType, string> {
  return {
    leave: t('studyLoad.teacherLeave.type.leave'),
    resignation: t('studyLoad.teacherLeave.type.resignation'),
    transfer: t('studyLoad.teacherLeave.type.transfer'),
  };
}

function useColumns(
  t: (key: string) => string,
  page: number,
  pageSize: number,
  onApprove: (item: TeacherLeave) => void,
  onReject: (item: TeacherLeave) => void,
  onDelete: (item: TeacherLeave) => void,
  onPdf: (item: TeacherLeave) => void,
  onReassign: (item: TeacherLeave) => void,
  pdfLoadingId: string | null,
): ColumnDef<TeacherLeave>[] {
  return useMemo(
    () => [
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
        header: t('studyLoad.teacherLeave.form.teacher'),
        id: 'teacherName',
        cell: ({ row }) => (
          <strong style={{ color: 'var(--color-text)' }}>
            {row.original.teacherName ?? '—'}
          </strong>
        ),
      },
      {
        header: t('studyLoad.teacherLeave.column.type'),
        id: 'type',
        size: 140,
        cell: ({ row }) => {
          const type = row.original.type;
          const labels = buildTeacherLeaveTypeLabels(t);
          return type ? (labels[type] ?? type) : '—';
        },
      },
      {
        header: t('studyLoad.distribution.column.date'),
        id: 'dateRange',
        size: 180,
        cell: ({ row }) => {
          const { fromDate, toDate } = row.original;
          if (!fromDate && !toDate) return '—';
          const from = fromDate ? dayjs(fromDate).format('DD.MM.YYYY') : '…';
          const to = toDate ? dayjs(toDate).format('DD.MM.YYYY') : '…';
          return (
            <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
              {from} – {to}
            </Typography.Text>
          );
        },
      },
      {
        header: t('studyLoad.teacherLeave.form.reason'),
        id: 'reason',
        cell: ({ row }) => {
          const reason = row.original.reason;
          if (!reason) return <span style={{ color: 'var(--color-text-soft)' }}>—</span>;
          return (
            <Tooltip title={reason} placement="topLeft">
              <Typography.Text
                ellipsis
                style={{ maxWidth: 200, color: 'var(--color-text-soft)', fontSize: 13 }}
              >
                {reason}
              </Typography.Text>
            </Tooltip>
          );
        },
      },
      {
        header: t('studyLoad.distribution.column.status'),
        id: 'status',
        size: 140,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        header: t('studyLoad.distribution.column.actions'),
        id: 'actions',
        size: 180,
        meta: { align: 'right' as const },
        cell: ({ row }) => {
          const item = row.original;
          const isPending = item.status === 'pending';
          const isApproved = item.status === 'approved';
          const isReassignable =
            isApproved && (item.type === 'resignation' || item.type === 'transfer');
          return (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {isPending ? (
                <Can perform="teacherLeave:update">
                  <Tooltip title={t('studyLoad.approval.action.approve')}>
                    <Button
                      type="text"
                      icon={<CheckOutlined />}
                      size="small"
                      style={{ color: 'var(--brand-primary)' }}
                      onClick={() => onApprove(item)}
                    />
                  </Tooltip>
                </Can>
              ) : null}

              {isPending ? (
                <Can perform="teacherLeave:update">
                  <Tooltip title={t('studyLoad.approval.action.reject')}>
                    <Button
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      size="small"
                      onClick={() => onReject(item)}
                    />
                  </Tooltip>
                </Can>
              ) : null}

              {isReassignable ? (
                <Can perform="teacherLeave:update">
                  <Tooltip title={t('studyLoad.teacherLeave.reassign')}>
                    <Button
                      type="text"
                      icon={<UserSwitchOutlined />}
                      size="small"
                      style={{ color: 'var(--brand-primary)' }}
                      onClick={() => onReassign(item)}
                    />
                  </Tooltip>
                </Can>
              ) : null}

              <Can perform="teacherLeave:read">
                <Tooltip
                  title={
                    isApproved
                      ? t('studyLoad.teacherLeave.pdfProtocol')
                      : t('studyLoad.teacherLeave.pdfProtocolNotApproved')
                  }
                >
                  <Button
                    type="text"
                    icon={<FilePdfOutlined />}
                    size="small"
                    style={{ color: 'var(--color-text-soft)' }}
                    loading={pdfLoadingId === item.id}
                    disabled={!isApproved || (pdfLoadingId !== null && pdfLoadingId !== item.id)}
                    onClick={() => onPdf(item)}
                  />
                </Tooltip>
              </Can>

              <Can perform="teacherLeave:delete">
                <Tooltip title={t('studyLoad.common.delete')}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={() => onDelete(item)}
                  />
                </Tooltip>
              </Can>
            </div>
          );
        },
      },
    ],
    [t, page, pageSize, onApprove, onReject, onDelete, onPdf, onReassign, pdfLoadingId],
  );
}

interface IDeleteBodyProps {
  item: TeacherLeave;
}

const TeacherLeaveDeleteBody = ({ item }: IDeleteBodyProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const deleteMutation = useDeleteTeacherLeave();

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(item.id);
      message.success(t('studyLoad.teacherLeave.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      title={t('studyLoad.teacherLeave.deleteConfirmTitle')}
      subtitle={t('studyLoad.teacherLeave.deleteConfirmSubtitle', {
        teacher: item.teacherName ?? t('studyLoad.teacherLeave.pageTitleSingular'),
      })}
      loading={deleteMutation.isPending}
      onConfirm={() => { void handleConfirm(); }}
    />
  );
};

const TeacherLeaveListPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const filter: TeacherLeaveFilter = useMemo(
    () => ({ page, limit: pageSize, search: search || undefined, status: statusFilter }),
    [page, pageSize, search, statusFilter],
  );

  const { data, isLoading } = useTeacherLeaves(filter);

  useEffect(() => {
    const totalPages = data?.meta.totalPages;
    if (totalPages !== undefined && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.meta.totalPages, page]);

  const approveMutation = useApproveTeacherLeave();
  const rejectMutation = useRejectTeacherLeave();

  const handleApprove = (item: TeacherLeave) => {
    showModal({
      title: t('studyLoad.teacherLeave.approveTitle'),
      maxWidth: '545px',
      body: () => (
        <ApproveModal
          title={t('studyLoad.teacherLeave.approveTitle')}
          recordName={item.teacherName ?? undefined}
          onConfirm={() => approveMutation.mutateAsync({ id: item.id }).then(() => undefined)}
          loading={approveMutation.isPending}
        />
      ),
    });
  };

  const handleReject = (item: TeacherLeave) => {
    showModal({
      title: t('studyLoad.teacherLeave.rejectTitle'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.teacherLeave.rejectTitle')}
          recordName={item.teacherName ?? undefined}
          onConfirm={(comment) => rejectMutation.mutateAsync({ id: item.id, comment }).then(() => undefined)}
          loading={rejectMutation.isPending}
        />
      ),
    });
  };

  const handleDelete = (item: TeacherLeave) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <TeacherLeaveDeleteBody item={item} />,
    });
  };

  const handlePdf = async (item: TeacherLeave) => {
    setPdfLoadingId(item.id);
    try {
      await openPdf(`/teacher-leaves/${item.id}/pdf`, message, t);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleCreate = () => {
    showModal({
      title: t('studyLoad.teacherLeave.create'),
      body: CreateLeaveModal,
      maxWidth: '520px',
    });
  };

  const handleReassign = (item: TeacherLeave) => {
    const ModalBody = () => <ReassignModal leaveId={item.id} />;
    showModal({
      title: t('studyLoad.teacherLeave.reassign'),
      body: ModalBody,
      maxWidth: '520px',
    });
  };

  const columns = useColumns(
    t,
    page,
    pageSize,
    handleApprove,
    handleReject,
    handleDelete,
    handlePdf,
    handleReassign,
    pdfLoadingId,
  );

  return (
    <PageContainer
      title={t('studyLoad.teacherLeave.title')}
      extra={
        <Can perform="teacherLeave:create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {t('studyLoad.teacherLeave.create')}
          </Button>
        </Can>
      }
    >
      <Filters
        searchPlaceholder={t('studyLoad.teacherLeave.searchPlaceholder')}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        selects={[
          {
            key: 'status',
            placeholder: t('studyLoad.teacherLeave.column.status'),
            value: statusFilter,
            options: [
              { value: 'pending', label: t('studyLoad.approval.status.pending') },
              { value: 'approved', label: t('studyLoad.distribution.status.approved') },
              { value: 'rejected', label: t('studyLoad.distribution.status.rejected') },
            ],
            onChange: (val) => {
              setStatusFilter(val);
              setPage(1);
            },
          },
        ]}
      />

      <DataTable<TeacherLeave>
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

export default TeacherLeaveListPage;
