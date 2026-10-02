import { useTranslation } from '@/shared/lib/i18n';

export default function ApplicantCard({
  name,
  subtitle,
  tone = 'neutral',
}: {
  name: string;
  subtitle?: string;
  tone?: 'neutral' | 'success';
}) {
  const { t } = useTranslation();
  const success = tone === 'success';

  return (
    <div
      style={{
        background: success
          ? 'color-mix(in srgb, var(--brand-primary) 7%, #fff)'
          : 'var(--color-bg-elevate)',
        border: `1px solid ${
          success ? 'color-mix(in srgb, var(--brand-primary) 28%, #fff)' : 'var(--color-border)'
        }`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
        {t('scientificDepartment.exam.colName')}:
      </div>
      <div style={{ fontWeight: 600, marginTop: 4 }}>{name}</div>
      {subtitle ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
