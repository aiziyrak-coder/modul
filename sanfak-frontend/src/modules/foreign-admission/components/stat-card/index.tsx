import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  value: number | string;
  label: string;
  bg: string;
  color: string;
}

export function StatCard({ icon, value, label, bg, color }: Props) {
  return (
    <div
      style={{
        background: 'var(--color-bg, #fff)',
        border: '1px solid var(--color-border, #e3e8ef)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(16,24,40,0.05))',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          background: bg,
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.1,
            color: 'var(--color-text)',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-text-mute, #697586)' }}>{label}</span>
      </div>
    </div>
  );
}
