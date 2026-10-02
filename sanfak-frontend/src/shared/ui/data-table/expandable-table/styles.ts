import styled from 'styled-components';

export const TableWrapper = styled.div<{ $minWidth?: number }>`
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--radius-lg, 12px);
  background: var(--color-bg, #fff);
  overflow: auto;
`;

export const Table = styled.table<{ $minWidth?: number }>`
  width: 100%;
  min-width: ${({ $minWidth }) => ($minWidth ? `${$minWidth}px` : 'auto')};
  border-collapse: collapse;
  font-family: Inter, sans-serif;
  font-size: 14px;
`;

export const Th = styled.th`
  text-align: left;
  padding: 13px;
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  background: var(--color-bg-table-head, #eef2f6);
  color: var(--color-text-soft, #697586);
  border-bottom: none;
`;

export const Td = styled.td`
  padding: 20px 12px;
  color: var(--color-text, #121926);
  border-bottom: 1px solid var(--color-border-table, #e4e7ec);
  font-size: 14px;
  font-weight: 500;
  line-height: 100%;
  letter-spacing: -0.02em;
  white-space: nowrap;
`;

export const Tr = styled.tr<{ $clickable?: boolean }>`
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

  &:hover td {
    background: var(--color-bg-elevate, #f5f7fb);
  }
  &:last-child td {
    border-bottom: none;
  }
`;

export const SubTd = styled(Td)`
  background: var(--color-bg-elevate, #f5f7fb);
  padding-left: 36px;
`;

export const ParentTd = styled.td<{ $expanded?: boolean; $warning?: boolean }>`
  position: relative;
  padding: 0 12px;
  box-sizing: border-box;
  height: 58px;
  border-bottom: 1px solid var(--color-border-table, #e4e7ec);
  color: var(--color-text, #121926);
  font-size: 14px;
  font-weight: 500;
  line-height: 100%;
  letter-spacing: -0.02em;
  background: ${({ $expanded, $warning }) =>
    $warning ? '#FEF6EE' : $expanded ? '#EFF8FF' : 'var(--color-bg, #fff)'};
`;
