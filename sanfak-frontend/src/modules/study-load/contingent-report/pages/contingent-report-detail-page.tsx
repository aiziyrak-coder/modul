import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, DatePicker, Dropdown, Empty, Skeleton, Space, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  CloudDownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  PlusOutlined,
  RedoOutlined,
  SaveOutlined,
  SendOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { Can, usePermission, useSessionStore } from '@/app/session';
import StatusBadge from '../../components/status-badge';
import ApprovalTimeline from '../../components/approval-timeline';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import {
  FIXED_FINAL_STEP,
  finalStepRole,
  useRevokeFinalGate,
} from '../../lib/final-step';
import WarningConfirm from '../../components/warning-confirm';
import { openPdf } from '../../lib/open-pdf';
import { downloadFile } from '../../lib/download-file';
import {
  useApproveContingentReport,
  useContingentReportDetail,
  usePrefillContingentReport,
  useRejectContingentReport,
  useUpdateContingentReport,
} from '../api/contingent-report-api';
import { toRowInput } from '../api/mapper';
import type { ContingentRow, ForeignRow } from '../model/types';
import { REPORT_STEP_ROLES, reportTurn } from '../model/chain';
import { foreignRowError, invalidRowCount, rowErrors } from '../model/invariants';
import ContingentTable from '../components/contingent-table';
import ForeignTable from '../components/foreign-table';
import AddRowModal from '../components/add-row-modal';

const { Title, Text } = Typography;
const ROOT = '/contingent-reports';

const ContingentReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);
  const role = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const isSuper = useSessionStore((s) => s.permissions.includes('*'));
  const canRevokeFinalDoc = useRevokeFinalGate();
  const [fileLoading, setFileLoading] = useState<'pdf' | 'xlsx' | null>(null);

  const { data, isLoading, isError } = useContingentReportDetail(id);
  const approve = useApproveContingentReport();
  const reject = useRejectContingentReport();
  const update = useUpdateContingentReport();
  const prefill = usePrefillContingentReport();

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<ContingentRow[]>([]);
  const [foreign, setForeign] = useState<ForeignRow[]>([]);
  const [asOf, setAsOf] = useState<Dayjs | null>(null);

  useEffect(() => {
    if (!data || editing) return;
    setRows(data.rows);
    setForeign(data.foreignByCountry);
    setAsOf(data.asOfDate ? dayjs(data.asOfDate) : null);
  }, [data, editing]);

  const startEdit = () => {
    if (!data) return;
    setRows(data.rows);
    setForeign(data.foreignByCountry);
    setAsOf(data.asOfDate ? dayjs(data.asOfDate) : null);
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);

  const invalidRows = rows.filter((r) => rowErrors(r).length > 0).length;
  const invalidForeign = foreign.filter((f) => foreignRowError(f) || !f.country.trim()).length;

  const handleSave = async () => {
    if (!id) return;
    if (invalidRows || invalidForeign) {
      message.error(t('studyLoad.contingentReport.invariant.blocked', { count: invalidRows + invalidForeign }));
      return;
    }
    try {
      await update.mutateAsync({
        id,
        payload: {
          ...(asOf ? { asOfDate: asOf.format('YYYY-MM-DD') } : {}),
          rows: rows.map(toRowInput),
          foreignByCountry: foreign.map((f) => ({ ...f, country: f.country.trim() })),
        },
      });
      message.success(t('studyLoad.contingentReport.saved'));
      setEditing(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handlePrefill = async (force: boolean) => {
    if (!id) return;
    try {
      const res = await prefill.mutateAsync({ id, force });
      message.success(res.message);
      if (res.meta.groupsWithoutYear > 0) {
        message.warning(t('studyLoad.contingentReport.groupsWithoutYear', { count: res.meta.groupsWithoutYear }));
      }
      setEditing(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const withFile = async (kind: 'pdf' | 'xlsx', fn: () => Promise<unknown>) => {
    setFileLoading(kind);
    try {
      await fn();
    } finally {
      setFileLoading(null);
    }
  };
  const handlePdf = () => id && withFile('pdf', () => openPdf(`${ROOT}/${id}/pdf`, message, t));
  const handleXlsx = () =>
    id &&
    withFile('xlsx', () =>
      downloadFile(
        `${ROOT}/${id}/xlsx`,
        {},
        `kontingent-hisoboti-${(data?.academicYearTitle ?? '').replace(/[^0-9]+/g, '-')}.xlsx`,
        message,
        t,
      ),
    );

  const confirmWarning = (kind: 'submit' | 'reopen') =>
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
            if (!id) return;
            await approve.mutateAsync({ id });
            message.success(t(kind === 'submit' ? 'studyLoad.contingentReport.submitted' : 'studyLoad.contingentReport.reopened'));
          }}
        />
      ),
    });

  const recordName = data ? `${data.facultyTitle} — ${data.academicYearTitle}` : '';

  const handleApprove = () =>
    showModal({
      title: t('studyLoad.contingentReport.approveTitle'),
      maxWidth: '545px',
      body: () => (
        <ApproveModal
          title={t('studyLoad.contingentReport.approveTitle')}
          recordName={recordName}
          protocol
          loading={approve.isPending}
          onConfirm={async (protocol) => {
            if (id) await approve.mutateAsync({ id, protocol });
          }}
        />
      ),
    });

  const handleReject = () =>
    showModal({
      title: t('studyLoad.contingentReport.rejectTitle'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.contingentReport.rejectTitle')}
          recordName={recordName}
          loading={reject.isPending}
          onConfirm={async (comment) => {
            if (id) await reject.mutateAsync({ id, comment });
          }}
        />
      ),
    });

  const handleRevokeFinal = () =>
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.revokeFinal.title')}
          recordName={recordName}
          loading={reject.isPending}
          confirmLabel={t('studyLoad.revokeFinal.action')}
          successMessage={t('studyLoad.revokeFinal.success')}
          onConfirm={async (comment) => {
            if (id) await reject.mutateAsync({ id, comment });
          }}
        />
      ),
    });

  const handleAddRow = () =>
    showModal({
      title: t('studyLoad.contingentReport.addRow.title'),
      maxWidth: '480px',
      bodyPadding: '0',
      body: () => <AddRowModal rows={rows} onAdd={(row) => setRows((prev) => [...prev, row])} />,
    });

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Empty description={t('studyLoad.contingentReport.notFound')} />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('studyLoad.common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const turn = reportTurn(data.status, data.currentStep, role, isSuper);
  const canRevoke = canRevokeFinalDoc({
    status: data.status,
    finalRole: finalStepRole(
      data.approvalHistory,
      REPORT_STEP_ROLES,
      FIXED_FINAL_STEP.contingentReport,
    ),
  });
  const canEdit = turn.canEdit && can('contingentReport:update');
  const invalidSaved = invalidRowCount(data.rows, data.foreignByCountry);
  const chainBlocked = data.status !== 'approved' && invalidSaved > 0;
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return (
    <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <Space size={12} align="start">
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} style={{ marginTop: 2 }} />
          <div>
            <Title level={4} style={{ margin: 0, color: 'var(--color-text)' }}>
              {t('studyLoad.contingentReport.detailTitle', { faculty: data.facultyTitle, year: data.academicYearTitle })}
            </Title>
            <Space size={8} wrap>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('studyLoad.contingentReport.asOf')}:
              </Text>
              {editing ? (
                <DatePicker
                  size="small"
                  value={asOf}
                  format="DD.MM.YYYY"
                  allowClear={false}
                  onChange={(d) => setAsOf(d)}
                  aria-label={t('studyLoad.contingentReport.form.asOfDate')}
                />
              ) : (
                <Text style={{ fontSize: 13 }}>{fmtDate(data.asOfDate)}</Text>
              )}
              <Text type="secondary" style={{ fontSize: 13 }}>
                · {t('studyLoad.contingentReport.detailSubtitle', { count: data.rows.length })}
              </Text>
            </Space>
          </div>
          <StatusBadge status={data.status} />
        </Space>
        <Space size={8} wrap>
          {editing ? (
            <>
              <Button icon={<PlusOutlined />} style={{ height: 38 }} onClick={handleAddRow}>
                {t('studyLoad.contingentReport.addRow.title')}
              </Button>
              <Button style={{ height: 38 }} onClick={cancelEdit} disabled={update.isPending}>
                {t('studyLoad.common.cancel')}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                style={{ height: 38 }}
                loading={update.isPending}
                onClick={() => void handleSave()}
              >
                {t('studyLoad.common.save')}
              </Button>
            </>
          ) : (
            <>
              <Can perform="contingentReport:export">
                <Button icon={<FilePdfOutlined />} style={{ height: 38 }} loading={fileLoading === 'pdf'} onClick={() => void handlePdf()}>
                  {t('studyLoad.contingentReport.pdf')}
                </Button>
                <Button icon={<FileExcelOutlined />} style={{ height: 38 }} loading={fileLoading === 'xlsx'} onClick={() => void handleXlsx()}>
                  {t('studyLoad.contingentReport.excel')}
                </Button>
              </Can>
              {canEdit ? (
                <>
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'soft', label: t('studyLoad.contingentReport.prefill.soft'), onClick: () => void handlePrefill(false) },
                        { key: 'force', label: t('studyLoad.contingentReport.prefill.force'), danger: true, onClick: () => void handlePrefill(true) },
                      ],
                    }}
                  >
                    <Button icon={<CloudDownloadOutlined />} style={{ height: 38 }} loading={prefill.isPending}>
                      {t('studyLoad.contingentReport.prefill.button')}
                    </Button>
                  </Dropdown>
                  <Button icon={<EditOutlined />} style={{ height: 38 }} onClick={startEdit}>
                    {t('studyLoad.common.edit')}
                  </Button>
                </>
              ) : null}
              {turn.canSubmit && can('contingentReport:update') ? (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  style={{ height: 38 }}
                  disabled={chainBlocked}
                  onClick={() => confirmWarning('submit')}
                >
                  {t('studyLoad.contingentReport.action.submit')}
                </Button>
              ) : null}
              {turn.canApprove && can('contingentReport:approve') ? (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  style={{ height: 38 }}
                  disabled={chainBlocked}
                  onClick={handleApprove}
                >
                  {t('studyLoad.common.confirm')}
                </Button>
              ) : null}
              {turn.canReject && can('contingentReport:reject') ? (
                <Button danger icon={<CloseOutlined />} style={{ height: 38 }} onClick={handleReject}>
                  {t('studyLoad.common.reject')}
                </Button>
              ) : null}
              {canRevoke && can('contingentReport:reject') ? (
                <Button danger icon={<UndoOutlined />} style={{ height: 38 }} onClick={handleRevokeFinal}>
                  {t('studyLoad.revokeFinal.action')}
                </Button>
              ) : null}
              {turn.canReopen && can('contingentReport:update') ? (
                <Button icon={<RedoOutlined />} style={{ height: 38 }} onClick={() => confirmWarning('reopen')}>
                  {t('studyLoad.contingentReport.action.reopen')}
                </Button>
              ) : null}
            </>
          )}
        </Space>
      </div>

      {data.status === 'rejected' && data.rejectComment ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.contingentReport.rejectedReason')}
          description={data.rejectComment}
        />
      ) : null}
      {editing && (invalidRows || invalidForeign) ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.contingentReport.invariant.blocked', { count: invalidRows + invalidForeign })}
        />
      ) : null}
      {!editing && chainBlocked ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.contingentReport.invariant.blockedView', { count: invalidSaved })}
        />
      ) : null}
      {editing ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.contingentReport.editHint')}
        />
      ) : null}

      <ContingentTable
        rows={editing ? rows : data.rows}
        editable={editing}
        onChange={setRows}
        facultyTitle={data.facultyTitle}
      />

      <div style={{ marginTop: 'var(--space-5)', maxWidth: 720 }}>
        <Title level={5} style={{ marginBottom: 'var(--space-3)' }}>
          {t('studyLoad.contingentReport.foreignTitle')}
        </Title>
        <ForeignTable rows={editing ? foreign : data.foreignByCountry} editable={editing} onChange={setForeign} />
      </div>

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Title level={5} style={{ marginBottom: 'var(--space-3)' }}>
          {t('studyLoad.contingentReport.chainTitle')}
        </Title>
        <ApprovalTimeline history={data.approvalHistory} />
      </div>
    </div>
  );
};

export default ContingentReportDetailPage;
