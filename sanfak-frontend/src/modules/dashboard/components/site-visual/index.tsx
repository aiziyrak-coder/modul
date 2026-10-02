import binoRasmi from '../../assets/institut-binosi.jpg';

export function SiteVisual({ height = 260 }: { height?: number }) {
  return (
    <div
      className="dz-site-visual"
      style={{
        height,
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        position: 'relative',
        background: '#0f5132',
      }}
    >
      <style>{`
        @keyframes dzShine { 0% { transform: translateX(-60%) skewX(-14deg) } 100% { transform: translateX(260%) skewX(-14deg) } }
        @keyframes dzBadge { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        .dz-site-visual .dz-shine { animation: dzShine 6.5s ease-in-out infinite; }
        .dz-site-visual .dz-badge { animation: dzBadge 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .dz-site-visual .dz-shine, .dz-site-visual .dz-badge { animation: none; }
        }
      `}</style>

      <img
        src={binoRasmi}
        alt="Farg'ona jamoat salomatligi tibbiyot instituti binosi"
        loading="lazy"
        style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 42%',
          display: 'block',
        }}
      />

      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(180deg, rgba(15,81,50,.10) 0%, rgba(15,81,50,.05) 45%, rgba(15,81,50,.78) 100%)',
        }}
      />

      <div
        className="dz-shine"
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '26%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.30), transparent)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          className="dz-badge"
          style={{
            width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,.94)', color: '#1f7a5a', flex: '0 0 auto',
            boxShadow: '0 4px 12px rgba(0,0,0,.22)',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
            <path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 600, textShadow: '0 1px 6px rgba(0,0,0,.45)' }}>
          Rasmiy veb-sayt
        </span>
      </div>
    </div>
  );
}
