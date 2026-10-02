import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Segmented } from 'antd';
import { Avatar, Button, Empty, Input, Table, Tag } from '@/shared/ui';
import type { TableProps } from '@/shared/ui';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CloseOutlined,
  EyeOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useServerTable } from '../lib/use-server-table';
import { useDebouncedSearch } from '../lib/use-debounced';
import { fetchMyTasksPage } from '../api/task-management-api';
import { useTaskStats } from '../api/queries';
import { toEnStatus } from '../api/mapper';
import { statusTabs } from '../lib/constants';
import { colors } from '../lib/theme';
import StatusBadge from '../components/status-badge';
import PriorityBadge from '../components/priority-badge';
import TaskBoard from '../components/task-board';
import { useViewMode, type ViewMode } from '../lib/use-view-mode';
import type { Task, TaskStatusUz } from '../model/types';

const DETAIL_BASE = '/task-management/my-tasks';

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;
const TabRow = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;
const TabChip = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1.5px solid ${({ $active }) => ($active ? colors.primary : colors.border)};
  background: ${({ $active }) => ($active ? colors.primaryLight : '#fff')};
  cursor: pointer;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? '600' : '500')};
  color: ${({ $active }) => ($active ? colors.primary : colors.textSecondary)};
  transition: all 0.15s;
  &:hover {
    border-color: ${colors.primary};
    color: ${colors.primary};
  }
`;
const ChipCount = styled.span<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? colors.primary : '#E4E7EC')};
  color: ${({ $active }) => ($active ? '#fff' : colors.textSecondary)};
  font-size: 12px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
`;
const ClearAllBtn = styled.button`
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #f59e0b;
  background: #fff;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 5px;
  &:hover {
    background: #fef3c7;
  }
`;
const TaskTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.textPrimary};
  cursor: pointer;
  &:hover {
    color: ${colors.primary};
  }
`;
const TaskId = styled.span`
  font-size: 12px;
  color: ${colors.textSecondary};
  display: block;
  margin-top: 1px;
`;
const DeadlineCell = styled.div<{ $overdue: boolean }>`
  font-size: 13px;
  color: ${({ $overdue }) => ($overdue ? colors.danger : colors.textPrimary)};
  font-weight: ${({ $overdue }) => ($overdue ? '600' : '400')};
`;

export default function MyTasksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useViewMode('assigned');

  const { rows, total, page, limit, sort, loading, error, setPage, setLimit, resetFilters, setSort } =
    useServerTable<Task>(fetchMyTasksPage, { initialLimit: 10 });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search);
  const initialStatus = (location.state as { statusFilter?: TaskStatusUz | '' } | null)?.statusFilter ?? '';
  const [statusFilter, setStatusFilter] = useState<TaskStatusUz | ''>(initialStatus);

  const filterParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (statusFilter) {
      const en = toEnStatus(statusFilter);
      if (en) p.status = en;
    }
    return p;
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    resetFilters(filterParams);
  }, [filterParams, resetFilters]);

  const statsParams = useMemo(() => {
    const { status: _s, ...rest } = filterParams;
    return rest;
  }, [filterParams]);
  const { statsAssigned } = useTaskStats(statsParams);

  const tabCounts: Record<string, number> = {
    '': statsAssigned.total,
    yangi: statsAssigned.yangi,
    jarayonda: statsAssigned.jarayonda,
    tekshiruvda: statsAssigned.tekshiruvda,
    bajarildi: statsAssigned.bajarildi,
    kechikdi: statsAssigned.kechikdi,
    'rad etildi': statsAssigned['rad etildi'],
    bajarilmadi: statsAssigned.bajarilmadi,
  };

  const onTableChange: TableProps<Task>['onChange'] = (pag, _f, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const order = s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : null;
    const nextField = order ? 'deadline' : null;
    const changed = (sort?.field ?? null) !== nextField || (sort?.order ?? null) !== order;
    if (changed) setSort(nextField, order);
    else {
      setPage(pag.current ?? 1);
      setLimit(pag.pageSize ?? limit);
    }
  };

  const columns: TableProps<Task>['columns'] = [
    {
      title: 'Topshiriq',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record) => (
        <div>
          <TaskTitle onClick={() => navigate(`${DETAIL_BASE}/${record.id}`)}>{text}</TaskTitle>
          <TaskId>
            {record.code || record.id} • {record.category}
          </TaskId>
        </div>
      ),
    },
    {
      title: 'Bergan',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 160,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={26} style={{ background: '#1677ff', fontSize: 12 }}>
            {record.createdBy.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{record.createdBy.name.split(' ')[0]}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{record.createdBy.position}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Muddat',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 130,
      render: (deadline: string) => {
        const overdue = dayjs(deadline).isBefore(dayjs(), 'day');
        const daysLeft = dayjs(deadline).startOf('day').diff(dayjs().startOf('day'), 'day');
        return (
          <div>
            <DeadlineCell $overdue={overdue}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {dayjs(deadline).format('DD.MM.YYYY')}
            </DeadlineCell>
            {overdue ? (
              <Tag color="error" style={{ fontSize: 12, borderRadius: 4, marginTop: 2 }}>
                {Math.abs(daysLeft)} kun kechikdi
              </Tag>
            ) : daysLeft === 0 ? (
              <Tag color="warning" style={{ fontSize: 12, borderRadius: 4, marginTop: 2 }}>
                Bugun tugaydi
              </Tag>
            ) : daysLeft <= 3 ? (
              <Tag color="warning" style={{ fontSize: 12, borderRadius: 4, marginTop: 2 }}>
                {daysLeft} kun qoldi
              </Tag>
            ) : null}
          </div>
        );
      },
      sorter: true,
    },
    {
      title: 'Muhimlik',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (p: Task['priority']) => <PriorityBadge priority={p} />,
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: Task['status']) => <StatusBadge status={s} />,
    },
    {
      title: 'Amal',
      key: 'action',
      width: 110,
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          size="small"
          type="primary"
          onClick={() => navigate(`${DETAIL_BASE}/${record.id}`)}
          style={{ borderRadius: 6, fontSize: 12 }}
        >
          Ko&apos;rish
        </Button>
      ),
    },
  ];

  const hasActiveFilter = !!debouncedSearch || !!statusFilter;
  const emptyText = loading ? (
    <Empty description="Yuklanmoqda..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : error ? (
    <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : hasActiveFilter ? (
    <Empty description="Filtrga mos topshiriq topilmadi" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : (
    <Empty description="Sizga topshiriq biriktirilmagan" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  );

  return (
    <div>
      <TopBar>
        <Input
          prefix={<SearchOutlined style={{ color: colors.textSecondary }} />}
          placeholder="Topshiriq qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 260, borderRadius: 8 }}
        />
        {!!search && (
          <ClearAllBtn onClick={() => setSearch('')}>
            <CloseOutlined /> Tozalash
          </ClearAllBtn>
        )}
        <Segmented
          value={view}
          onChange={(v) => setView(v as ViewMode)}
          style={{ marginLeft: 'auto' }}
          options={[
            { value: 'table', icon: <UnorderedListOutlined />, label: 'Jadval' },
            { value: 'board', icon: <AppstoreOutlined />, label: 'Doska' },
          ]}
        />
      </TopBar>

      {view === 'table' && (
        <TabRow>
          {statusTabs.map((tab) => (
            <TabChip key={tab.key} $active={statusFilter === tab.key} onClick={() => setStatusFilter(tab.key)}>
              {tab.label}
              <ChipCount $active={statusFilter === tab.key}>{tabCounts[tab.key] || 0}</ChipCount>
            </TabChip>
          ))}
        </TabRow>
      )}

      {view === 'board' ? (
        <TaskBoard
          fetcher={fetchMyTasksPage}
          filters={statsParams}
          detailBase={DETAIL_BASE}
          personField="createdBy"
        />
      ) : (
        <Table<Task>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          onChange={onTableChange}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: (t) => `Jami: ${t} ta topshiriq`,
          }}
          style={{ background: '#fff', borderRadius: 12, border: `1px solid ${colors.border}` }}
          locale={{ emptyText }}
        />
      )}
    </div>
  );
}
