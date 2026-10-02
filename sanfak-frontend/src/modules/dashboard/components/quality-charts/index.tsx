import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  indicators: { total: number; active: number };
  submissions: { total: number; byStatus: Record<string, number>; totalScore: number };
  faculties: { faculty: string; teachers: number; totalScore: number; avgScore: number }[];
}

const SERIES = '#4a82c8';

export function QualityCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'quality-charts'],
    queryFn: () => fetchOne<Stats>('/quality-statistics/overview'),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 'var(--space-4, 16px)' }}>
        Reyting yuklanmoqda···
      </Text>
    );
  }
  if (isError || !data) return null;

  const faks = (data.faculties ?? []).slice(0, 5);
  if (!faks.length) return null;
  const max = Math.max(...faks.map((f) => f.avgScore), 1);

  return (
    <div style={{ marginTop: 'var(--space-4, 16px)' }}>
      <style>{`
        .dz-bar { transition: opacity .15s ease; }
        .dz-row:hover .dz-bar { opacity: .78; }
      `}</style>

      <div style={sarlavha}>Fakultetlar reytingi · o'rtacha ball</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {faks.map((f, i) => (
          <div
            key={f.faculty}
            className="dz-row"
            title={`${f.faculty}: o'rtacha ${f.avgScore} · jami ${f.totalScore} ball · ${f.teachers} o'qituvchi`}
            style={{ display: 'grid', gridTemplateColumns: '14px 84px minmax(0, 1fr) 34px', alignItems: 'center', gap: 6 }}
          >
            <span style={{ fontSize: 10.5, color: 'var(--color-text-mute, #9aa3b2)', fontVariantNumeric: 'tabular-nums' }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.faculty}
            </span>
            <span style={{ height: 8, borderRadius: 4, background: 'var(--color-bg-elevate, #f5f7fb)', display: 'block' }}>
              <span
                className="dz-bar"
                style={{
                  display: 'block', height: '100%',
                  width: `${Math.max(6, (f.avgScore / max) * 100)}%`,
                  borderRadius: '4px 3px 3px 4px',
                  background: SERIES,
                }}
              />
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {f.avgScore}
            </span>
          </div>
        ))}
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
