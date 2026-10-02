import { Button, Tooltip } from 'antd';
import { SelectOutlined } from '@ant-design/icons';
import { usePermission } from '@/app/session';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useElectiveOptions } from '../../api/distribution-api';
import ElectiveChoiceModal from '../elective-choice-modal';

interface IProps {
  distributionId: string;
  blockId: string;
  currentScienceId: string | null;
  lockReason?: string;
}

const ElectiveChoiceAction = ({
  distributionId,
  blockId,
  currentScienceId,
  lockReason,
}: IProps) => {
  const { t } = useTranslation();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);

  const allowed = can('workloadDistribution:update');
  const optionsQuery = useElectiveOptions(distributionId, blockId, allowed);

  if (!allowed) return null;
  if (optionsQuery.isPending) return null;
  if (!optionsQuery.isError && !optionsQuery.data?.main) return null;

  const label = t('studyLoad.distribution.electiveChoice.action');

  const handleOpen = () => {
    const ModalBody = () => (
      <ElectiveChoiceModal
        distributionId={distributionId}
        blockId={blockId}
        currentScienceId={currentScienceId}
      />
    );
    showModal({
      title: t('studyLoad.distribution.electiveChoice.title'),
      body: ModalBody,
      maxWidth: '560px',
    });
  };

  return (
    <Tooltip title={lockReason ?? label}>
      <span>
        <Button
          size="small"
          type="text"
          icon={<SelectOutlined />}
          aria-label={label}
          disabled={Boolean(lockReason)}
          onClick={handleOpen}
        />
      </span>
    </Tooltip>
  );
};

export default ElectiveChoiceAction;
