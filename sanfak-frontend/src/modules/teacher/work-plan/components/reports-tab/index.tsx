import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Space, Tooltip, Typography } from 'antd';
import { DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import {
  downloadReportsExport,
  getApiErrorMessage,
  useDeleteReport,
  useReportsPaginated,
} from '../../api/reports-api';
import { getReportRejectionComment } from '../../api/reports-mapper';
import { formatSubmittedDate } from '../../../hr/model/helper';
import type { PersonalReport } from '../../model/report-types';
import { REPORT_EDITABLE_STATUSES } from '../../model/report-types';
import StatusBadge from '../../../components/status-badge';
import DeleteConfirm from '../../../components/delete-confirm';
import ReportFormModal from '../report-form-modal';
import ReportViewModal from '../report-view-modal';
import { TabWrapper } from './style';

interface IProps {
  planId: string;
  academicYearId: string | null;
}

const ReportsTab = ({ planId, academicYearId }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useReportsPaginated({ planId, page, limit: pageSize });
  const deleteReport = useDeleteReport();

  const handleCreate = () => {
    if (!academicYearId) {
      message.error(t('teacher.personalPlan.reports.academicYearMissing'));
      return;
    }
    showModal({
      title: t('teacher.personalPlan.reports.form.createTitle'),
      body: () => <ReportFormModal planId={planId} academicYearId={academicYearId} />,
      maxWidth: '545px',
      bodyPadding: '0',
      overflow: true,
    });
  };

  const handleEdit = (report: PersonalReport) => {
    showModal({
      title: t('teacher.personalPlan.reports.form.editTitle'),
      body: () => <ReportFormModal planId={planId} academicYearId={academicYearId} report={report} />,
      maxWidth: '545px',
      bodyPadding: '0',
      overflow: true,
    });
  };

  const handleView = (report: PersonalReport) => {
    showModal({
      title: t('teacher.personalPlan.reports.view.title'),
      body: () => <ReportViewModal report={report} />,
      maxWidth: '545px',
    });
  };

  const handleDelete = (report: PersonalReport) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <DeleteConfirm
          title={t('teacher.personalPlan.reports.deleteConfirmTitle')}
          subtitle={t('teacher.personalPlan.reports.deleteConfirmSubtitle', {
            semester: t(`teacher.personalPlan.reports.semester.${report.semester}`),
          })}
          loading={deleteReport.isPending}
          onConfirm={() => {
            void deleteReport
              .mutateAsync(report.id)
              .then(() => {
                message.success(t('teacher.personalPlan.reports.deleted'));
                useModalStore.getState().hideModal();
              })
              .catch((e: unknown) => message.error(getApiErrorMessage(e)));
          }}
        />
      ),
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportsExport(planId);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<PersonalReport>[] = [
    {
      header: t('teacher.personalPlan.reports.column.semester'),
      id: 'semester',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>
          {t(`teacher.personalPlan.reports.semester.${row.original.semester}`)}
        </strong>
      ),
    },
    {
      header: t('teacher.personalPlan.reports.column.createdAt'),
      id: 'createdAt',
      size: 140,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatSubmittedDate(row.original.createdAt)}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.reports.column.status'),
      id: 'status',
      size: 170,
      cell: ({ row }) => {
        const report = row.original;
        if (report.status !== 'rejected') {
          return <StatusBadge status={report.status} />;
        }
        const rejectionComment = getReportRejectionComment(report);
        return (
          <Space size={4}>
            <StatusBadge status={report.status} />
            <Tooltip title={rejectionComment ?? undefined}>
              <InfoCircleOutlined style={{ color: 'var(--brand-error)' }} />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      header: t('teacher.personalPlan.reports.column.actions'),
      id: 'actions',
      size: 160,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const report = row.original;
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: 'var(--brand-primary)' }}
              onClick={() => handleView(report)}
            >
              {t('teacher.common.view')}
            </Button>
            {REPORT_EDITABLE_STATUSES.includes(report.status) ? (
              <>
                <Can perform="personalWorkPlan:update">
                  <Tooltip title={t('edit')}>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(report)} />
                  </Tooltip>
                </Can>
                <Can perform="personalWorkPlan:delete">
                  <Tooltip title={t('delete')}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(report)}
                    />
                  </Tooltip>
                </Can>
              </>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <TabWrapper>
      <Filters
        hideSearch
        onSearch={() => undefined}
        extra={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExport()}>
              {t('teacher.personalPlan.reports.export')}
            </Button>
            <Can perform="personalWorkPlan:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                {t('teacher.personalPlan.reports.create')}
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable<PersonalReport>
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
    </TabWrapper>
  );
};

export default ReportsTab;
