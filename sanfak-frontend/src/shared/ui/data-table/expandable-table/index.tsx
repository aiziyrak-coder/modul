import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnMeta,
  type ExpandedState,
  type OnChangeFn,
  type Row,
} from '@tanstack/react-table';
import type { CSSProperties } from 'react';
import { Empty, Flex, Spin } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import styled from 'styled-components';
import * as S from './styles';

const ExpandBtn = styled.button<{ $expanded: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  color: var(--color-text-soft, #697586);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  transition: transform 0.2s;
  transform: ${({ $expanded }) => ($expanded ? 'rotate(90deg)' : 'rotate(0deg)')};
`;

export type WithSubRows<T> = T & { subRows?: T[] };

export interface ExpandableColMeta extends ColumnMeta<unknown, unknown> {
  rowSpan?: number;
  headerStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
}

export interface ExpandableTableProps<T> {
  data: WithSubRows<T>[];
  columns: ColumnDef<WithSubRows<T>, unknown>[];
  loading?: boolean;
  renderParentRow?: (row: Row<WithSubRows<T>>) => ReactNode;
  parentRowTone?: (row: Row<WithSubRows<T>>) => 'default' | 'warning';
  minWidth?: number;
  expanded?: ExpandedState;
  onExpandedChange?: OnChangeFn<ExpandedState>;
}

export function ExpandableTable<T extends object>({
  data,
  columns,
  loading,
  renderParentRow,
  parentRowTone,
  minWidth,
  expanded: expandedProp,
  onExpandedChange,
}: ExpandableTableProps<T>) {
  const { t } = useTranslation();
  const [innerExpanded, setInnerExpanded] = useState<ExpandedState>({});
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : innerExpanded;

  const expandCol: ColumnDef<WithSubRows<T>, unknown> = {
    id: '_expand',
    header: '',
    size: 40,
    cell: ({ row }: { row: Row<WithSubRows<T>> }) =>
      row.getCanExpand() ? (
        <ExpandBtn
          $expanded={row.getIsExpanded()}
          type="button"
          onClick={row.getToggleExpandedHandler()}
        >
          <RightOutlined />
        </ExpandBtn>
      ) : null,
  };

  const table = useReactTable({
    data,
    columns: renderParentRow ? columns : [expandCol, ...columns],
    state: { expanded },
    onExpandedChange: isControlled ? onExpandedChange : setInnerExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <Spin spinning={Boolean(loading)}>
      <S.TableWrapper>
        <S.Table $minWidth={minWidth}>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <S.Tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | ExpandableColMeta
                    | undefined;
                  if (
                    meta?.rowSpan !== undefined &&
                    !header.isPlaceholder &&
                    header.id === header.column.id
                  ) {
                    return null;
                  }
                  return (
                    <S.Th
                      key={header.id}
                      colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                      rowSpan={meta?.rowSpan}
                      style={meta?.headerStyle}
                    >
                      {typeof header.column.columnDef.header === 'string'
                        ? t(header.column.columnDef.header)
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </S.Th>
                  );
                })}
              </S.Tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              if (row.depth === 0 && renderParentRow) {
                return (
                  <S.Tr key={row.id}>
                    <S.ParentTd
                      colSpan={row.getVisibleCells().length}
                      $expanded={row.getIsExpanded()}
                      $warning={parentRowTone?.(row) === 'warning'}
                    >
                      {renderParentRow(row)}
                    </S.ParentTd>
                  </S.Tr>
                );
              }
              return (
                <S.Tr key={row.id}>
                  {row.getVisibleCells().map((cell, ci) => {
                    const CellEl = row.depth > 0 && ci > 0 ? S.SubTd : S.Td;
                    const meta = cell.column.columnDef.meta as
                      | ExpandableColMeta
                      | undefined;
                    return (
                      <CellEl key={cell.id} style={meta?.bodyStyle}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </CellEl>
                    );
                  })}
                </S.Tr>
              );
            })}
          </tbody>
        </S.Table>
        {!loading && data.length === 0 && (
          <Flex justify="center" style={{ padding: 32 }}>
            <Empty description={t('no_data')} />
          </Flex>
        )}
      </S.TableWrapper>
    </Spin>
  );
}
