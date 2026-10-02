import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, App, Button, Tooltip, Typography } from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  RedoOutlined,
  SendOutlined,
  EditOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission } from '@/app/session';
import {
  useDistributions,
  useDeleteDistribution,
  useApproveDistribution,
  useSubmitDistribution,
  getApiErrorMessage,
  fetchAllDistributions,
  type DistributionsFilter,
} from '../api/distribution-api';
import type { Distribution } from '../model/types';
import StatusBadge from '../../components/status-badge';
import DistributionCreateForm from '../components/distribution-create-modal';
import { exportDistributionsToExcel } from '../../lib/excel';
import ApproveModal from '../../components/approve-modal';
import DeleteConfirm from '../../components/delete-confirm';
import WarningConfirm from '../../components/warning-confirm';
import { buildMinHourErrorMessage } from '../lib/min-hour-error';
import { buildOverloadWarningMessage } from '../lib/overload-warning';
import { buildSuitabilityWarningMessage } from '../lib/suitability';
import { useHasRole } from '../../lib/use-has-pending-step';

function buildStatusOptions(t: (key: string) => string) {
  return [
    { label: t('studyLoad.distribution.status.draft'), value: 'draft' },
    { label: t('studyLoad.distribution.status.new'), value: 'new' },
    { label: t('studyLoad.distribution.status.inReview'), value: 'in_review' },
    { label: t('studyLoad.distribution.status.approved'), value: 'approved' },
    { label: t('studyLoad.distribution.status.rejected'), value: 'rejected' },
    { label: t('studyLoad.summary.status.superseded'), value: 'superseded' },
  ];
}

interface IDistDeleteBodyProps {
  item: Distribution;
}

const DistributionDeleteBody = ({ item }: IDistDeleteBodyProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const deleteDistribution = useDeleteDistribution();

  const handleConfirm = async () => {
    try {
      await deleteDistribution.mutateAsync(item.id);
      message.success(t('studyLoad.distribution.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      title={t('studyLoad.distribution.deleteConfirmTitle')}
      subtitle={t('studyLoad.common.deleteConfirmSubtitle')}
      loading={deleteDistribution.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
};

const DistributionListPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);
  const isKafedraMudiri = useHasRole('kafedra_mudiri');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);

  const filter: DistributionsFilter = useMemo(
    () => ({ page, limit: pageSize, status: statusFilter }),
    [page, pageSize, statusFilter],
  );

  const { data, isLoading, isError, error } = useDistributions(filter);
  const approveMutation = useApproveDistribution();
  const submitMutation = useSubmitDistribution();

  const [exporting, setExporting] = useState(false);
  const handleExcel = async () => {
    setExporting(true);
    try {
      exportDistributionsToExcel(await fetchAllDistributions({ status: filter.status }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = (item: Distribution) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <DistributionDeleteBody item={item} />,
    });
  };

  const handleSubmit = (item: Distribution) => {
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.distribution.submitTitle')}
          subtitle={t('studyLoad.distribution.submitSubtitle')}
          confirmText={t('studyLoad.distribution.action.submit')}
          loading={submitMutation.isPending}
          formatError={(err) => buildMinHourErrorMessage(t, err)}
          onConfirm={async () => {
            const res = await submitMutation.mutateAsync(item.id);
            message.success(t('studyLoad.distribution.submitted'));
            const overloadMessage = buildOverloadWarningMessage(t, res.warnings);
            if (overloadMessage) message.warning(overloadMessage, 8);
            const suitabilityMessage = buildSuitabilityWarningMessage(t, res.suitabilityWarnings);
            if (suitabilityMessage) message.warning(suitabilityMessage, 8);
          }}
        />
      ),
    });
  };

  const handleApprove = (item: Distribution) => {
    if (item.status === 'rejected') {
      showModal({
        withHeader: false,
        maxWidth: '544px',
        body: () => (
          <WarningConfirm
            title={t('studyLoad.distribution.reopenTitle')}
            subtitle={t('studyLoad.distribution.reopenSubtitle')}
            confirmText={t('studyLoad.distribution.action.reopen')}
            loading={approveMutation.isPending}
            onConfirm={async () => {
              await approveMutation.mutateAsync(item.id);
              message.success(t('studyLoad.distribution.reopened'));
            }}
          />
        ),
      });
      return;
    }

    const ModalBody = () => (
      <ApproveModal
        title={t('studyLoad.distribution.approveTitle')}
        recordName={item.title ?? undefined}
        onConfirm={() => approveMutation.mutateAsync(item.id)}
        loading={approveMutation.isPending}
      />
    );
    showModal({
      title: t('studyLoad.distribution.approveTitle'),
      body: ModalBody,
      maxWidth: '545px',
    });
  };

  const columns: ColumnDef<Distribution>[] = [
    {
      header: t('studyLoad.distribution.column.title'),
      id: 'title',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>
          {row.original.title ||
            row.original.departmentTitle ||
            row.original.academicYearTitle ||
            '—'}
        </strong>
      ),
    },
    {
      header: t('studyLoad.distribution.column.course'),
      id: 'course',
      size: 80,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.course > 0 ? t('studyLoad.common.courseN', { n: row.original.course }) : '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.scienceNumber'),
      id: 'scienceNumber',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.scienceNumber}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.totalHour'),
      id: 'totalHour',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.totalHour}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.residueHour'),
      id: 'residueHour',
      size: 120,
      cell: ({ row }) => (
        <span
          style={{
            display: 'inline-block',
            border: '1px solid var(--color-border, #e3e8ef)',
            padding: '4px 6px',
            borderRadius: 'var(--radius-md, 8px)',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          {row.original.residueHour}
        </span>
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
      size: 150,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 220,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        const isDraft = item.status === 'draft';
        const isRejected = item.status === 'rejected';
        const canApprove = isRejected && isKafedraMudiri;
        const canSubmit = isDraft && isKafedraMudiri;
        const canEdit = isDraft || isRejected;
        return (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            {canSubmit ? (
              <Can perform="workloadDistribution:update">
                <Tooltip title={t('studyLoad.distribution.action.submit')}>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SendOutlined />}
                    onClick={() => handleSubmit(item)}
                  >
                    {t('studyLoad.distribution.action.submit')}
                  </Button>
                </Tooltip>
              </Can>
            ) : null}

            {canApprove ? (
              <Can perform="workloadDistribution:approve">
                <Tooltip title={t('studyLoad.distribution.action.reopen')}>
                  <Button
                    type="text"
                    icon={<RedoOutlined />}
                    size="small"
                    style={{ color: 'var(--brand-primary)' }}
                    onClick={() => handleApprove(item)}
                  />
                </Tooltip>
              </Can>
            ) : null}

            <Tooltip title={t('studyLoad.common.view')}>
              <Button
                type="text"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => navigate(`/study-load/distributions/${item.id}`)}
                style={{ color: 'var(--brand-primary)' }}
              />
            </Tooltip>

            {canEdit && can('workloadDistribution:update') ? (
              <Tooltip title={t('studyLoad.common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/study-load/distributions/${item.id}`)}
                />
              </Tooltip>
            ) : null}

            {(isDraft || isRejected) && can('workloadDistribution:delete') ? (
              <Tooltip title={t('studyLoad.common.delete')}>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
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
    <PageContainer title={t('studyLoad.distribution.pageTitle')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
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
        ]}
        extra={
          <>
            <Can perform="workloadDistribution:readAll">
              <Button
                icon={<FileExcelOutlined />}
                loading={exporting}
                onClick={() => void handleExcel()}
                style={{
                  height: 38,
                  color: 'var(--brand-primary)',
                  borderColor: 'var(--brand-primary)',
                }}
              >
                {t('studyLoad.workingSchedule.excel')}
              </Button>
            </Can>
            <Can perform="workloadDistribution:create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  showModal({
                    title: t('studyLoad.distribution.create'),
                    body: DistributionCreateForm,
                    maxWidth: '545px',
                    bodyPadding: '0',
                    overflow: true,
                  })
                }
                style={{ height: 38 }}
              >
                {t('studyLoad.distribution.create')}
              </Button>
            </Can>
          </>
        }
      />

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('studyLoad.distribution.loadError')}
          description={getApiErrorMessage(error)}
        />
      )}

      <DataTable<Distribution>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={(p) => setPage(p)}
        pageSizeOptions={[10, 20, 50, 100, 200]}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </PageContainer>
  );
};

export default DistributionListPage;
