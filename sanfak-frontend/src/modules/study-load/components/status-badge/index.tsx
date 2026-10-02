import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { getStatusMeta } from '../../model/status-workflow';

interface IProps {
  status: string;
}

const StatusBadge = ({ status }: IProps) => {
  const { t } = useTranslation();
  const meta = getStatusMeta(status);
  return <Tag color={meta.color}>{t(meta.labelKey, { defaultValue: meta.label })}</Tag>;
};

export default StatusBadge;
