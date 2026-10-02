import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  overdue: { count: number; share: number };
  discipline: { completed: number; onTime: number; percent: number };
  avgCompletionDays: number | null;
  byDepartment: {
    department: string;
    total: number;
    completed: number;
    overdue: number;
    onTimePercent: number;
  }[];
  monthly: { month: string; berilgan: number; bajarilgan: number }[];
  byCategory: { category: string; count: number }[];
  byPriority: Record<string, number>;
  highOverdue: number;
}

const BERILGAN = '#4a82c8';
const BAJARILGAN = '#34c18c';
const XAVF = 'var(--brand-error, #F04438)';

const STATUS_NOM: Record<string, string> = {
  new: 'Yangi',
  in_progress: 'Jarayonda',
  under_review: 'Tekshiruvda',
  completed: 'Bajarilgan',
  rejected: 'Rad etilgan',
  not_needed: 'Kerak emas',
};

export function TaskCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'task-charts'],
    queryFn: () => fetchOne<Stats>('/task-statistics/overview'),
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

  const statusRows = Object.entries(STATUS_NOM)
    .map(([k, nom]) => ({ nom, n: data.byStatus?.[k] ?? 0 }))
    .filter((r) => r.n > 0);
  const maxStatus = Math.max(...statusRows.map((r) => r.n), 1);

  const oylar = (data.monthly ?? []).filter((m) => m.berilgan > 0 || m.bajarilgan > 0);
  const maxOy = Math.max(...oylar.flatMap((m) => [m.berilgan, m.bajarilgan]), 1);

  const deps = [...(data.byDepartment ?? [])].filter((d) => d.total > 0);
  const engKech = [...deps].sort((a, b) => b.overdue - a.overdue).filter((d) => d.overdue > 0).slice(0, 3);

  const Qator = ({ nom, n, max, rang }: { nom: string; n: number; max: number; rang: string }) => (
    <div
      className="dz-row"
      title={`${nom}: ${n} ta`}
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
            background: rang,
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
        .dz-row:hover .dz-bar, .dz-col:hover .dz-bar { opacity: .78; }
      `}</style>

      {data.highOverdue > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-error, #F04438) 8%, transparent)',
            borderLeft: `3px solid ${XAVF}`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: XAVF, fontVariantNumeric: 'tabular-nums' }}>
            {data.highOverdue}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
            yuqori muhimlikdagi topshiriq muddati o'tgan
          </span>
        </div>
      )}

      {statusRows.length > 0 && (
        <>
          <div style={sarlavha}>Holat bo'yicha taqsimot</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {statusRows.map((r) => (
              <Qator key={r.nom} nom={r.nom} n={r.n} max={maxStatus} rang={BERILGAN} />
            ))}
          </div>
        </>
      )}

      {oylar.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>Oylik dinamika</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 7 }}>
            {[
              { nom: 'Berilgan', rang: BERILGAN },
              { nom: 'Bajarilgan', rang: BAJARILGAN },
            ].map((l) => (
              <span key={l.nom} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--color-text)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: l.rang }} />
                {l.nom}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 62 }}>
            {oylar.map((m) => (
              <div
                key={m.month}
                className="dz-col"
                title={`${m.month}: berilgan ${m.berilgan}, bajarilgan ${m.bajarilgan}`}
                style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              >
                <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 46, width: '100%' }}>
                  {[
                    { v: m.berilgan, rang: BERILGAN },
                    { v: m.bajarilgan, rang: BAJARILGAN },
                  ].map((s, i) => (
                    <span
                      key={i}
                      className="dz-bar"
                      style={{
                        flex: 1,
                        height: Math.max(3, Math.round((s.v / maxOy) * 46)),
                        borderRadius: '4px 4px 2px 2px',
                        background: s.rang,
                        opacity: s.v === 0 ? 0.2 : 1,
                      }}
                    />
                  ))}
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--color-text-mute, #9aa3b2)' }}>{m.month}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {engKech.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>
            Eng ko'p kechiktirgan bo'linmalar
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {engKech.map((d) => (
              <div
                key={d.department}
                title={`${d.department}: ${d.overdue} ta muddati o'tgan, o'z vaqtida ${d.onTimePercent}%`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '1px 0' }}
              >
                <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.department}
                </span>
                <span style={{ color: XAVF, fontWeight: 650, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {d.overdue} ta
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
