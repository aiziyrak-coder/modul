import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, App, Button, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  LinkOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { formatSubmittedDate } from '../../hr/model/helper';
import {
  downloadCompletedItemsExport,
  getApiErrorMessage,
  useCompletedWorkItems,
  useVerifyWorkItem,
} from '../api/completed-items-api';
import { useAcademicYearsForSelect } from '../api/work-plan-api';
import { useIsVerifier } from '../lib/use-is-verifier';
import type { CompletedItemsFilter } from '../model/completed-item-types';
import type { CompletedWorkItem } from '../model/completed-item-types';
import { isSafeLink } from '../model/safe-link';
import VerifyStatusBadge from '../components/verify-status-badge';
import VerifyItemModal from '../components/verify-item-modal';
import VerifyConfirm from '../components/verify-confirm';
import VerifyRejectModal from '../components/verify-reject-modal';

function buildStatusOptions(t: (key: string) => string) {
  return [
    { label: t('teacher.hr.status.pending'), value: 'pending' },
    { label: t('teacher.hr.status.approved'), value: 'approved' },
    { label: t('teacher.hr.status.rejected'), value: 'rejected' },
  ];
}

const CompletedItemsPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const hideModal = useModalStore((s) => s.hideModal);
  const isVerifier = useIsVerifier();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
  const { data: academicYears = [] } = useAcademicYearsForSelect();
  const academicYearOptions = useMemo(
    () => academicYears.map((y) => ({ label: y.title, value: y.id })),
    [academicYears],
  );

  const filter: CompletedItemsFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      academicYear: academicYearFilter,
      verificationStatus: (statusFilter as CompletedItemsFilter['verificationStatus']) || undefined,
    }),
    [page, pageSize, search, academicYearFilter, statusFilter],
  );

  const { data, isLoading } = useCompletedWorkItems(filter);
  const verifyMutation = useVerifyWorkItem();

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCompletedItemsExport({
        search: search || undefined,
        academicYear: academicYearFilter,
        verificationStatus: (statusFilter as CompletedItemsFilter['verificationStatus']) || undefined,
      });
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const openRejectModal = (item: CompletedWorkItem) => {
    showModal({
      title: t('teacher.personalPlan.completedItems.rejectModal.title'),
      maxWidth: '460px',
      body: () => (
        <VerifyRejectModal
          teacherName={item.teacherName ?? '—'}
          loading={verifyMutation.isPending}
          onConfirm={async (comment) => {
            try {
              await verifyMutation.mutateAsync({
                planId: item.planId,
                itemId: item.itemId,
                section: item.section,
                decision: 'rejected',
                comment,
              });
              message.success(t('teacher.personalPlan.completedItems.reject.success'));
              hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  const openConfirmModal = (item: CompletedWorkItem) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <VerifyConfirm
          loading={verifyMutation.isPending}
          onConfirm={async () => {
            try {
              await verifyMutation.mutateAsync({
                planId: item.planId,
                itemId: item.itemId,
                section: item.section,
                decision: 'approved',
              });
              message.success(t('teacher.personalPlan.completedItems.approve.success'));
              hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  const openDetailModal = (item: CompletedWorkItem) => {
    showModal({
      title: t('teacher.personalPlan.completedItems.detailModal.title'),
      maxWidth: '540px',
      body: () => (
        <VerifyItemModal
          item={item}
          onApprove={() => openConfirmModal(item)}
          onReject={() => openRejectModal(item)}
        />
      ),
    });
  };

  const columns: ColumnDef<CompletedWorkItem>[] = [
    {
      header: t('teacher.personalPlan.table.title'),
      id: 'title',
      cell: ({ row }) => <strong style={{ color: 'var(--color-text)' }}>{row.original.title}</strong>,
    },
    {
      header: t('teacher.personalPlan.completedItems.column.fullName'),
      id: 'fullName',
      cell: ({ row }) => row.original.teacherName ?? '—',
    },
    {
      header: t('teacher.personalPlan.completedItems.column.academicYear'),
      id: 'academicYear',
      size: 120,
      cell: ({ row }) => row.original.academicYearTitle ?? '—',
    },
    {
      header: t('teacher.personalPlan.completedItems.column.date'),
      id: 'date',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatSubmittedDate(row.original.completedAt)}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.table.link'),
      id: 'link',
      size: 100,
      cell: ({ row }) =>
        isSafeLink(row.original.link) ? (
          <a href={row.original.link} target="_blank" rel="noreferrer">
            <LinkOutlined /> {t('teacher.personalPlan.table.linkOpen')}
          </a>
        ) : (
          row.original.link || '—'
        ),
    },
    {
      header: t('teacher.personalPlan.completedItems.column.file'),
      id: 'file',
      size: 130,
      cell: ({ row }) =>
        row.original.fileUrl ? (
          <a href={row.original.fileUrl} target="_blank" rel="noreferrer" download>
            <PaperClipOutlined /> {t('teacher.personalPlan.completedItems.fileDownload')}
          </a>
        ) : (
          '—'
        ),
    },
    {
      header: t('teacher.personalPlan.completedItems.column.status'),
      id: 'status',
      size: 150,
      cell: ({ row }) => (
        <VerifyStatusBadge
          status={row.original.verification.status}
          comment={row.original.verification.comment}
        />
      ),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 150,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        const isPending = item.verification.status === 'pending';
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            {isPending ? (
              <Tooltip title={t('teacher.personalPlan.completedItems.action.approve')}>
                <Button
                  type="text"
                  icon={<CheckCircleOutlined />}
                  size="small"
                  style={{ color: 'var(--brand-primary)' }}
                  onClick={() => openDetailModal(item)}
                />
              </Tooltip>
            ) : null}
            {isPending ? (
              <Tooltip title={t('teacher.personalPlan.completedItems.action.reject')}>
                <Button
                  type="text"
                  danger
                  icon={<CloseCircleOutlined />}
                  size="small"
                  onClick={() => openRejectModal(item)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title={t('teacher.personalPlan.completedItems.action.view')}>
              <Button
                type="text"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => openDetailModal(item)}
              />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  if (!isVerifier) {
    return (
      <PageContainer title={t('teacher.personalPlan.completedItems.pageTitle')}>
        <Alert
          type="warning"
          showIcon
          message={t('teacher.personalPlan.completedItems.roleGate.title')}
          description={t('teacher.personalPlan.completedItems.roleGate.desc')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('teacher.personalPlan.completedItems.pageTitle')}>
      <Filters
        searchValue={search}
        searchPlaceholder="teacher.personalPlan.completedItems.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'academicYear',
            placeholder: t('teacher.personalPlan.completedItems.filter.allYears'),
            value: academicYearFilter,
            options: academicYearOptions,
            onChange: (v) => {
              setAcademicYearFilter(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: t('teacher.personalPlan.completedItems.filter.allStatuses'),
            value: statusFilter,
            options: statusOptions,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExport()}>
            {t('teacher.personalPlan.completedItems.export')}
          </Button>
        }
      />

      <DataTable<CompletedWorkItem>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={(p) => setPage(p)}
        pageSizeOptions={[12, 24, 36, 48]}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </PageContainer>
  );
};

export default CompletedItemsPage;
