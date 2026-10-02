import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Empty, Spin, Tooltip } from 'antd';
import {
  BankOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ContainerOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageContainer, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePermission, useSessionStore } from '@/app/session';
import { useDashboardStats, type DashboardStats } from '../api/dashboard-api';
import { useSciRole } from '../model/role-status';
import StatusBadge from '../components/status-badge';
import type { Article } from '../model/types';

type StatCard = {
  key: string;
  labelKey: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  soft: string;
  path?: string;
};

const TONE = {
  primary: { color: 'var(--brand-primary)', soft: 'var(--brand-primary-soft)' },
  warning: {
    color: 'var(--brand-warning)',
    soft: 'color-mix(in srgb, var(--brand-warning) 14%, #fff)',
  },
  error: {
    color: 'var(--brand-error)',
    soft: 'color-mix(in srgb, var(--brand-error) 12%, #fff)',
  },
  info: {
    color: 'var(--brand-info)',
    soft: 'color-mix(in srgb, var(--brand-info) 12%, #fff)',
  },
} as const;

const CARD_PERMISSION: Record<string, string> = {
  articles: 'article:readAll',
  theses: 'thesis:readAll',
  methodical: 'methodicalRecommendation:readAll',
  monographs: 'monograph:readAll',
  'work-plans': 'departmentWorkPlan:readAll',
  'annual-reports': 'annualReport:readAll',
};

const roleKeyOf = (backendRole: string | null | undefined, fallback: string): string => {
  switch (backendRole) {
    case 'oqituvchi':
      return 'teacher';
    case 'ilmiy_bolim':
      return 'ilmiy';
    case 'ilmiy_kengash_kotibi':
      return 'kotib';
    case 'rektor':
      return 'rektor';
    case 'prorektor':
      return 'prorektor';
    case 'kafedra_mudiri':
      return 'kafedra';
    case 'dekan':
      return 'dekan';
    case 'admin':
    case 'super_admin':
      return 'admin';
    default:
      return fallback;
  }
};

const sumField = (
  stats: DashboardStats,
  field: 'total' | 'pending' | 'approved' | 'rejected',
): number =>
  stats.article[field] + stats.thesis[field] + stats.methodical[field] + stats.monograph[field];

export default function ScientificDepartmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useSciRole();
  const user = useSessionStore((s) => s.user);
  const can = usePermission();

  const { data: stats, isLoading } = useDashboardStats();
  const recentArticles = stats?.recentArticles ?? [];

  const roleKey = roleKeyOf(stats?.role, role);

  const cards: StatCard[] = useMemo(() => {
    if (!stats) return [];
    const p = (path: string): string | undefined => {
      const need = CARD_PERMISSION[path];
      return need && can(need) ? `/scientific-department/${path}` : undefined;
    };
    const mk = (
      key: string,
      labelKey: string,
      value: number,
      icon: React.ReactNode,
      tone: keyof typeof TONE,
      path?: string,
    ): StatCard => ({
      key,
      labelKey: `scientificDepartment.${labelKey}`,
      value,
      icon,
      path,
      ...TONE[tone],
    });

    const cArticles = mk(
      'articles',
      'nav.articles',
      stats.article.total,
      <FileTextOutlined />,
      'primary',
      p('articles'),
    );
    const cTheses = mk(
      'theses',
      'nav.theses',
      stats.thesis.total,
      <ContainerOutlined />,
      'primary',
      p('theses'),
    );
    const cMethodical = mk(
      'methodical',
      'nav.methodical',
      stats.methodical.total,
      <ToolOutlined />,
      'primary',
      p('methodical'),
    );
    const cMonographs = mk(
      'monographs',
      'nav.monographs',
      stats.monograph.total,
      <BankOutlined />,
      'primary',
      p('monographs'),
    );
    const cWorkPlans = mk(
      'workPlans',
      'nav.workPlans',
      stats.workPlan.total,
      <ScheduleOutlined />,
      'primary',
      p('work-plans'),
    );
    const cAnnualReports = mk(
      'annualReports',
      'nav.annualReports',
      stats.annualReport.total,
      <FileDoneOutlined />,
      'primary',
      p('annual-reports'),
    );
    const cSignPending = mk(
      'signaturePending',
      'dashboard.card.signaturePending',
      stats.signaturePending,
      <SafetyCertificateOutlined />,
      'warning',
      p('methodical'),
    );
    const cMethApproved = mk(
      'methodicalApproved',
      'dashboard.card.methodicalApproved',
      stats.methodical.approved,
      <CheckCircleOutlined />,
      'primary',
      p('methodical'),
    );
    const cMethodicalSign = mk(
      'methodicalSignPending',
      'dashboard.card.methodicalSignPending',
      stats.methodicalSignPending,
      <SafetyCertificateOutlined />,
      'warning',
      p('methodical'),
    );
    const cMonographSign = mk(
      'monographSignPending',
      'dashboard.card.monographSignPending',
      stats.monographSignPending,
      <SafetyCertificateOutlined />,
      'warning',
      p('monographs'),
    );
    const cReports = mk(
      'reports',
      'nav.reports',
      stats.reportTotal,
      <BarChartOutlined />,
      'info',
      p('reports'),
    );

    const statusCards: StatCard[] = [
      mk(
        'total',
        'dashboard.stat.total',
        sumField(stats, 'total'),
        <ExperimentOutlined />,
        'primary',
      ),
      mk(
        'pending',
        'dashboard.stat.pending',
        sumField(stats, 'pending'),
        <ClockCircleOutlined />,
        'warning',
      ),
      mk(
        'approved',
        'dashboard.stat.approved',
        sumField(stats, 'approved'),
        <CheckCircleOutlined />,
        'primary',
      ),
      mk(
        'rejected',
        'dashboard.stat.rejected',
        sumField(stats, 'rejected'),
        <CloseCircleOutlined />,
        'error',
      ),
    ];
    const typeCards: StatCard[] = [cArticles, cTheses, cMethodical, cMonographs];

    switch (stats.role) {
      case 'oqituvchi':
        return typeCards;
      case 'kafedra_mudiri':
        return [cArticles, cTheses, cWorkPlans, cAnnualReports];
      case 'dekan':
        return [
          cWorkPlans,
          cAnnualReports,
          mk(
            'approvalPending',
            'dashboard.card.approvalPending',
            stats.approvalPending,
            <ClockCircleOutlined />,
            'warning',
            p('work-plans'),
          ),
          cArticles,
        ];
      case 'rektor':
        return [cSignPending, cMethApproved, cMonographs, cReports];
      case 'ilmiy_kengash_kotibi':
        return [
          cMethodicalSign,
          cMonographSign,
          cMethApproved,
          mk(
            'methodicalRejected',
            'dashboard.card.methodicalRejected',
            stats.methodical.rejected,
            <CloseCircleOutlined />,
            'error',
            p('methodical'),
          ),
        ];
      case 'ilmiy_bolim':
      case 'prorektor':
      case 'admin':
      case 'super_admin':
        return [...statusCards, ...typeCards];
      default:
        return statusCards;
    }
  }, [stats, can]);

  const recentColumns: ColumnsType<Article> = [
    {
      title: t('scientificDepartment.articles.colAuthorTitle'),
      dataIndex: 'title',
      render: (_v, r) => (
        <a onClick={() => navigate(`/scientific-department/articles/${r.id}`)}>
          {r.title || t('scientificDepartment.articles.noTitle')}
        </a>
      ),
    },
    {
      title: t('scientificDepartment.articles.colJournal'),
      dataIndex: 'journalName',
      width: 200,
    },
    {
      title: t('scientificDepartment.articles.colFaculty'),
      dataIndex: 'facultyName',
      width: 150,
      render: (v: string | null) => v || '—',
    },
    {
      title: t('scientificDepartment.articles.colStatus'),
      dataIndex: 'status',
      width: 150,
      render: (_v, r) => <StatusBadge status={r.status} />,
    },
    {
      title: t('scientificDepartment.articles.colDate'),
      dataIndex: 'date',
      width: 130,
    },
    {
      title: t('scientificDepartment.actions'),
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_v, r) => (
        <Tooltip title={t('scientificDepartment.view')}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined style={{ fontSize: 17, color: 'var(--brand-primary)' }} />}
            onClick={() => navigate(`/scientific-department/articles/${r.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.dashboard.title')}>
      <div
        style={{
          background:
            'linear-gradient(120deg, var(--brand-primary-soft), color-mix(in srgb, var(--brand-primary) 18%, #fff))',
          border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '18px 22px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-primary)' }}>
            {t(`scientificDepartment.dashboard.roleName.${roleKey}`)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-soft)', marginTop: 4 }}>
            {t(`scientificDepartment.dashboard.roleDesc.${roleKey}`)}
          </div>
        </div>
        {user ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
              {t('scientificDepartment.dashboard.loggedIn')}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user.fullName}</div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 200 }}>
          <Spin />
        </Flex>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {cards.map((c) => (
              <div
                key={c.key}
                onClick={c.path ? () => navigate(c.path as string) : undefined}
                style={{
                  background: 'var(--color-bg-container, #fff)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: c.path ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 10,
                    background: c.soft,
                    color: c.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {c.icon}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{c.value}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-mute)' }}>
                    {t(c.labelKey)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(
            <div
              style={{
                background: 'var(--color-bg-container, #fff)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '16px 18px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                {t(
                  role === 'teacher'
                    ? 'scientificDepartment.dashboard.recentMine'
                    : 'scientificDepartment.dashboard.recentArticles',
                )}
              </div>
              <Table<Article>
                rowKey="id"
                size="small"
                columns={recentColumns}
                dataSource={recentArticles}
                pagination={false}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('scientificDepartment.dashboard.noArticles')}
                    />
                  ),
                }}
              />
            </div>
          )}
        </>
      )}
      <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
    </PageContainer>
  );
}
