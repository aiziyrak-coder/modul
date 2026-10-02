import { Tag, Tooltip } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';

interface IProps {
  needsRecalculation: boolean;
}

const NeedsRecalcBadge = ({ needsRecalculation }: IProps) => {
  const { t } = useTranslation();

  if (!needsRecalculation) return null;

  const label = t('studyLoad.deptContingent.recalc.tag');
  return (
    <Tooltip title={t('studyLoad.deptContingent.recalc.tooltip')}>
      <Tag
        color="warning"
        icon={<SyncOutlined />}
        style={{ marginInlineEnd: 0 }}
        aria-label={label}
        data-testid="needs-recalc-badge"
      >
        {label}
      </Tag>
    </Tooltip>
  );
};

export default NeedsRecalcBadge;
