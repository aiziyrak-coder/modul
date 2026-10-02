import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Collapse, Empty, Skeleton, Space, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  RedoOutlined,
  SendOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
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
  useApproveWorkloadSummary,
  useRejectWorkloadSummary,
  useWorkloadSummaryDetail,
} from '../api/workload-summary-api';
import { SUMMARY_STEP_ROLES, summaryTurn } from '../model/chain';
import SummaryTable from '../components/summary-table';
import DeleteSummaryConfirm from '../components/delete-summary-confirm';

const { Title, Text } = Typography;

const WorkloadSummaryDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);
  const role = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const isSuper = useSessionStore((s) => s.permissions.includes('*'));
  const canRevokeFinalDoc = useRevokeFinalGate('workloadSummary');
  const [fileLoading, setFileLoading] = useState<'pdf' | 'xlsx' | null>(null);

  const { data, isLoading, isError } = useWorkloadSummaryDetail(id);
  const approve = useApproveWorkloadSummary();
  const reject = useRejectWorkloadSummary();

  const withFile = async (kind: 'pdf' | 'xlsx', fn: () => Promise<unknown>) => {
    setFileLoading(kind);
    try {
      await fn();
    } finally {
      setFileLoading(null);
    }
  };
  const handlePdf = () => id && withFile('pdf', () => openPdf(`/workload-summaries/${id}/pdf`, message, t));
  const handleXlsx = () =>
    id &&
    withFile('xlsx', () =>
      downloadFile(
        `/workload-summaries/${id}/xlsx`,
        {},
        `kafedralar-soatlar-hisobi-${(data?.academicYearTitle ?? '').replace(/[^0-9]+/g, '-')}.xlsx`,
        message,
        t,
      ),
    );

  const confirmWarning = (titleKey: string, subtitleKey: string, confirmKey: string, doneKey: string) =>
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t(titleKey)}
          subtitle={t(subtitleKey)}
          confirmText={t(confirmKey)}
          loading={approve.isPending}
          onConfirm={async () => {
            if (!id) return;
            await approve.mutateAsync(id);
            message.success(t(doneKey));
          }}
        />
      ),
    });

  const handleApprove = () =>
    showModal({
      title: t('studyLoad.summary.approveTitle'),
      maxWidth: '545px',
      body: () => (
        <ApproveModal
          title={t('studyLoad.summary.approveTitle')}
          recordName={data?.academicYearTitle}
          loading={approve.isPending}
          onConfirm={async () => {
            if (id) await approve.mutateAsync(id);
          }}
        />
      ),
    });

  const handleReject = () =>
    showModal({
      title: t('studyLoad.summary.rejectTitle'),
      maxWidth: '545px',
      body: () => (
        <RejectModal
          title={t('studyLoad.summary.rejectTitle')}
          recordName={data?.academicYearTitle}
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
          recordName={data?.academicYearTitle}
          loading={reject.isPending}
          confirmLabel={t('studyLoad.revokeFinal.action')}
          successMessage={t('studyLoad.revokeFinal.success')}
          onConfirm={async (comment) => {
            if (id) await reject.mutateAsync({ id, comment });
          }}
        />
      ),
    });

  const handleDelete = () =>
    data &&
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <DeleteSummaryConfirm
          item={data}
          onDeleted={() => navigate('/study-load/workload-summaries', { replace: true })}
        />
      ),
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
        <Empty description={t('studyLoad.summary.notFound')} />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('studyLoad.common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const turn = summaryTurn(data.status, data.currentStep, role, isSuper);
  const canRevoke = canRevokeFinalDoc({
    status: data.status,
    finalRole: finalStepRole(
      data.approvalHistory,
      SUMMARY_STEP_ROLES,
      FIXED_FINAL_STEP.workloadSummary,
    ),
  });
  const stale = data.staleness;

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
              {t('studyLoad.summary.detailTitle', { year: data.academicYearTitle })}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('studyLoad.summary.detailSubtitle', { count: data.rowCount })}
            </Text>
          </div>
          <StatusBadge status={data.status} />
        </Space>
        <Space size={8} wrap>
          <Can perform="workloadSummary:read">
            <Button
              icon={<FilePdfOutlined />}
              style={{ height: 38 }}
              loading={fileLoading === 'pdf'}
              onClick={() => void handlePdf()}
            >
              {t('studyLoad.summary.pdf')}
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              style={{ height: 38 }}
              loading={fileLoading === 'xlsx'}
              onClick={() => void handleXlsx()}
            >
              {t('studyLoad.summary.excel')}
            </Button>
          </Can>
          {turn.canSubmit && can('workloadSummary:approve') ? (
            <Button
              type="primary"
              icon={<SendOutlined />}
              style={{ height: 38 }}
              onClick={() =>
                confirmWarning(
                  'studyLoad.summary.submitTitle',
                  'studyLoad.summary.submitSubtitle',
                  'studyLoad.summary.action.submit',
                  'studyLoad.summary.submitted',
                )
              }
            >
              {t('studyLoad.summary.action.submit')}
            </Button>
          ) : null}
          {turn.canApprove && can('workloadSummary:approve') ? (
            <Button type="primary" icon={<CheckOutlined />} style={{ height: 38 }} onClick={handleApprove}>
              {t('studyLoad.common.confirm')}
            </Button>
          ) : null}
          {turn.canReject && can('workloadSummary:reject') ? (
            <Button danger icon={<CloseOutlined />} style={{ height: 38 }} onClick={handleReject}>
              {t('studyLoad.common.reject')}
            </Button>
          ) : null}
          {canRevoke && can('workloadSummary:reject') ? (
            <Button danger icon={<UndoOutlined />} style={{ height: 38 }} onClick={handleRevokeFinal}>
              {t('studyLoad.revokeFinal.action')}
            </Button>
          ) : null}
          {turn.canReopen && can('workloadSummary:approve') ? (
            <Button
              icon={<RedoOutlined />}
              style={{ height: 38 }}
              onClick={() =>
                confirmWarning(
                  'studyLoad.summary.reopenTitle',
                  'studyLoad.summary.reopenSubtitle',
                  'studyLoad.summary.action.reopen',
                  'studyLoad.summary.reopened',
                )
              }
            >
              {t('studyLoad.summary.action.reopen')}
            </Button>
          ) : null}
          {turn.canDelete && can('workloadSummary:delete') ? (
            <Button danger icon={<DeleteOutlined />} style={{ height: 38 }} onClick={handleDelete}>
              {t('studyLoad.common.delete')}
            </Button>
          ) : null}
        </Space>
      </div>

      {stale?.isStale ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.summary.stale.title')}
          description={t('studyLoad.summary.stale.desc', {
            added: stale.added,
            changed: stale.changed,
            removed: stale.removed,
          })}
        />
      ) : null}
      {data.status === 'rejected' && data.rejectComment ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.summary.rejectedReason')}
          description={data.rejectComment}
        />
      ) : null}
      {data.status === 'superseded' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.summary.supersededNote')}
        />
      ) : null}

      <SummaryTable rows={data.rows} totals={data.totals} />

      {data.missingDepartments.length ? (
        <Collapse
          style={{ marginTop: 'var(--space-4)' }}
          items={[
            {
              key: 'missing',
              label: t('studyLoad.summary.missing.title', { count: data.missingDepartments.length }),
              children: (
                <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', columns: 2 }}>
                  {data.missingDepartments.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      ) : null}

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Title level={5} style={{ marginBottom: 'var(--space-3)' }}>
          {t('studyLoad.summary.chainTitle')}
        </Title>
        <ApprovalTimeline history={data.approvalHistory} />
      </div>
    </div>
  );
};

export default WorkloadSummaryDetailPage;
