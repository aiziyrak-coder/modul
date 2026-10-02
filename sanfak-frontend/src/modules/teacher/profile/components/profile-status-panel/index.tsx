import { Alert, Typography } from 'antd';
import { StatusTag } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { HrApprovalStatus } from '../../model/types';
import { PanelWrapper } from './style';

const { Text } = Typography;

interface IProps {
  status: HrApprovalStatus;
  approvedByName: string | null;
  approvalDate: string | null;
  comment: string | null;
  isNew?: boolean;
}

const STATUS_TO_TAG: Record<HrApprovalStatus, 'pending' | 'approved' | 'rejected'> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
};

const ProfileStatusPanel = ({ status, approvedByName, approvalDate, comment, isNew }: IProps) => {
  const { t } = useTranslation();

  if (isNew) {
    return (
      <Alert
        type="info"
        showIcon
        message={t('teacher.profile.status.newProfileTitle')}
        description={t('teacher.profile.status.newProfileDesc')}
        style={{ marginBottom: 'var(--space-4)' }}
      />
    );
  }

  return (
    <PanelWrapper>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Text strong style={{ color: 'var(--color-text)' }}>
          {t('teacher.profile.status.label')}
        </Text>
        <StatusTag status={STATUS_TO_TAG[status]} label={t(`teacher.profile.status.${status}`)} />
      </div>

      {status === 'approved' && approvedByName ? (
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 'var(--space-2)' }}>
          {t('teacher.profile.status.approvedBy', { name: approvedByName })}
          {approvalDate ? ` · ${new Date(approvalDate).toLocaleDateString('uz-UZ')}` : ''}
        </Text>
      ) : null}

      {status === 'rejected' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 'var(--space-3)' }}
          message={t('teacher.profile.status.rejectedTitle')}
          description={comment ?? t('teacher.profile.status.rejectedNoComment')}
        />
      ) : null}

      {status === 'pending' ? (
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 'var(--space-2)' }}>
          {t('teacher.profile.status.pendingHint')}
        </Text>
      ) : null}
    </PanelWrapper>
  );
};

export default ProfileStatusPanel;
