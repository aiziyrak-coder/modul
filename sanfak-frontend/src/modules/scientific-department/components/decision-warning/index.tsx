import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';

export default function DecisionWarning() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        background: 'color-mix(in srgb, var(--brand-warning) 12%, #fff)',
        border: '1px solid color-mix(in srgb, var(--brand-warning) 35%, #fff)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        marginTop: 12,
        fontSize: 12.5,
        color: '#92400e',
      }}
    >
      <WarningOutlined style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{t('scientificDepartment.decisionWarning')}</span>
    </div>
  );
}
