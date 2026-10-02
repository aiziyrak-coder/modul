import { useEffect, useState } from 'react';
import { Alert, Col, Row, Select, Skeleton, Typography } from 'antd';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePermission } from '@/app/session';
import {
  useAcademicYearsForStatistics,
  useFacultiesForStatistics,
  useOubFaculties,
  useOubOverview,
  useOubTeachers,
} from '../api/statistics-api';
import type { StatisticsFilters } from '../model/types';
import StatTile from '../components/stat-tile';
import ExecutionFunnel from '../components/execution-funnel';
import FacultyTable from '../components/faculty-table';
import TeacherCoverage from '../components/teacher-coverage';
import VacancyPanel from '../components/vacancy-panel';
import { foiz, son } from '../lib/format';
import { resolveDefaultAcademicYearId } from '../lib/default-year';
import { FilterRow, Section, SectionTitle, Tiles } from './statistics-page.style';

const StatisticsPage = () => {
  const { t } = useTranslation();
  const can = usePermission();
  const canSeeStats = can('statistics:read');

  const [filters, setFilters] = useState<StatisticsFilters>({});

  const { data: years, isLoading: yearsLoading } = useAcademicYearsForStatistics();
  const { data: faculties, isLoading: facultiesLoading } = useFacultiesForStatistics();

  useEffect(() => {
    if (!filters.academicYear && years && years.length > 0) {
      const defaultYear = resolveDefaultAcademicYearId(years);
      if (defaultYear) setFilters((prev) => ({ ...prev, academicYear: defaultYear }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  const overview = useOubOverview(filters, canSeeStats);
  const facultiesQuery = useOubFaculties(filters, canSeeStats);
  const teachersQuery = useOubTeachers(filters, canSeeStats);

  const yearOptions = (years ?? []).map((y) => ({ label: y.title, value: y.id }));
  const facultyOptions = (faculties ?? []).map((f) => ({ label: f.title, value: f.id }));

  if (!canSeeStats) {
    return (
      <PageContainer title={t('studyLoad.nav.statistics')}>
        <Alert
          type="info"
          showIcon
          message={t('studyLoad.stats.noAccess')}
          description={t('studyLoad.stats.noAccessDescription')}
        />
      </PageContainer>
    );
  }

  const ov = overview.data;

  return (
    <PageContainer title={t('studyLoad.nav.statistics')}>
      <FilterRow>
        <Typography.Text style={{ fontWeight: 500 }}>{t('studyLoad.stats.filter.academicYear')}:</Typography.Text>
        <Select
          placeholder={t('studyLoad.stats.filter.academicYear')}
          loading={yearsLoading}
          options={yearOptions}
          value={filters.academicYear}
          onChange={(v: string) => setFilters((prev) => ({ ...prev, academicYear: v }))}
          style={{ minWidth: 200 }}
        />
        <Typography.Text style={{ fontWeight: 500 }}>{t('studyLoad.stats.filter.faculty')}:</Typography.Text>
        <Select
          allowClear
          placeholder={t('studyLoad.stats.filter.reset')}
          loading={facultiesLoading}
          options={facultyOptions}
          value={filters.faculty}
          onChange={(v: string | undefined) => setFilters((prev) => ({ ...prev, faculty: v }))}
          style={{ minWidth: 220 }}
        />
      </FilterRow>

      <Section>
        {overview.isError ? (
          <Alert
            type="error"
            showIcon
            message={t('studyLoad.stats.error')}
            description={t('studyLoad.stats.retry')}
            action={
              <a onClick={() => void overview.refetch()} role="button">
                {t('studyLoad.stats.retry')}
              </a>
            }
            style={{ marginBottom: 'var(--space-4)' }}
          />
        ) : null}

        {overview.isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <Tiles>
            <StatTile
              label={t('studyLoad.stats.metric.plansApproved')}
              value={ov?.studyPlans ? `${son(ov.studyPlans.approved)}/${son(ov.studyPlans.total)} (${foiz(ov.studyPlans.percent)})` : '—'}
              tone="good"
            />
            <StatTile
              label={t('studyLoad.stats.metric.groups')}
              value={ov?.contingent ? son(ov.contingent.groups) : '—'}
            />
            <StatTile
              label={t('studyLoad.stats.metric.students')}
              value={ov?.contingent ? son(ov.contingent.students) : '—'}
            />
            <StatTile
              label={t('studyLoad.stats.metric.totalHours')}
              value={ov?.hours ? son(ov.hours.planTotalHour) : '—'}
            />
            <StatTile
              label={t('studyLoad.stats.metric.distributedHours')}
              value={ov?.hours ? `${son(ov.hours.distributedHour)} (${foiz(ov.hours.coverage)})` : '—'}
              tone="good"
            />
            <StatTile
              label={t('studyLoad.stats.metric.vacancyCount')}
              value={
                ov?.vacancies
                  ? `${t('studyLoad.common.countN', { n: son(ov.vacancies.count) })} · ${t('studyLoad.common.hoursN', { n: son(ov.vacancies.hours) })}`
                  : '—'
              }
              tone="critical"
            />
            <StatTile
              label={t('studyLoad.stats.metric.readiness')}
              value={ov?.documents ? foiz(ov.documents.readiness) : '—'}
            />
          </Tiles>
        )}
      </Section>

      <Section>
        {overview.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : ov?.execution ? (
          <ExecutionFunnel steps={ov.execution.steps} percent={ov.execution.percent} />
        ) : (
          <Alert type="info" showIcon message={t('studyLoad.stats.empty')} />
        )}
      </Section>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Section>
            <SectionTitle>{t('studyLoad.stats.section.faculties')}</SectionTitle>
            {facultiesQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message={t('studyLoad.stats.error')}
                action={
                  <a onClick={() => void facultiesQuery.refetch()} role="button">
                    {t('studyLoad.stats.retry')}
                  </a>
                }
              />
            ) : (
              <FacultyTable rows={facultiesQuery.data?.rows ?? []} loading={facultiesQuery.isLoading} />
            )}
          </Section>
        </Col>

        <Col xs={24} lg={10}>
          <Section>
            <SectionTitle>{t('studyLoad.stats.section.vacancies')}</SectionTitle>
            {teachersQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message={t('studyLoad.stats.error')}
                action={
                  <a onClick={() => void teachersQuery.refetch()} role="button">
                    {t('studyLoad.stats.retry')}
                  </a>
                }
              />
            ) : (
              <VacancyPanel
                count={teachersQuery.data?.vacancies.count ?? 0}
                hours={teachersQuery.data?.vacancies.hours ?? 0}
                byDepartment={teachersQuery.data?.vacancies.byDepartment ?? []}
                loading={teachersQuery.isLoading}
              />
            )}
          </Section>
        </Col>
      </Row>

      <Section>
        <SectionTitle>{t('studyLoad.stats.section.teachers')}</SectionTitle>
        {teachersQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message={t('studyLoad.stats.error')}
            action={
              <a onClick={() => void teachersQuery.refetch()} role="button">
                {t('studyLoad.stats.retry')}
              </a>
            }
          />
        ) : (
          <TeacherCoverage
            summary={
              teachersQuery.data?.summary ?? {
                total: 0,
                assigned: 0,
                unassigned: 0,
                assignedPercent: 0,
                unknownFaculty: 0,
              }
            }
            byDepartment={teachersQuery.data?.byDepartment ?? []}
            loading={teachersQuery.isLoading}
          />
        )}
      </Section>
    </PageContainer>
  );
};

export default StatisticsPage;
