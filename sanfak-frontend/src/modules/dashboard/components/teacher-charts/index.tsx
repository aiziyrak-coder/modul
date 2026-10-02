import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  teachers: {
    total: number;
    byDegree: Record<string, number>;
    byTitle: Record<string, number>;
    byEmployment: Record<string, number>;
    degreeRatio: number;
    profilePending: number;
    avgHIndex: number;
  };
  workPlans: {
    total: number;
    byStatus: Record<string, number>;
    missing: number;
    overdueItems: number;
    completedItems: number;
    itemsTotal: number;
    completionPercent: number;
  };
}

const SERIES = '#4a82c8';
const XAVF = 'var(--brand-error, #F04438)';

const DARAJA_NOM: [string, string][] = [
  ['fan_doktori', 'Fan doktori'],
  ['fan_nomzodi', 'Fan nomzodi'],
  ['falsafa_doktori', 'PhD'],
  ['none', 'Darajasiz'],
];

const REJA_NOM: [string, string][] = [
  ['draft', 'Qoralama'],
  ['submitted', 'Yuborilgan'],
  ['approved', 'Tasdiqlangan'],
  ['rejected', 'Rad etilgan'],
  ['completed', 'Yakunlangan'],
];

export function TeacherCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'teacher-charts'],
    queryFn: () => fetchOne<Stats>('/teacher-statistics/overview'),
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

  const daraja = DARAJA_NOM.map(([k, nom]) => ({ k, nom, n: data.teachers.byDegree?.[k] ?? 0 })).filter(
    (r) => r.n > 0,
  );
  const maxDaraja = Math.max(...daraja.map((r) => r.n), 1);

  const reja = REJA_NOM.map(([k, nom]) => ({ k, nom, n: data.workPlans.byStatus?.[k] ?? 0 })).filter(
    (r) => r.n > 0,
  );
  const maxReja = Math.max(...reja.map((r) => r.n), 1);

  const Qator = ({ nom, n, max, qizil }: { nom: string; n: number; max: number; qizil?: boolean }) => (
    <div
      className="dz-row"
      title={`${nom}: ${n}`}
      style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr) 24px', alignItems: 'center', gap: 7 }}
    >
      <span style={{ fontSize: 11.5, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nom}
      </span>
      <span style={{ height: 8, borderRadius: 4, background: 'var(--color-bg-elevate, #f5f7fb)', display: 'block' }}>
        <span
          className="dz-bar"
          style={{
            display: 'block', height: '100%',
            width: `${Math.max(6, (n / max) * 100)}%`,
            borderRadius: '4px 3px 3px 4px',
            background: qizil ? XAVF : SERIES,
          }}
        />
      </span>
      <span
        style={{
          fontSize: 11.5, fontWeight: 650, textAlign: 'right',
          color: qizil ? XAVF : 'var(--color-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {n}
      </span>
    </div>
  );

  return (
    <div style={{ marginTop: 'var(--space-4, 16px)' }}>
      <style>{`
        .dz-bar { transition: opacity .15s ease; }
        .dz-row:hover .dz-bar { opacity: .78; }
      `}</style>

      {(data.workPlans.missing > 0 || data.teachers.profilePending > 0) && (
        <div
          style={{
            marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-error, #F04438) 8%, transparent)',
            borderLeft: `3px solid ${XAVF}`,
          }}
        >
          {data.workPlans.missing > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: XAVF, fontVariantNumeric: 'tabular-nums' }}>
                {data.workPlans.missing}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
                o'qituvchi ish rejasini topshirmagan
              </span>
            </div>
          )}
          {data.teachers.profilePending > 0 && (
            <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: data.workPlans.missing > 0 ? 4 : 0 }}>
              {data.teachers.profilePending} profil kadrlar bo'limi tasdig'ini kutmoqda
            </Text>
          )}
        </div>
      )}

      {daraja.length > 0 && (
        <>
          <div style={sarlavha}>Ilmiy daraja · salohiyat {data.teachers.degreeRatio}%</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {daraja.map((r) => (
              <Qator key={r.k} nom={r.nom} n={r.n} max={maxDaraja} qizil={r.k === 'none'} />
            ))}
          </div>
        </>
      )}

      {reja.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>
            Ish rejalari · bajarilish {data.workPlans.completionPercent}%
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {reja.map((r) => (
              <Qator key={r.k} nom={r.nom} n={r.n} max={maxReja} qizil={r.k === 'rejected'} />
            ))}
          </div>
          <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: 6 }}>
            {data.workPlans.completedItems} / {data.workPlans.itemsTotal} ish bajarilgan ·{' '}
            <span style={{ color: XAVF, fontWeight: 650 }}>{data.workPlans.overdueItems} muddati o'tgan</span>
          </Text>
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
