import type { ReactNode } from 'react';
import { RightOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { ACCENT, type ModuleCard } from '../../model/registry';

const { Text } = Typography;

export function ModuleCardTile({
  card,
  icon,
  active,
  onSelect,
}: {
  card: ModuleCard;
  icon: ReactNode;
  active: boolean;
  onSelect: () => void;
}) {
  const a = ACCENT[card.accent];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`dz-card${active ? ' dz-card-active' : ''}`}
      style={{
        ['--dz-accent' as string]: a.solid,
        ['--dz-accent-soft' as string]: a.soft,
      }}
    >
      <div className="dz-card-line" />

      <div className="dz-card-row">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="dz-card-title">{card.title}</div>
          <Text type="secondary" style={{ fontSize: 12.5, display: 'block', lineHeight: 1.5 }}>
            {card.subtitle}
          </Text>
        </div>
        <span className="dz-card-ic">{icon}</span>
      </div>

      <span className="dz-card-btn">
        Batafsil <RightOutlined style={{ fontSize: 11 }} />
      </span>
    </button>
  );
}
