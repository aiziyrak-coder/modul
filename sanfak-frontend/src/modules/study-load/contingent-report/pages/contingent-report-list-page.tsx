import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  BarChartOutlined,
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
import { getApiErrorMessage } from '@/shared/api';
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
import DeleteConfirm from '../../components/delete-confirm';
import WarningConfirm from '../../components/warning-confirm';
import { useAcademicYearsRef } from '../../workload/api/workload-api';
import {
  useApproveContingentReport,
  useContingentReports,
  useDeleteContingentReport,
  useFacultyOptions,
  useRejectContingentReport,
  type ContingentReportsFilter,
} from '../api/contingent-report-api';
import type { ContingentReport } from '../model/types';
import { canSeeInstituteSummary, REPORT_STEP_ROLES, reportTurn } from '../model/chain';
import CreateReportModal from '../components/create-report-modal';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const STATUSES = ['draft', 'in_review', 'approved', 'rejected'];
const BASE = '/study-load/contingent-reports';

const DeleteBody = ({ item }: { item: ContingentReport }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const del = useDeleteContingentReport();
  const handleConfirm = async () => {
    try {
      await del.mutateAsync(item.id);
      message.success(t('studyLoad.contingentReport.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };
  return (
    <DeleteConfirm
      title={t('studyLoad.contingentReport.deleteTitle')}
      subtitle={t('studyLoad.contingentReport.deleteSubtitle', { year: item.academicYearTitle })}
      loading={del.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
};

const ContingentReportListPage = () => {
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);
  const role = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const isSuper = useSessionStore((s) => s.permissions.includes('*'));
  const canRevokeFinalDoc = useRevokeFinalGate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [yearId, setYearId] = useState<string | undefined>(undefined);
  const [facultyId, setFacultyId] = useState<string | undefined>(undefined);

  const filter = useMemo<ContingentReportsFilter>(
    () => ({ page, limit: pageSize, status, academicYear: yearId, faculty: facultyId }),
    [page, pageSize, status, yearId, facultyId],
  );
  const { data, isLoading } = useContingentReports(filter);
  const { data: years = [] } = useAcademicYearsRef();
  const { data: faculties = [] } = useFacultyOptions();
  const approve = useApproveContingentReport();
  const reject = useRejectContingentReport();

  const statusOptions = STATUSES.map((s) => {
    const meta = getStatusMeta(s);
    return { value: s, label: t(meta.labelKey, { defaultValue: meta.label }) };
  });
  const yearOptions = years.map((y) => ({ value: y.id, label: y.title }));

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const confirmWarning = (item: ContingentReport, kind: 'submit' | 'reopen') =>
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t(`studyLoad.contingentReport.${kind}Title`)}
          subtitle={t(`studyLoad.contingentReport.${kind}Subtitle`)}
          confirmText={t(`studyLoad.contingentReport.action.${kind}`)}
          loading={approve.isPending}
          onConfirm={async () => {
            await approve.mutateAsync({ id: item.id });
            message.success(t(kind === 'submit' ? 'studyLoad.contingentReport.submitted' : 'studyLoad.contingentReport.reopened'));
          }}
        />
      ),
    });

  const handleApprove = (item: ContingentReport) =>
    showModal({
      title: t('studyLoad.contingentReport.approveTitle'),
      maxWidth: '545px',
      body: () => (
        <ApproveModal
          title={t('studyLoad.contingentReport.approveTitle')}
          recordName={`${item.facultyTitle} — ${item.academicYearTitle}`}
          protocol
          onConfirm={async (protocol) => {
            await approve.mutateAsync({ id: item.id, protocol });
          }}
          loading={approve.isPending}
        />
      ),
    });

  const handleReject = (item: ContingentReport) =>
    showModal({
      title: t('studyLoad.contingentReport.rejectTitle'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.contingentReport.rejectTitle')}
          recordName={`${item.facultyTitle} — ${item.academicYearTitle}`}
          onConfirm={async (comment) => {
            await reject.mutateAsync({ id: item.id, comment });
          }}
          loading={reject.isPending}
        />
      ),
    });

  const handleRevokeFinal = (item: ContingentReport) =>
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.revokeFinal.title')}
          recordName={`${item.facultyTitle} — ${item.academicYearTitle}`}
          onConfirm={async (comment) => {
            await reject.mutateAsync({ id: item.id, comment });
          }}
          loading={reject.isPending}
          confirmLabel={t('studyLoad.revokeFinal.action')}
          successMessage={t('studyLoad.revokeFinal.success')}
        />
      ),
    });

  const handleDelete = (item: ContingentReport) =>
    showModal({ withHeader: false, maxWidth: '460px', body: () => <DeleteBody item={item} /> });

  const iconBtn = (title: string, icon: React.ReactNode, onClick: () => void, danger = false) => (
    <Tooltip title={title}>
      <Button type="text" size="small" danger={danger} icon={icon} onClick={onClick} aria-label={title} />
    </Tooltip>
  );

  const columns: ColumnDef<ContingentReport>[] = [
    {
      header: t('studyLoad.contingentReport.column.faculty'),
      id: 'faculty',
      cell: ({ row }) => (
        <Typography.Text strong style={{ color: 'var(--color-text)' }}>
          {row.original.facultyTitle || '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.contingentReport.column.academicYear'),
      id: 'year',
      cell: ({ row }) => row.original.academicYearTitle || '—',
    },
    {
      header: t('studyLoad.contingentReport.column.status'),
      id: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: t('studyLoad.contingentReport.column.asOfDate'),
      id: 'asOfDate',
      cell: ({ row }) => fmtDate(row.original.asOfDate ?? row.original.createdAt),
    },
    {
      header: t('studyLoad.contingentReport.column.submittedAt'),
      id: 'submittedAt',
      cell: ({ row }) => fmtDate(row.original.submittedAt),
    },
    {
      header: t('studyLoad.contingentReport.column.actions'),
      id: 'actions',
      size: 220,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        const turn = reportTurn(item.status, item.currentStep, role, isSuper);
        const canRevoke = canRevokeFinalDoc({
          status: item.status,
          finalRole: finalStepRole(null, REPORT_STEP_ROLES, FIXED_FINAL_STEP.contingentReport),
        });
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
            {iconBtn(t('studyLoad.common.view'), <EyeOutlined />, () => navigate(`${BASE}/${item.id}`))}
            {turn.canSubmit && can('contingentReport:update')
              ? iconBtn(t('studyLoad.contingentReport.action.submit'), <SendOutlined />, () => confirmWarning(item, 'submit'))
              : null}
            {turn.canApprove && can('contingentReport:approve')
              ? iconBtn(t('studyLoad.common.confirm'), <CheckOutlined />, () => handleApprove(item))
              : null}
            {turn.canReject && can('contingentReport:reject')
              ? iconBtn(t('studyLoad.common.reject'), <CloseOutlined />, () => handleReject(item), true)
              : null}
            {canRevoke && can('contingentReport:reject')
              ? iconBtn(t('studyLoad.revokeFinal.action'), <UndoOutlined />, () => handleRevokeFinal(item), true)
              : null}
            {turn.canReopen && can('contingentReport:update')
              ? iconBtn(t('studyLoad.contingentReport.action.reopen'), <RedoOutlined />, () => confirmWarning(item, 'reopen'))
              : null}
            {turn.canDelete && can('contingentReport:delete')
              ? iconBtn(t('studyLoad.common.delete'), <DeleteOutlined />, () => handleDelete(item), true)
              : null}
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('studyLoad.nav.contingentReport')}>
      <Filters
        hideSearch
        onSearch={() => {}}
        selects={[
          ...(faculties.length
            ? [
                {
                  key: 'faculty',
                  placeholder: t('studyLoad.contingentReport.filter.allFaculties'),
                  value: facultyId,
                  options: faculties.map((f) => ({ value: f.id, label: f.title })),
                  onChange: (v: string | undefined) => {
                    setFacultyId(v);
                    setPage(1);
                  },
                },
              ]
            : []),
          {
            key: 'academicYear',
            placeholder: t('studyLoad.contingentReport.filter.allYears'),
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
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {canSeeInstituteSummary(role, isSuper) && can('contingentReport:readAll') ? (
              <Button icon={<BarChartOutlined />} style={{ height: 38 }} onClick={() => navigate(`${BASE}/summary`)}>
                {t('studyLoad.contingentReport.summary.open')}
              </Button>
            ) : null}
            <Can perform="contingentReport:create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ height: 38 }}
                onClick={() =>
                  showModal({
                    title: t('studyLoad.contingentReport.create'),
                    body: () => (
                      <CreateReportModal
                        onCreated={(id, meta) => {
                          if (meta.groupsWithoutYear > 0) {
                            message.warning(t('studyLoad.contingentReport.groupsWithoutYear', { count: meta.groupsWithoutYear }));
                          }
                          navigate(`${BASE}/${id}`);
                        }}
                      />
                    ),
                    maxWidth: '520px',
                    bodyPadding: '0',
                  })
                }
              >
                {t('studyLoad.contingentReport.create')}
              </Button>
            </Can>
          </div>
        }
      />
      <DataTable<ContingentReport>
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

export default ContingentReportListPage;
