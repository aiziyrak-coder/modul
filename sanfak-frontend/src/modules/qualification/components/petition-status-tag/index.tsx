import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { PETITION_STATUS, type PetitionStatus } from '../../model/petition.types';

const MAP: Record<PetitionStatus, { color: string; key: string }> = {
  [PETITION_STATUS.PENDING]: { color: 'gold', key: 'qualification.enrollment.status.pending' },
  [PETITION_STATUS.APPROVED]: { color: 'green', key: 'qualification.enrollment.status.approved' },
  [PETITION_STATUS.REJECTED]: { color: 'red', key: 'qualification.enrollment.status.rejected' },
};

export default function PetitionStatusTag({ status }: { status: PetitionStatus }) {
  const { t } = useTranslation();
  const m = MAP[status] ?? MAP[PETITION_STATUS.PENDING];
  return <Tag color={m.color}>{t(m.key)}</Tag>;
}
