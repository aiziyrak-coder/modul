import { Tag } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';

export default function SigCard({
  roleLabel,
  signerName,
  signed,
  signedAt,
  eriSerial,
  signsFileLabel,
  extra,
}: {
  roleLabel: string;
  signerName?: string | null;
  signed: boolean;
  signedAt?: string | null;
  eriSerial?: string | null;
  signsFileLabel?: string;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        border: signed
          ? '1px solid color-mix(in srgb, var(--brand-primary) 35%, #fff)'
          : '1px solid var(--color-border)',
        background: signed ? 'var(--brand-primary-soft)' : '#fff',
        borderRadius: 'var(--radius-md)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <SafetyCertificateOutlined
          style={{
            color: signed ? 'var(--brand-primary)' : 'var(--color-text-mute)',
            fontSize: 16,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{roleLabel}</span>
      </div>
      {signerName ? (
        <div style={{ fontSize: 12.5, color: 'var(--color-text-soft)', marginBottom: 6 }}>
          {signerName}
        </div>
      ) : null}
      {signsFileLabel ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginBottom: 8 }}>
          {t('scientificDepartment.eri.signsFile')}: {signsFileLabel}
        </div>
      ) : null}

      {signed ? (
        <>
          <Tag color="success" style={{ borderRadius: 'var(--radius-pill)' }}>
            {t('scientificDepartment.eri.signedTag')}
          </Tag>
          {signedAt ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-soft)', marginTop: 8 }}>
              {t('scientificDepartment.articles.colDate')}: {signedAt}
            </div>
          ) : null}
          {eriSerial ? (
            <div
              style={{
                marginTop: 8,
                fontFamily: 'monospace',
                fontSize: 12,
                border: '1px dashed color-mix(in srgb, var(--brand-primary) 45%, #fff)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                color: 'var(--brand-primary)',
                background: '#fff',
              }}
            >
              ERI: {eriSerial} ✓
            </div>
          ) : null}
          {extra}
        </>
      ) : (
        <Tag style={{ borderRadius: 'var(--radius-pill)' }}>
          {t('scientificDepartment.plans.stageWaiting')}
        </Tag>
      )}
    </div>
  );
}
