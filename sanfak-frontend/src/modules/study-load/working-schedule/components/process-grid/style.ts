import styled from 'styled-components';

export const ProcessWrap = styled.div`
  overflow-x: auto;
`;

export const LegendRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-6);
  margin-bottom: var(--space-5);
`;

export const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  color: var(--color-text);
`;

export const LegendBox = styled.div<{ $bg?: string }>`
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: ${({ $bg }) => $bg ?? 'var(--color-bg-layout)'};
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 13px;
  color: var(--color-text);
  flex-shrink: 0;
`;

export const GridTable = styled.table`
  border-collapse: collapse;
  font-size: 12px;
  min-width: 100%;

  th,
  td {
    border: 1px solid var(--color-border);
    padding: 0;
    text-align: center;
    white-space: nowrap;
  }

  thead th {
    background: var(--color-bg-table-head, #eef2f6);
    color: var(--color-text);
    font-weight: 600;
    padding: 4px 6px;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  thead th.month-header {
    background: #ecf3ff;
  }

  tbody td {
    height: 36px;
    min-width: 28px;
    max-width: 36px;
  }

  tbody td.course-cell {
    min-width: 60px;
    padding: 4px 8px;
    text-align: left;
    background: var(--color-bg-table-head, #eef2f6);
    font-weight: 600;
  }

  tbody td.stat-cell {
    min-width: 60px;
    padding: 4px 6px;
    background: var(--color-bg-layout, #f8fafc);
  }

  tbody td.total-cell {
    min-width: 50px;
    padding: 4px 6px;
    background: var(--color-bg-layout, #f8fafc);
    font-weight: 600;
  }

  th.sticky-col,
  td.sticky-col {
    position: sticky;
    right: var(--sticky-right, 0px);
    z-index: 2;
    min-width: 0;
    max-width: none;
    box-sizing: border-box;
  }

  thead th.sticky-col {
    z-index: 3;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.15;
    font-size: 11px;
    padding: 4px 3px;
  }

  th.sticky-col.sticky-edge,
  td.sticky-col.sticky-edge {
    box-shadow: -2px 0 4px rgba(0, 0, 0, 0.06);
  }

  td.actions-cell {
    background: var(--color-bg-layout, #f8fafc);
  }
`;

export const WeekCell = styled.div<{ $bg?: string }>`
  width: 100%;
  height: 100%;
  min-height: 36px;
  background: ${({ $bg }) => $bg ?? 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text);
`;
