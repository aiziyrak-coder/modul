import { GlobalOutlined, LinkOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { SITE_CARD } from '../../model/registry';

const { Text } = Typography;

export function SiteCard({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`dz-card${active ? ' dz-card-active' : ''}`}
      style={{
        ['--dz-accent' as string]: 'var(--brand-primary, #34c18c)',
        ['--dz-accent-soft' as string]: 'var(--brand-primary-soft, #ebf9f3)',
      }}
    >
      <div className="dz-card-line" style={{ background: 'linear-gradient(90deg, #34c18c, #4a82c8)' }} />

      <div className="dz-card-row">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="dz-card-title">{SITE_CARD.title}</div>
          <Text type="secondary" style={{ fontSize: 12.5, display: 'block', lineHeight: 1.5 }}>
            {SITE_CARD.subtitle}
          </Text>
        </div>
        <span className="dz-card-ic" style={{ background: 'linear-gradient(135deg, #34c18c, #1f7a5a)' }}>
          <GlobalOutlined />
        </span>
      </div>

      <span className="dz-card-btn">
        Saytga o'tish <LinkOutlined style={{ fontSize: 11 }} />
      </span>
    </button>
  );
}
