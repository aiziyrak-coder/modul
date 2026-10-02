import styled from 'styled-components';

type StatusNum = 1 | 2 | 3 | 4 | 5;
type StatusStr = 'active' | 'inactive' | 'pending' | 'rejected' | 'approved' | 'cancelled' | 'info' | 'system';

const COLOR_MAP: Record<StatusNum, { bg: string; color: string }> = {
  1: { bg: '#ecfdf3', color: '#037a48' },
  2: { bg: '#fffaeb', color: '#b54708' },
  3: { bg: '#eff8ff', color: '#175cd3' },
  4: { bg: '#fef3f2', color: '#b42318' },
  5: { bg: '#f2f4f7', color: '#344054' },
};

const STR_TO_NUM: Record<StatusStr, StatusNum> = {
  active: 1,
  approved: 1,
  pending: 2,
  info: 3,
  inactive: 4,
  rejected: 4,
  cancelled: 5,
  system: 5,
};

const Badge = styled.span<{ $bg: string; $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: var(--radius-pill, 9999px);
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  font-family: Inter, sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
`;

export interface StatusTagProps {
  label: string;
  status: StatusNum | StatusStr;
}

export function StatusTag({ label, status }: StatusTagProps) {
  const num: StatusNum =
    typeof status === 'number' ? status : (STR_TO_NUM[status] ?? 5);
  const { bg, color } = COLOR_MAP[num];
  return (
    <Badge $bg={bg} $color={color}>
      {label}
    </Badge>
  );
}
