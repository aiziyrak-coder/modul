import type { ReactNode } from 'react';
import { Flex, Typography } from 'antd';

interface Props {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  accent: string;
  sub?: ReactNode;
}

export function StatCard({ icon, value, label, accent, sub }: Props) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 200,
        background: 'var(--color-bg-elevate, #fff)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg, 14px)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-5, 22px)',
      }}
    >
      <Flex
        align="center"
        justify="center"
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          fontSize: 21,
          color: accent,
          background: `${accent}1a`,
        }}
      >
        {icon}
      </Flex>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          marginTop: 16,
          letterSpacing: '-0.02em',
          color: 'var(--color-text)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 13.5 }}>
        {label}
      </Typography.Text>
      {sub != null && (
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
          {sub}
        </Typography.Text>
      )}
    </div>
  );
}
