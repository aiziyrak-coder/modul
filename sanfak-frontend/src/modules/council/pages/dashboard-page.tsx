import { useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  AuditOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  InfoCircleOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Col, Flex, Row, Typography, theme } from 'antd';
import { PageContainer } from '@/shared/ui';
import { appConfig } from '@/shared/config';
import { usePermission } from '@/app/session';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { DonutChart } from '../components/donut-chart';
import { BarChart } from '../components/bar-chart';
import { RadialChart } from '../components/radial-chart';
import type { CouncilRole, RankStatus, TaskStatus, VotingStatus } from '../model/types';
import { TASK_STATUS_ORDER, taskStatusMeta, votingStatusMeta } from '../model/status';
import { ROLE_LABELS, useCouncilRole } from '../model/role';
import {
  useMembers,
  useRankApps,
  useRankTabsCount,
  useTaskTabsCount,
  useTasks,
  useVotingSessions,
  useVotingTabsCount,
} from '../api/council-api';

const { Title, Text } = Typography;

const ROLE_HINT: Record<CouncilRole, string> = {
  ilmiy_kengash_kotibi:
    "Kengash a'zolarini boshqaring, topshiriqlar bering, unvon arizalarini qabul qiling va so'rovnomalarni tashkil eting.",
  ilmiy_kengash_azosi:
    "Sizga tegishli topshiriqlarni bajaring va faol so'rovnomalarda ovoz bering.",
  oqituvchi:
    "Unvon (dotsent/professor) uchun ariza topshiring va topshiriqlaringiz holatini kuzating.",
  rektor:
    "Kengash faoliyatini kuzating: topshiriqlar, unvon arizalari va so'rovnomalar bo'yicha umumiy ko'rinish.",
};

interface CardDef {
  icon: ReactNode;
  value: number;
  label: string;
  accent: string;
  sub?: ReactNode;
}

const PANEL: CSSProperties = {
  background: 'var(--color-bg-elevate, #fff)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg, 14px)',
  boxShadow: 'var(--shadow-sm)',
  padding: 'var(--space-5, 22px)',
  height: '100%',
};

export default function DashboardPage() {
  const role = useCouncilRole();
  const isKotib = role === 'ilmiy_kengash_kotibi';
  const primary = appConfig.ui.primaryColor;
  const { token } = theme.useToken();

  const can = usePermission();
  const canMembers = can('councilMember:readAll');
  const canTasks = can('councilTask:readAll');
  const canRank = can('rankApplication:readAll');
  const canVoting = can('votingSession:readAll');

  const members = useMembers({});
  const tasks = useTasks({});
  const rankApps = useRankApps({});
  const votingSessions = useVotingSessions({});
  const taskTabs = useTaskTabsCount();
  const rankTabs = useRankTabsCount();
  const votingTabs = useVotingTabsCount();

  const statusColor = useMemo<Record<TaskStatus, string>>(
    () => ({
      new: token.blue6,
      in_progress: token.orange6,
      done: token.cyan6,
      approved: token.colorSuccess,
      rejected: token.colorError,
      overdue: token.red7,
    }),
    [token],
  );

  const taskList = useMemo(() => tasks.data ?? [], [tasks.data]);

  const taskCounts = useMemo(() => {
    const tabs = taskTabs.data ?? {};
    const byList = (s: TaskStatus) => taskList.filter((t) => t.status === s).length;
    const result = {} as Record<TaskStatus, number>;
    TASK_STATUS_ORDER.forEach((s) => {
      result[s] = typeof tabs[s] === 'number' ? tabs[s] : byList(s);
    });
    return result;
  }, [taskTabs.data, taskList]);

  const rankCounts = useMemo(() => {
    const tabs = rankTabs.data ?? {};
    const list = rankApps.data ?? [];
    const byList = (s: RankStatus) => list.filter((r) => r.status === s).length;
    const pick = (s: RankStatus) => (typeof tabs[s] === 'number' ? tabs[s] : byList(s));
    return { new: pick('new'), accepted: pick('accepted'), returned: pick('returned') };
  }, [rankTabs.data, rankApps.data]);

  const votingCounts = useMemo(() => {
    const tabs = votingTabs.data ?? {};
    const list = votingSessions.data ?? [];
    const byList = (s: VotingStatus) => list.filter((v) => v.status === s).length;
    const pick = (s: VotingStatus) => (typeof tabs[s] === 'number' ? tabs[s] : byList(s));
    return { active: pick('active'), approved: pick('approved'), rejected: pick('rejected') };
  }, [votingTabs.data, votingSessions.data]);

  const memberByDept = useMemo(() => {
    const map = new Map<string, number>();
    (members.data ?? []).forEach((m) => {
      const key = m.department?.title ?? 'Kafedrasiz';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [members.data]);

  const memberCount = members.data?.length ?? 0;
  const voteEligible = (members.data ?? []).filter((m) => m.canVote).length;
  const taskTotal = TASK_STATUS_ORDER.reduce((acc, s) => acc + taskCounts[s], 0);
  const openTasks = taskCounts.new + taskCounts.in_progress;
  const rankTotal = rankCounts.new + rankCounts.accepted + rankCounts.returned;
  const activeVotings = votingCounts.active;

  const cards: CardDef[] = [];
  if (isKotib) {
    if (canMembers)
      cards.push({
        icon: <TeamOutlined />,
        value: memberCount,
        label: "Kengash a'zolari",
        accent: primary,
        sub: `Ovoz huquqli: ${voteEligible}`,
      });
    if (canTasks)
      cards.push({
        icon: <FileDoneOutlined />,
        value: taskTotal,
        label: 'Topshiriqlar',
        accent: token.blue6,
        sub: `Jarayonda: ${openTasks}`,
      });
    if (canRank)
      cards.push({
        icon: <AuditOutlined />,
        value: rankTotal,
        label: 'Unvon arizalari',
        accent: token.orange6,
        sub: `Yangi: ${rankCounts.new}`,
      });
    if (canVoting)
      cards.push({
        icon: <SolutionOutlined />,
        value: activeVotings,
        label: "Faol so'rovnomalar",
        accent: token.cyan6,
        sub: `Tasdiqlangan: ${votingCounts.approved}`,
      });
  } else {
    if (canTasks) {
      cards.push({
        icon: <FileDoneOutlined />,
        value: taskTotal,
        label: 'Topshiriqlar',
        accent: primary,
        sub: `Jarayonda: ${openTasks}`,
      });
      cards.push({
        icon: <CheckCircleOutlined />,
        value: taskCounts.approved,
        label: 'Tasdiqlangan topshiriqlar',
        accent: token.colorSuccess,
      });
    }
    if (canRank)
      cards.push({
        icon: <AuditOutlined />,
        value: rankTotal,
        label: 'Unvon arizalari',
        accent: token.orange6,
        sub: `Yangi: ${rankCounts.new}`,
      });
    if (canVoting)
      cards.push({
        icon: <SolutionOutlined />,
        value: activeVotings,
        label: "Faol so'rovnomalar",
        accent: token.cyan6,
        sub: `Tasdiqlangan: ${votingCounts.approved}`,
      });
  }

  const deptPalette = [
    token.blue6,
    token.cyan6,
    token.purple6,
    token.gold6,
    token.green6,
    token.magenta6,
    token.geekblue6,
    token.volcano6,
  ];

  return (
    <PageContainer title="Bosh sahifa">
      <PageHeader
        title={`Ilmiy kengash — ${ROLE_LABELS[role]}`}
        subtitle={`${ROLE_LABELS[role]} — umumiy ko'rinish`}
      />

      {cards.length > 0 && (
        <Flex gap={16} wrap style={{ marginBottom: 18 }}>
          {cards.map((c) => (
            <StatCard key={c.label} icon={c.icon} value={c.value} label={c.label} accent={c.accent} sub={c.sub} />
          ))}
        </Flex>
      )}

      <Row gutter={[16, 16]}>
        {canTasks && (
          <Col xs={24} lg={12}>
            <div style={PANEL}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 18 }}>
                Topshiriqlar status kesimi
              </Title>
              <DonutChart
                centerCaption="Jami topshiriq"
                data={TASK_STATUS_ORDER.map((s) => ({
                  label: taskStatusMeta(s).label,
                  value: taskCounts[s],
                  color: statusColor[s],
                }))}
              />
            </div>
          </Col>
        )}

        {canRank && (
          <Col xs={24} lg={12}>
            <div style={PANEL}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 18 }}>
                Unvon arizalari holati
              </Title>
              <BarChart
                data={[
                  { label: 'Yangi', value: rankCounts.new, color: token.blue6 },
                  { label: 'Qabul', value: rankCounts.accepted, color: token.colorSuccess },
                  { label: 'Qaytarildi', value: rankCounts.returned, color: token.colorError },
                ]}
              />
            </div>
          </Col>
        )}

        {canVoting && (
          <Col xs={24} lg={12}>
            <div style={PANEL}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 18 }}>
                Ovoz berish (so'rovnomalar)
              </Title>
              <RadialChart
                data={[
                  { label: votingStatusMeta('active').label, value: votingCounts.active, color: token.blue6 },
                  { label: votingStatusMeta('approved').label, value: votingCounts.approved, color: token.colorSuccess },
                  { label: votingStatusMeta('rejected').label, value: votingCounts.rejected, color: token.colorError },
                ]}
              />
            </div>
          </Col>
        )}

        {canMembers && (
          <Col xs={24} lg={12}>
            <div style={PANEL}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 18 }}>
                A'zolar — kafedra kesimi
              </Title>
              <BarChart
                emptyText="A'zolar yo'q"
                data={memberByDept.map((d, i) => ({
                  ...d,
                  color: deptPalette[i % deptPalette.length] ?? token.blue6,
                }))}
              />
            </div>
          </Col>
        )}
      </Row>

      <Flex
        gap={14}
        align="flex-start"
        style={{
          marginTop: 18,
          padding: '18px 20px',
          background: `${primary}14`,
          border: `1px solid ${primary}33`,
          borderRadius: 'var(--radius-lg, 14px)',
        }}
      >
        <InfoCircleOutlined style={{ color: primary, fontSize: 20, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
            Faol rol: {ROLE_LABELS[role]}
          </div>
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            {ROLE_HINT[role]}
          </Text>
        </div>
      </Flex>
    </PageContainer>
  );
}
