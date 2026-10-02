import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Divider,
  Empty,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  FilePdfOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Can } from '@/app/session';
import { useModalStore } from '@/shared/ui';
import {
  useWorkingScheduleProcess,
  useWorkingScheduleSciences,
} from '../api/working-schedule-process-api';
import {
  useWorkingSchedule,
  useApproveWorkingSchedule,
  useRejectWorkingSchedule,
} from '../api/working-schedule-api';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import {
  FIXED_FINAL_STEP,
  finalStepRole,
  useRevokeFinalGate,
} from '../../lib/final-step';
import WarningConfirm from '../../components/warning-confirm';
import StatusBadge from '../../components/status-badge';
import ApprovalTimeline from '../../components/approval-timeline';
import {
  useHasPendingStep,
  useHasRole,
  WORKING_SCHEDULE_STEP_ROLES,
} from '../../lib/use-has-pending-step';
import { fetchUnfilledSlots, useWorkingPlanGrid } from '../../working-plan/api/working-plan-api';
import ProcessGridTab from '../components/process-grid';
import SubjectsTab from '../components/subjects-tab';
import CompositionTab from '../components/composition-tab';
import PlanGrid from './working-plan-grid';
import SegmentedTabs from '../../components/segmented-tabs';
import { isContentEditable } from '../../lib/content-lock';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { useTranslation } from '@/shared/lib/i18n';
import { openPdf } from '../../lib/open-pdf';

const WorkingScheduleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const TAB_OPTIONS = [
    { key: 'process', label: t('studyLoad.workingSchedule.tab.process') },
    { key: 'plan', label: t('studyLoad.workingSchedule.tab.plan') },
    { key: 'sciences', label: t('studyLoad.workingSchedule.tab.sciences') },
    { key: 'composition', label: t('studyLoad.workingSchedule.tab.composition') },
  ];

  const [activeTab, setActiveTab] = useState('process');
  const [pdfLoading, setPdfLoading] = useState(false);
  const showModal = useModalStore((s) => s.showModal);

  usePageTitle(t('studyLoad.workingSchedule.pageTitle'), { back: true });

  const processQuery = useWorkingScheduleProcess(
    activeTab === 'process' ? id : undefined,
  );
  const planQuery = useWorkingPlanGrid(
    activeTab === 'plan' ? id : undefined,
  );
  const sciencesQuery = useWorkingScheduleSciences(
    activeTab === 'sciences' ? id : undefined,
  );

  const { data: schedule } = useWorkingSchedule(id);
  const approveMutation = useApproveWorkingSchedule();
  const rejectMutation = useRejectWorkingSchedule();

  const hasPendingStep = useHasPendingStep(
    schedule?.approvalHistory,
    WORKING_SCHEDULE_STEP_ROLES,
  );

  const canAct = schedule?.status === 'in_review' && hasPendingStep;

  const isUslubiyBoshqarma = useHasRole('oquv_uslubiy_boshqarma');
  const canReopen = schedule?.status === 'rejected' && isUslubiyBoshqarma;

  const canRevokeFinalDoc = useRevokeFinalGate();
  const canRevoke = schedule
    ? canRevokeFinalDoc({
        status: schedule.status,
        finalRole: finalStepRole(
          schedule.approvalHistory,
          WORKING_SCHEDULE_STEP_ROLES,
          FIXED_FINAL_STEP.workingSchedule,
        ),
      })
    : false;

  const contentEditable = isContentEditable(schedule?.status);

  const handleApprove = async () => {
    if (!id) return;
    const recordName = schedule?.title ?? undefined;
    const unfilled = schedule?.status === 'draft' ? await fetchUnfilledSlots(qc, id) : [];
    const ModalBody = () => (
      <>
        {unfilled.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 'var(--space-3)' }}
            message={t('studyLoad.workingPlan.electiveSlot.unfilledWarning', {
              count: unfilled.length,
            })}
          />
        ) : null}
        <ApproveModal
          title={t('studyLoad.workingSchedule.approveTitle')}
          onConfirm={async () => {
            const res = await approveMutation.mutateAsync(id);
            if (res?.warning) message.warning(res.warning, 8);
          }}
          loading={approveMutation.isPending}
          recordName={recordName}
        />
      </>
    );
    showModal({
      title: t('studyLoad.workingSchedule.approveTitle'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  const handleReject = () => {
    if (!id) return;
    const recordName = schedule?.title ?? undefined;
    const ModalBody = () => (
      <RejectModal
        title={t('studyLoad.workingSchedule.rejectTitle')}
        onConfirm={(comment) => rejectMutation.mutateAsync({ id, comment })}
        loading={rejectMutation.isPending}
        recordName={recordName}
      />
    );
    showModal({
      title: t('studyLoad.workingSchedule.rejectTitle'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  const handleRevokeFinal = () => {
    if (!id) return;
    const ModalBody = () => (
      <RejectModal
        title={t('studyLoad.revokeFinal.title')}
        onConfirm={(comment) => rejectMutation.mutateAsync({ id, comment })}
        loading={rejectMutation.isPending}
        recordName={schedule?.title ?? undefined}
        confirmLabel={t('studyLoad.revokeFinal.action')}
        successMessage={t('studyLoad.revokeFinal.success')}
      />
    );
    showModal({
      title: t('studyLoad.revokeFinal.title'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  const handleReopen = () => {
    if (!id) return;
    showModal({
      withHeader: false,
      maxWidth: '544px',
      body: () => (
        <WarningConfirm
          title={t('studyLoad.workingSchedule.reopenTitle')}
          subtitle={t('studyLoad.workingSchedule.reopenSubtitle')}
          confirmText={t('studyLoad.workingSchedule.action.reopen')}
          loading={approveMutation.isPending}
          onConfirm={async () => {
            await approveMutation.mutateAsync(id);
            message.success(t('studyLoad.workingSchedule.reopened'));
          }}
        />
      ),
    });
  };

  const handleViewPdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      await openPdf(`/working-schedules/${id}/pdf`, message, t);
    } finally {
      setPdfLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'process':
        return (
          <ProcessGridTab
            scheduleId={id}
            isLoading={processQuery.isLoading}
            isError={processQuery.isError}
            data={processQuery.data}
            editable={contentEditable}
          />
        );

      case 'plan':
        return planQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : planQuery.isError || !planQuery.data ? (
          <Empty
            description={t('studyLoad.common.dataLoadError')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <PlanGrid
            semesters={planQuery.data.semesters}
            particleLabels={planQuery.data.meta?.particles?.items ?? []}
            workingPlanId={planQuery.data.id}
            workingScheduleId={id}
            editable={contentEditable}
            semesterNumbers={planQuery.data.semesterNumbers}
          />
        );

      case 'sciences':
        return (
          <SubjectsTab
            isLoading={sciencesQuery.isLoading}
            isError={sciencesQuery.isError}
            data={sciencesQuery.data}
          />
        );

      case 'composition':
        return <CompositionTab id={id} editable={contentEditable} />;

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        {schedule ? <StatusBadge status={schedule.status} /> : <span />}

        <Space>
          <Can perform="workingSchedule:read">
            <Button
              icon={<FilePdfOutlined />}
              loading={pdfLoading}
              onClick={() => void handleViewPdf()}
              style={{ color: 'var(--color-text-soft)' }}
            >
              PDF
            </Button>
          </Can>

          {canAct ? (
            <Can perform="workingSchedule:approve">
              <Button
                icon={<CheckOutlined />}
                onClick={() => void handleApprove()}
                loading={approveMutation.isPending}
                style={{ color: 'var(--brand-primary)' }}
              >
                {t('studyLoad.approval.action.approve')}
              </Button>
            </Can>
          ) : null}

          {canAct ? (
            <Can perform="workingSchedule:reject">
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={handleReject}
                loading={rejectMutation.isPending}
              >
                {t('studyLoad.common.reject')}
              </Button>
            </Can>
          ) : null}

          {canRevoke ? (
            <Can perform="workingSchedule:reject">
              <Button
                danger
                icon={<UndoOutlined />}
                onClick={handleRevokeFinal}
                loading={rejectMutation.isPending}
              >
                {t('studyLoad.revokeFinal.action')}
              </Button>
            </Can>
          ) : null}

          {canReopen ? (
            <Can perform="workingSchedule:approve">
              <Button
                icon={<RedoOutlined />}
                onClick={handleReopen}
                loading={approveMutation.isPending}
                style={{ color: 'var(--brand-primary)' }}
              >
                {t('studyLoad.workingSchedule.action.reopen')}
              </Button>
            </Can>
          ) : null}
        </Space>
      </div>

      {schedule?.approvalHistory?.length ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Typography.Text
            strong
            style={{ fontSize: 15, display: 'block', marginBottom: 8, color: 'var(--color-text)' }}
          >
            {t('studyLoad.approval.title')}
          </Typography.Text>
          <ApprovalTimeline history={schedule.approvalHistory} />
          <Divider style={{ margin: '12px 0' }} />
        </div>
      ) : null}

      <div style={{ marginBottom: 20 }}>
        <SegmentedTabs
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {renderContent()}
    </div>
  );
};

export default WorkingScheduleDetailPage;
