import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import StatusBadge from '../../../components/status-badge';
import type { VerificationStatus } from '../../model/types';

interface IProps {
  status: VerificationStatus;
  comment?: string | null;
}

const VerifyStatusBadge = ({ status, comment }: IProps) => {
  const { t } = useTranslation();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
      <StatusBadge status={status} />
      {status === 'rejected' ? (
        <Tooltip title={comment || t('teacher.personalPlan.completedItems.noComment')}>
          <InfoCircleOutlined style={{ color: 'var(--brand-error)', fontSize: 13 }} />
        </Tooltip>
      ) : null}
    </span>
  );
};

export default VerifyStatusBadge;
