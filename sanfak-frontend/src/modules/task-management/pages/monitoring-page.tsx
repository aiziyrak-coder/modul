import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Col, Progress, Row } from 'antd';
import { App, Avatar, Button, Card, Drawer, Empty, Input, Select, Table, Tag, Tooltip } from '@/shared/ui';
import type { TableProps } from '@/shared/ui';
import {
  CalendarOutlined,
  CloseOutlined,
  FileExcelOutlined,
  MessageOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Can } from '@/app/session';
import { downloadMonitoringXlsx, fetchMonitoring, fetchTasksPage } from '../api/task-management-api';
import { nameOf } from '../api/user-name';
import { useServerTable } from '../lib/use-server-table';
import { months } from '../lib/constants';
import { colors } from '../lib/theme';
import StatusBadge from '../components/status-badge';
import type { EmployeeStat, MonitoringRow, Task } from '../model/types';

const SummaryCard = styled(Card)`
  border-radius: 12px;
  border: 1px solid ${colors.border};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  .ant-card-body {
    padding: 20px;
  }
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
const WorkloadDot = styled.div<{ $level: 'high' | 'mid' | 'low' }>`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${({ $level }) => ($level === 'high' ? '#F04438' : $level === 'mid' ? '#FA8C16' : colors.primary)};
  flex-shrink: 0;
`;

const getWorkloadLevel = (active: number): 'high' | 'mid' | 'low' => (active >= 5 ? 'high' : active >= 3 ? 'mid' : 'low');
const workloadLabel: Record<string, string> = { high: 'Yuklanish yuqori', mid: "O'rtacha", low: "Bo'sh" };
const workloadColor: Record<string, string> = { high: '#F04438', mid: '#FA8C16', low: colors.primary };

const SORT_MAP: Record<string, string> = { total: 'total', active: 'active', done: 'completed', late: 'overdue', rate: 'rating', name: 'name' };

export default function MonitoringPage() {
  const { message } = App.useApp();
  const { rows, total, page, limit, sort, loading, setPage, setLimit, setFilter, setSort } =
    useServerTable<MonitoringRow>(fetchMonitoring, { initialLimit: 12 });

  const [empSearch, setEmpSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [empDrawer, setEmpDrawer] = useState<EmployeeStat | null>(null);
  const [empDrawerTasks, setEmpDrawerTasks] = useState<Task[]>([]);
  const [empDrawerTotal, setEmpDrawerTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);

  const currentYear = dayjs().year();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  const hasReportFilter = filterMonth != null || filterYear != null;
  const hasEmpFilter = !!empSearch;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(empSearch), 350);
    return () => clearTimeout(t);
  }, [empSearch]);

  const periodParams = useMemo(() => {
    const p: { from?: string; to?: string } = {};
    const y = filterYear != null ? filterYear : filterMonth != null ? currentYear : null;
    let from: dayjs.Dayjs | undefined;
    let to: dayjs.Dayjs | undefined;
    if (y != null && filterMonth != null) {
      from = dayjs(new Date(y, filterMonth, 1)).startOf('day');
      to = dayjs(new Date(y, filterMonth + 1, 0)).endOf('day');
    } else if (y != null) {
      from = dayjs(new Date(y, 0, 1)).startOf('day');
      to = dayjs(new Date(y, 11, 31)).endOf('day');
    }
    if (from?.isValid()) p.from = from.toISOString();
    if (to?.isValid()) p.to = to.toISOString();
    return p;
  }, [filterMonth, filterYear, currentYear]);

  useEffect(() => {
    setFilter({ search: debouncedSearch, from: periodParams.from, to: periodParams.to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, periodParams]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadMonitoringXlsx(periodParams);
      message.success('Hisobot .xlsx formatda yuklab olindi');
    } catch {
      message.error('Yuklab olishda xatolik');
    } finally {
      setExporting(false);
    }
  };
  const handleExportEmployee = async (emp: EmployeeStat) => {
    try {
      await downloadMonitoringXlsx({ ...periodParams, assignee: emp.id });
      message.success(`${emp.name} hisoboti .xlsx formatda yuklab olindi`);
    } catch {
      message.error('Yuklab olishda xatolik');
    }
  };

  const employeeStats: EmployeeStat[] = rows.map((r) => ({
    id: String(r.assigneeId),
    name: nameOf(r) ?? '—',
    position: r.position ?? '',
    department: r.department ?? '',
    total: r.total,
    done: r.completed,
    active: r.active,
    late: r.overdue,
    rate: r.rating,
  }));

  const onTableChange: TableProps<EmployeeStat>['onChange'] = (pag, _f, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const fieldKey = (s?.columnKey ?? s?.field) as string | undefined;
    const field = fieldKey ? SORT_MAP[fieldKey] : undefined;
    const order = s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : null;
    const nextField = order && field ? field : null;
    const changed = (sort?.field ?? null) !== nextField || (sort?.order ?? null) !== order;
    if (changed) setSort(nextField, order);
    else {
      setPage(pag.current ?? 1);
      setLimit(pag.pageSize ?? limit);
    }
  };

  useEffect(() => {
    if (!empDrawer) {
      setEmpDrawerTasks([]);
      setEmpDrawerTotal(0);
      return;
    }
    let cancelled = false;
    fetchTasksPage({
      page: 1,
      limit: 100,
      assignee: empDrawer.id,
      createdFrom: periodParams.from,
      createdTo: periodParams.to,
    })
      .then((res) => {
        if (cancelled) return;
        setEmpDrawerTasks(res.docs);
        setEmpDrawerTotal(res.totalDocs ?? res.docs.length);
      })
      .catch(() => {
        if (cancelled) return;
        setEmpDrawerTasks([]);
        setEmpDrawerTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [empDrawer, periodParams]);

  const empColumns: TableProps<EmployeeStat>['columns'] = [
    {
      title: 'Xodim',
      key: 'name',
      render: (_, rec) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={34} style={{ background: colors.primary, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {rec.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, lineHeight: 1.3 }}>{rec.name}</div>
            {rec.position && <div style={{ fontSize: 12, color: colors.textSecondary }}>{rec.position}</div>}
          </div>
        </div>
      ),
    },
    {
      title: "Bo'lim",
      dataIndex: 'department',
      key: 'department',
      width: 190,
      render: (v: string) =>
        v ? (
          <span style={{ fontSize: 12, color: colors.textPrimary }}>{v}</span>
        ) : (
          <span style={{ fontSize: 12, color: colors.textSecondary }}>—</span>
        ),
    },
    { title: 'Jami', dataIndex: 'total', key: 'total', width: 60, align: 'center', render: (v: number) => <span style={{ fontWeight: 700, color: '#1677ff' }}>{v}</span>, sorter: true },
    {
      title: 'Faol',
      dataIndex: 'active',
      key: 'active',
      width: 60,
      align: 'center',
      render: (v: number) => {
        const level = getWorkloadLevel(v);
        return (
          <Tooltip title={workloadLabel[level]}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <WorkloadDot $level={level} />
              <span style={{ fontWeight: 600, color: workloadColor[level] }}>{v}</span>
            </div>
          </Tooltip>
        );
      },
      sorter: true,
    },
    { title: 'Bajarildi', dataIndex: 'done', key: 'done', width: 80, align: 'center', render: (v: number) => <span style={{ fontWeight: 600, color: colors.primary }}>{v}</span>, sorter: true },
    {
      title: 'Kechikdi',
      dataIndex: 'late',
      key: 'late',
      width: 80,
      align: 'center',
      render: (v: number) =>
        v > 0 ? (
          <Tag color="error" style={{ borderRadius: 4, fontSize: 12 }}>
            <WarningOutlined style={{ marginRight: 2 }} />
            {v}
          </Tag>
        ) : (
          <span style={{ color: colors.textSecondary, fontSize: 12 }}>—</span>
        ),
      sorter: true,
    },
    {
      title: 'Reyting',
      dataIndex: 'rate',
      key: 'rate',
      width: 160,
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={v} size="small" showInfo={false} strokeColor={v >= 80 ? colors.primary : v >= 50 ? '#FA8C16' : '#F04438'} style={{ flex: 1, minWidth: 80 }} />
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 34, color: v >= 80 ? colors.primary : v >= 50 ? '#FA8C16' : '#F04438' }}>{v}%</span>
        </div>
      ),
      sorter: true,
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div>
      <SummaryCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: colors.textSecondary }} />}
            placeholder="Xodim qidirish..."
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: 8, height: 40 }}
          />
          <Select placeholder="Oy" value={filterMonth} onChange={(v) => setFilterMonth(v ?? null)} allowClear style={{ width: 120, height: 40 }} options={months.map((m, i) => ({ value: i, label: m }))} />
          <Select placeholder="Yil" value={filterYear} onChange={(v) => setFilterYear(v ?? null)} allowClear style={{ width: 95, height: 40 }} options={years.map((y) => ({ value: y, label: `${y}` }))} />
          {(hasEmpFilter || hasReportFilter) && (
            <ClearAllBtn
              onClick={() => {
                setEmpSearch('');
                setFilterMonth(null);
                setFilterYear(null);
              }}
            >
              <CloseOutlined /> Tozalash
            </ClearAllBtn>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <Can perform="task:export">
              <Button type="primary" icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport} style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8, height: 40 }}>
                .xlsx yuklab olish
              </Button>
            </Can>
            {[
              { level: 'low' as const, label: "Bo'sh (0–2)" },
              { level: 'mid' as const, label: "O'rtacha (3–4)" },
              { level: 'high' as const, label: 'Yuqori (5+)' },
            ].map((l) => (
              <div key={l.level} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: colors.textSecondary }}>
                <WorkloadDot $level={l.level} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        <Table<EmployeeStat>
          columns={empColumns}
          dataSource={employeeStats}
          rowKey="id"
          size="small"
          loading={loading}
          onChange={onTableChange}
          onRow={(rec) => ({ onClick: () => setEmpDrawer(rec), style: { cursor: 'pointer' } })}
          pagination={{ current: page, pageSize: limit, total, showSizeChanger: false, showTotal: (t) => `Jami: ${t} ta xodim` }}
          locale={{ emptyText: <Empty description="Xodim topilmadi" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${colors.border}` }}
        />
      </SummaryCard>

      <Drawer
        title={
          empDrawer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={40} style={{ background: colors.primary, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                {empDrawer.name.charAt(0)}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, whiteSpace: 'normal' }}>{empDrawer.name}</div>
                {(empDrawer.position || empDrawer.department) && (
                  <div style={{ fontSize: 12, fontWeight: 400, color: colors.textSecondary }}>
                    {[empDrawer.position, empDrawer.department].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          )
        }
        extra={
          empDrawer && (
            <Can perform="task:export">
              <Button type="primary" icon={<FileExcelOutlined />} onClick={() => handleExportEmployee(empDrawer)} style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8 }}>
                Yuklab olish
              </Button>
            </Can>
          )
        }
        open={!!empDrawer}
        onClose={() => setEmpDrawer(null)}
        width={520}
        styles={{ body: { padding: 20, background: colors.bgGray } }}
      >
        {empDrawer && (
          <>
            <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
              {[
                { label: 'Jami', value: empDrawer.total, color: '#1677ff' },
                { label: 'Faol', value: empDrawer.active, color: '#FA8C16' },
                { label: 'Bajarildi', value: empDrawer.done, color: colors.primary },
                { label: 'Kechikdi', value: empDrawer.late, color: '#F04438' },
              ].map((s) => (
                <Col span={6} key={s.label}>
                  <div style={{ background: '#fff', border: `1px solid ${s.color}30`, borderTop: `3px solid ${s.color}`, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.label}</div>
                  </div>
                </Col>
              ))}
            </Row>

            <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: colors.textSecondary, fontWeight: 500 }}>Bajarilish reytingi</span>
                <span style={{ fontWeight: 700, color: empDrawer.rate >= 80 ? colors.primary : empDrawer.rate >= 50 ? '#FA8C16' : '#F04438' }}>{empDrawer.rate}%</span>
              </div>
              <Progress percent={empDrawer.rate} showInfo={false} strokeColor={empDrawer.rate >= 80 ? colors.primary : empDrawer.rate >= 50 ? '#FA8C16' : '#F04438'} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Tag color={getWorkloadLevel(empDrawer.active) === 'high' ? 'error' : getWorkloadLevel(empDrawer.active) === 'mid' ? 'warning' : 'success'} style={{ borderRadius: 6 }}>
                  <ThunderboltOutlined style={{ marginRight: 4 }} />
                  {workloadLabel[getWorkloadLevel(empDrawer.active)]}
                </Tag>
                {empDrawer.late > 0 && (
                  <Tag color="error" style={{ borderRadius: 6 }}>
                    <WarningOutlined style={{ marginRight: 4 }} />
                    {empDrawer.late} ta kechikdi
                  </Tag>
                )}
              </div>
            </div>

            {empDrawerTasks.length === 0 && <Empty description="Topshiriq yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {empDrawerTasks.map((task) => {
              const isOverdue = dayjs(task.deadline).isBefore(dayjs(), 'day') && task.status !== 'bajarildi';
              return (
                <div
                  key={task.id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${isOverdue ? '#FFCCC7' : colors.border}`,
                    borderLeft: `4px solid ${isOverdue ? '#F04438' : task.status === 'bajarildi' ? colors.primary : '#FA8C16'}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div>
                      <Tag style={{ fontSize: 12, borderRadius: 4, marginBottom: 4 }}>{task.code || task.id}</Tag>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>{task.title}</div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: isOverdue ? '#F04438' : colors.textSecondary }}>
                    <span>
                      <CalendarOutlined style={{ marginRight: 3 }} />
                      {dayjs(task.deadline).format('DD.MM.YYYY')}
                      {isOverdue ? ' ⚠ Kechikdi' : ''}
                    </span>
                    <span style={{ color: colors.textSecondary }}>
                      <MessageOutlined style={{ marginRight: 3 }} />
                      {task.responseCount} javob
                    </span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Progress
                      percent={task.assignees.length ? Math.round((task.completedBy.length / task.assignees.length) * 100) : 0}
                      size="small"
                      showInfo={false}
                      strokeColor={task.status === 'bajarildi' ? colors.primary : '#FA8C16'}
                    />
                  </div>
                </div>
              );
            })}
            {empDrawerTotal > empDrawerTasks.length && (
              <div style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                Ko'rsatildi: {empDrawerTasks.length} / {empDrawerTotal}
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
