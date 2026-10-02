import { useState } from 'react';
import { Empty } from 'antd';

export interface DirectionBar {
  id: string;
  name: string;
  count: number;
}

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max / 4)));
  return Math.ceil(max / (4 * step)) * 4 * step;
}

export function DirectionBars({ items }: { items: DirectionBar[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const max = niceMax(Math.max(...items.map((i) => i.count)));
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0 8px' }}>
        {items.map((item) => {
          const isHovered = hovered === item.id;
          return (
            <div
              key={item.id}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
            >
              <span
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-soft, #475569)' }}
              >
                {item.name}
              </span>
              <div
                style={{
                  position: 'relative',
                  height: 14,
                  background: 'var(--color-bg-elevate, #f1f5f9)',
                  borderRadius: '0 7px 7px 0',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(item.count / max) * 100}%`,
                    background: isHovered
                      ? 'color-mix(in srgb, var(--brand-primary) 82%, #000)'
                      : 'var(--brand-primary)',
                    borderRadius: '0 7px 7px 0',
                    transition: 'width 0.6s ease, background 0.15s ease',
                    position: 'relative',
                  }}
                >
                  {isHovered && (
                    <span
                      style={{
                        position: 'absolute',
                        right: -34,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#1e293b',
                        color: '#fff',
                        padding: '1px 8px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 38px 0 0',
          fontSize: 11,
          color: 'var(--color-text-mute, #94a3b8)',
        }}
      >
        {ticks.map((tick) => (
          <span key={tick}>{Math.round(tick)}</span>
        ))}
      </div>
    </div>
  );
}
