import styled from 'styled-components';

export const TableScroll = styled.div`
  overflow-x: auto;
  border: 1px solid var(--color-border-table);
  border-radius: var(--radius-md);
`;

export const Table = styled.table<{ $minWidth: number }>`
  border-collapse: collapse;
  min-width: ${({ $minWidth }) => `${$minWidth}px`};
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
  }

  thead tr.group-row th {
    background: var(--brand-primary-soft);
    color: var(--brand-primary-active, var(--brand-primary));
  }

  td.info-cell {
    text-align: left;
    font-weight: 600;
    background: var(--color-bg-elevate);
  }

  td.total-cell {
    background: var(--brand-primary-soft);
    font-weight: 700;
  }

  td.editable-cell {
    padding: 2px 4px;
  }

  td.actions-cell {
    white-space: nowrap;
  }
`;
