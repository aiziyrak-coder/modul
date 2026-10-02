import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  students: {
    total: number;
    avgScore: number | null;
    byFaculty: { faculty: string; count: number; avgScore: number | null }[];
    byCourse: { course: number; count: number }[];
    top: { fullName: string; faculty: string | null; course: number | null; totalScore: number }[];
  };
  achievements: {
    byStatus: Record<string, number>;
    pending: { count: number; oldestDays: number | null };
    byType: { type: string; count: number }[];
  };
  scholarships: {
    byStatus: Record<string, number>;
    byType: { type: string; total: number; pending: number; approved: number; rejected: number }[];
  };
  rektorJudging: { total: number; fullyScored: number; awaiting: number; judgeCount: number };
}

const SERIES = '#4a82c8';
const YAXSHI = 'var(--brand-primary, #34c18c)';
const XAVF = 'var(--brand-error, #F04438)';

export function GiftedCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'gifted-charts'],
    queryFn: () => fetchOne<Stats>('/gifted-statistics/overview'),
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

  const top = (data.students.top ?? []).slice(0, 5);
  const maxBall = Math.max(...top.map((t) => t.totalScore), 1);
  const faks = (data.students.byFaculty ?? []).slice(0, 4);
  const maxFak = Math.max(...faks.map((f) => f.count), 1);
  const navbat = data.achievements.pending;
  const hakam = data.rektorJudging;

  const Qator = ({ nom, n, max, izoh }: { nom: string; n: number; max: number; izoh?: string }) => (
    <div
      className="dz-row"
      title={izoh ?? `${nom}: ${n}`}
      style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr) 28px', alignItems: 'center', gap: 7 }}
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
            background: SERIES,
          }}
        />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
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

      {navbat.count > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-error, #F04438) 8%, transparent)',
            borderLeft: `3px solid ${XAVF}`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: XAVF, fontVariantNumeric: 'tabular-nums' }}>
            {navbat.count}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
            yutuq ko'rib chiqilmagan
            {navbat.oldestDays != null && ` · eng eskisi ${navbat.oldestDays} kun kutmoqda`}
          </span>
        </div>
      )}

      {hakam.total > 0 && (
        <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <div style={sarlavha}>Rektor stipendiyasi · hakamlar baholashi</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-bg-elevate, #f5f7fb)', display: 'block' }}>
              <span
                style={{
                  display: 'block', height: '100%', borderRadius: 4, background: YAXSHI,
                  width: `${(hakam.fullyScored / hakam.total) * 100}%`,
                }}
              />
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{hakam.fullyScored}</b>/{hakam.total} to'liq
            </span>
          </div>
          <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: 4 }}>
            {hakam.awaiting} ta ariza hakam bahosini kutmoqda · {hakam.judgeCount} hakam
          </Text>
        </div>
      )}

      {top.length > 0 && (
        <>
          <div style={sarlavha}>Reyting · TOP-5</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {top.map((t) => (
              <Qator
                key={t.fullName}
                nom={t.fullName}
                n={t.totalScore}
                max={maxBall}
                izoh={`${t.fullName}${t.faculty ? ` · ${t.faculty}` : ''}${t.course ? ` · ${t.course}-kurs` : ''}: ${t.totalScore} ball`}
              />
            ))}
          </div>
        </>
      )}

      {faks.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>Fakultet kesimida</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {faks.map((f) => (
              <Qator
                key={f.faculty}
                nom={f.faculty}
                n={f.count}
                max={maxFak}
                izoh={`${f.faculty}: ${f.count} talaba · o'rtacha ball ${f.avgScore ?? '—'}`}
              />
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
