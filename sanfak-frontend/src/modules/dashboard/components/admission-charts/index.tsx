import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  total: number;
  byStatus: { new: number; approved: number; rejected: number };
  byCountry: { country: string; count: number }[];
  byMonth: { month: string; count: number }[];
}

const SERIES = '#4a82c8';
const TOP_COUNTRIES = 6;
const MAX_MONTHS = 12;

const OY = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function oyYorlig(kod: string): string {
  const [y, m] = kod.split('-');
  const i = Number(m) - 1;
  return `${OY[i] ?? m} ${(y ?? '').slice(2)}`;
}

function uzluksizOylar(
  rows: { month: string; count: number }[],
  oxirgi: number,
): { month: string; count: number }[] {
  if (!rows.length) return [];
  const bor = new Map(rows.map((r) => [r.month, r.count]));
  const son = rows[rows.length - 1]?.month;
  if (!son) return [];
  const [yStr, mStr] = son.split('-');
  let y = Number(yStr);
  let m = Number(mStr);

  const out: { month: string; count: number }[] = [];
  for (let i = 0; i < oxirgi; i += 1) {
    const kod = `${y}-${String(m).padStart(2, '0')}`;
    out.unshift({ month: kod, count: bor.get(kod) ?? 0 });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const birinchiBor = out.findIndex((r) => r.count > 0);
  return birinchiBor > 0 ? out.slice(birinchiBor) : out;
}

export function AdmissionCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'admission-charts'],
    queryFn: () => fetchOne<Stats>('/international-admission/stats'),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 'var(--space-4, 16px)' }}>
        Taqsimotlar yuklanmoqda···
      </Text>
    );
  }
  if (isError || !data) return null;

  const countries = (data.byCountry ?? []).slice(0, TOP_COUNTRIES);
  const months = uzluksizOylar(data.byMonth ?? [], MAX_MONTHS);
  if (!countries.length && !months.length) return null;

  const maxCountry = Math.max(...countries.map((c) => c.count), 1);
  const maxMonth = Math.max(...months.map((m) => m.count), 1);

  return (
    <div style={{ marginTop: 'var(--space-4, 16px)' }}>
      <style>{`
        .dz-bar     { transition: opacity .15s ease; }
        .dz-row:hover .dz-bar,
        .dz-col:hover .dz-bar { opacity: .78; }
        .dz-col     { cursor: default; }
      `}</style>

      {countries.length > 0 && (
        <>
          <div style={sarlavha}>
            Davlatlar kesimida{data.byCountry.length > TOP_COUNTRIES ? ` · eng ko'p ${TOP_COUNTRIES} tasi` : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {countries.map((c) => (
              <div
                key={c.country}
                className="dz-row"
                title={`${c.country}: ${c.count} ta ariza`}
                style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr) 24px', alignItems: 'center', gap: 7 }}
              >
                <span
                  style={{
                    fontSize: 11.5, color: 'var(--color-text)', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {c.country}
                </span>
                <span style={{ height: 8, borderRadius: 4, background: 'var(--color-bg-elevate, #f5f7fb)', display: 'block' }}>
                  <span
                    className="dz-bar"
                    style={{
                      display: 'block', height: '100%',
                      width: `${Math.max(6, (c.count / maxCountry) * 100)}%`,
                      borderRadius: '4px 3px 3px 4px',
                      background: SERIES,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 12.5, fontWeight: 650, color: 'var(--color-text)',
                    fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                  }}
                >
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {months.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>Oylar kesimida</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 92 }}>
            {months.map((m) => {
              const h = Math.max(4, Math.round((m.count / maxMonth) * 68));
              return (
                <div
                  key={m.month}
                  className="dz-col"
                  title={`${oyYorlig(m.month)}: ${m.count} ta ariza`}
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 10.5, lineHeight: 1, height: 12,
                      color: m.count === maxMonth ? 'var(--color-text)' : 'transparent',
                      fontWeight: 650, fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {m.count}
                  </span>
                  <span
                    className="dz-bar"
                    style={{
                      width: '100%', height: h,
                      borderRadius: '4px 4px 2px 2px',
                      background: SERIES,
                      opacity: m.count === 0 ? 0.18 : 1,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9.5, color: 'var(--color-text-mute, #9aa3b2)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                    }}
                  >
                    {oyYorlig(m.month)}
                  </span>
                </div>
              );
            })}
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
