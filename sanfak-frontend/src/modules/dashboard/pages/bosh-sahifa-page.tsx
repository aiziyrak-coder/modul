import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { MODULE_CARDS, SITE_CARD, type ModuleCard } from '../model/registry';
import { useCardStats } from '../api/dashboard-api';
import { HeroPanel } from '../components/hero-panel';
import { SiteCard } from '../components/site-card';
import { ModuleCardTile } from '../components/module-card';
import { ModuleDetail } from '../components/module-detail';
import { moduleIcon } from '../components/module-icon';

const SITE_KEY = '__site__';

export default function BoshSahifaPage() {
  const navigate = useNavigate();
  const can = usePermission();

  const cards = MODULE_CARDS;
  const stats = useCardStats(cards);

  const [selected, setSelected] = useState<string>(SITE_KEY);
  const isSite = selected === SITE_KEY;
  const activeCard = cards.find((c) => c.key === selected) ?? null;

  const entryPath = (c: ModuleCard) =>
    c.entries?.find((e) => can(e.permission))?.path ?? c.path;

  const open = (key: string) => {
    if (key === SITE_KEY) {
      window.open(SITE_CARD.url, '_blank', 'noopener,noreferrer');
      return;
    }
    const c = cards.find((x) => x.key === key);
    if (c) navigate(entryPath(c));
  };

  return (
    <PageContainer title="Bosh sahifa">
      <style>{`
        .dz-page {
          background-image:
            radial-gradient(circle 3px at 8% 12%,  #34c18c33 99%, transparent),
            radial-gradient(circle 4px at 26% 68%, #4a82c82e 99%, transparent),
            radial-gradient(circle 3px at 44% 22%, #d6409f2b 99%, transparent),
            radial-gradient(circle 4px at 61% 84%, #e8833a2e 99%, transparent),
            radial-gradient(circle 3px at 76% 38%, #34c18c2e 99%, transparent),
            radial-gradient(circle 4px at 90% 70%, #4a82c82b 99%, transparent),
            radial-gradient(circle 3px at 15% 92%, #d6409f26 99%, transparent),
            radial-gradient(circle 4px at 55% 5%,  #34c18c29 99%, transparent);
        }
        .dz-layout { display: grid; gap: var(--space-6, 24px); align-items: start;
                     grid-template-columns: minmax(0, 1fr); }
        .dz-cards  { display: grid; gap: var(--space-5, 20px);
                     grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        @media (min-width: 1100px) {
          .dz-layout { grid-template-columns: minmax(0, 1fr) minmax(0, 400px); }
          .dz-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 1500px) {
          .dz-layout { grid-template-columns: minmax(0, 1fr) minmax(0, 480px); }
        }

        @keyframes dzCardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .dz-card {
          position: relative; display: flex; flex-direction: column; text-align: left;
          cursor: pointer; width: 100%; padding: 0 24px 22px;
          border-radius: 18px;
          background: var(--color-bg, #fff);
          border: 1px solid var(--color-border-soft, #eef2f6);
          box-shadow: 0 2px 12px rgba(16,24,40,.05);
          transition: box-shadow .25s ease, transform .25s ease, border-color .25s ease;
          animation: dzCardIn .45s ease both;
          overflow: hidden;
        }
        .dz-cards > .dz-card:nth-child(1)  { animation-delay: .02s }
        .dz-cards > .dz-card:nth-child(2)  { animation-delay: .06s }
        .dz-cards > .dz-card:nth-child(3)  { animation-delay: .10s }
        .dz-cards > .dz-card:nth-child(4)  { animation-delay: .14s }
        .dz-cards > .dz-card:nth-child(5)  { animation-delay: .18s }
        .dz-cards > .dz-card:nth-child(6)  { animation-delay: .22s }
        .dz-cards > .dz-card:nth-child(7)  { animation-delay: .26s }
        .dz-cards > .dz-card:nth-child(8)  { animation-delay: .30s }
        .dz-cards > .dz-card:nth-child(9)  { animation-delay: .34s }
        .dz-cards > .dz-card:nth-child(10) { animation-delay: .38s }
        .dz-cards > .dz-card:nth-child(n+11) { animation-delay: .42s }
        .dz-card:hover { transform: translateY(-5px); box-shadow: 0 20px 44px rgba(16,24,40,.13); }
        .dz-card-active {
          border-color: color-mix(in srgb, var(--dz-accent, #34c18c) 55%, #fff);
          box-shadow: 0 14px 34px color-mix(in srgb, var(--dz-accent, #34c18c) 22%, transparent);
        }

        .dz-card-line { height: 3px; margin: 0 -24px;
                        background: linear-gradient(90deg,
                          var(--dz-accent),
                          color-mix(in srgb, var(--dz-accent) 45%, #fff)); }

        .dz-card-row { display: flex; align-items: flex-start; gap: 14px;
                       padding-top: 20px; flex: 1; }
        .dz-card-title { font-weight: 650; font-size: 16.5px; color: var(--color-text);
                         line-height: 1.35; margin-bottom: 4px; letter-spacing: -.01em; }

        .dz-card-ic {
          flex: 0 0 auto; width: 60px; height: 60px; display: grid; place-items: center;
          border-radius: 19px; font-size: 25px; color: #fff;
          background: linear-gradient(150deg,
            color-mix(in srgb, var(--dz-accent) 82%, #fff) 0%,
            var(--dz-accent) 55%,
            color-mix(in srgb, var(--dz-accent) 82%, #121926) 130%);
          box-shadow: 0 10px 22px color-mix(in srgb, var(--dz-accent) 32%, transparent);
        }

        .dz-card-btn {
          margin-top: 18px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          height: 40px; border-radius: 10px;
          border: 1px solid var(--color-border, #e3e8ef);
          color: var(--color-text); font-size: 13.5px; font-weight: 600;
          background: var(--color-bg, #fff);
          transition: background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        .dz-card:hover .dz-card-btn {
          border-color: color-mix(in srgb, var(--dz-accent) 55%, #fff);
          color: var(--dz-accent); background: var(--dz-accent-soft, #f5f7fb);
        }
        .dz-card-active .dz-card-btn {
          background: var(--dz-accent); border-color: var(--dz-accent); color: #fff;
          box-shadow: 0 8px 18px color-mix(in srgb, var(--dz-accent) 35%, transparent);
        }

        @media (prefers-reduced-motion: reduce) {
          .dz-card { animation: none; }
          .dz-card:hover { transform: none; }
        }
      `}</style>

      <div className="dz-page">
      <div className="dz-layout">
        <div style={{ minWidth: 0 }}>
          <HeroPanel cards={cards} stats={stats} onOpen={open} />

          <div className="dz-cards">
            <SiteCard active={isSite} onSelect={() => setSelected(SITE_KEY)} />

            {cards.map((c) => (
              <ModuleCardTile
                key={c.key}
                card={c}
                icon={moduleIcon(c.key)}
                active={selected === c.key}
                onSelect={() => setSelected(c.key)}
              />
            ))}
          </div>
        </div>

        <ModuleDetail
          card={activeCard}
          stats={activeCard ? stats[activeCard.key] : undefined}
          isSite={isSite}
          onOpen={() => open(selected)}
        />
      </div>
      </div>
    </PageContainer>
  );
}
