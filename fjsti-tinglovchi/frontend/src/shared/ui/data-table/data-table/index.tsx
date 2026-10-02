import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnMeta,
} from '@tanstack/react-table';
import { Empty, Flex, Pagination, Spin } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import * as S from './styles';

export interface ColMeta extends ColumnMeta<unknown, unknown> {
  align?: 'left' | 'center' | 'right';
}

const DEFAULT_PAGE_SIZE_OPTIONS = [12, 24, 36, 48];

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  loading?: boolean;
  page: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  loading,
  page,
  pageSize = 20,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  const showPagination = total !== undefined && total > 0 && onPageChange;

  return (
    <S.DataTableRoot>
      <S.TableScrollArea>
        <Spin spinning={Boolean(loading)}>
          <S.TableWrapper>
            <S.Table>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <S.Tr key={group.id}>
                    {group.headers.map((header) => {
                      const meta = header.column.columnDef.meta as ColMeta | undefined;
                      return (
                        <S.Th key={header.id} $align={meta?.align}>
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
                {table.getRowModel().rows.map((row) => (
                  <S.Tr
                    key={row.id}
                    $clickable={Boolean(onRowClick)}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as ColMeta | undefined;
                      return (
                        <S.Td key={cell.id} $align={meta?.align}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </S.Td>
                      );
                    })}
                  </S.Tr>
                ))}
              </tbody>
            </S.Table>
            {!loading && data.length === 0 && (
              <Flex justify="center" style={{ padding: 32 }}>
                <Empty description={t('no_data')} />
              </Flex>
            )}
          </S.TableWrapper>
        </Spin>
      </S.TableScrollArea>

      {showPagination ? (
        <S.PaginationWrapper>
          <S.SizeContainer>
            <h5>{t('table_rows')}:</h5>
            {pageSizeOptions.map((option) => (
              <S.SizeButton
                key={option}
                $active={pageSize === option}
                onClick={() => onPageSizeChange?.(option)}
              >
                {option}
              </S.SizeButton>
            ))}
          </S.SizeContainer>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={onPageChange}
            showSizeChanger={false}
          />
        </S.PaginationWrapper>
      ) : null}
    </S.DataTableRoot>
  );
}
