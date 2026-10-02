import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Empty, Select, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useAcademicYearsRef } from '../../workload/api/workload-api';
import { httpStatus, useDeptContingentSummary } from '../api/department-contingent-api';
import type { SummaryCohort, SummaryDepartment, SummaryDepartmentRow } from '../model/types';
import { cohortKey } from '../model/invariants';

const { Title, Text } = Typography;
const BASE = '/study-load/department-contingents';

interface CohortCoverage {
  departmentTitle: string;
  streamCount: number;
  groupCount: number;
}

const sum = (rows: SummaryDepartmentRow[], f: 'groupCount' | 'studentCount' | 'streamCount') =>
  rows.reduce((acc, r) => acc + r[f], 0);

const DepartmentContingentSummaryPage = () => {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [yearId, setYearId] = useState<string | undefined>(undefined);
  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsRef();
  const { data, isLoading, isError, error, refetch } = useDeptContingentSummary(yearId);

  const coverage = useMemo(() => {
    const map = new Map<string, CohortCoverage[]>();
    for (const d of data?.departments ?? []) {
      for (const r of d.rows) {
        const key = r.joinKey;
        const list = map.get(key) ?? [];
        list.push({ departmentTitle: d.departmentTitle, streamCount: r.streamCount, groupCount: r.groupCount });
        map.set(key, list);
      }
    }
    return map;
  }, [data]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const cohortColumns: ColumnsType<SummaryCohort> = [
    { title: t('studyLoad.deptContingent.col.direction'), key: 'direction', render: (_: unknown, c) => c.directionTitle || '—' },
    { title: t('studyLoad.deptContingent.col.course'), key: 'course', width: 90, align: 'center', render: (_: unknown, c) => c.courseTitle || c.courseNum || '—' },
    { title: t('studyLoad.deptContingent.col.groupCount'), key: 'groups', width: 90, align: 'center', render: (_: unknown, c) => c.groupCount },
    { title: t('studyLoad.deptContingent.col.studentCount'), key: 'students', width: 90, align: 'center', render: (_: unknown, c) => c.studentCount },
    {
      title: t('studyLoad.deptContingent.summary.streamsByDepartment'),
      key: 'coverage',
      render: (_: unknown, c) => {
        const list = coverage.get(c.joinKey) ?? [];
        if (!list.length) return <Text type="secondary">{t('studyLoad.deptContingent.summary.noCoverage')}</Text>;
        return (
          <Space size={4} wrap>
            {list.map((x) => {
              const mismatch = x.groupCount !== c.groupCount;
              const label = t('studyLoad.deptContingent.summary.coverageTag', {
                department: x.departmentTitle,
                count: x.streamCount,
              });
              return mismatch ? (
                <Tooltip
                  key={x.departmentTitle}
                  title={t('studyLoad.deptContingent.summary.groupMismatch', { have: x.groupCount, total: c.groupCount })}
                >
                  <Tag color="warning">{label}</Tag>
                </Tooltip>
              ) : (
                <Tag key={x.departmentTitle}>{label}</Tag>
              );
            })}
          </Space>
        );
      },
    },
  ];

  const departmentColumns: ColumnsType<SummaryDepartment> = [
    { title: t('studyLoad.deptContingent.column.department'), key: 'department', render: (_: unknown, d) => <Text strong>{d.departmentTitle || '—'}</Text> },
    { title: t('studyLoad.deptContingent.column.rowCount'), key: 'rows', width: 100, align: 'center', render: (_: unknown, d) => d.rows.length },
    { title: t('studyLoad.deptContingent.column.streamCount'), key: 'streams', width: 100, align: 'center', render: (_: unknown, d) => sum(d.rows, 'streamCount') },
    { title: t('studyLoad.deptContingent.col.groupCount'), key: 'groups', width: 100, align: 'center', render: (_: unknown, d) => sum(d.rows, 'groupCount') },
    { title: t('studyLoad.deptContingent.column.updatedAt'), key: 'updatedAt', width: 130, render: (_: unknown, d) => fmtDate(d.updatedAt) },
  ];

  const rowColumns: ColumnsType<SummaryDepartmentRow> = [
    { title: t('studyLoad.deptContingent.col.direction'), key: 'direction', render: (_: unknown, r) => r.directionTitle || '—' },
    { title: t('studyLoad.deptContingent.col.course'), key: 'course', width: 80, align: 'center', render: (_: unknown, r) => r.courseNum },
    { title: t('studyLoad.deptContingent.col.groupCount'), key: 'groups', width: 90, align: 'center', render: (_: unknown, r) => r.groupCount },
    { title: t('studyLoad.deptContingent.col.studentCount'), key: 'students', width: 90, align: 'center', render: (_: unknown, r) => r.studentCount },
    { title: t('studyLoad.deptContingent.col.streamCount'), key: 'streams', width: 90, align: 'center', render: (_: unknown, r) => <Text strong>{r.streamCount}</Text> },
  ];

  const renderBody = () => {
    if (!yearId) return <Empty description={t('studyLoad.deptContingent.summary.pickYear')} />;
    if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
    if (isError || !data) {
      if (httpStatus(error) === 403) {
        return <Alert type="warning" showIcon message={t('studyLoad.deptContingent.summary.forbidden')} />;
      }
      return (
        <Alert
          type="error"
          showIcon
          message={t('studyLoad.deptContingent.summary.loadError')}
          description={getApiErrorMessage(error)}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('studyLoad.deptContingent.retry')}
            </Button>
          }
        />
      );
    }
    return (
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <Alert
          type={data.missingDepartments.length ? 'warning' : 'success'}
          showIcon
          message={t('studyLoad.deptContingent.summary.totals', {
            count: data.totals.withContingent,
            expected: data.totals.expected,
          })}
          description={
            data.missingDepartments.length ? (
              <>
                <Text strong>{t('studyLoad.deptContingent.summary.missing', { count: data.missingDepartments.length })}</Text>{' '}
                {data.missingDepartments.map((d) => d.title).join(', ')}
              </>
            ) : undefined
          }
        />
        <div>
          <Title level={5}>{t('studyLoad.deptContingent.summary.cohorts')}</Title>
          {data.cohorts.length ? (
            <Table<SummaryCohort>
              rowKey={(c) => `${c.directionId}|${c.courseId}`}
              size="small"
              bordered
              pagination={false}
              columns={cohortColumns}
              dataSource={data.cohorts}
              scroll={{ x: 760 }}
            />
          ) : (
            <Empty description={t('studyLoad.deptContingent.summary.noCohorts')} />
          )}
        </div>
        <div>
          <Title level={5}>{t('studyLoad.deptContingent.summary.departments')}</Title>
          {data.departments.length ? (
            <Table<SummaryDepartment>
              rowKey="departmentId"
              size="small"
              bordered
              pagination={false}
              columns={departmentColumns}
              dataSource={data.departments}
              scroll={{ x: 640 }}
              expandable={{
                rowExpandable: (d) => d.rows.length > 0,
                expandedRowRender: (d) => (
                  <Table<SummaryDepartmentRow>
                    rowKey={(r) => cohortKey(r.directionId, r.courseNum)}
                    size="small"
                    pagination={false}
                    columns={rowColumns}
                    dataSource={d.rows}
                  />
                ),
              }}
            />
          ) : (
            <Empty description={t('studyLoad.deptContingent.summary.noDepartments')} />
          )}
        </div>
      </div>
    );
  };

  return (
    <PageContainer
      title={t('studyLoad.deptContingent.summary.title')}
      extra={
        <Space size={8} wrap>
          <Button icon={<ArrowLeftOutlined />} style={{ height: 38 }} onClick={() => navigate(BASE)}>
            {t('studyLoad.common.back')}
          </Button>
          <Select
            style={{ minWidth: 200 }}
            placeholder={t('studyLoad.deptContingent.form.academicYearPlaceholder')}
            loading={yearsLoading}
            value={yearId}
            onChange={(v: string) => setYearId(v)}
            options={years.map((y) => ({ value: y.id, label: y.title }))}
            showSearch
            optionFilterProp="label"
            aria-label={t('studyLoad.deptContingent.form.academicYear')}
          />
        </Space>
      }
    >
      {renderBody()}
    </PageContainer>
  );
};

export default DepartmentContingentSummaryPage;
