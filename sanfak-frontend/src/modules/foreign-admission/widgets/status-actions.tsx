import { Button, Flex, Space } from '@/shared/ui';

import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { useApplicantDecision } from '../lib/use-applicant-decision';
import type { Applicant } from '../model/types';

const ACTION_RADIUS = 'var(--radius-md)';

export function StatusActions({
  applicant,
  size = 'middle',
  layout = 'inline',
}: {
  applicant: Applicant;
  size?: 'small' | 'middle';
  layout?: 'inline' | 'split';
}) {
  const { t } = useTranslation();
  const { canApprove, canReject, approving, onApprove, onReject } =
    useApplicantDecision(applicant);

  if (!canApprove && !canReject) return null;

  const approveBtn = canApprove ? (
    <Button
      type="primary"
      size={size}
      icon={<CheckCircleOutlined />}
      loading={approving}
      onClick={onApprove}
      style={{ borderRadius: ACTION_RADIUS }}
    >
      {t('foreignAdmission.action.approve')}
    </Button>
  ) : null;

  const rejectBtn = canReject ? (
    <Button
      danger
      size={size}
      icon={<CloseCircleOutlined />}
      onClick={onReject}
      style={{ borderRadius: ACTION_RADIUS }}
    >
      {t('foreignAdmission.action.reject')}
    </Button>
  ) : null;

  if (layout === 'split') {
    return (
      <Flex justify="space-between" gap={10} wrap>
        {rejectBtn}
        {approveBtn}
      </Flex>
    );
  }

  return (
    <Space size={8} wrap>
      {approveBtn}
      {rejectBtn}
    </Space>
  );
}
