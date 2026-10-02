import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  contracts: {
    total: number;
    byStatus: Record<string, number>;
    awaitingRector: number;
    endingSoon: number;
  };
  organizations: { total: number };
  students: { total: number };
}

const SERIES = '#34c18c';
const XAVF = 'var(--brand-error, #F04438)';

const HOLAT_NOM: [string, string][] = [
  ['draft', 'Yangi'],
  ['in_progress', 'Jarayonda'],
  ['rektor_approved', 'Rektor tasdiqlagan'],
  ['both_approved', 'Ikki tomon tasdiqlagan'],
  ['rejected', 'Rad etilgan'],
];

export function PracticeCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'practice-charts'],
    queryFn: () => fetchOne<Stats>('/practice-statistics/overview'),
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

  const rows = HOLAT_NOM.map(([k, nom]) => ({ k, nom, n: data.contracts.byStatus?.[k] ?? 0 })).filter(
    (r) => r.n > 0,
  );
  const max = Math.max(...rows.map((r) => r.n), 1);
  const kutmoqda = data.contracts.awaitingRector;
  const tugayapti = data.contracts.endingSoon;

  return (
    <div style={{ marginTop: 'var(--space-4, 16px)' }}>
      <style>{`
        .dz-bar { transition: opacity .15s ease; }
        .dz-row:hover .dz-bar { opacity: .78; }
      `}</style>

      {kutmoqda > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-primary, #34c18c) 10%, transparent)',
            borderLeft: `3px solid ${SERIES}`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: SERIES, fontVariantNumeric: 'tabular-nums' }}>
            {kutmoqda}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
            shartnoma sizning imzoingizni kutmoqda
          </span>
        </div>
      )}

      {tugayapti > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-error, #F04438) 8%, transparent)',
            borderLeft: `3px solid ${XAVF}`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: XAVF, fontVariantNumeric: 'tabular-nums' }}>
            {tugayapti}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
            shartnoma muddati 30 kun ichida tugaydi
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={sarlavha}>Shartnomalar holati</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {rows.map((r) => (
              <div
                key={r.k}
                className="dz-row"
                title={`${r.nom}: ${r.n} ta`}
                style={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr) 24px', alignItems: 'center', gap: 7 }}
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
                      background: r.k === 'rejected' ? XAVF : SERIES,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 11.5, fontWeight: 650, textAlign: 'right',
                    color: r.k === 'rejected' ? XAVF : 'var(--color-text)',
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
