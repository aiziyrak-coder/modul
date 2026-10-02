import styled from 'styled-components';

export const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
`;

export const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
`;

export const ActionsGroup = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
`;

export const FiltersRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
`;

export const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`;

export const GroupWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
`;

export const GroupHeader = styled.div<{ $color: string }>`
  padding: var(--space-1) var(--space-1);
  font-size: 12px;
  font-weight: 600;
  color: ${({ $color }) => $color};
`;

export const EntryWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const RollupWrap = styled.div`
  padding-inline: var(--space-1);
`;

export const RollupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
`;

export const PaginationRow = styled.div`
  display: flex;
  justify-content: center;
  padding: var(--space-4) 0;
`;
