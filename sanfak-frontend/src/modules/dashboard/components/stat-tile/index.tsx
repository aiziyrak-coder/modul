import { Typography } from 'antd';
import { ACCENT, type AccentKey } from '../../model/registry';

const { Text } = Typography;

export function StatTile({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: number | null;
  accent: AccentKey;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        flex: '1 1 120px',
        minWidth: 120,
        padding: 'var(--space-3, 12px) var(--space-4, 16px)',
        borderRadius: 'var(--radius-md, 8px)',
        background: 'var(--color-bg-elevate, #f5f7fb)',
        borderLeft: `3px solid ${ACCENT[accent].solid}`,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.2,
          color: 'var(--color-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {loading ? '···' : (value ?? '—')}
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
    </div>
  );
}
