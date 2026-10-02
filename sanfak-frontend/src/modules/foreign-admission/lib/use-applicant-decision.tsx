import { App, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useApproveApplicant } from '../api/foreign-admission-api';
import { isActionable } from '../model/status';
import RejectForm from '../components/reject-form';
import { useConfirm } from './use-confirm';
import type { Applicant } from '../model/types';

export function useApplicantDecision(applicant: Applicant) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const can = usePermission();
  const { confirm } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);
  const approve = useApproveApplicant();

  const actionable = isActionable(applicant.status);

  const onApprove = () =>
    confirm(
      async () => {
        try {
          await approve.mutateAsync(applicant.id);
          message.success(t('foreignAdmission.approve.done'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: t('foreignAdmission.approve.confirm_title'),
        content: applicant.fullName,
        okText: t('foreignAdmission.action.approve'),
      },
    );

  const onReject = () =>
    showModal({
      title: t('foreignAdmission.reject.title'),
      maxWidth: '480px',
      body: () => <RejectForm applicant={applicant} />,
    });

  return {
    canApprove: actionable && can('internationalAdmission:approve'),
    canReject: actionable && can('internationalAdmission:reject'),
    approving: approve.isPending,
    onApprove,
    onReject,
  };
}
