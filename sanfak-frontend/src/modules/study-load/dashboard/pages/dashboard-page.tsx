import { useState } from 'react';
import {
  Alert,
  Col,
  Progress,
  Row,
  Select,
  Skeleton,
  Statistic,
  Typography,
} from 'antd';
import styled from 'styled-components';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePermission } from '@/app/session';
import {
  useStudyLoadSummary,
  useAcademicYearsForDashboard,
  type StatCard,
} from '../api/dashboard-api';

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
`;

const StatCardWrap = styled.div`
  background: #fff;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border, #e8e8e8);
  padding: var(--space-5) var(--space-6);
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
`;

const ApprovedLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
`;

interface IStatCardProps {
  title: string;
  stat: StatCard;
}

const DashboardStatCard = ({ title, stat }: IStatCardProps) => {
  const { t } = useTranslation();
  const percent =
    stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0;

  return (
    <StatCardWrap>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 13, fontWeight: 500 }}
      >
        {title}
      </Typography.Text>

      <Statistic
        value={stat.total}
        valueStyle={{ fontSize: 36, fontWeight: 700, color: 'var(--color-text)' }}
      />

      <ApprovedLine>
        <Typography.Text style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>
          {t('studyLoad.dashboard.approved')}: <strong style={{ color: 'var(--brand-primary)' }}>{stat.approved}</strong>
        </Typography.Text>
        <Typography.Text style={{ fontSize: 12, color: 'var(--color-text-soft)' }}>
          {percent}%
        </Typography.Text>
      </ApprovedLine>

      <Progress
        percent={percent}
        showInfo={false}
        strokeColor="var(--brand-primary)"
        trailColor="var(--color-border, #e8e8e8)"
        size={['100%', 6]}
      />
    </StatCardWrap>
  );
};

const CardSkeleton = () => (
  <StatCardWrap>
    <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
  </StatCardWrap>
);

const CARD_DEFS = [
  { key: 'workloads', titleKey: 'studyLoad.dashboard.card.workloads' },
  { key: 'distributions', titleKey: 'studyLoad.dashboard.card.distributions' },
  { key: 'teachers', titleKey: 'studyLoad.dashboard.card.teachers' },
  { key: 'workPlans', titleKey: 'studyLoad.dashboard.card.workPlans' },
] as const;

type CardKey = (typeof CARD_DEFS)[number]['key'];

const DashboardPage = () => {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState<string | undefined>(undefined);
  const can = usePermission();

  const canSeeSummary = can('report:read');

  const { data: years, isLoading: yearsLoading } = useAcademicYearsForDashboard();
  const { data, isLoading, isError } = useStudyLoadSummary(
    selectedYear,
    canSeeSummary,
  );

  const yearOptions = (years ?? []).map((y) => ({ label: y.title, value: y.id }));

  return (
    <PageContainer title={t('studyLoad.nav.dashboard')}>
      <FilterRow>
        <Typography.Text style={{ fontWeight: 500 }}>
          {t('studyLoad.dashboard.academicYearLabel')}:
        </Typography.Text>
        <Select
          allowClear
          placeholder={t('studyLoad.dashboard.allYears')}
          loading={yearsLoading}
          options={yearOptions}
          value={selectedYear}
          onChange={(v: string | undefined) => setSelectedYear(v)}
          style={{ minWidth: 200 }}
        />
      </FilterRow>

      {!canSeeSummary ? (
        <Alert
          type="info"
          showIcon
          message={t('studyLoad.dashboard.noAccessTitle')}
          description={t('studyLoad.dashboard.noAccessDescription')}
        />
      ) : (
        <>
          {isError ? (
            <Alert
              type="error"
              showIcon
              message={t('studyLoad.dashboard.errorTitle')}
              description={t('studyLoad.dashboard.errorDescription')}
              style={{ marginBottom: 'var(--space-5)' }}
            />
          ) : null}

          <Row gutter={[16, 16]}>
            {CARD_DEFS.map((def) => (
              <Col key={def.key} xs={24} sm={12} lg={6}>
                {isLoading ? (
                  <CardSkeleton />
                ) : (
                  <DashboardStatCard
                    title={t(def.titleKey)}
                    stat={data?.[def.key as CardKey] ?? { total: 0, approved: 0 }}
                  />
                )}
              </Col>
            ))}
          </Row>
        </>
      )}
    </PageContainer>
  );
};

export default DashboardPage;
