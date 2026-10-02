import { Flex } from 'antd';
import type { TabDef } from '../../model/status';

const countForTab = (tab: TabDef, counts: Record<string, number>): number => {
  if (tab.statuses === null) return counts.all ?? 0;
  return tab.statuses.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
};

interface Props {
  tabs: TabDef[];
  active: string;
  counts?: Record<string, number>;
  onChange: (key: string) => void;
}

export function StatusTabs({ tabs, active, counts = {}, onChange }: Props) {
  return (
    <Flex gap={8} wrap style={{ marginBottom: 16 }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const count = countForTab(tab, counts);
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 14px',
              borderRadius: 'var(--radius-pill, 999px)',
              border: '1px solid',
              borderColor: isActive ? 'var(--brand-primary)' : 'var(--color-border)',
              background: isActive ? 'var(--brand-primary)' : 'var(--color-bg-elevate, #fff)',
              color: isActive ? '#fff' : 'var(--color-text)',
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all .15s ease',
            }}
          >
            {tab.label}
            <span
              style={{
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 10,
                fontSize: 12,
                lineHeight: '20px',
                textAlign: 'center',
                background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--color-border-soft, #eef2f6)',
                color: isActive ? '#fff' : 'var(--color-text-soft, #697586)',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </Flex>
  );
}
