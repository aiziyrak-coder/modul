import { Alert, Skeleton } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import ApprovalTimeline from '../approval-timeline';
import type { ApprovalStep } from '../../distribution/model/types';

interface IProps {
  isLoading: boolean;
  isError: boolean;
  steps: ApprovalStep[] | undefined;
}

const ApprovalChainModal = ({ isLoading, isError, steps }: IProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <Alert type="error" showIcon message={t('studyLoad.approval.loadError')} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
      <ApprovalTimeline history={steps ?? []} />
    </div>
  );
};

export default ApprovalChainModal;
