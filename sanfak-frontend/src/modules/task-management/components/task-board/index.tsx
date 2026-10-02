import { useCallback, useMemo, useRef } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Empty, Spin, Tooltip } from '@/shared/ui';
import { CalendarOutlined, MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Paginated } from '@/shared/api';
import { toEnStatus } from '../../api/mapper';
import { TASK_BOARD_KEY } from '../../api/queries';
import { boardColumns, type BoardColumn } from '../../lib/constants';
import { colors } from '../../lib/theme';
import PriorityBadge from '../priority-badge';
import type { Task } from '../../model/types';

const PAGE = 15;

const Board = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(200px, 1fr);
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 8px;
  align-items: start;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ColumnHead = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: ${({ $color }) => $color};
  color: #fff;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
`;

const ColumnCount = styled.span`
  background: rgba(255, 255, 255, 0.28);
  border-radius: 10px;
  padding: 0 8px;
  font-size: 12px;
  min-width: 22px;
  text-align: center;
`;

const ColumnBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 2px;
`;

const Card = styled.div<{ $color: string }>`
  background: #fff;
  border: 1px solid ${colors.border};
  border-left: 3px solid ${({ $color }) => $color};
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
  &:hover {
    box-shadow: 0 4px 14px rgba(16, 24, 40, 0.1);
    transform: translateY(-1px);
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

const CodeChip = styled.span<{ $color: string }>`
  background: ${({ $color }) => `${$color}1a`};
  color: ${({ $color }) => $color};
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
`;

const Deadline = styled.span<{ $overdue: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${({ $overdue }) => ($overdue ? colors.danger : colors.textSecondary)};
  font-weight: ${({ $overdue }) => ($overdue ? 600 : 400)};
  white-space: nowrap;
`;

const CardTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${colors.textPrimary};
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardDesc = styled.div`
  font-size: 12px;
  color: ${colors.textSecondary};
  line-height: 1.45;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardFoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid ${colors.border};
  font-size: 12px;
  color: ${colors.textSecondary};
`;

const Person = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding: 18px 0;
`;

export type BoardFetcher = (
  params: Record<string, string | number | undefined>,
) => Promise<Paginated<Task>>;

interface Props {
  fetcher: BoardFetcher;
  filters: Record<string, string>;
  detailBase: string;
  personField: 'assignee' | 'createdBy';
}

const columnStatusParam = (col: BoardColumn): string =>
  col.statuses.map((s) => toEnStatus(s)).filter(Boolean).join(',');

function BoardColumnView({
  column,
  fetcher,
  filters,
  detailBase,
  personField,
}: Props & { column: BoardColumn }) {
  const navigate = useNavigate();
  const statusParam = useMemo(() => columnStatusParam(column), [column]);

  const { data, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: [...TASK_BOARD_KEY, detailBase, column.key, filters] as const,
    queryFn: ({ pageParam }) =>
      fetcher({ ...filters, status: statusParam, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? (last.page ?? 0) + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => (data?.pages ?? []).flatMap((p) => p.docs ?? []), [data]);
  const total = data?.pages?.[0]?.totalDocs ?? 0;

  const bodyRef = useRef<HTMLDivElement>(null);
  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Column>
      <ColumnHead $color={column.color}>
        <span>{column.label}</span>
        {isFetching && !isFetchingNextPage && rows.length > 0 ? (
          <Spin size="small" />
        ) : (
          <ColumnCount>{total}</ColumnCount>
        )}
      </ColumnHead>

      <ColumnBody ref={bodyRef} onScroll={onScroll}>
        {rows.length === 0 && isFetching ? (
          <Centered>
            <Spin size="small" />
          </Centered>
        ) : rows.length === 0 ? (
          <Centered>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: 12 }}>Bo&apos;sh</span>} />
          </Centered>
        ) : (
          <>
            {rows.map((t) => {
              const overdue = !!t.deadline && dayjs(t.deadline).isBefore(dayjs(), 'day');
              const person = personField === 'assignee' ? t.assignees[0] : t.createdBy;
              return (
                <Card key={t.id} $color={column.color} onClick={() => navigate(`${detailBase}/${t.id}`)}>
                  <CardTop>
                    <CodeChip $color={column.color}>{t.code || '—'}</CodeChip>
                    <Deadline $overdue={overdue}>
                      <CalendarOutlined />
                      {t.deadline ? dayjs(t.deadline).format('DD.MM.YYYY') : '—'}
                    </Deadline>
                  </CardTop>

                  <CardTitle>{t.title}</CardTitle>
                  {t.description && <CardDesc>{t.description}</CardDesc>}

                  <CardFoot>
                    <Tooltip title={person?.position || undefined}>
                      <Person>{person?.name || '—'}</Person>
                    </Tooltip>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <PriorityBadge priority={t.priority} />
                      <span style={{ color: t.responseCount ? colors.primary : undefined }}>
                        <MessageOutlined /> {t.responseCount ?? 0}
                      </span>
                    </span>
                  </CardFoot>
                </Card>
              );
            })}
            {isFetchingNextPage && (
              <Centered>
                <Spin size="small" />
              </Centered>
            )}
          </>
        )}
      </ColumnBody>
    </Column>
  );
}

export default function TaskBoard(props: Props) {
  return (
    <Board>
      {boardColumns.map((col) => (
        <BoardColumnView key={col.key} column={col} {...props} />
      ))}
    </Board>
  );
}
