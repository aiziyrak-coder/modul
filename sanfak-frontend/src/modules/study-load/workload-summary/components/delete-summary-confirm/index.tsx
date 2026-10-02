import { App } from 'antd';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import DeleteConfirm from '../../../components/delete-confirm';
import { useDeleteWorkloadSummary } from '../../api/workload-summary-api';
import type { WorkloadSummary } from '../../model/types';

interface IProps {
  item: Pick<WorkloadSummary, 'id' | 'status' | 'academicYearTitle'>;
  onDeleted?: () => void;
}

const DeleteSummaryConfirm = ({ item, onDeleted }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const del = useDeleteWorkloadSummary();
  const isRejected = item.status === 'rejected';

  const handleConfirm = async () => {
    try {
      await del.mutateAsync(item.id);
      message.success(t(isRejected ? 'studyLoad.summary.deletedRejected' : 'studyLoad.summary.deleted'));
      hideModal();
      onDeleted?.();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      title={t(isRejected ? 'studyLoad.summary.deleteRejectedTitle' : 'studyLoad.summary.deleteTitle')}
      subtitle={t(isRejected ? 'studyLoad.summary.deleteRejectedSubtitle' : 'studyLoad.summary.deleteSubtitle', {
        year: item.academicYearTitle,
      })}
      loading={del.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
};

export default DeleteSummaryConfirm;
