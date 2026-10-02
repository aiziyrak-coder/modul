import { Flex, Tag, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { STATUS_META } from '../model/status';
import type { ForeignStatus } from '../model/types';

export function StatusTag({
  status,
  rejectionReason,
}: {
  status: ForeignStatus;
  rejectionReason?: string;
}) {
  const { t } = useTranslation();
  const meta = STATUS_META[status];
  const tag = <Tag color={meta.color}>{t(meta.titleKey)}</Tag>;

  if (status !== 'radEtilgan' || !rejectionReason) return tag;

  return (
    <Flex align="center" gap={6}>
      <Tooltip
        title={rejectionReason}
        color="var(--brand-error)"
        placement="top"
        styles={{ root: { maxWidth: 280 } }}
      >
        <InfoCircleOutlined
          style={{ color: 'var(--brand-error)', cursor: 'help', fontSize: 15 }}
        />
      </Tooltip>
      {tag}
    </Flex>
  );
}
