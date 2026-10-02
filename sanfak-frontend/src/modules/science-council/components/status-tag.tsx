import styled from 'styled-components';
import { Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { WorkStatus } from '../model/types';

const STATUS_COLORS: Record<WorkStatus, { color: string; bg: string }> = {
  new: { color: '#2563eb', bg: '#eff6ff' },
  accepted: { color: '#0891b2', bg: '#ecfeff' },
  pending: { color: '#d97706', bg: '#fffbeb' },
  reviewed: { color: '#059669', bg: '#ecfdf5' },
  not_evaluated: { color: '#0891b2', bg: '#ecfeff' },
  not_recommended: { color: '#be123c', bg: '#fff1f2' },
  rejected: { color: '#dc2626', bg: '#fef2f2' },
  revision: { color: '#9333ea', bg: '#faf5ff' },
};

const Wrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const Badge = styled.span<{ $bg: string; $color: string }>`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  border: 1px solid ${({ $color }) => `${$color}33`};
  white-space: nowrap;
`;

export function StatusTag({ status, reason }: { status: WorkStatus; reason?: string }) {
  const { t } = useTranslation();
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.new;
  const label = t(`scienceCouncil.status.${status}`);
  const showReason = status === 'rejected' && reason;

  return (
    <Wrap>
      <Badge $color={cfg.color} $bg={cfg.bg}>{label}</Badge>
      {showReason && (
        <Tooltip
          title={
            <div style={{ maxWidth: 260 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {t('scienceCouncil.rejection.reason')}
              </div>
              <div>{reason}</div>
            </div>
          }
          color="#dc2626"
        >
          <InfoCircleOutlined style={{ color: '#dc2626', fontSize: 14, cursor: 'help' }} />
        </Tooltip>
      )}
    </Wrap>
  );
}
