import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, Button, Tooltip, Typography } from 'antd';
import { EyeOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import { useVacancies, getApiErrorMessage } from '../api/distribution-api';
import type { Vacancy } from '../model/types';
import StatusBadge from '../../components/status-badge';
import { exportVacanciesToExcel } from '../../lib/excel';
import { vacancyReasonLabel } from '../lib/vacancy-reason';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

function vacancyLabel(item: Vacancy): string {
  return item.vacantLabel ?? (item.vacancyNumber != null ? `Vakant-${item.vacancyNumber}` : '—');
}

const ACADEMIC_TITLE_KEYS = ['phd', 'docent', 'professor'] as const;

export function requirementLabel(item: Vacancy, t: (key: string) => string): string {
  const rawTitle = item.requiredAcademicTitle;
  const academicTitle = rawTitle
    ? (ACADEMIC_TITLE_KEYS as readonly string[]).includes(rawTitle)
      ? t(`studyLoad.distribution.vacateModal.academicTitle.${rawTitle}`)
      : rawTitle
    : null;
  return (
    [item.requiredSpecialization, item.requiredPosition, academicTitle].filter(Boolean).join(', ') ||
    '—'
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ');
}

const VacancyListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [academicYearId, setAcademicYearId] = useState<string | undefined>(undefined);
  const [courseFilter, setCourseFilter] = useState<string | undefined>(undefined);

  const { data: vacancies = [], isLoading, isError, error } = useVacancies();

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    vacancies.forEach((v) => {
      if (v.department) map.set(v.department.id, v.department.title);
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [vacancies]);

  const academicYearOptions = useMemo(() => {
    const map = new Map<string, string>();
    vacancies.forEach((v) => {
      if (v.academicYear) map.set(v.academicYear.id, v.academicYear.title);
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [vacancies]);

  const courseOptions = useMemo(() => {
    const set = new Set<number>();
    vacancies.forEach((v) => {
      if (v.course > 0) set.add(v.course);
    });
    return Array.from(set)
      .sort((a, b) => a - b)
      .map((c) => ({ value: String(c), label: t('studyLoad.common.courseN', { n: c }) }));
  }, [vacancies, t]);

  const filtered = useMemo(
    () =>
      vacancies.filter((v) => {
        if (departmentId && v.department?.id !== departmentId) return false;
        if (academicYearId && v.academicYear?.id !== academicYearId) return false;
        if (courseFilter && String(v.course) !== courseFilter) return false;
        return true;
      }),
    [vacancies, departmentId, academicYearId, courseFilter],
  );

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const columns: ColumnDef<Vacancy>[] = [
    {
      header: t('studyLoad.vacancy.column.name'),
      id: 'name',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>{vacancyLabel(row.original)}</strong>
      ),
    },
    {
      header: t('studyLoad.workload.column.department'),
      id: 'department',
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text)' }}>
          {row.original.department?.title ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.vacancy.column.distribution'),
      id: 'distribution',
      cell: ({ row }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Typography.Text style={{ color: 'var(--color-text)' }}>
            {row.original.distributionTitle ?? '—'}
          </Typography.Text>
          <StatusBadge status={row.original.distributionStatus} />
        </div>
      ),
    },
    {
      header: t('studyLoad.distribution.column.course'),
      id: 'course',
      size: 90,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.course > 0 ? t('studyLoad.common.courseN', { n: row.original.course }) : '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.vacancy.column.sciences'),
      id: 'sciences',
      cell: ({ row }) => {
        const titles = row.original.blocks.map((b) => b.scienceTitle ?? '—');
        if (titles.length === 0) return <Typography.Text>—</Typography.Text>;
        return (
          <Typography.Text
            style={{ maxWidth: 260, display: 'inline-block' }}
            ellipsis={{ tooltip: titles.join(', ') }}
          >
            {titles.join(', ')}
          </Typography.Text>
        );
      },
    },
    {
      header: t('studyLoad.distribution.column.totalHour'),
      id: 'totalHour',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>{row.original.totalHour}</Typography.Text>
      ),
    },
    {
      header: t('studyLoad.vacancy.column.reason'),
      id: 'reason',
      size: 180,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {vacancyReasonLabel(row.original, t)}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.vacancy.column.requirement'),
      id: 'requirement',
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {requirementLabel(row.original, t)}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.vacancy.column.deadline'),
      id: 'deadline',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatDate(row.original.deadline)}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 80,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Tooltip title={t('studyLoad.common.view')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => navigate(`/study-load/distributions/${row.original.distributionId}`)}
              style={{ color: 'var(--brand-primary)' }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <PageContainer title={t('studyLoad.vacancy.pageTitle')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'department',
            placeholder: t('studyLoad.workload.filter.allDepartments'),
            value: departmentId,
            options: departmentOptions,
            onChange: (v) => {
              setDepartmentId(v);
              setPage(1);
            },
          },
          {
            key: 'academicYear',
            placeholder: t('studyLoad.myWorkload.filter.allYears'),
            value: academicYearId,
            options: academicYearOptions,
            onChange: (v) => {
              setAcademicYearId(v);
              setPage(1);
            },
          },
          {
            key: 'course',
            placeholder: t('studyLoad.workingSchedule.filter.allCourses'),
            value: courseFilter,
            options: courseOptions,
            onChange: (v) => {
              setCourseFilter(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <Can perform="workloadDistribution:readAll">
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => exportVacanciesToExcel(filtered)}
              style={{
                height: 38,
                color: 'var(--brand-primary)',
                borderColor: 'var(--brand-primary)',
              }}
            >
              {t('studyLoad.workingSchedule.excel')}
            </Button>
          </Can>
        }
      />

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('studyLoad.vacancy.loadError')}
          description={getApiErrorMessage(error)}
        />
      )}

      <DataTable<Vacancy>
        data={pageItems}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </PageContainer>
  );
};

export default VacancyListPage;
