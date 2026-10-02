import { useEffect, useState } from 'react';
import { Typography } from 'antd';
import { ACCENT, type ModuleCard } from '../../model/registry';
import { moduleAnim, moduleIcon } from '../module-icon';
import { ModuleAnim } from '../module-anim';
import type { CardStats } from '../../api/dashboard-api';
import { formatStat } from '../../lib/format-stat';

const { Text } = Typography;

export function HeroPanel({
  cards,
  stats,
  onOpen,
}: {
  cards: readonly ModuleCard[];
  stats: Record<string, CardStats>;
  onOpen: (key: string) => void;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (cards.length < 2 || paused) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setTimeout(() => setI((v) => (v + 1) % cards.length), 5000);
    return () => window.clearTimeout(t);
  }, [i, cycle, paused, cards.length]);

  useEffect(() => {
    if (i >= cards.length) setI(0);
  }, [cards.length, i]);

  const card = cards[i];
  if (!card) return null;

  const a = ACCENT[card.accent];
  const s = stats[card.key];
  const shownStats = (s?.loading ? (s?.stats ?? []) : (s?.stats ?? []).filter((x) => x.value !== null)).slice(0, 4);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setCycle((c) => c + 1);
      }}
      style={{
        borderRadius: 'var(--radius-xl, 16px)',
        border: '1px solid var(--color-border, #e3e8ef)',
        background: 'var(--color-bg, #fff)',
        boxShadow: '0 1px 3px rgba(16,24,40,.05)',
        overflow: 'hidden',
        marginBottom: 'var(--space-5, 20px)',
      }}
    >
      <style>{`
        @keyframes dzHeroIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes dzFill { from { width: 0%; } to { width: 100%; } }
        .dz-hero-fill { height: 100%; border-radius: 2px; width: 0%;
                        animation: dzFill 5s linear forwards; }
        @media (prefers-reduced-motion: reduce) { .dz-hero-fill { animation: none; width: 100%; } }
        .dz-hero { display: grid; gap: var(--space-4, 16px); padding: var(--space-4, 16px) var(--space-5, 20px);
                   align-items: center; grid-template-columns: minmax(0, 1fr); }
        .dz-hero-slide { animation: dzHeroIn .45s ease both; min-width: 0; }
        @media (min-width: 860px) { .dz-hero { grid-template-columns: minmax(0, 1fr) minmax(0, 320px); } }
        @media (prefers-reduced-motion: reduce) { .dz-hero-slide { animation: none; } }
      `}</style>

      <div style={{ height: 3, background: a.solid, transition: 'background .4s ease' }} />

      <div className="dz-hero">
        <div className="dz-hero-slide" key={`t-${card.key}`}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 'var(--radius-pill, 9999px)',
              background: a.solid, color: '#fff', fontSize: 12.5, fontWeight: 650,
              boxShadow: `0 6px 14px ${a.solid}40`,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', opacity: 0.9 }} />
            {card.title}
          </span>

          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12.5 }}>
            {card.subtitle} · {card.ttRef}
          </Text>

          {shownStats.length > 0 ? (
            <div style={{ display: 'flex', gap: 'var(--space-6, 24px)', marginTop: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
              {shownStats.map((st) => (
                <div key={st.label}>
                  <div style={{ fontSize: st.format === 'money' ? 19 : 24, fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
                    {s?.loading ? '···' : formatStat(st)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {st.label}
                  </Text>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 'var(--space-3, 12px)', color: 'var(--color-text)', fontSize: 13, lineHeight: 1.55, maxWidth: 520 }}>
              {card.about}
            </div>
          )}

          <button
            type="button"
            onClick={() => onOpen(card.key)}
            style={{
              marginTop: 'var(--space-3, 12px)', height: 36, padding: '0 18px',
              cursor: 'pointer', borderRadius: 'var(--radius-md, 8px)', border: 'none',
              background: a.solid, color: '#fff', fontWeight: 600, fontSize: 13.5,
              boxShadow: `0 6px 16px ${a.solid}44`,
            }}
          >
            Batafsil
          </button>
        </div>

        <div
          className="dz-hero-slide"
          key={`a-${card.key}`}
          style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 30px rgba(16,24,40,.10)' }}
        >
          <ModuleAnim kind={moduleAnim(card.key)} accent={card.accent} height={116} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 var(--space-5, 20px) var(--space-3, 12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          {cards.map((c, idx) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.title}
              title={c.title}
              onClick={() => setI(idx)}
              style={{
                width: idx === i ? 22 : 8, height: 8,
                borderRadius: 'var(--radius-pill, 9999px)', border: 'none', cursor: 'pointer', padding: 0,
                background: idx === i ? ACCENT[c.accent].solid : 'var(--color-border, #e3e8ef)',
                transition: 'width .3s ease, background .3s ease',
              }}
            />
          ))}
        </div>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--color-border-soft, #eef2f6)', overflow: 'hidden', marginLeft: 6 }}>
          <div
            key={`${i}-${cycle}`}
            className="dz-hero-fill"
            style={{
              background: a.solid,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-mute, #9aa3b2)', fontSize: 12, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, background: a.soft, color: a.solid, fontSize: 13 }}>
            {moduleIcon(card.key)}
          </span>
          {i + 1} / {cards.length}
        </span>
      </div>
    </div>
  );
}
