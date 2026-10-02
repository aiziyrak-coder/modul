import { useId } from 'react';
import { ACCENT, type AccentKey } from '../../model/registry';

export type AnimKind =
  | 'flow'
  | 'stack'
  | 'vote'
  | 'doc'
  | 'sign'
  | 'bell'
  | 'people'
  | 'chart'
  | 'globe'
  | 'star'
  | 'book'
  | 'shield';

interface Props {
  kind: AnimKind;
  accent: AccentKey;
  height?: number;
}

export function ModuleAnim({ kind, accent, height = 168 }: Props) {
  const uid = useId().replace(/:/g, '');
  const gid = `g-${uid}`;
  const c = ACCENT[accent].solid;
  const soft = ACCENT[accent].soft;

  return (
    <div
      style={{
        height,
        borderRadius: 'inherit',
        background: `linear-gradient(135deg, ${soft} 0%, #ffffff 100%)`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes dzDash { to { stroke-dashoffset: -220; } }
        @keyframes dzFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes dzGrow { 0% { transform: scaleY(.25); } 50% { transform: scaleY(1); } 100% { transform: scaleY(.25); } }
        @keyframes dzRing { 0% { r: 15; opacity: .55; } 100% { r: 46; opacity: 0; } }
        @keyframes dzSweep { 0% { transform: translateX(-40%); } 100% { transform: translateX(140%); } }
        @keyframes dzTick { 0%,70% { stroke-dashoffset: 34; } 85%,100% { stroke-dashoffset: 0; } }
        @keyframes dzSwing { 0%,100% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } }
        @keyframes dzSpin { to { transform: rotate(360deg); } }
        @keyframes dzTwinkle { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes dzPage { 0%,45% { transform: scaleX(1); } 55%,100% { transform: scaleX(-1); } }
        @media (prefers-reduced-motion: reduce) { .dz-anim * { animation: none !important; } }
      `}</style>

      <svg
        className="dz-anim"
        viewBox="0 0 320 168"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={c} stopOpacity="0.12" />
            <stop offset="100%" stopColor={c} stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {kind === 'flow' && (
          <>
            <path
              d="M12 122 C 70 122, 66 66, 120 66 S 196 104, 240 74 S 292 42, 310 46"
              fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="10 8" style={{ animation: 'dzDash 3.2s linear infinite' }}
            />
            {[60, 132, 208, 274].map((x, i) => (
              <circle key={x} cx={x} cy={[104, 66, 92, 58][i]} r="5.5" fill={c}
                style={{ animation: `dzFloat 2.6s ease-in-out ${i * 0.35}s infinite` }} />
            ))}
          </>
        )}

        {kind === 'stack' &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={26 + i * 48} y={38} width="26" height="96" rx="6" fill={`url(#${gid})`}
              style={{ transformOrigin: `${39 + i * 48}px 134px`, animation: `dzGrow ${2.4 + i * 0.22}s ease-in-out ${i * 0.16}s infinite` }} />
          ))}

        {kind === 'vote' && (
          <>
            <circle cx="160" cy="84" r="15" fill="none" stroke={c} strokeWidth="2" style={{ animation: 'dzRing 2.4s ease-out infinite' }} />
            <circle cx="160" cy="84" r="15" fill="none" stroke={c} strokeWidth="2" style={{ animation: 'dzRing 2.4s ease-out 1.2s infinite' }} />
            <circle cx="160" cy="84" r="13" fill={c} opacity="0.9" />
            <path d="M152 84 l6 6 l12 -13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="34" style={{ animation: 'dzTick 2.8s ease-in-out infinite' }} />
            {[60, 96, 224, 260].map((x, i) => (
              <rect key={x} x={x} y={70} width="22" height="28" rx="5" fill={c} opacity="0.22" style={{ animation: `dzFloat 3s ease-in-out ${i * 0.4}s infinite` }} />
            ))}
          </>
        )}

        {kind === 'doc' &&
          [0, 1, 2].map((i) => (
            <g key={i} style={{ animation: `dzFloat 3.4s ease-in-out ${i * 0.5}s infinite` }}>
              <rect x={44 + i * 84} y={34} width="62" height="82" rx="8" fill="#fff" stroke={c} strokeWidth="1.6" opacity="0.95" />
              {[0, 1, 2, 3].map((l) => (
                <rect key={l} x={54 + i * 84} y={48 + l * 15} width={l === 3 ? 26 : 42} height="5" rx="2.5" fill={c} opacity={0.18 + l * 0.12} />
              ))}
            </g>
          ))}

        {kind === 'sign' && (
          <>
            <rect x="72" y="30" width="176" height="108" rx="10" fill="#fff" stroke={c} strokeWidth="1.6" />
            {[0, 1, 2].map((l) => (
              <rect key={l} x="92" y={48 + l * 16} width={l === 2 ? 74 : 128} height="6" rx="3" fill={c} opacity={0.2 + l * 0.1} />
            ))}
            <path d="M96 116 c 16 -22, 30 10, 46 -10 s 26 -18, 44 4" fill="none" stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeDasharray="150" style={{ animation: 'dzTick 3.4s ease-in-out infinite' }} />
            <rect x="72" y="30" width="40" height="108" fill={`url(#${gid})`} opacity="0.25" style={{ animation: 'dzSweep 3.6s linear infinite' }} />
          </>
        )}

        {kind === 'bell' && (
          <>
            <g style={{ transformOrigin: '160px 52px', animation: 'dzSwing 2.6s ease-in-out infinite' }}>
              <path d="M160 40 c -18 0 -28 13 -28 30 v 16 l -10 14 h 76 l -10 -14 v -16 c 0 -17 -10 -30 -28 -30 z" fill={c} opacity="0.9" />
              <circle cx="160" cy="36" r="5" fill={c} />
            </g>
            <path d="M150 104 a 10 10 0 0 0 20 0" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
          </>
        )}

        {kind === 'people' && (
          <>
            {[
              { x: 100, y: 78, r: 15, d: 0 },
              { x: 160, y: 66, r: 18, d: 0.4 },
              { x: 220, y: 78, r: 15, d: 0.8 },
            ].map((p, i) => (
              <g key={i} style={{ animation: `dzFloat 3s ease-in-out ${p.d}s infinite` }}>
                <circle cx={p.x} cy={p.y} r={p.r} fill={c} opacity={i === 1 ? 0.9 : 0.45} />
                <path d={`M ${p.x - p.r - 8} ${p.y + p.r * 2.4} a ${p.r + 8} ${p.r + 8} 0 0 1 ${(p.r + 8) * 2} 0`} fill={c} opacity={i === 1 ? 0.55 : 0.25} />
              </g>
            ))}
            <circle cx="160" cy="66" r="26" fill="none" stroke={c} strokeWidth="1.4" opacity="0.4" style={{ animation: 'dzRing 3.2s ease-out infinite' }} />
          </>
        )}

        {kind === 'chart' && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x={54 + i * 46} y={44} width="22" height="90" rx="5" fill={`url(#${gid})`}
                style={{ transformOrigin: `${65 + i * 46}px 134px`, animation: `dzGrow ${2.2 + i * 0.3}s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
            <path d="M54 96 L 112 72 L 158 86 L 204 52 L 262 64" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="8 7" style={{ animation: 'dzDash 3s linear infinite' }} />
          </>
        )}

        {kind === 'globe' && (
          <>
            <circle cx="160" cy="84" r="46" fill="none" stroke={c} strokeWidth="1.8" opacity="0.8" />
            <ellipse cx="160" cy="84" rx="46" ry="16" fill="none" stroke={c} strokeWidth="1.2" opacity="0.5" />
            <g style={{ transformOrigin: '160px 84px', animation: 'dzSpin 9s linear infinite' }}>
              <ellipse cx="160" cy="84" rx="18" ry="46" fill="none" stroke={c} strokeWidth="1.2" opacity="0.55" />
              <ellipse cx="160" cy="84" rx="34" ry="46" fill="none" stroke={c} strokeWidth="1" opacity="0.35" />
            </g>
            <circle cx="160" cy="84" r="46" fill={`url(#${gid})`} opacity="0.12" />
            {([[104, 52], [222, 110], [118, 122]] as const).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4.5" fill={c} style={{ animation: `dzTwinkle 2.6s ease-in-out ${i * 0.6}s infinite` }} />
            ))}
          </>
        )}

        {kind === 'star' && (
          <>
            <g style={{ transformOrigin: '160px 82px', animation: 'dzFloat 3.2s ease-in-out infinite' }}>
              <path d="M160 42 l 12.5 25.4 28 4.1 -20.2 19.7 4.8 27.9 -25.1 -13.2 -25.1 13.2 4.8 -27.9 -20.2 -19.7 28 -4.1 z" fill={`url(#${gid})`} stroke={c} strokeWidth="1.5" />
            </g>
            {([[86, 46], [238, 44], [70, 112], [252, 116], [160, 24]] as const).map(([x, y], i) => (
              <path key={i} d={`M${x} ${y - 7} l2.2 4.6 4.8.8 -3.5 3.4.8 4.9 -4.3 -2.3 -4.3 2.3.8 -4.9 -3.5 -3.4 4.8 -.8 z`} fill={c} style={{ animation: `dzTwinkle 2.4s ease-in-out ${i * 0.45}s infinite` }} />
            ))}
          </>
        )}

        {kind === 'book' && (
          <>
            <path d="M160 44 c -18 -10 -46 -12 -62 -6 v 84 c 16 -6 44 -4 62 6 c 18 -10 46 -12 62 -6 v -84 c -16 -6 -44 -4 -62 6 z" fill="#fff" stroke={c} strokeWidth="1.8" />
            <path d="M160 44 v 84" stroke={c} strokeWidth="1.4" opacity="0.5" />
            {[0, 1, 2, 3].map((l) => (
              <g key={l}>
                <rect x="110" y={58 + l * 15} width="38" height="4.5" rx="2" fill={c} opacity={0.18 + l * 0.1} />
                <rect x="172" y={58 + l * 15} width="38" height="4.5" rx="2" fill={c} opacity={0.18 + l * 0.1} />
              </g>
            ))}
            <rect x="98" y="38" width="62" height="96" fill={`url(#${gid})`} opacity="0.2" style={{ transformOrigin: '160px 84px', animation: 'dzPage 4s ease-in-out infinite' }} />
          </>
        )}

        {kind === 'shield' && (
          <>
            <g style={{ animation: 'dzFloat 3.4s ease-in-out infinite' }}>
              <path d="M160 34 l 44 14 v 34 c 0 30 -19 48 -44 58 c -25 -10 -44 -28 -44 -58 v -34 z" fill={`url(#${gid})`} stroke={c} strokeWidth="1.8" />
              <path d="M143 84 l 12 12 l 24 -26" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" style={{ animation: 'dzTick 3s ease-in-out infinite' }} />
            </g>
            <circle cx="160" cy="88" r="15" fill="none" stroke={c} strokeWidth="1.6" opacity=".5" style={{ animation: 'dzRing 3s ease-out infinite' }} />
          </>
        )}
      </svg>
    </div>
  );
}
