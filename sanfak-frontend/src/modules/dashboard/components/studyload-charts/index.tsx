import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Doc {
  total: number;
  draft: number;
  new: number;
  in_review: number;
  approved: number;
  rejected: number;
}

interface Stats {
  rectorInbox: { workingSchedule: number; workload: number; total: number; oldestWaitingDays: number | null };
  documents: {
    workingSchedule: Doc;
    workload: Doc;
    distribution: Doc;
    scienceProgram: Doc;
    syllabus: Doc;
    readiness: number;
  };
  hours: { distributed: number; residue: number; coverage: number };
  vacancies: { count: number; hours: number; byDepartment: { department: string; count: number; hours: number }[] };
}

const SERIES = '#4a82c8';
const YAXSHI = 'var(--brand-primary, #34c18c)';
const XAVF = 'var(--brand-error, #F04438)';

const HUJJAT_NOM: [keyof Stats['documents'], string][] = [
  ['workingSchedule', 'Ishchi grafik'],
  ['workload', 'Yuklama'],
  ['distribution', 'Taqsimot'],
  ['scienceProgram', 'Fan dasturi'],
  ['syllabus', 'Sillabus'],
];

const son = (n: number) => n.toLocaleString('uz-UZ').replace(/,/g, ' ');

export function StudyLoadCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'studyload-charts'],
    queryFn: () => fetchOne<Stats>('/study-load-statistics/overview'),
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

  const inbox = data.rectorInbox;
  const hujjatlar = HUJJAT_NOM.map(([k, nom]) => ({ nom, d: data.documents[k] as Doc })).filter(
    (x) => x.d && x.d.total > 0,
  );
  const maxHujjat = Math.max(...hujjatlar.map((x) => x.d.total), 1);
  const vak = (data.vacancies.byDepartment ?? []).slice(0, 3);

  return (
    <div style={{ marginTop: 'var(--space-4, 16px)' }}>
      <style>{`
        .dz-bar { transition: opacity .15s ease; }
        .dz-row:hover .dz-bar { opacity: .78; }
      `}</style>

      {inbox.total > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-primary, #34c18c) 10%, transparent)',
            borderLeft: `3px solid ${YAXSHI}`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: YAXSHI, fontVariantNumeric: 'tabular-nums' }}>
            {inbox.total}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
            hujjat imzoingizni kutmoqda
            {inbox.oldestWaitingDays != null && ` · eng eskisi ${inbox.oldestWaitingDays} kun`}
          </span>
        </div>
      )}

      {hujjatlar.length > 0 && (
        <>
          <div style={sarlavha}>Hujjatlar tayyorligi · {data.documents.readiness}%</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {hujjatlar.map((x) => (
              <div
                key={x.nom}
                className="dz-row"
                title={`${x.nom}: jami ${x.d.total} · tasdiqlangan ${x.d.approved} · jarayonda ${x.d.in_review} · rad ${x.d.rejected}`}
                style={{ display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr) 46px', alignItems: 'center', gap: 7 }}
              >
                <span style={{ fontSize: 11.5, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {x.nom}
                </span>
                <span style={{ height: 8, borderRadius: 4, background: 'var(--color-bg-elevate, #f5f7fb)', display: 'block', position: 'relative' }}>
                  <span
                    className="dz-bar"
                    style={{
                      position: 'absolute', inset: 0,
                      width: `${(x.d.total / maxHujjat) * 100}%`,
                      borderRadius: '4px 3px 3px 4px',
                      background: SERIES, opacity: 0.35,
                    }}
                  />
                  <span
                    className="dz-bar"
                    style={{
                      position: 'absolute', inset: 0,
                      width: `${(x.d.approved / maxHujjat) * 100}%`,
                      borderRadius: '4px 3px 3px 4px',
                      background: SERIES,
                    }}
                  />
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  <b>{x.d.approved}</b>
                  <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>/{x.d.total}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {vak.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>
            Vakansiyalar · {son(data.vacancies.hours)} soat
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vak.map((v) => (
              <div
                key={v.department}
                title={`${v.department}: ${v.count} vakansiya · ${son(v.hours)} soat`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '1px 0' }}
              >
                <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.department}
                </span>
                <span style={{ color: XAVF, fontWeight: 650, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {v.count} ta · {son(v.hours)} soat
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
