import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Dropdown, Tooltip, Typography } from 'antd';
import {
  PlusOutlined,
  DownOutlined,
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
  finalStepRole,
  scienceProgramFinalStep,
  useRevokeFinalGate,
  SCIENCE_PROGRAM_V259_FINAL_CANDIDATES,
} from '../../lib/final-step';
import DeleteConfirm from '../../components/delete-confirm';
import WarningConfirm from '../../components/warning-confirm';
import ApprovalChainModal from '../../components/approval-chain-modal';
import { openPdf } from '../../lib/open-pdf';
import FormVersionTag from '../components/form-version-tag';
import {
  filterByFormVersion,
  toFormVersionFilter,
  type FormVersionFilterValue,
} from '../lib/form-version-filter';
import {
  useChainRowGate,
  useHasRole,
  SCIENCE_PROGRAM_STEP_ROLES,
  SCIENCE_PROGRAM_SUBMIT_ROLE,
} from '../../lib/use-has-pending-step';
import {
  useSciencePrograms,
  useDeleteScienceProgram,
  useApproveScienceProgram,
  useRejectScienceProgram,
  useScienceProgramApproval,
  fetchScienceProgramApprovalSteps,
  scienceProgramApprovalKey,
  getApiErrorMessage,
  type ScienceProgramsFilter,
} from '../api/science-program-api';
import type { ScienceProgram } from '../model/types';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;
const PROTOCOL_STEPS: readonly string[] = ['kafedra', 'dean', 'prorektor', 'rektor'];

function useActiveColumns(
  t: (key: string) => string,
  onEdit: (item: ScienceProgram) => void,
  onDelete: (item: ScienceProgram) => void,
  onApprove: (item: ScienceProgram) => void,
  onReject: (item: ScienceProgram) => void,
  onViewPdf: (item: ScienceProgram) => void,
  onViewApprovalChain: (item: ScienceProgram) => void,
  pdfLoadingId: string | null,
  canActOnRow: (status: string, currentStep: string | null | undefined) => boolean,
  onReopen: (item: ScienceProgram) => void,
  canReopen: boolean,
  onRevokeFinal: (item: ScienceProgram) => void,
  canRevokeRow: (item: ScienceProgram) => boolean,
): ColumnDef<ScienceProgram>[] {
  return useMemo(
    () => [
      {
        header: t('studyLoad.myWorkload.column.science'),
        id: 'scienceName',
        cell: ({ row }) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: 'var(--color-text)' }}>
              {row.original.scienceName ?? '—'}
            </strong>
            <FormVersionTag version={row.original.formVersion} />
          </span>
        ),
      },
      {
        header: t('studyLoad.myWorkload.column.semester'),
        id: 'semester',
        size: 100,
        cell: ({ row }) => row.original.semester ?? '—',
      },
      {
        header: t('studyLoad.distribution.column.academicYear'),
        id: 'academicYear',
        size: 140,
        cell: ({ row }) => (
          <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
            {row.original.academicYearTitle ?? '—'}
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
          const badge = <StatusBadge status={item.status} />;
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
        size: 220,
        meta: { align: 'right' as const },
        cell: ({ row }) => {
          const item = row.original;

          const canAct = canActOnRow(item.status, item.currentStep);
          const canApprove = canAct;
          const canReject = canAct && item.status === 'in_review';
          const canEdit = item.status === 'draft';
          const canDelete = item.status === 'draft' || item.status === 'rejected';
          const showReopen = canReopen && item.status === 'rejected';
          const showRevoke = canRevokeRow(item);
          return (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {canApprove ? (
                <Can perform={['scienceProgram:approve', 'scienceProgram:update']}>
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
                <Can perform="scienceProgram:reject">
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
                <Can perform="scienceProgram:reject">
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
                <Can perform={['scienceProgram:approve', 'scienceProgram:update']}>
                  <Tooltip title={t('studyLoad.scienceProgram.action.reopen')}>
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

              <Can perform="scienceProgram:read">
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

              <Can perform="scienceProgram:read">
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
                <Can perform="scienceProgram:update">
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
                <Can perform="scienceProgram:delete">
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
  onEdit: (item: ScienceProgram) => void,
  onDelete: (item: ScienceProgram) => void,
  onApprove: (item: ScienceProgram) => void,
): ColumnDef<ScienceProgram>[] {
  return useMemo(
    () => [
      {
        header: t('studyLoad.myWorkload.column.science'),
        id: 'scienceName',
        cell: ({ row }) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: 'var(--color-text)' }}>
              {row.original.scienceName ?? '—'}
            </strong>
            <FormVersionTag version={row.original.formVersion} />
          </span>
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
        size: 150,
        meta: { align: 'right' as const },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>

              <Can perform="scienceProgram:update">
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
              <Can perform="scienceProgram:update">
                <Tooltip title={t('studyLoad.common.edit')}>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => onEdit(item)}
                  />
                </Tooltip>
              </Can>
              <Can perform="scienceProgram:delete">
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
    [t, onEdit, onDelete, onApprove],
  );
}

interface IApprovalBodyProps {
  id: string;
}

const ScienceProgramApprovalBody = ({ id }: IApprovalBodyProps) => {
  const { data, isLoading, isError } = useScienceProgramApproval(id);
  return <ApprovalChainModal isLoading={isLoading} isError={isError} steps={data} />;
};

interface IDeleteBodyProps {
  item: ScienceProgram;
}

const ScienceProgramDeleteBody = ({ item }: IDeleteBodyProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const deleteMutation = useDeleteScienceProgram();

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(item.id);
      message.success(t('studyLoad.scienceProgram.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      title={t('studyLoad.scienceProgram.deleteConfirmTitle')}
      subtitle={t('studyLoad.common.deleteConfirmSubtitle')}
      loading={deleteMutation.isPending}
      onConfirm={() => { void handleConfirm(); }}
    />
  );
};

const ScienceProgramListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'active' | 'draft'>(
    searchParams.get('tab') === 'draft' ? 'draft' : 'active',
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState<FormVersionFilterValue | undefined>(undefined);

  const statusFilter = activeTab === 'draft' ? 'draft' : undefined;

  const filter: ScienceProgramsFilter = useMemo(
    () => ({ page, limit: pageSize, status: statusFilter }),
    [page, pageSize, statusFilter],
  );

  const { data, isLoading } = useSciencePrograms(filter);

  useEffect(() => {
    const totalPages = data?.meta.totalPages;
    if (totalPages !== undefined && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.meta.totalPages, page]);

  const approveMutation = useApproveScienceProgram();
  const rejectMutation = useRejectScienceProgram();
  const canActOnRow = useChainRowGate(
    SCIENCE_PROGRAM_STEP_ROLES,
    SCIENCE_PROGRAM_SUBMIT_ROLE,
  );
  const isTeacher = useHasRole(SCIENCE_PROGRAM_SUBMIT_ROLE);
  const qc = useQueryClient();
  const canRevokeFinalDoc = useRevokeFinalGate();
  const canRevokeRow = (item: ScienceProgram): boolean => {
    const known = scienceProgramFinalStep(item.formVersion);
    const candidates = known ? [known] : SCIENCE_PROGRAM_V259_FINAL_CANDIDATES;
    return candidates.some((stepKey) =>
      canRevokeFinalDoc({
        status: item.status,
        finalRole: finalStepRole(null, SCIENCE_PROGRAM_STEP_ROLES, stepKey),
      }),
    );
  };

  const handleReopen = (item: ScienceProgram) => {
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.scienceProgram.reopenTitle')}
          subtitle={t('studyLoad.scienceProgram.reopenSubtitle')}
          confirmText={t('studyLoad.scienceProgram.action.reopen')}
          loading={approveMutation.isPending}
          onConfirm={async () => {
            await approveMutation.mutateAsync({ id: item.id });
            message.success(t('studyLoad.scienceProgram.reopened'));
          }}
        />
      ),
    });
  };

  const handleEdit = (item: ScienceProgram) => {
    const suffix = item.formVersion === 'v142' ? 'edit-142' : 'edit';
    navigate(`/study-load/science-programs/${item.id}/${suffix}`);
  };

  const handleViewPdf = async (item: ScienceProgram) => {
    setPdfLoadingId(item.id);
    try {
      await openPdf(`/science-programs/${item.id}/pdf`, message, t);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleDelete = (item: ScienceProgram) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <ScienceProgramDeleteBody item={item} />,
    });
  };

  const handleApprove = (item: ScienceProgram) => {
    const needsProtocol =
      item.status === 'in_review' &&
      item.currentStep !== null &&
      PROTOCOL_STEPS.includes(item.currentStep);
    showModal({
      title: t('studyLoad.scienceProgram.approveTitle'),
      maxWidth: '545px',
      body: () => (
        <ApproveModal
          title={t('studyLoad.scienceProgram.approveTitle')}
          recordName={item.scienceName ?? undefined}
          protocol={needsProtocol}
          onConfirm={(protocol) => approveMutation.mutateAsync({ id: item.id, protocol })}
          loading={approveMutation.isPending}
        />
      ),
    });
  };

  const handleReject = (item: ScienceProgram) => {
    showModal({
      title: t('studyLoad.scienceProgram.rejectTitle'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.scienceProgram.rejectTitle')}
          recordName={item.scienceName ?? undefined}
          onConfirm={(comment) => rejectMutation.mutateAsync({ id: item.id, comment })}
          loading={rejectMutation.isPending}
        />
      ),
    });
  };

  const openRevokeFinalModal = (item: ScienceProgram) => {
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

  const handleRevokeFinal = async (item: ScienceProgram) => {
    if (scienceProgramFinalStep(item.formVersion)) {
      openRevokeFinalModal(item);
      return;
    }
    try {
      const steps = await qc.fetchQuery({
        queryKey: scienceProgramApprovalKey(item.id),
        queryFn: () => fetchScienceProgramApprovalSteps(item.id),
      });
      const allowed = canRevokeFinalDoc({
        status: item.status,
        finalRole: finalStepRole(steps, SCIENCE_PROGRAM_STEP_ROLES),
      });
      if (allowed) openRevokeFinalModal(item);
      else message.warning(t('studyLoad.revokeFinal.notFinalRole'));
    } catch (e) {
      message.error(getApiErrorMessage(e, t('studyLoad.common.errorOccurred')));
    }
  };

  const handleApprovalChain = (item: ScienceProgram) => {
    showModal({
      title: t('studyLoad.approval.title'),
      maxWidth: '620px',
      body: () => <ScienceProgramApprovalBody id={item.id} />,
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
    (item) => void handleRevokeFinal(item),
    canRevokeRow,
  );
  const draftColumns = useDraftColumns(t, handleEdit, handleDelete, handleApprove);

  const displayedItems = useMemo(() => {
    const items = data?.items ?? [];
    const byTab =
      activeTab === 'active'
        ? items.filter((i) => i.status !== 'draft')
        : items.filter((i) => i.status === 'draft');
    return filterByFormVersion(byTab, formVersion);
  }, [data?.items, activeTab, formVersion]);

  const tabData: LineTabItem[] = [
    { key: 'active', label: t('studyLoad.syllabus.tab.active') },
    { key: 'draft', label: t('studyLoad.syllabus.tab.draft') },
  ];

  return (
    <PageContainer
      title={t('studyLoad.scienceProgram.pageTitle')}
      extra={
        <Can perform="scienceProgram:create">
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'v259', label: t('studyLoad.scienceProgram.createV259') },
                { key: 'v142', label: t('studyLoad.scienceProgram.createV142') },
              ],
              onClick: ({ key }) => {
                navigate(
                  key === 'v142'
                    ? '/study-load/science-programs/new-142'
                    : '/study-load/science-programs/new',
                );
              },
            }}
          >
            <Button type="primary" icon={<PlusOutlined />} style={{ height: 38 }}>
              {t('studyLoad.scienceProgram.create')}
              <DownOutlined />
            </Button>
          </Dropdown>
        </Can>
      }
    >
      <Filters
        searchPlaceholder={t('studyLoad.syllabus.searchPlaceholder')}
        onSearch={() => {
          setPage(1);
        }}
        selects={[
          {
            key: 'formVersion',
            placeholder: t('studyLoad.scienceProgram.filter.allFormVersions'),
            value: formVersion,
            options: [
              { label: t('studyLoad.scienceProgram.formVersionBadgeV259'), value: 'v259' },
              { label: t('studyLoad.scienceProgram.formVersionBadgeV142'), value: 'v142' },
            ],
            onChange: (v) => {
              setFormVersion(toFormVersionFilter(v));
              setPage(1);
            },
          },
        ]}
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

      <DataTable<ScienceProgram>
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

export default ScienceProgramListPage;
