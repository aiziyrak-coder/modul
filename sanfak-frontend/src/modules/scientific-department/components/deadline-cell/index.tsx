import { Tag } from 'antd';
import dayjs from 'dayjs';
import { ClockCircleOutlined } from '@ant-design/icons';
import { Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { deadlineBadge } from '../../model/deadline-badge';

export default function DeadlineCell({ deadline }: { deadline: string | null }) {
  const { t } = useTranslation();

  if (!deadline) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;

  const diff = dayjs(deadline).startOf('day').diff(dayjs().startOf('day'), 'day');
  const badge = deadlineBadge(diff);

  return (
    <div style={{ lineHeight: 1.5 }}>
      <Flex align="center" gap={6}>
        <ClockCircleOutlined style={{ color: 'var(--brand-warning)' }} />
        <span style={diff < 0 ? { color: 'var(--color-text-mute)' } : undefined}>{deadline}</span>
      </Flex>
      {badge ? (
        <Tag
          color={badge.color}
          style={{ marginTop: 4, marginInlineEnd: 0, borderRadius: 'var(--radius-pill)' }}
        >
          {t(`scientificDepartment.conferences.${badge.key}`)}
        </Tag>
      ) : null}
    </div>
  );
}
