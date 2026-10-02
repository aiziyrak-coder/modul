import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { fetchOne } from '@/shared/api';

const { Text } = Typography;

interface Stats {
  contingent: {
    total: number;
    byProgram: Record<string, number>;
    byFunding: Record<string, number>;
    bySpecialty: { specialty: string; count: number }[];
  };
  attendance: {
    total: number;
    byStatus: Record<string, number>;
    presentPercent: number;
    monthly: { month: string; total: number; presentPercent: number }[];
  };
  attestation: {
    count: number;
    avgScore: number | null;
    byGrade: Record<string, number>;
  };
  risk: {
    warned: number;
    expelled: number;
    top: { fullName: string; hours: number; warned: boolean; expelled: boolean }[];
  };
  plans: {
    activity: Record<string, number>;
    dissertation: Record<string, number>;
  };
}

const SERIES = '#4a82c8';
const XAVF = 'var(--brand-error, #F04438)';

const PROGRAM_NOM: Record<string, string> = {
  magistratura: 'Magistratura',
  ordinatura: 'Ordinatura',
};
const MOLIYA_NOM: Record<string, string> = { byudjet: 'Byudjet', shartnoma: 'Shartnoma' };
const BAHO_NOM: Record<string, string> = {
  alo: "A'lo",
  yaxshi: 'Yaxshi',
  qoniqarli: 'Qoniqarli',
  qoniqarsiz: 'Qoniqarsiz',
};

export function ResidencyCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'residency-charts'],
    queryFn: () => fetchOne<Stats>('/residency-statistics/overview'),
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

  const tarkib = [
    ...Object.entries(PROGRAM_NOM).map(([k, nom]) => ({ nom, n: data.contingent.byProgram?.[k] ?? 0 })),
    ...Object.entries(MOLIYA_NOM).map(([k, nom]) => ({ nom, n: data.contingent.byFunding?.[k] ?? 0 })),
  ].filter((r) => r.n > 0);
  const maxTarkib = Math.max(...tarkib.map((r) => r.n), 1);

  const baholar = Object.entries(BAHO_NOM)
    .map(([k, nom]) => ({ nom, n: data.attestation.byGrade?.[k] ?? 0 }))
    .filter((b) => b.n > 0);
  const maxBaho = Math.max(...baholar.map((b) => b.n), 1);

  const oylar = (data.attendance.monthly ?? []).filter((m) => m.total > 0);
  const xavfTop = (data.risk.top ?? []).slice(0, 3);

  const Qator = ({ nom, n, max, izoh }: { nom: string; n: number; max: number; izoh?: string }) => (
    <div
      className="dz-row"
      title={izoh ?? `${nom}: ${n}`}
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
        .dz-row:hover .dz-bar, .dz-col:hover .dz-bar { opacity: .78; }
      `}</style>

      {(data.risk.warned > 0 || data.risk.expelled > 0) && (
        <div
          style={{
            marginBottom: 'var(--space-3, 12px)',
            padding: '7px 11px', borderRadius: 'var(--radius-md, 8px)',
            background: 'color-mix(in srgb, var(--brand-error, #F04438) 8%, transparent)',
            borderLeft: `3px solid ${XAVF}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: XAVF, fontVariantNumeric: 'tabular-nums' }}>
              {data.risk.warned}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--color-text)', lineHeight: 1.35 }}>
              ogohlantirish olgan
              {data.risk.expelled > 0 && ` · ${data.risk.expelled} ta chetlatish buyrug'i`}
            </span>
          </div>
          {xavfTop.length > 0 && (
            <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {xavfTop.map((t) => (
                <div key={t.fullName} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
                  <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.fullName}
                  </span>
                  <span style={{ color: XAVF, fontWeight: 650, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {t.hours} soat
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tarkib.length > 0 && (
        <>
          <div style={sarlavha}>Kontingent tarkibi</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {tarkib.map((r) => (
              <Qator key={r.nom} nom={r.nom} n={r.n} max={maxTarkib} />
            ))}
          </div>
        </>
      )}

      {baholar.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>
            Attestatsiya ballari
            {data.attestation.avgScore != null && ` · o'rtacha ${data.attestation.avgScore}`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {baholar.map((b) => (
              <Qator key={b.nom} nom={b.nom} n={b.n} max={maxBaho} />
            ))}
          </div>
        </>
      )}

      {oylar.length > 0 && (
        <>
          <div style={{ ...sarlavha, marginTop: 'var(--space-4, 16px)' }}>Davomat · oylik trend</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 62 }}>
            {oylar.map((m) => (
              <div
                key={m.month}
                className="dz-col"
                title={`${m.month}: kelgan ${m.presentPercent}% (${m.total} yozuv)`}
                style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              >
                <span
                  className="dz-bar"
                  style={{
                    width: '100%',
                    height: Math.max(3, Math.round((m.presentPercent / 100) * 46)),
                    borderRadius: '4px 4px 2px 2px',
                    background: SERIES,
                  }}
                />
                <span style={{ fontSize: 9.5, color: 'var(--color-text-mute, #9aa3b2)' }}>{m.month}</span>
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
