import styled from 'styled-components';
import { priorities } from '../../lib/constants';
import type { TaskPriorityUz } from '../../model/types';

const Badge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid ${({ $color }) => $color}40;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => $color}10;
`;

export default function PriorityBadge({ priority }: { priority: TaskPriorityUz }) {
  const info = priorities.find((p) => p.value === priority);
  if (!info) return <Badge $color="#8c8c8c">{priority}</Badge>;
  return <Badge $color={info.color}>{info.label}</Badge>;
}
