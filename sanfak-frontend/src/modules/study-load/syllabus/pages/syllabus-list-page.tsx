import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Tag, Tooltip, Typography } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  AuditOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageContainer, DataTable, Filters, LineTab, type LineTabItem, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import StatusBadge from '../../components/status-badge';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import {
  FIXED_FINAL_STEP,
  finalStepRole,
  useRevokeFinalGate,
} from '../../lib/final-step';
import DeleteConfirm from '../../components/delete-confirm';
import WarningConfirm from '../../components/warning-confirm';
import ApprovalChainModal from '../../components/approval-chain-modal';
import { openPdf } from '../../lib/open-pdf';
import {
  useChainRowGate,
  useHasRole,
  SYLLABUS_STEP_ROLES,
  SYLLABUS_SUBMIT_ROLE,
} from '../../lib/use-has-pending-step';
import {
  useSyllabi,
  useDeleteSyllabus,
  useApproveSyllabus,
  useRejectSyllabus,
  useSyllabusApproval,
  getApiErrorMessage,
  type SyllabusFilter,
} from '../api/syllabus-api';
import type { SyllabusListItem } from '../model/types';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

const ACTIVE_TAB_STATUSES: SyllabusListItem['status'][] = [
  'new',
  'in_review',
  'approved',
  'rejected',
];

interface IDeleteBodyProps {
  item: SyllabusListItem;
}

const SyllabusDeleteBody = ({ item }: IDeleteBodyProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const deleteMutation = useDeleteSyllabus();

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(item.id);
      message.success(t('studyLoad.syllabus.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      title={t('studyLoad.syllabus.deleteConfirmTitle')}
      subtitle={t('studyLoad.common.deleteConfirmSubtitle')}
      loading={deleteMutation.isPending}
      onConfirm={() => { void handleConfirm(); }}
    />
  );
};

interface IApprovalBodyProps {
  id: string;
}

const SyllabusApprovalBody = ({ id }: IApprovalBodyProps) => {
  const { data, isLoading, isError } = useSyllabusApproval(id);
  return <ApprovalChainModal isLoading={isLoading} isError={isError} steps={data} />;
};

function useActiveColumns(
  t: (key: string) => string,
  onEdit: (item: SyllabusListItem) => void,
  onDelete: (item: SyllabusListItem) => void,
  onApprove: (item: SyllabusListItem) => void,
  onReject: (item: SyllabusListItem) => void,
  onViewPdf: (item: SyllabusListItem) => void,
  onViewApprovalChain: (item: SyllabusListItem) => void,
  pdfLoadingId: string | null,
  canActOnRow: (status: string, currentStep: string | null | undefined) => boolean,
  onReopen: (item: SyllabusListItem) => void,
  canReopen: boolean,
  onRevokeFinal: (item: SyllabusListItem) => void,
  canRevokeRow: (item: SyllabusListItem) => boolean,
): ColumnDef<SyllabusListItem>[] {
  return useMemo(
    () => [
      {
        header: t('studyLoad.myWorkload.column.science'),
        id: 'scienceName',
        cell: ({ row }) => (
          <strong style={{ color: 'var(--color-text)' }}>
            {row.original.scienceName ?? '—'}
          </strong>
        ),
      },
      {
        header: t('studyLoad.myWorkload.column.semester'),
        id: 'semester',
        size: 100,
        cell: ({ row }) => row.original.semester ?? '—',
      },
      {
        header: t('studyLoad.distribution.column.course'),
        id: 'year',
        size: 120,
        cell: ({ row }) => (
          <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
            {row.original.year ?? '—'}
          </Typography.Text>
        ),
      },
      {
        header: t('studyLoad.distribution.column.date'),
        id: 'createdAt',
        size: 130,
        cell: ({ row }) =>
          row.original.createdAt
            ? dayjs(row.original.createdAt).format('DD.MM.YYYY')
            : '—',
      },
      {
        header: t('studyLoad.distribution.column.status'),
        id: 'status',
        size: 160,
        cell: ({ row }) => {
          const item = row.original;
          const badge =
            item.status === 'new' ? (
              <Tag color="blue">{t('studyLoad.syllabus.status.new')}</Tag>
            ) : (
              <StatusBadge status={item.status} />
            );
          return item.status === 'rejected' && item.rejectedReason ? (
            <Tooltip title={item.rejectedReason} placement="topLeft">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
                {badge}
                <InfoCircleOutlined style={{ color: 'var(--brand-error, #f04438)', fontSize: 13 }} />
              </span>
            </Tooltip>
          ) : (
            badge
          );
        },
      },
      {
        header: t('studyLoad.distribution.column.actions'),
        id: 'actions',
        size: 240,
        meta: { align: 'right' as const },
        cell: ({ row }) => {
          const item = row.original;

          const canAct = canActOnRow(item.status, item.currentStep);
          const canApprove = canAct;
          const canReject = canAct && item.status === 'in_review';

          const canEdit = item.status === 'draft' || item.status === 'new';
          const canDelete =
            item.status === 'draft' || item.status === 'new' || item.status === 'rejected';
          const showReopen = canReopen && item.status === 'rejected';
          const showRevoke = canRevokeRow(item);
          return (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {canApprove ? (
                <Can perform={['syllabus:approve', 'syllabus:update']}>
                  <Tooltip title={t('studyLoad.syllabus.approveEri')}>
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

              {canReject ? (
                <Can perform="syllabus:reject">
                  <Tooltip title={t('studyLoad.common.reject')}>
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

              {showRevoke ? (
                <Can perform="syllabus:reject">
                  <Tooltip title={t('studyLoad.revokeFinal.action')}>
                    <Button
                      type="text"
                      danger
                      icon={<UndoOutlined />}
                      size="small"
                      aria-label={t('studyLoad.revokeFinal.action')}
                      onClick={() => onRevokeFinal(item)}
                    />
                  </Tooltip>
                </Can>
              ) : null}

              {showReopen ? (
                <Can perform={['syllabus:approve', 'syllabus:update']}>
                  <Tooltip title={t('studyLoad.syllabus.action.reopen')}>
                    <Button
                      type="text"
                      icon={<RedoOutlined />}
                      size="small"
                      style={{ color: 'var(--brand-primary)' }}
                      onClick={() => onReopen(item)}
                    />
                  </Tooltip>
                </Can>
              ) : null}

              <Can perform="syllabus:read">
                <Tooltip title={t('studyLoad.syllabus.viewPdf')}>
                  <Button
                    type="text"
                    icon={<FilePdfOutlined />}
                    size="small"
                    style={{ color: 'var(--color-text-soft)' }}
                    loading={pdfLoadingId === item.id}
                    disabled={pdfLoadingId !== null && pdfLoadingId !== item.id}
                    onClick={() => onViewPdf(item)}
                  />
                </Tooltip>
              </Can>

              <Can perform="syllabus:read">
                <Tooltip title={t('studyLoad.approval.title')}>
                  <Button
                    type="text"
                    icon={<AuditOutlined />}
                    size="small"
                    style={{ color: 'var(--color-text-soft)' }}
                    onClick={() => onViewApprovalChain(item)}
                  />
                </Tooltip>
              </Can>

              {canEdit ? (
                <Can perform="syllabus:update">
                  <Tooltip title={t('studyLoad.common.edit')}>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => onEdit(item)}
                    />
                  </Tooltip>
                </Can>
              ) : null}

              {canDelete ? (
                <Can perform="syllabus:delete">
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
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      t,
      onEdit,
      onDelete,
      onApprove,
      onReject,
      onViewPdf,
      onViewApprovalChain,
      pdfLoadingId,
      canActOnRow,
      onReopen,
      canReopen,
      onRevokeFinal,
      canRevokeRow,
    ],
  );
}

function useDraftColumns(
  t: (key: string) => string,
  onApprove: (item: SyllabusListItem) => void,
  onEdit: (item: SyllabusListItem) => void,
  onDelete: (item: SyllabusListItem) => void,
): ColumnDef<SyllabusListItem>[] {
  return useMemo(
    () => [
      {
        header: t('studyLoad.myWorkload.column.science'),
        id: 'scienceName',
        cell: ({ row }) => (
          <strong style={{ color: 'var(--color-text)' }}>
            {row.original.scienceName ?? '—'}
          </strong>
        ),
      },
      {
        header: t('studyLoad.distribution.column.date'),
        id: 'createdAt',
        size: 130,
        cell: ({ row }) =>
          row.original.createdAt
            ? dayjs(row.original.createdAt).format('DD.MM.YYYY')
            : '—',
      },
      {
        header: t('studyLoad.distribution.column.actions'),
        id: 'actions',
        size: 120,
        meta: { align: 'right' as const },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>

              <Can perform="syllabus:update">
                <Tooltip title={t('studyLoad.syllabus.approveEri')}>
                  <Button
                    type="text"
                    style={{ color: 'var(--brand-primary)' }}
                    icon={<CheckOutlined />}
                    size="small"
                    onClick={() => onApprove(item)}
                  />
                </Tooltip>
              </Can>
              <Can perform="syllabus:update">
                <Tooltip title={t('studyLoad.common.edit')}>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => onEdit(item)}
                  />
                </Tooltip>
              </Can>
              <Can perform="syllabus:delete">
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
    [t, onApprove, onEdit, onDelete],
  );
}

const SyllabusListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const approveMutation = useApproveSyllabus();
  const rejectMutation = useRejectSyllabus();
  const canActOnRow = useChainRowGate(SYLLABUS_STEP_ROLES, SYLLABUS_SUBMIT_ROLE);
  const isTeacher = useHasRole(SYLLABUS_SUBMIT_ROLE);
  const canRevokeFinalDoc = useRevokeFinalGate();
  const canRevokeRow = (item: SyllabusListItem): boolean =>
    canRevokeFinalDoc({
      status: item.status,
      finalRole: finalStepRole(null, SYLLABUS_STEP_ROLES, FIXED_FINAL_STEP.syllabus),
    });

  const handleReopen = (item: SyllabusListItem) => {
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.syllabus.reopenTitle')}
          subtitle={t('studyLoad.syllabus.reopenSubtitle')}
          confirmText={t('studyLoad.syllabus.action.reopen')}
          loading={approveMutation.isPending}
          onConfirm={async () => {
            await approveMutation.mutateAsync({ id: item.id });
            message.success(t('studyLoad.syllabus.reopened'));
          }}
        />
      ),
    });
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'active' | 'draft'>(
    searchParams.get('tab') === 'draft' ? 'draft' : 'active',
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const statusFilter = activeTab === 'draft' ? 'draft' : undefined;

  const filter: SyllabusFilter = useMemo(
    () => ({ page, limit: pageSize, status: statusFilter, search: search || undefined }),
    [page, pageSize, statusFilter, search],
  );

  const { data, isLoading } = useSyllabi(filter);

  useEffect(() => {
    const totalPages = data?.meta.totalPages;
    if (totalPages !== undefined && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.meta.totalPages, page]);


  const handleEdit = (item: SyllabusListItem) => {
    navigate(`/study-load/syllabi/${item.id}/edit`);
  };

  const handleViewPdf = async (item: SyllabusListItem) => {
    setPdfLoadingId(item.id);
    try {
      await openPdf(`/syllabi/${item.id}/pdf`, message, t);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleDelete = (item: SyllabusListItem) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <SyllabusDeleteBody item={item} />,
    });
  };

  const handleApprove = (item: SyllabusListItem) => {
    const needsProtocol = item.status === 'in_review' && item.currentStep === 'kafedra';
    showModal({
      title: t('studyLoad.syllabus.approveTitle'),
      maxWidth: '545px',
      body: () => (
        <ApproveModal
          title={t('studyLoad.syllabus.approveTitle')}
          recordName={item.scienceName ?? undefined}
          protocol={needsProtocol}
          onConfirm={(protocol) => approveMutation.mutateAsync({ id: item.id, protocol })}
          loading={approveMutation.isPending}
        />
      ),
    });
  };

  const handleReject = (item: SyllabusListItem) => {
    showModal({
      title: t('studyLoad.syllabus.rejectTitle'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.syllabus.rejectTitle')}
          recordName={item.scienceName ?? undefined}
          onConfirm={(comment) => rejectMutation.mutateAsync({ id: item.id, comment })}
          loading={rejectMutation.isPending}
        />
      ),
    });
  };

  const handleRevokeFinal = (item: SyllabusListItem) => {
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.revokeFinal.title')}
          recordName={item.scienceName ?? undefined}
          onConfirm={(comment) => rejectMutation.mutateAsync({ id: item.id, comment })}
          loading={rejectMutation.isPending}
          confirmLabel={t('studyLoad.revokeFinal.action')}
          successMessage={t('studyLoad.revokeFinal.success')}
        />
      ),
    });
  };

  const handleApprovalChain = (item: SyllabusListItem) => {
    showModal({
      title: t('studyLoad.approval.title'),
      maxWidth: '620px',
      body: () => <SyllabusApprovalBody id={item.id} />,
    });
  };

  const activeColumns = useActiveColumns(
    t,
    handleEdit,
    handleDelete,
    handleApprove,
    handleReject,
    handleViewPdf,
    handleApprovalChain,
    pdfLoadingId,
    canActOnRow,
    handleReopen,
    isTeacher,
    handleRevokeFinal,
    canRevokeRow,
  );
  const draftColumns = useDraftColumns(t, handleApprove, handleEdit, handleDelete);

  const displayedItems = useMemo(() => {
    const items = data?.items ?? [];
    if (activeTab === 'active') {
      return items.filter((i) => ACTIVE_TAB_STATUSES.includes(i.status));
    }
    return items.filter((i) => i.status === 'draft');
  }, [data?.items, activeTab]);

  const tabData: LineTabItem[] = [
    { key: 'active', label: t('studyLoad.syllabus.tab.active') },
    { key: 'draft', label: t('studyLoad.syllabus.tab.draft') },
  ];

  return (
    <PageContainer
      title={t('studyLoad.nav.syllabus')}
      extra={
        <Can perform="syllabus:create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/study-load/syllabi/new')}
            style={{ height: 38 }}
          >
            {t('studyLoad.syllabus.create')}
          </Button>
        </Can>
      }
    >
      <Filters
        searchPlaceholder={t('studyLoad.syllabus.searchPlaceholder')}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
      />

      <LineTab
        data={tabData}
        activeTab={activeTab}
        setActiveTab={(key) => {
          setActiveTab(key as 'active' | 'draft');
          setPage(1);
          setSearchParams(key === 'draft' ? { tab: 'draft' } : {}, { replace: true });
        }}
      />

      <DataTable<SyllabusListItem>
        data={displayedItems}
        columns={activeTab === 'active' ? activeColumns : draftColumns}
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

export default SyllabusListPage;
