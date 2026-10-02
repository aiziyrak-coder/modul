import type { ReactNode } from 'react';
import styled from 'styled-components';

export interface Column<T> {
  key: string;
  title: ReactNode;
  width?: string | number;
  render?: (value: unknown, row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
}

export default function Table<T extends { id?: string | number }>({
  columns,
  data,
  onRowClick,
}: TableProps<T>) {
  return (
    <Wrap>
      <StyledTable>
        <thead>
          <tr>
            {columns.map((col) => (
              <Th key={col.key} style={{ width: col.width }}>
                {col.title}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <EmptyTd colSpan={columns.length}>
                <EmptyState>
                  <span>📭</span>
                  <p>Ma&apos;lumot topilmadi</p>
                </EmptyState>
              </EmptyTd>
            </tr>
          ) : (
            data.map((row, i) => (
              <Tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                $clickable={!!onRowClick}
              >
                {columns.map((col) => {
                  const value = (row as Record<string, unknown>)[col.key];
                  return (
                    <Td key={col.key}>
                      {col.render ? col.render(value, row) : (value as ReactNode)}
                    </Td>
                  );
                })}
              </Tr>
            ))
          )}
        </tbody>
      </StyledTable>
    </Wrap>
  );
}

const Wrap = styled.div`
  overflow-x: auto;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  padding: 12px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Tr = styled.tr<{ $clickable: boolean }>`
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  transition: background 0.1s;
  &:hover {
    background: ${({ $clickable, theme }) => ($clickable ? theme.colors.primaryLight : 'transparent')};
  }
  &:not(:last-child) td {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const Td = styled.td`
  padding: 12px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  vertical-align: middle;
`;

const EmptyTd = styled.td`
  padding: 40px;
  text-align: center;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  span {
    font-size: 32px;
  }
  p {
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;
