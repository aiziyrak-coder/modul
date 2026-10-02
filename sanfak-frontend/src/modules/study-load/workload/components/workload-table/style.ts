import styled from 'styled-components';

export const TableScroll = styled.div`
  overflow-x: auto;
  border: 1px solid var(--color-border-table);
  border-radius: var(--radius-md);
`;

export const Table = styled.table<{ $minWidth: number }>`
  border-collapse: collapse;
  min-width: ${({ $minWidth }) => $minWidth}px;
  width: 100%;
  font-size: 12px;

  th,
  td {
    border: 1px solid var(--color-border-table);
    padding: 6px 8px;
    text-align: center;
    white-space: normal;
    vertical-align: middle;
  }

  thead th {
    background: var(--color-bg-table-head);
    color: var(--color-text);
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  thead tr.group-row th {
    background: var(--brand-primary-soft);
    color: var(--brand-primary-active, var(--brand-primary));
  }

  td.info-cell {
    text-align: left;
  }

  tr.direction-row td {
    background: var(--brand-primary);
    font-weight: 700;
    color: var(--color-text-invert, #fff);
    text-align: center;
  }

  tr.section-row td {
    background: var(--color-bg-elevate);
    font-weight: 600;
    color: var(--color-text-soft);
  }

  tr.jami-row td {
    background: var(--brand-primary-soft);
    font-weight: 700;
    color: var(--color-text);
  }

  tr.jami-row.grand td {
    background: var(--color-bg-table-head);
  }

  td.editable-cell {
    padding: 2px 4px;
  }
`;

export const CellActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
`;
