import styled, { css } from 'styled-components';

export const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--border-secondary, #eaecf0);
  border-radius: var(--radius-md, 8px);
  padding: 6px 14px;
  font-size: 13px;
  color: var(--color-text-secondary, #475467);
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: var(--bg-tertiary, #f9fafb);
    color: var(--color-text, #121926);
  }
`;

export const HeaderCard = styled.div`
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #eaecf0);
  border-radius: var(--radius-lg, 12px);
  padding: 20px 24px;
  margin-bottom: 20px;
`;

export const HeaderTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text, #121926);
  margin: 0 0 4px;
  line-height: 1.4;
`;

export const HeaderSub = styled.div`
  font-size: 13px;
  color: var(--color-text-tertiary, #667085);
`;

export const HeaderMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
`;

export const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  .meta-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--color-text-tertiary, #667085);
  }
  .meta-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #121926);
  }
`;

export const ActionGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
`;

export const RevisionBanner = styled.div`
  background: linear-gradient(135deg, #faf5ff, #ede9fe);
  border: 1px solid #e9d5ff;
  border-radius: var(--radius-md, 8px);
  padding: 12px 16px;
  margin-top: 16px;
  font-size: 13px;
  color: #7c3aed;
`;

export const RejectionBanner = styled.div`
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  border: 1px solid #fecaca;
  border-radius: var(--radius-md, 8px);
  padding: 12px 16px;
  margin-top: 16px;
  font-size: 13px;
  color: #dc2626;
`;

export const ReviewProgressBanner = styled.div<{ $done?: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  background: ${({ $done }) => $done ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : 'linear-gradient(135deg, #fffbeb, #fef3c7)'};
  border: 1px solid ${({ $done }) => $done ? '#bbf7d0' : '#fde68a'};
  border-radius: var(--radius-md, 8px);
  padding: 14px 18px;
  margin-bottom: 16px;
  font-size: 13px;
  color: ${({ $done }) => $done ? '#15803d' : '#92400e'};
`;

export const BannerIcon = styled.div<{ $done?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: ${({ $done }) => $done ? '#dcfce7' : '#fef3c7'};
  color: ${({ $done }) => $done ? '#16a34a' : '#d97706'};
`;

export const BannerContent = styled.div`
  flex: 1;
  .banner-title {
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 2px;
  }
  .banner-desc {
    font-size: 13px;
    opacity: 0.85;
  }
`;

export const BannerCounter = styled.div`
  font-size: 20px;
  font-weight: 700;
  white-space: nowrap;
`;

export const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #eaecf0);
  border-radius: var(--radius-lg, 12px);
  padding: 20px 24px;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const DetailCell = styled.div<{ $span2?: boolean }>`
  padding: 12px 0;
  border-bottom: 1px solid var(--border-secondary, #eaecf0);
  ${({ $span2 }) => $span2 && 'grid-column: 1 / -1;'}
  &:nth-last-child(-n+2) { border-bottom: none; }
`;

export const DetailLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-tertiary, #667085);
  margin-bottom: 4px;
`;

export const DetailValue = styled.div<{ $color?: string }>`
  font-size: 14px;
  font-weight: 500;
  color: ${({ $color }) => $color ?? 'var(--color-text, #121926)'};
`;

export const SupervisorCard = styled.section`
  display: flex;
  gap: 14px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #eaecf0);
  border-left: 3px solid var(--brand-primary, #34c18c);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-4, 16px) var(--space-5, 20px);
  margin-top: var(--space-3, 12px);
`;

export const SupervisorAvatar = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--brand-primary, #34c18c) 12%, transparent);
  color: var(--brand-primary, #34c18c);
`;

export const SupervisorBody = styled.div`
  flex: 1;
  min-width: 0;
`;

export const SupervisorEyebrow = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--brand-primary, #34c18c);
  margin-bottom: 2px;
`;

export const SupervisorName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #121926);
  margin-bottom: 8px;
`;

export const SupervisorChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  &:empty {
    display: none;
  }
`;

export const SupervisorChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: color-mix(in srgb, var(--brand-primary, #34c18c) 10%, transparent);
  color: color-mix(in srgb, var(--brand-primary, #34c18c) 75%, #000);
  border: 1px solid color-mix(in srgb, var(--brand-primary, #34c18c) 25%, transparent);
`;

export const SupervisorMeta = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 20px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-secondary, #eaecf0);
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const InfoCard = styled.div`
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #eaecf0);
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
`;

export const InfoCardTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #121926);
  margin: 0 0 14px;
`;

export const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-secondary, #eaecf0);
  &:last-child { border-bottom: none; }
  .info-label {
    font-size: 13px;
    color: var(--color-text-tertiary, #667085);
    min-width: 120px;
  }
  .info-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text, #121926);
    text-align: right;
  }
`;

export const TabCard = styled.div`
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #eaecf0);
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
`;

export const DocRow = styled.div<{ $uploaded?: boolean }>`
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border-secondary, #eaecf0);
  &:last-child { border-bottom: none; }
  &:hover { background: var(--bg-tertiary, #f9fafb); }
`;

export const DocIcon = styled.div<{ $status: 'uploaded' | 'required' | 'optional' }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  ${({ $status }) => {
    if ($status === 'uploaded') return css`background: #f0fdf4; color: #16a34a;`;
    if ($status === 'required') return css`background: #fef2f2; color: #dc2626;`;
    return css`background: #f9fafb; color: #9ca3af;`;
  }}
`;

export const DocInfo = styled.div`
  flex: 1;
  min-width: 0;
  .doc-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text, #121926);
  }
  .doc-meta {
    font-size: 12px;
    color: var(--color-text-tertiary, #667085);
    margin-top: 2px;
  }
`;

export const ReviewCard = styled.div<{ $type?: 'positive' | 'neutral' | 'negative' }>`
  border-radius: var(--radius-md, 8px);
  padding: 14px 16px;
  margin-bottom: 10px;
  border: 1px solid;
  ${({ $type }) => {
    if ($type === 'positive') return css`background: #f0fdf4; border-color: #bbf7d0;`;
    if ($type === 'negative') return css`background: #fef2f2; border-color: #fecaca;`;
    return css`background: #f9fafb; border-color: #e5e7eb;`;
  }}
`;

export const ReviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  .reviewer-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text, #121926);
  }
  .review-date {
    font-size: 12px;
    color: var(--color-text-tertiary, #667085);
  }
`;

export const ReviewText = styled.div`
  font-size: 13px;
  color: var(--color-text-secondary, #475467);
  line-height: 1.6;
  white-space: pre-wrap;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 6px;
`;

export const AuditItem = styled.div`
  .audit-action {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text, #121926);
  }
  .audit-detail {
    font-size: 13px;
    color: var(--color-text-secondary, #475467);
    margin-top: 2px;
  }
  .audit-user {
    font-size: 12px;
    color: var(--color-text-tertiary, #667085);
    margin-top: 2px;
  }
`;

export const SpanFull = styled.div`
  grid-column: 1 / -1;
`;

export const MemberRow = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border-secondary, #eaecf0);
  &:last-child { border-bottom: none; }
  &:hover { background: var(--bg-tertiary, #f9fafb); }
`;

export const MemberNum = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0fdf4;
  color: #16a34a;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const MemberInfo = styled.div`
  flex: 1;
  .member-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text, #121926);
  }
  .member-pos {
    font-size: 12px;
    color: var(--color-text-tertiary, #667085);
    margin-top: 1px;
  }
`;

export const ProtocolViewCard = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  background: linear-gradient(135deg, #faf5ff, #ede9fe);
  border: 1px solid #c4b5fd;
  border-radius: var(--radius-lg, 12px);
  padding: 14px 18px;
  margin-bottom: 16px;
  transition: box-shadow 0.2s;
  &:hover {
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.15);
  }
`;

export const ProtocolViewIcon = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22px;
  color: #7c3aed;
`;

export const ProtocolViewContent = styled.div`
  flex: 1;
  min-width: 0;
  .pv-title {
    font-weight: 700;
    font-size: 14px;
    color: #5b21b6;
  }
  .pv-desc {
    font-size: 12px;
    color: var(--color-text-tertiary, #667085);
  }
`;

export const ProtocolSignedCard = styled.div`
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
  margin-bottom: 16px;
`;

export const ProtocolSignedHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  .ps-icon {
    color: #16a34a;
    font-size: 20px;
  }
  .ps-title {
    font-weight: 700;
    font-size: 15px;
    color: #15803d;
  }
`;

export const ProtocolInfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const ProtocolInfoItem = styled.div`
  .pi-label {
    font-size: 11px;
    color: var(--color-text-tertiary, #667085);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .pi-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #121926);
  }
  .pi-cert {
    font-size: 11px;
    word-break: break-all;
    color: #7c3aed;
  }
`;

export const ESignBox = styled.div`
  margin-top: 20px;
  padding: 16px;
  background: #faf5ff;
  border: 1px solid #ddd6fe;
  border-radius: 10px;
  .es-title {
    font-weight: 700;
    font-size: 13px;
    color: #7c3aed;
    margin-bottom: 6px;
  }
  .es-desc {
    font-size: 12px;
    color: var(--color-text-tertiary, #667085);
    margin-bottom: 12px;
  }
`;

export const DecisionCard = styled.div<{ $type: string }>`
  border: 1px solid;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 8px;
  ${({ $type }) => {
    if ($type === 'seminar') return 'background: #f0fdf4; border-color: #bbf7d0;';
    if ($type === 'rejected') return 'background: #fef2f2; border-color: #fecaca;';
    return 'background: #faf5ff; border-color: #ddd6fe;';
  }}
`;
