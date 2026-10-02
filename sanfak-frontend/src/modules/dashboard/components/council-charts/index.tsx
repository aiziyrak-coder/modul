import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  tasks: { total: number; byStatus: Record<string, number>; overdue: number };
  ranks: { total: number; byStatus: Record<string, number> };
  votings: { total: number; byStatus: Record<string, number>; active: number; passed: number };
  members: { total: number };
}

const SERIES = '#34c18c';
const XAVF = 'var(--brand-error, #F04438)';

const TASK_NOM: [string, string][] = [
  ['new', 'Yangi'],
  ['in_progress', 'Jarayonda'],
  ['done', 'Bajarilgan'],
  ['approved', 'Tasdiqlangan'],
  ['rejected', 'Rad etilgan'],
  ['overdue', "Muddati o'tgan"],
];

export function CouncilCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'council-charts'],
    queryFn: () => fetchOne<Stats>('/council-statistics/overview'),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 'var(--space-4, 16px)' }}>
        Kesimlar yuklanmoqda···
      </Text>
    );
  }
  if (isError || !data) return null;

  const rows = TASK_NOM.map(([k, nom]) => ({ k, nom, n: data.tasks.byStatus?.[k] ?? 0 })).filter(
    (r) => r.n > 0,
  );
  const max = Math.max(...rows.map((r) => r.n), 1);

  const Holat = ({ nom, qismlar }: { nom: string; qismlar: { t: string; n: number; rang?: string }[] }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
      <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nom}
      </span>
      <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {qismlar.map((q, i) => (
          <span key={q.t}>
            {i > 0 && <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}> · </span>}
            <span style={{ color: q.rang ?? 'var(--color-text-mute, #9aa3b2)', fontWeight: q.rang ? 650 : 400 }}>
              {q.n} {q.t}
            </span>
          </span>
        ))}
      </span>
    </div>
  );

  return (
    <div style={{ marginTop: 'var(--space-4, 16px)' }}>
      <style>{`
        .dz-bar { transition: opacity .15s ease; }
        .dz-row:hover .dz-bar { opacity: .78; }
      `}</style>

      {data.tasks.overdue > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-error, #F04438) 8%, transparent)',
            borderLeft: `3px solid ${XAVF}`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: XAVF, fontVariantNumeric: 'tabular-nums' }}>
            {data.tasks.overdue}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
            topshiriq muddati o'tgan
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={sarlavha}>Topshiriqlar holati</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {rows.map((r) => (
              <div
                key={r.k}
                className="dz-row"
                title={`${r.nom}: ${r.n} ta`}
                style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr) 24px', alignItems: 'center', gap: 7 }}
              >
                <span style={{ fontSize: 11.5, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.nom}
                </span>
                <span style={{ height: 8, borderRadius: 4, background: 'var(--color-bg-elevate, #f5f7fb)', display: 'block' }}>
                  <span
                    className="dz-bar"
                    style={{
                      display: 'block', height: '100%',
                      width: `${Math.max(6, (r.n / max) * 100)}%`,
                      borderRadius: '4px 3px 3px 4px',
                      background: r.k === 'overdue' || r.k === 'rejected' ? XAVF : SERIES,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 11.5, fontWeight: 650, textAlign: 'right',
                    color: r.k === 'overdue' || r.k === 'rejected' ? XAVF : 'var(--color-text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {r.n}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>Unvon va ovoz berish</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Holat
          nom="Unvon arizalari"
          qismlar={[
            { t: 'yangi', n: data.ranks.byStatus?.new ?? 0 },
            { t: 'qabul', n: data.ranks.byStatus?.accepted ?? 0, rang: SERIES },
            { t: 'qaytarilgan', n: data.ranks.byStatus?.returned ?? 0, rang: XAVF },
          ]}
        />
        <Holat
          nom="Ovoz berish"
          qismlar={[
            { t: 'faol', n: data.votings.active, rang: SERIES },
            { t: 'tasdiq', n: data.votings.byStatus?.approved ?? 0 },
            { t: 'rad', n: data.votings.byStatus?.rejected ?? 0, rang: XAVF },
          ]}
        />
      </div>
    </div>
  );
}

const sarlavha: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--color-text-mute, #9aa3b2)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  marginBottom: 7,
};
