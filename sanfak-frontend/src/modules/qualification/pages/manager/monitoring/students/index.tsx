import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { EyeOutlined } from '@ant-design/icons';
import { Button, Progress, Tag, Tooltip, Typography } from 'antd';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { TableGap } from '../../../../components/table-gap';
import { useTranslation } from '@/shared/lib/i18n';
import { useStudentsMonitoring } from '../../../../api/monitoring-api';
import { useCourseOptions } from '../../../../api/course-api';
import type { StudentMonitorRow } from '../../../../model/monitoring.types';

const { Text } = Typography;
const LIMIT = 12;

export default function StudentMonitoringPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [performance, setPerformance] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);

  const { data: courseOptions = [] } = useCourseOptions();
  const { data, isFetching } = useStudentsMonitoring({ page, limit: pageSize, search, course, performance });

  const perfColor = (p: number) =>
    p >= 80 ? 'var(--brand-primary)' : p >= 60 ? 'var(--brand-warning)' : 'var(--brand-error)';

  const columns: ColumnDef<StudentMonitorRow, unknown>[] = [
    { id: 'idx', header: '#', cell: ({ row }) => (page - 1) * pageSize + row.index + 1 },
    { accessorKey: 'fullName', header: t('qualification.monitoring.colFio') },
    { accessorKey: 'courseName', header: t('qualification.monitoring.colCourse') },
    {
      id: 'eduType',
      header: t('qualification.monitoring.colEduType'),
      cell: ({ row }) => (
        <Tag color={row.original.educationType === 1 ? 'blue' : 'gold'}>
          {row.original.educationType === 1
            ? t('qualification.monitoring.budget')
            : t('qualification.monitoring.contract')}
        </Tag>
      ),
    },
    {
      id: 'progress',
      header: t('qualification.monitoring.colProgress'),
      cell: ({ row }) => {
        const p = row.original.progressPercent;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
            <div style={{ flex: 1 }}>
              <Progress percent={p} showInfo={false} size="small" strokeColor={perfColor(p)} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: perfColor(p), width: 38, textAlign: 'right' }}>{p}%</span>
          </div>
        );
      },
    },
    {
      id: 'detail',
      header: t('qualification.monitoring.colDetail'),
      cell: ({ row }) => (
        <Tooltip title={t('qualification.monitoring.colDetail')}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/qualification/manager/monitoring/students/${row.original.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  const perfOptions = [
    { value: 'high', label: t('qualification.monitoring.perfHigh') },
    { value: 'medium', label: t('qualification.monitoring.perfMedium') },
    { value: 'low', label: t('qualification.monitoring.perfLow') },
  ];

  return (
    <PageContainer title={t('qualification.monitoring.studentsNav')}>
      <Filters
        searchValue={search}
        searchPlaceholder="qualification.monitoring.searchPh"
        onSearch={(v) => { setSearch(v); setPage(1); }}
        selects={[
          { key: 'course', placeholder: 'qualification.monitoring.filterCourse', value: course || undefined, options: courseOptions, onChange: (v) => { setCourse(v ?? ''); setPage(1); } },
          { key: 'perf', placeholder: 'qualification.monitoring.filterPerf', value: performance || undefined, options: perfOptions, onChange: (v) => { setPerformance(v ?? ''); setPage(1); } },
        ]}
        extra={<Text type="secondary">{t('qualification.monitoring.count', { count: data?.total ?? 0 })}</Text>}
      />
      <TableGap>
        <DataTable<StudentMonitorRow>
          data={data?.items ?? []}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </TableGap>
    </PageContainer>
  );
}
