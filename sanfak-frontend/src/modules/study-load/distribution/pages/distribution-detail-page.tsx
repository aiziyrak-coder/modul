import { App, Button, Divider, Empty, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  PlusOutlined,
  RollbackOutlined,
  SendOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Can } from '@/app/session';
import { Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useDistribution,
  useSubmitDistribution,
  useWithdrawDistribution,
  useApproveDistribution,
  useRejectDistribution,
} from '../api/distribution-api';
import { getStatusMeta } from '../../model/status-workflow';
import { useHasPendingStep, DISTRIBUTION_STEP_ROLES } from '../../lib/use-has-pending-step';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import {
  FIXED_FINAL_STEP,
  finalStepRole,
  useRevokeFinalGate,
} from '../../lib/final-step';
import WarningConfirm from '../../components/warning-confirm';
import { buildMinHourErrorMessage } from '../lib/min-hour-error';
import ApprovalTimeline from '../../components/approval-timeline';
import DistributionTable from '../components/distribution-table';
import AssignForm from '../components/assign-drawer';
import { buildAssignedBlockMap } from '../lib/assigned-blocks';
import { exportDistributionsToExcel, type DistributionExcelRow } from '../../lib/excel';
import { openPdf } from '../../lib/open-pdf';
import { buildOverloadWarningMessage } from '../lib/overload-warning';
import { buildSuitabilityWarningMessage } from '../lib/suitability';

const { Title, Text } = Typography;

const DistributionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const hideModal = useModalStore((s) => s.hideModal);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [acceptanceFilter, setAcceptanceFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, isError } = useDistribution(id);
  const submitDistribution = useSubmitDistribution();
  const withdrawDistribution = useWithdrawDistribution();
  const approveMutation = useApproveDistribution();
  const rejectMutation = useRejectDistribution();
  const hasPendingStep = useHasPendingStep(data?.approvalHistory, DISTRIBUTION_STEP_ROLES);
  const canRevokeFinalDoc = useRevokeFinalGate();

  const visibleTeachers = useMemo(() => {
    const list = data?.teachers ?? [];
    if (!acceptanceFilter) return list;
    return list.filter((teach) => teach.acceptanceStatus === acceptanceFilter);
  }, [data?.teachers, acceptanceFilter]);

  const [focusTeacherId, setFocusTeacherId] = useState<string | null>(null);

  const assignedBlocks = useMemo(
    () => buildAssignedBlockMap(data?.teachers),
    [data?.teachers],
  );

  const handleAssignClick = () => {
    if (!id) return;
    showModal({
      title: t('studyLoad.distribution.assignTitle'),
      body: () => (
        <AssignForm
          distributionId={id}
          workloadId={data?.workloadId}
          assignedBlocks={assignedBlocks}
          onViewAssignment={(tid) => {
            hideModal();
            setFocusTeacherId(tid);
          }}
        />
      ),
      right: true,
      maxWidth: '756px',
      bodyPadding: '0',
      overflow: true,
    });
  };

  const handleSubmit = () => {
    if (!id) return;
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.distribution.submitTitle')}
          subtitle={t('studyLoad.distribution.submitSubtitle')}
          confirmText={t('studyLoad.distribution.action.submit')}
          loading={submitDistribution.isPending}
          formatError={(err) => buildMinHourErrorMessage(t, err)}
          onConfirm={async () => {
            const res = await submitDistribution.mutateAsync(id);
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

  const handleWithdraw = () => {
    if (!id) return;
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.distribution.withdrawTitle')}
          subtitle={t('studyLoad.distribution.withdrawSubtitle')}
          confirmText={t('studyLoad.distribution.withdraw')}
          loading={withdrawDistribution.isPending}
          onConfirm={async () => {
            await withdrawDistribution.mutateAsync(id);
            message.success(t('studyLoad.distribution.withdrawn'));
          }}
        />
      ),
    });
  };

  const handleApprove = () => {
    if (!id) return;
    const ModalBody = () => (
      <ApproveModal
        title={t('studyLoad.distribution.approveTitle')}
        recordName={data?.title ?? data?.departmentName ?? undefined}
        onConfirm={async () => {
          await approveMutation.mutateAsync(id);
          message.success(t('studyLoad.distribution.approved'));
        }}
        loading={approveMutation.isPending}
      />
    );
    showModal({
      title: t('studyLoad.distribution.approveTitle'),
      body: ModalBody,
      maxWidth: '545px',
    });
  };

  const handleReject = () => {
    if (!id) return;
    const ModalBody = () => (
      <RejectModal
        title={t('studyLoad.distribution.rejectTitle')}
        recordName={data?.title ?? data?.departmentName ?? undefined}
        onConfirm={async (comment) => {
          await rejectMutation.mutateAsync({ id, comment });
          message.success(t('studyLoad.distribution.rejected'));
        }}
        loading={rejectMutation.isPending}
      />
    );
    showModal({
      title: t('studyLoad.distribution.rejectTitle'),
      body: ModalBody,
      maxWidth: '545px',
    });
  };

  const handleRevokeFinal = () => {
    if (!id) return;
    const ModalBody = () => (
      <RejectModal
        title={t('studyLoad.revokeFinal.title')}
        recordName={data?.title ?? data?.departmentName ?? undefined}
        onConfirm={(comment) => rejectMutation.mutateAsync({ id, comment })}
        loading={rejectMutation.isPending}
        confirmLabel={t('studyLoad.revokeFinal.action')}
        successMessage={t('studyLoad.revokeFinal.success')}
      />
    );
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      body: ModalBody,
      maxWidth: '545px',
    });
  };

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
        <Empty description={t('studyLoad.distribution.notFound')} />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('studyLoad.common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const statusMeta = getStatusMeta(data.status);
  const isDraft = data.status === 'draft';
  const isInReview = data.status === 'in_review';
  const canAct = isInReview && hasPendingStep;
  const canRevoke = canRevokeFinalDoc({
    status: data.status,
    finalRole: finalStepRole(
      data.approvalHistory,
      DISTRIBUTION_STEP_ROLES,
      FIXED_FINAL_STEP.workloadDistribution,
    ),
  });

  const someStepApproved = (data.approvalHistory ?? []).some(
    (s) => s.status === 'approved' && String(s.step) !== 'kafedra',
  );
  const canWithdraw = isInReview && !someStepApproved;

  const displayTitle =
    data.title ??
    [data.departmentName, data.academicYearTitle].filter(Boolean).join(' — ') ??
    t('studyLoad.distribution.pageTitle');

  const handleExcel = () => {
    const row: DistributionExcelRow = {
      title: displayTitle,
      course: null,
      scienceNumber: data.scienceNumber,
      totalHour: data.totalHour,
      residueHour: data.residueHour,
      academicYearTitle: data.academicYearTitle,
      date: data.date,
      status: data.status,
    };
    exportDistributionsToExcel([row], 'Taqsimot.xlsx');
  };

  const handlePdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      await openPdf(`/distributions/${id}/pdf`, message, t);
    } finally {
      setPdfLoading(false);
    }
  };

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
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate(-1)}
            style={{ marginTop: 2 }}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: 'var(--color-text)' }}>
              {displayTitle}
            </Title>
            {data.departmentName ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {data.departmentName}
              </Text>
            ) : null}
          </div>
          <Tag color={statusMeta.color} style={{ marginTop: 4 }}>
            {t(statusMeta.labelKey, { defaultValue: statusMeta.label })}
          </Tag>
        </Space>

        <Space size={8}>
          <Can perform="workloadDistribution:read">
            <Button
              icon={<FilePdfOutlined />}
              style={{ height: 38 }}
              loading={pdfLoading}
              onClick={handlePdf}
            >
              {t('studyLoad.distribution.protocolPdf')}
            </Button>
          </Can>

          <Can perform="workloadDistribution:read">
            <Button
              icon={<FileExcelOutlined />}
              style={{ height: 38, color: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' }}
              onClick={handleExcel}
            >
              Excel
            </Button>
          </Can>

          {canAct ? (
            <Can perform="workloadDistribution:approve">
              <Button
                icon={<CheckOutlined />}
                style={{ height: 38, color: 'var(--brand-primary)' }}
                onClick={handleApprove}
                loading={approveMutation.isPending}
              >
                {t('studyLoad.approval.action.approve')}
              </Button>
            </Can>
          ) : null}

          {canAct ? (
            <Can perform="workloadDistribution:reject">
              <Button
                danger
                icon={<CloseOutlined />}
                style={{ height: 38 }}
                onClick={handleReject}
                loading={rejectMutation.isPending}
              >
                {t('studyLoad.approval.action.reject')}
              </Button>
            </Can>
          ) : null}

          {canRevoke ? (
            <Can perform="workloadDistribution:reject">
              <Button
                danger
                icon={<UndoOutlined />}
                style={{ height: 38 }}
                onClick={handleRevokeFinal}
                loading={rejectMutation.isPending}
              >
                {t('studyLoad.revokeFinal.action')}
              </Button>
            </Can>
          ) : null}

          {isInReview ? (
            <Can perform="workloadDistribution:update">
              <Tooltip
                title={
                  canWithdraw
                    ? t('studyLoad.distribution.withdrawTooltipEnabled')
                    : t('studyLoad.distribution.withdrawTooltipDisabled')
                }
              >
                <span style={{ display: 'inline-block' }}>
                  <Button
                    icon={<RollbackOutlined />}
                    disabled={!canWithdraw}
                    onClick={handleWithdraw}
                    loading={withdrawDistribution.isPending}
                    style={{ height: 38 }}
                  >
                    {t('studyLoad.distribution.withdraw')}
                  </Button>
                </span>
              </Tooltip>
            </Can>
          ) : null}

          {isDraft ? (
            <Can perform="workloadDistribution:update">
              <Button
                icon={<SendOutlined />}
                onClick={handleSubmit}
                loading={submitDistribution.isPending}
                style={{ height: 38 }}
              >
                {t('studyLoad.distribution.action.submit')}
              </Button>
            </Can>
          ) : null}

          {isDraft ? (
            <Can perform="workloadDistribution:create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAssignClick}
                style={{ height: 38 }}
              >
                {t('studyLoad.distribution.assign')}
              </Button>
            </Can>
          ) : null}
        </Space>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-6)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-4)',
          background: 'var(--color-bg-layout, #f5f5f5)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {t('studyLoad.distribution.column.scienceNumber')}
          </Text>
          <Text strong style={{ fontSize: 18 }}>
            {data.scienceNumber}
          </Text>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {t('studyLoad.distribution.column.totalHour')}
          </Text>
          <Text strong style={{ fontSize: 18 }}>
            {data.totalHour}
          </Text>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {t('studyLoad.distribution.column.residueHour')}
          </Text>
          <Text
            strong
            style={{
              fontSize: 18,
              color:
                data.residueHour > 0
                  ? 'var(--brand-warning)'
                  : 'var(--brand-primary)',
            }}
          >
            {data.residueHour}
          </Text>
        </div>
        {data.academicYearTitle ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {t('studyLoad.distribution.column.academicYear')}
            </Text>
            <Text strong style={{ fontSize: 18 }}>
              {data.academicYearTitle}
            </Text>
          </div>
        ) : null}
        {data.date ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {t('studyLoad.distribution.column.date')}
            </Text>
            <Text strong style={{ fontSize: 18 }}>
              {data.date}
            </Text>
          </div>
        ) : null}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {data.approvalHistory.length > 0 ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Text
            strong
            style={{ fontSize: 15, display: 'block', marginBottom: 8, color: 'var(--color-text)' }}
          >
            {t('studyLoad.approval.title')}
          </Text>
          <ApprovalTimeline history={data.approvalHistory} />
          <Divider style={{ margin: '12px 0' }} />
        </div>
      ) : null}

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Text
          strong
          style={{ fontSize: 15, display: 'block', marginBottom: 12, color: 'var(--color-text)' }}
        >
          {acceptanceFilter
            ? `${t('studyLoad.distribution.teachersCount', { count: visibleTeachers.length })} / ${data.teachers.length}`
            : t('studyLoad.distribution.teachersCount', { count: data.teachers.length })}
        </Text>

        {data.teachers.length > 0 ? (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Filters
              hideSearch
              onSearch={() => {}}
              selects={[
                {
                  key: 'acceptance',
                  placeholder: t('studyLoad.distribution.acceptance.filterPlaceholder'),
                  value: acceptanceFilter,
                  options: [
                    { label: t('studyLoad.distribution.acceptance.pending'), value: 'pending' },
                    { label: t('studyLoad.distribution.acceptance.accepted'), value: 'accepted' },
                    { label: t('studyLoad.distribution.acceptance.rejected'), value: 'rejected' },
                  ],
                  onChange: (value) => setAcceptanceFilter(value),
                },
              ]}
            />
          </div>
        ) : null}

        {data.teachers.length === 0 ? (
          <Empty description={t('studyLoad.distribution.noTeachers')} />
        ) : visibleTeachers.length === 0 ? (
          <Empty description={t('studyLoad.distribution.acceptance.noMatch')}>
            <Button type="link" onClick={() => setAcceptanceFilter(undefined)}>
              {t('studyLoad.distribution.acceptance.clearFilter')}
            </Button>
          </Empty>
        ) : (
          <DistributionTable
            teachers={visibleTeachers}
            distributionId={id ?? ''}
            workloadId={data.workloadId}
            distributionStatus={data.status}
            assignedBlocks={assignedBlocks}
            focusTeacherId={focusTeacherId}
          />
        )}
      </div>
    </div>
  );
};

export default DistributionDetailPage;
