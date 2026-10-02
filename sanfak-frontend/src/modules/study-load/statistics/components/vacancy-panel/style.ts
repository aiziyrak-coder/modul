import styled from 'styled-components';

export const Tiles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
`;

export const ListRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`;

export const DeptName = styled.span`
  font-size: 12.5px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const DeptValue = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: var(--brand-error);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

export const Empty = styled.div`
  font-size: 12.5px;
  color: var(--color-text-soft);
`;
