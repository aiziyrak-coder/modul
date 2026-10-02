import styled from 'styled-components';
import { statuses } from '../../lib/constants';
import type { TaskStatusUz } from '../../model/types';

const Badge = styled.span<{ $bg: string; $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
  }
`;

export default function StatusBadge({ status }: { status: TaskStatusUz }) {
  const info = statuses.find((s) => s.value === status);
  if (!info) {
    return (
      <Badge $color="#8c8c8c" $bg="#f5f5f5">
        {status}
      </Badge>
    );
  }
  return (
    <Badge $color={info.color} $bg={info.bg}>
      {info.label}
    </Badge>
  );
}
