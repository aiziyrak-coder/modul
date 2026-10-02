import { App, Button, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import {
  useApproveWorkPlan,
  useCompleteWorkPlan,
  useRejectWorkPlan,
  useReopenWorkPlan,
  useSubmitWorkPlan,
} from '../../api/work-plan-api';
import type { PersonalPlanDetail } from '../../model/types';
import { useCanCompletePlan, useHasPendingStep } from '../../lib/use-my-pending-step';
import ApprovePlanConfirm from '../approve-plan-confirm';
import RejectPlanModal from '../reject-plan-modal';
import StatusTimeline from '../status-timeline';
import { ActionBar, Panel } from './style';

interface IProps {
  plan: PersonalPlanDetail;
  disabled?: boolean;
}

const ApprovalPanel = ({ plan, disabled = false }: IProps) => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const hasPendingStep = useHasPendingStep(plan.approvals);
  const canComplete = useCanCompletePlan();

  const submit = useSubmitWorkPlan(plan.id);
  const approve = useApproveWorkPlan(plan.id);
  const reject = useRejectWorkPlan(plan.id);
  const reopen = useReopenWorkPlan(plan.id);
  const complete = useCompleteWorkPlan(plan.id);

  const handleSubmit = () => {
    modal.confirm({
      title: t('teacher.personalPlan.submit.title'),
      content: t('teacher.personalPlan.submit.content'),
      okText: t('teacher.personalPlan.submit.confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await submit.mutateAsync();
          message.success(t('teacher.personalPlan.submit.success'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleReopen = () => {
    modal.confirm({
      title: t('teacher.personalPlan.reopen.title'),
      content: t('teacher.personalPlan.reopen.content'),
      okText: t('teacher.personalPlan.reopen.confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await reopen.mutateAsync();
          message.success(t('teacher.personalPlan.reopen.success'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleComplete = () => {
    modal.confirm({
      title: t('teacher.personalPlan.completePlan.title'),
      content: t('teacher.personalPlan.completePlan.content'),
      okText: t('teacher.personalPlan.completePlan.confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await complete.mutateAsync();
          message.success(t('teacher.personalPlan.completePlan.success'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleApprove = () => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <ApprovePlanConfirm
          loading={approve.isPending}
          onConfirm={async (comment) => {
            try {
              await approve.mutateAsync(comment);
              message.success(t('teacher.personalPlan.approve.success'));
              useModalStore.getState().hideModal();
            } catch (e) {
              message.error(getApiErrorMessage(e));
            }
          }}
        />
      ),
    });
  };

  const handleReject = () => {
    showModal({
      title: t('teacher.personalPlan.reject.title'),
      maxWidth: '460px',
      body: () => (
        <RejectPlanModal
          loading={reject.isPending}
          onConfirm={async (comment) => {
            try {
              await reject.mutateAsync(comment);
              message.success(t('teacher.personalPlan.reject.success'));
              useModalStore.getState().hideModal();
            } catch (e) {
              message.error(getApiErrorMessage(e));
            }
          }}
        />
      ),
    });
  };

  return (
    <Panel>
      <StatusTimeline plan={plan} />

      {plan.status === 'draft' ? (
        <ActionBar>
          <Can perform="personalWorkPlan:update">
            <Button type="primary" disabled={disabled} loading={submit.isPending} onClick={handleSubmit}>
              {t('teacher.personalPlan.submit.action')}
            </Button>
          </Can>
        </ActionBar>
      ) : null}

      {plan.status === 'submitted' && hasPendingStep ? (
        <ActionBar>
          <Can perform="personalWorkPlan:reject">
            <Button danger onClick={handleReject}>
              {t('teacher.personalPlan.reject.action')}
            </Button>
          </Can>
          <Can perform="personalWorkPlan:approve">
            <Button type="primary" onClick={handleApprove}>
              {t('teacher.personalPlan.approve.action')}
            </Button>
          </Can>
        </ActionBar>
      ) : null}

      {plan.status === 'approved' && canComplete ? (
        <ActionBar>
          <Can perform="personalWorkPlan:approve">
            <Button type="primary" loading={complete.isPending} onClick={handleComplete}>
              {t('teacher.personalPlan.completePlan.action')}
            </Button>
          </Can>
        </ActionBar>
      ) : null}

      {plan.status === 'rejected' ? (
        <ActionBar>
          <Can perform="personalWorkPlan:update">
            <Button disabled={disabled} loading={reopen.isPending} onClick={handleReopen}>
              {t('teacher.personalPlan.reopen.action')}
            </Button>
          </Can>
        </ActionBar>
      ) : null}
    </Panel>
  );
};

export default ApprovalPanel;
