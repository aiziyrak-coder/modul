import styled from 'styled-components';

export const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
`;

export const ItemRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 8px);
`;

export const ItemIndex = styled.span`
  flex: 0 0 28px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary, #697586);
`;
