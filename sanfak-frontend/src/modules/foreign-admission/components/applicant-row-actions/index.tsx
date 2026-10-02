import { useNavigate } from 'react-router-dom';
import { ActionButtons } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useApplicantDecision } from '../../lib/use-applicant-decision';
import type { Applicant } from '../../model/types';
import { RowActions } from './style';

export function ApplicantRowActions({ applicant }: { applicant: Applicant }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canApprove, canReject, onApprove, onReject } = useApplicantDecision(applicant);

  const detailUrl = `/foreign-admission/applications/${applicant.id}`;

  return (
    <RowActions>
      <ActionButtons
        onView={() => navigate(detailUrl)}
        viewLabel={t('foreignAdmission.view')}
        onPrint={() => navigate(`${detailUrl}?print=1`)}
        printLabel={t('foreignAdmission.detail.print')}
        hideToggle
      />
      {canApprove || canReject ? (
        <ActionButtons
          onConfirm={canApprove ? onApprove : undefined}
          confirmLabel={t('foreignAdmission.action.approve')}
          onReturn={canReject ? onReject : undefined}
          returnLabel={t('foreignAdmission.action.reject')}
          hideToggle
        />
      ) : null}
    </RowActions>
  );
}
