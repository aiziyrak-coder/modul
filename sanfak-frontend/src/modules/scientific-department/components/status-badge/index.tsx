import { Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { BadgeStatus } from '../../model/types';

const STATUS_STYLE: Record<BadgeStatus, { color: string; bg: string }> = {
  new: {
    color: 'var(--brand-info)',
    bg: 'color-mix(in srgb, var(--brand-info) 10%, #fff)',
  },
  pending: {
    color: '#a16207',
    bg: 'color-mix(in srgb, var(--brand-warning) 14%, #fff)',
  },
  approved: {
    color: 'var(--brand-primary)',
    bg: 'var(--brand-primary-soft)',
  },
  rejected: {
    color: 'var(--brand-error)',
    bg: 'color-mix(in srgb, var(--brand-error) 10%, #fff)',
  },
  finalReview: {
    color: '#7c3aed',
    bg: 'color-mix(in srgb, #7c3aed 8%, #fff)',
  },
  kotibApproved: {
    color: '#0891b2',
    bg: 'color-mix(in srgb, #0891b2 8%, #fff)',
  },
  prorektorApproved: {
    color: '#0e7490',
    bg: 'color-mix(in srgb, #0e7490 8%, #fff)',
  },
  ssvSendPending: {
    color: '#c2410c',
    bg: 'color-mix(in srgb, #c2410c 8%, #fff)',
  },
  ssvSent: {
    color: '#4f46e5',
    bg: 'color-mix(in srgb, #4f46e5 8%, #fff)',
  },
  ssvReceived: {
    color: '#0d9488',
    bg: 'color-mix(in srgb, #0d9488 8%, #fff)',
  },
};

export default function StatusBadge({
  status,
  reason,
  rejectedBy,
}: {
  status: BadgeStatus;
  reason?: string | null;
  rejectedBy?: string | null;
}) {
  const { t } = useTranslation();
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.new;
  const label = t(`scientificDepartment.status.${status}`);

  const tooltip = (
    <div>
      <div>{reason || t('scientificDepartment.status.noReason')}</div>
      {rejectedBy ? (
        <div style={{ marginTop: 4, opacity: 0.9 }}>
          {t('scientificDepartment.status.rejectedBy')}: <strong>{rejectedBy}</strong>
        </div>
      ) : null}
    </div>
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {status === 'rejected' ? (
        <Tooltip title={tooltip} color="var(--brand-error)">
          <InfoCircleOutlined
            style={{ color: 'var(--brand-error)', fontSize: 14, cursor: 'help' }}
          />
        </Tooltip>
      ) : null}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 10px',
          borderRadius: 'var(--radius-pill)',
          fontSize: 12,
          fontWeight: 500,
          background: s.bg,
          color: s.color,
          border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </span>
  );
}
