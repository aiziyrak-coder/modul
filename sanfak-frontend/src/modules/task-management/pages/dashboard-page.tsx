import { useEffect, useState } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import styled from 'styled-components';
import { Col, Progress, Row } from 'antd';
import { Avatar, Button, Card } from '@/shared/ui';
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { usePermission, useSessionStore } from '@/app/session';
import {
  fetchMonitoring,
  fetchMonitoringMonthly,
  fetchMyTasksPage,
  fetchTasksPage,
} from '../api/task-management-api';
import { useTaskStats } from '../api/queries';
import { statuses } from '../lib/constants';
import { completionPercent } from '../lib/completion';
import { colors } from '../lib/theme';
import { statusByUz } from '../model/status-workflow';
import StatusBadge from '../components/status-badge';
import PriorityBadge from '../components/priority-badge';
import CreateTaskModal from '../components/create-task-modal';
import type { Task, TaskStatsScope } from '../model/types';

const StatsCard = styled(Card)`
  border-radius: 12px;
  border: 1px solid ${colors.border};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
  .ant-card-body {
    padding: 18px 20px;
  }
`;
const StatContent = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
`;
const StatIcon = styled.div<{ $bg: string; $color: string }>`
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: ${({ $bg }) => $bg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: ${({ $color }) => $color};
  flex-shrink: 0;
`;
const StatValue = styled.div`
  font-size: 26px;
  font-weight: 700;
  color: ${colors.textPrimary};
  line-height: 1;
`;
const StatLabel = styled.div`
  font-size: 12px;
  color: ${colors.textSecondary};
  margin-top: 4px;
`;
const StatChange = styled.div<{ $positive: boolean }>`
  font-size: 12px;
  color: ${({ $positive }) => ($positive ? colors.primary : colors.danger)};
  margin-top: 6px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 3px;
`;
const ChartCard = styled(Card)`
  border-radius: 12px;
  border: 1px solid ${colors.border};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  margin-top: 16px;
  .ant-card-head {
    border-bottom: 1px solid ${colors.border};
    font-size: 14px;
    font-weight: 600;
    color: ${colors.textPrimary};
    padding: 14px 20px;
    min-height: auto;
  }
  .ant-card-body {
    padding: 16px 20px;
  }
`;
const RecentItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 4px;
  &:hover {
    background: ${colors.bgGray};
  }
`;
const RecentTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.textPrimary};
  flex: 1;
  line-height: 1.4;
`;
const RecentMeta = styled.div`
  font-size: 12px;
  color: ${colors.textSecondary};
  margin-top: 2px;
`;
const WelcomeBanner = styled.div`
  background: linear-gradient(135deg, ${colors.sidebarBg} 0%, #1e3a5f 100%);
  border-radius: 14px;
  padding: 24px 28px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;
const WelcomeGreet = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
`;
const WelcomeName = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
`;
const WelcomeRole = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
`;
const TaskMiniCard = styled.div<{ $color?: string }>`
  background: #fff;
  border: 1px solid ${colors.border};
  border-left: 4px solid ${({ $color }) => $color || colors.primary};
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: box-shadow 0.15s;
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;



interface EmpStat {
  name: string;
  berilgan: number;
  bajarilgan: number;
  foiz: number;
}

function greetingText(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Xayrli tong' : hour < 17 ? 'Xayrli kun' : 'Xayrli kech';
}

function shortCode(task: Task): string {
  return task.code ? task.code.replace(/^T-/, '') : task.id.slice(-3);
}

export default function DashboardPage() {
  const can = usePermission();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const { statsCreated, statsAssigned } = useTaskStats();
  const isManager = can('task:export');

  if (!isManager) {
    return <AssigneeDashboard statsAssigned={statsAssigned} userName={user?.fullName ?? 'Foydalanuvchi'} navigate={navigate} />;
  }
  return (
    <ManagerDashboard
      statsCreated={statsCreated}
      userName={user?.fullName ?? 'Foydalanuvchi'}
      userRole={user?.roles?.[0]?.name ?? ''}
      navigate={navigate}
    />
  );
}

function ManagerDashboard({
  statsCreated,
  userName,
  userRole,
  navigate,
}: {
  statsCreated: TaskStatsScope;
  userName: string;
  userRole: string;
  navigate: NavigateFunction;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [empStats, setEmpStats] = useState<EmpStat[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<Array<Record<string, number | string>>>([]);

  useEffect(() => {
    let cancelled = false;
    fetchMonitoring({ page: 1, limit: 8, sort: 'total', order: 'desc' })
      .then((res) => {
        if (cancelled) return;
        setEmpStats(
          res.docs.map((r) => ({
            name: `${(r.lastName ?? '').split(' ')[0]} ${(r.firstName ?? '').charAt(0) || ''}.`.trim(),
            berilgan: r.total,
            bajarilgan: r.completed,
            foiz: r.rating,
          })),
        );
      })
      .catch(() => setEmpStats([]));
    fetchMonitoringMonthly({ year: new Date().getFullYear() })
      .then((rows) => !cancelled && setMonthlyStats(rows))
      .catch(() => !cancelled && setMonthlyStats([]));
    fetchTasksPage({ page: 1, limit: 5 })
      .then((res) => !cancelled && setRecentTasks(res.docs))
      .catch(() => !cancelled && setRecentTasks([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = statsCreated.total;
  const newCount = statsCreated.yangi;
  const review = statsCreated.tekshiruvda;
  const completed = statsCreated.bajarildi;
  const overdue = statsCreated.kechikdi;
  const notDone = statsCreated.bajarilmadi;
  const completionRate = completionPercent(completed, total);

  const statusData = statuses.map((s) => ({ name: s.label, value: statsCreated[s.value] || 0, color: s.color }));
  const pieData = statusData.filter((d) => d.value > 0);

  const stats = [
    { label: 'Jami topshiriqlar', value: total, icon: <UnorderedListOutlined />, iconBg: '#EFF8FF', iconColor: '#1677ff', change: `${newCount} ta yangi`, positive: true, status: '' },
    { label: 'Bajarildi', value: completed, icon: <CheckCircleOutlined />, iconBg: '#ECFDF5', iconColor: colors.primary, change: `${completionRate}% bajarilish`, positive: true, status: 'bajarildi' },
    { label: 'Tekshiruvda', value: review, icon: <SafetyCertificateOutlined />, iconBg: '#F9F0FF', iconColor: '#722ED1', change: 'Tasdiq kutilmoqda', positive: true, status: 'tekshiruvda' },
    { label: 'Kechikdi', value: overdue, icon: <ExclamationCircleOutlined />, iconBg: '#FFF2F0', iconColor: '#F04438', change: `${notDone} ta bajarilmadi`, positive: false, status: 'kechikdi' },
  ];

  return (
    <div>
      <WelcomeBanner>
        <div>
          <WelcomeGreet>{greetingText()}! 👋</WelcomeGreet>
          <WelcomeName>{userName}</WelcomeName>
          {userRole && <WelcomeRole>{userRole}</WelcomeRole>}
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => setCreateOpen(true)}
          style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8, flexShrink: 0 }}
        >
          Yangi topshiriq
        </Button>
      </WelcomeBanner>

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Row gutter={[12, 12]}>
        {stats.map((s) => (
          <Col xs={24} sm={12} lg={6} key={s.label}>
            <StatsCard onClick={() => navigate('/task-management/tasks', { state: { statusFilter: s.status } })}>
              <StatContent>
                <StatIcon $bg={s.iconBg} $color={s.iconColor}>
                  {s.icon}
                </StatIcon>
                <div>
                  <StatValue>{s.value}</StatValue>
                  <StatLabel>{s.label}</StatLabel>
                  <StatChange $positive={s.positive}>
                    <RiseOutlined /> {s.change}
                  </StatChange>
                </div>
              </StatContent>
            </StatsCard>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 0]}>
        <Col xs={24} lg={14}>
          <ChartCard title="Oylik topshiriqlar dinamikasi">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthlyStats} barSize={10} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: colors.textSecondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: colors.textSecondary }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="berilgan" name="Berilgan" fill="#1677ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bajarilgan" name="Bajarilgan" fill={colors.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="kechikdi" name="Kechikdi" fill="#F04438" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Col>

        <Col xs={24} lg={10}>
          <ChartCard title="Holat bo'yicha taqsimot">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 180, height: 200, flexShrink: 0 }}>
                <ResponsiveContainer width={180} height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {pieData.map((item, i) => (
                        <Cell key={i} fill={item.color} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginLeft: 60, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {statusData.map((item) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: colors.textSecondary, width: 86 }}>{item.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </Col>
      </Row>

      <Row gutter={[16, 0]}>
        <Col xs={24} lg={14}>
          <ChartCard title="Xodimlar ijro ko'rsatkichi">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={empStats} layout="vertical" barSize={10} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: colors.textSecondary }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: colors.textSecondary }} axisLine={false} tickLine={false} width={82} />
                <RTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 12 }} />
                <Bar dataKey="bajarilgan" name="Bajarilgan" fill={colors.primary} radius={[0, 4, 4, 0]} />
                <Bar dataKey="berilgan" name="Berilgan" fill="#E4E7EC" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Col>

        <Col xs={24} lg={10}>
          <ChartCard
            title="So'nggi topshiriqlar"
            extra={
              <Button type="link" size="small" onClick={() => navigate('/task-management/tasks')} style={{ color: colors.primary }}>
                Barchasi <ArrowRightOutlined />
              </Button>
            }
          >
            {recentTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: colors.textSecondary, fontSize: 13 }}>Topshiriq mavjud emas</div>
            ) : (
              recentTasks.map((task) => (
                <RecentItem key={task.id} onClick={() => navigate(`/task-management/tasks/${task.id}`)}>
                  <Avatar size={32} style={{ background: colors.primary, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {shortCode(task)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <RecentTitle style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</RecentTitle>
                    <RecentMeta>
                      {task.assignees.map((a) => a.name.split(' ')[0]).join(', ')} • {dayjs(task.deadline).format('DD-MMM')}
                    </RecentMeta>
                  </div>
                  <StatusBadge status={task.status} />
                </RecentItem>
              ))
            )}
          </ChartCard>
        </Col>
      </Row>
    </div>
  );
}

function AssigneeDashboard({
  statsAssigned,
  userName,
  navigate,
}: {
  statsAssigned: TaskStatsScope;
  userName: string;
  navigate: NavigateFunction;
}) {
  const [myList, setMyList] = useState<Task[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([]);
  const [urgentTotal, setUrgentTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMyTasksPage({ page: 1, limit: 5 })
      .then((res) => !cancelled && setMyList(res.docs))
      .catch(() => !cancelled && setMyList([]));

    const deadlineTo = dayjs().startOf('day').add(3, 'day').endOf('day').toISOString();
    Promise.all([
      fetchMyTasksPage({ page: 1, limit: 50, sort: 'deadline', order: 'asc', status: 'overdue' }),
      fetchMyTasksPage({
        page: 1,
        limit: 50,
        sort: 'deadline',
        order: 'asc',
        status: 'new,in_progress,under_review',
        deadlineTo,
      }),
    ])
      .then(([late, soon]) => {
        if (cancelled) return;
        setUrgentTasks([...late.docs, ...soon.docs]);
        setUrgentTotal((late.totalDocs ?? late.docs.length) + (soon.totalDocs ?? soon.docs.length));
      })
      .catch(() => {
        if (cancelled) return;
        setUrgentTasks([]);
        setUrgentTotal(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const total = statsAssigned.total;
  const completed = statsAssigned.bajarildi;
  const pending = statsAssigned.yangi + statsAssigned.jarayonda;
  const overdue = statsAssigned.kechikdi;
  const completionRate = completionPercent(completed, total);

  const recentTasks = myList;

  const cards = [
    { label: 'Jami topshiriqlar', value: total, iconBg: '#EFF8FF', iconColor: '#1677ff', icon: <UnorderedListOutlined />, status: '' },
    { label: 'Bajarildi', value: completed, iconBg: '#ECFDF5', iconColor: colors.primary, icon: <CheckCircleOutlined />, status: 'bajarildi' },
    { label: 'Jarayonda', value: statsAssigned.jarayonda, iconBg: '#FFFBE6', iconColor: '#FA8C16', icon: <ClockCircleOutlined />, status: 'jarayonda' },
    { label: 'Kechikdi', value: overdue, iconBg: '#FFF2F0', iconColor: '#F04438', icon: <ExclamationCircleOutlined />, status: 'kechikdi' },
  ];

  return (
    <div>
      <WelcomeBanner>
        <div>
          <WelcomeGreet>{greetingText()}! 👋</WelcomeGreet>
          <WelcomeName>{userName}</WelcomeName>
        </div>
      </WelcomeBanner>

      <Row gutter={[12, 12]}>
        {cards.map((s) => (
          <Col xs={12} lg={6} key={s.label}>
            <StatsCard onClick={() => navigate('/task-management/my-tasks', { state: { statusFilter: s.status } })}>
              <StatContent>
                <StatIcon $bg={s.iconBg} $color={s.iconColor}>
                  {s.icon}
                </StatIcon>
                <div>
                  <StatValue>{s.value}</StatValue>
                  <StatLabel>{s.label}</StatLabel>
                </div>
              </StatContent>
            </StatsCard>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 0]}>
        <Col xs={24} lg={14}>
          <ChartCard title="Bajarilish ko'rsatkichi">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress
                type="dashboard"
                percent={completionRate}
                strokeColor={completionRate >= 80 ? colors.primary : completionRate >= 50 ? '#FA8C16' : '#F04438'}
                strokeWidth={8}
                size={160}
                format={(p) => (
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>{p}%</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>Bajarildi</div>
                  </div>
                )}
              />
              <Row gutter={8} style={{ marginTop: 20 }}>
                {[
                  { label: 'Bajarildi', value: completed, color: colors.primary },
                  { label: 'Kutilmoqda', value: pending, color: '#FA8C16' },
                  { label: 'Kechikdi', value: overdue, color: '#F04438' },
                ].map((s) => (
                  <Col span={8} key={s.label}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.label}</div>
                  </Col>
                ))}
              </Row>
            </div>
          </ChartCard>

          {urgentTasks.length > 0 && (
            <ChartCard title={`⚠️ Shoshilinch topshiriqlar (${urgentTotal})`}>
              {urgentTasks.map((task) => {
                const daysLeft = dayjs(task.deadline).startOf('day').diff(dayjs().startOf('day'), 'day');
                const isOverdue = daysLeft < 0;
                return (
                  <TaskMiniCard key={task.id} $color={isOverdue ? '#F04438' : '#FA8C16'} onClick={() => navigate(`/task-management/my-tasks/${task.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, flex: 1, marginRight: 8 }}>{task.title}</div>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <div style={{ fontSize: 12, color: isOverdue ? '#F04438' : '#FA8C16', marginTop: 6, fontWeight: 600 }}>
                      {isOverdue
                        ? `${Math.abs(daysLeft)} kun kechikdi!`
                        : daysLeft === 0
                          ? 'Bugun tugaydi'
                          : `${daysLeft} kun qoldi`}
                      {' • '}
                      {task.createdBy.name}
                    </div>
                  </TaskMiniCard>
                );
              })}
              {urgentTotal > urgentTasks.length && (
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
                  Ko'rsatildi: {urgentTasks.length} / {urgentTotal}
                </div>
              )}
            </ChartCard>
          )}
        </Col>

        <Col xs={24} lg={10}>
          <ChartCard
            title="Kiruvchi topshiriqlar"
            extra={
              <Button type="link" size="small" onClick={() => navigate('/task-management/my-tasks')} style={{ color: colors.primary }}>
                Barchasi <ArrowRightOutlined />
              </Button>
            }
          >
            {recentTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: colors.textSecondary, fontSize: 13 }}>Topshiriq mavjud emas</div>
            ) : (
              recentTasks.map((task) => (
                <RecentItem key={task.id} onClick={() => navigate(`/task-management/my-tasks/${task.id}`)}>
                  <Avatar size={30} style={{ background: statusByUz(task.status).color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {shortCode(task)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <RecentTitle style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>{task.title}</RecentTitle>
                    <RecentMeta>
                      {task.createdBy.name} • {dayjs(task.deadline).format('DD.MM.YYYY')}
                    </RecentMeta>
                  </div>
                  <StatusBadge status={task.status} />
                </RecentItem>
              ))
            )}
          </ChartCard>
        </Col>
      </Row>
    </div>
  );
}
