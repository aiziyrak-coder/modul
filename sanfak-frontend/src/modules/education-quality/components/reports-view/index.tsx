import { useMemo, useCallback, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/shared/lib/i18n';
import {
  Table, Select, Button, Tag, DatePicker, Switch, Input, Tooltip, App as AntApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, FileZipOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from 'recharts';
import type {
  FacultyReport,
  DepartmentReport,
  TeacherReport,
  Semester,
  RankingMetrics,
} from '../../model/types';
import {
  useReportByFaculty,
  useReportByDepartment,
  useReportByTeachers,
  useAcademicYears,
  useFaculties,
  useDepartments,
  useIndicatorList,
  useSetTeacherAccess,
  useTeacherAccessMap,
  downloadSubmissionFilesZip,
} from '../../api/education-quality-api';
import { isTeacherActive } from '../../lib/teacher-access';
import { periodScoreColor } from '../../lib/score-threshold';
import { useDebouncedSearch } from '../../lib/use-debounced';
import * as S from '../report-chart/style';
import { TablePagination } from '../../components/table-pagination';
import { Page, TableCard } from '../../components/table-pagination/style';
import { ExportButton } from '../../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../../lib/excel';

export type ReportKind = 'faculty' | 'department' | 'teacher';

const MEDAL_COLORS = ['#F79009', '#98A2B3', '#B54708'];
const BAR_DEFAULT = '#16B364';

function barColor(i: number): string {
  return MEDAL_COLORS[i] ?? BAR_DEFAULT;
}

const HEADING_KEYS: Record<ReportKind, { title: string; desc: string }> = {
  faculty: {
    title: 'educationQuality.reports.facultyTitle',
    desc: 'educationQuality.reports.facultyDesc',
  },
  department: {
    title: 'educationQuality.reports.departmentTitle',
    desc: 'educationQuality.reports.departmentDesc',
  },
  teacher: {
    title: 'educationQuality.reports.teacherTitle',
    desc: 'educationQuality.reports.teacherDesc',
  },
};


export default function ReportsView({ kind }: { kind: ReportKind }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const facultyFilter = searchParams.get('faculty') ?? undefined;
  const deptFilter = searchParams.get('department') ?? undefined;
  const yearFilter = searchParams.get('year') ?? undefined;
  const indicatorFilter = searchParams.get('indicator') ?? undefined;
  const nameFilter = searchParams.get('search') ?? undefined;
  const employmentFilter = searchParams.get('employmentType') ?? undefined;
  const semesterRaw = searchParams.get('semester');
  const semesterFilter: Semester | undefined =
    semesterRaw === '1' ? 1 : semesterRaw === '2' ? 2 : undefined;

  const setParam = useCallback(
    (patch: Record<string, string | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const period = useMemo(
    () => ({
      academicYear: yearFilter,
      semester: semesterFilter,
      indicator: indicatorFilter,
      search: nameFilter,
      employmentType: employmentFilter,
    }),
    [yearFilter, semesterFilter, indicatorFilter, nameFilter, employmentFilter],
  );

  const { data: facultyData, isLoading: facLoading } = useReportByFaculty(period);
  const { data: deptData, isLoading: deptLoading } = useReportByDepartment({
    faculty: facultyFilter,
    ...period,
  });
  const { data: teacherData, isLoading: teacherLoading } = useReportByTeachers({
    faculty: facultyFilter,
    department: deptFilter,
    ...period,
  });

  const { data: academicYears } = useAcademicYears();
  const { data: indicatorPage } = useIndicatorList({});

  const [nameInput, setNameInput] = useState(nameFilter ?? '');
  const debouncedName = useDebouncedSearch(nameInput);

  useEffect(() => {
    if ((nameFilter ?? '') !== debouncedName) {
      setParam({ search: debouncedName || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName, setParam]);
  const { message } = AntApp.useApp();
  const [zipLoading, setZipLoading] = useState(false);
  const { data: accessMap } = useTeacherAccessMap();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments(facultyFilter);
  const setAccessMut = useSetTeacherAccess();

  const downloadFiles = useCallback(async () => {
    setZipLoading(true);
    try {
      await downloadSubmissionFilesZip({
        ...period,
        faculty: facultyFilter,
        department: deptFilter,
        status: 'approved',
      });
    } catch {
      message.error(t('educationQuality.reports.noFiles'));
    } finally {
      setZipLoading(false);
    }
  }, [period, facultyFilter, deptFilter, message, t]);

  const periodSelected = yearFilter !== undefined && semesterFilter !== undefined;

  const onFacultyChange = useCallback(
    (v?: string) => setParam({ faculty: v, department: undefined }),
    [setParam],
  );

  const openTeacher = useCallback(
    (id: string) => {
      const qs = searchParams.toString();
      navigate(`/education-quality/reports/teacher/${id}${qs ? `?${qs}` : ''}`);
    },
    [navigate, searchParams],
  );

  const drillDown = useCallback(
    (
      target: 'department' | 'teacher',
      patch: Record<string, string | null | undefined>,
      event: React.MouseEvent<HTMLElement>,
    ) => {
      if ((event.target as HTMLElement).closest('button, a, .ant-switch')) return;
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      navigate(`/education-quality/reports/${target}${qs ? `?${qs}` : ''}`);
    },
    [navigate, searchParams],
  );

  const facultyRatings = useMemo(() => facultyData ?? [], [facultyData]);
  const deptRatings = useMemo(() => deptData ?? [], [deptData]);
  const teacherRatings = useMemo(
    () =>
      (teacherData ?? []).map((r) => {
        const a = accessMap?.get(r._id);
        return a ? { ...r, active: a.active, activeFrom: a.activeFrom } : r;
      }),
    [teacherData, accessMap],
  );

  const rankedDept = useMemo(() => deptRatings.map((d, i) => ({ ...d, rank: i + 1 })), [deptRatings]);
  const rankedTeacher = useMemo(
    () => teacherRatings.map((r, i) => ({ ...r, rank: i + 1 })),
    [teacherRatings],
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  useEffect(() => {
    setPage(1);
  }, [kind, yearFilter, semesterFilter, facultyFilter, deptFilter, indicatorFilter, nameFilter, employmentFilter]);
  const facultyPage = useMemo(
    () => facultyRatings.slice((page - 1) * pageSize, page * pageSize),
    [facultyRatings, page, pageSize],
  );
  const deptPage = useMemo(
    () => rankedDept.slice((page - 1) * pageSize, page * pageSize),
    [rankedDept, page, pageSize],
  );
  const teacherPage = useMemo(
    () => rankedTeacher.slice((page - 1) * pageSize, page * pageSize),
    [rankedTeacher, page, pageSize],
  );

  const redColumn = {
    title: t('educationQuality.reports.belowThreshold'),
    key: 'red',
    align: 'center' as const,
    width: 150,
    render: (_v: unknown, r: RankingMetrics) =>
      r.teacherCount === 0 ? (
        <span style={{ color: 'var(--color-text-quaternary, #D0D5DD)' }}>—</span>
      ) : (
        <Tag color={r.redCount === 0 ? 'success' : 'error'} style={{ fontWeight: 600 }}>
          {t('educationQuality.reports.redTag', { count: r.redCount, share: r.redShare })}
        </Tag>
      ),
  };

  const facultyColumns: ColumnsType<FacultyReport> = [
    {
      title: t('educationQuality.reports.rank'),
      width: 70,
      align: 'center',
      render: (_v, _r, i) => <S.Medal $rank={i + 1}>{i + 1}</S.Medal>,
    },
    {
      title: t('educationQuality.common.faculty'),
      dataIndex: 'faculty',
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: t('educationQuality.reports.departments'),
      dataIndex: 'departmentCount',
      align: 'center',
      width: 120,
    },
    {
      title: t('educationQuality.reports.teachers'),
      dataIndex: 'teacherCount',
      align: 'center',
      width: 130,
    },
    redColumn as ColumnsType<FacultyReport>[number],
    {
      title: t('educationQuality.reports.totalScore'),
      dataIndex: 'totalScore',
      align: 'center',
      width: 120,
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: t('educationQuality.reports.avgScore'),
      dataIndex: 'avgScore',
      align: 'center',
      width: 130,
      render: (v: number) => (
        <Tag color="success" style={{ fontWeight: 700 }}>{v}</Tag>
      ),
    },
  ];

  const deptColumns: ColumnsType<DepartmentReport & { rank: number }> = [
    {
      title: t('educationQuality.reports.rank'),
      width: 70,
      align: 'center',
      render: (_v, r) => <S.Medal $rank={r.rank}>{r.rank}</S.Medal>,
    },
    {
      title: t('educationQuality.common.department'),
      dataIndex: 'department',
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: t('educationQuality.common.faculty'),
      dataIndex: 'faculty',
    },
    {
      title: t('educationQuality.reports.teachers'),
      dataIndex: 'teacherCount',
      align: 'center',
      width: 120,
    },
    redColumn as ColumnsType<DepartmentReport & { rank: number }>[number],
    {
      title: t('educationQuality.reports.totalScore'),
      dataIndex: 'totalScore',
      align: 'center',
      width: 110,
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: t('educationQuality.reports.avgScore'),
      dataIndex: 'avgScore',
      align: 'center',
      width: 130,
      render: (v: number) => (
        <Tag color="success" style={{ fontWeight: 700 }}>{v}</Tag>
      ),
    },
  ];

  const teacherColumns: ColumnsType<TeacherReport & { rank: number }> = [
    {
      title: t('educationQuality.reports.rank'),
      width: 64,
      align: 'center',
      render: (_v, r) => <S.Medal $rank={r.rank}>{r.rank}</S.Medal>,
    },
    {
      title: t('educationQuality.common.teacher'),
      dataIndex: 'teacher',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    { title: t('educationQuality.common.department'), dataIndex: 'department' },
    { title: t('educationQuality.common.faculty'), dataIndex: 'faculty' },
    {
      title: t('educationQuality.reports.employmentType'),
      dataIndex: 'employmentType',
      align: 'center',
      width: 130,
      render: (v: TeacherReport['employmentType']) =>
        v ? (
          <Tag color={v === 'asosiy' ? 'green' : 'gold'}>
            {t(`educationQuality.reports.employment${v === 'asosiy' ? 'Asosiy' : 'Orindosh'}`)}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: t('educationQuality.reports.indicators'),
      dataIndex: 'indicatorCount',
      align: 'center',
      width: 130,
      render: (c: number) => (
        <Tag color="processing">{t('educationQuality.reports.countItems', { count: c })}</Tag>
      ),
    },
    {
      title: t('educationQuality.reports.totalScore'),
      dataIndex: 'totalScore',
      align: 'center',
      width: 110,
      render: (v: number) => (
        <strong style={{ fontSize: 15, color: periodScoreColor(v, periodSelected) }}>{v}</strong>
      ),
    },
    {
      title: t('educationQuality.common.status'),
      key: 'access',
      align: 'center',
      width: 170,
      render: (_v, r) => {
        const reopened = !r.active && isTeacherActive(r);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={r.active}
              size="small"
              loading={setAccessMut.isPending}
              onChange={(active) => setAccessMut.mutate({ teacherId: r._id, active })}
            />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary, #475467)' }}>
              {r.active
                ? t('educationQuality.reports.active')
                : t('educationQuality.reports.inactive')}
            </span>
            {reopened && (
              <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                {t('educationQuality.reports.dateReached')}
              </Tag>
            )}
          </span>
        );
      },
    },
    {
      title: t('educationQuality.reports.activeFrom'),
      key: 'activeFrom',
      align: 'center',
      width: 180,
      render: (_v, r) =>
        r.active ? (
          <span style={{ color: 'var(--color-text-quaternary, #D0D5DD)' }}>—</span>
        ) : (
          <DatePicker
            size="small"
            style={{ width: 150 }}
            format="YYYY-MM-DD"
            placeholder={t('educationQuality.reports.pickDate')}
            value={r.activeFrom ? dayjs(r.activeFrom) : null}
            onChange={(_d, ds) =>
              setAccessMut.mutate({
                teacherId: r._id,
                activeFrom: typeof ds === 'string' && ds ? ds : null,
              })
            }
            allowClear
          />
        ),
    },
    {
      title: t('educationQuality.common.details'),
      width: 90,
      align: 'center',
      render: (_v, r) => (
        <Button type="text" icon={<EyeOutlined />} onClick={() => openTeacher(r._id)} />
      ),
    },
  ];

  const facChartData = useMemo(
    () => facultyRatings.map((f, i) => ({ name: f.faculty, ball: f.avgScore, rank: i + 1 })),
    [facultyRatings],
  );

  const shortDept = (name: string) => {
    const s = name.replace(/\s*kafedrasi$/i, '');
    return s.length > 16 ? s.slice(0, 15) + '…' : s;
  };

  const deptChartData = useMemo(
    () =>
      deptRatings.map((d) => ({
        name: shortDept(d.department),
        fullName: d.department,
        ball: d.avgScore,
      })),
    [deptRatings],
  );

  const handleExport = useCallback(() => {
    const L = {
      rank: t('educationQuality.reports.rank'),
      faculty: t('educationQuality.common.faculty'),
      department: t('educationQuality.common.department'),
      departments: t('educationQuality.reports.departments'),
      teacher: t('educationQuality.common.teacher'),
      teachers: t('educationQuality.reports.teachers'),
      indicators: t('educationQuality.reports.indicators'),
      totalScore: t('educationQuality.reports.totalScore'),
      avgScore: t('educationQuality.reports.avgScore'),
    };
    if (kind === 'faculty') {
      const rows: ExcelRow[] = facultyRatings.map((r, i) => ({
        [L.rank]: i + 1,
        [L.faculty]: r.faculty,
        [L.departments]: r.departmentCount,
        [L.teachers]: r.teacherCount,
        [L.totalScore]: r.totalScore,
        [L.avgScore]: r.avgScore,
      }));
      downloadExcel(
        rows,
        datedFileName(t('educationQuality.reports.exportFacultyFile')),
        t('educationQuality.reports.faculties'),
        [7, 40, 14, 14, 12, 14],
      );
    } else if (kind === 'department') {
      const rows: ExcelRow[] = deptRatings.map((r, i) => ({
        [L.rank]: i + 1,
        [L.department]: r.department,
        [L.faculty]: r.faculty,
        [L.teachers]: r.teacherCount,
        [L.totalScore]: r.totalScore,
        [L.avgScore]: r.avgScore,
      }));
      downloadExcel(
        rows,
        datedFileName(t('educationQuality.reports.exportDepartmentFile')),
        t('educationQuality.reports.departments'),
        [7, 34, 30, 14, 12, 14],
      );
    } else {
      const rows: ExcelRow[] = teacherRatings.map((r, i) => ({
        [L.rank]: i + 1,
        [L.teacher]: r.teacher,
        [L.department]: r.department,
        [L.faculty]: r.faculty,
        [L.indicators]: r.indicatorCount,
        [L.totalScore]: r.totalScore,
      }));
      downloadExcel(
        rows,
        datedFileName(t('educationQuality.reports.exportTeacherFile')),
        t('educationQuality.reports.teachers'),
        [7, 30, 26, 26, 14, 12],
      );
    }
  }, [kind, facultyRatings, deptRatings, teacherRatings, t]);

  const headingKeys = HEADING_KEYS[kind];

  const exportDisabled =
    (kind === 'faculty' ? facultyRatings.length : kind === 'department' ? deptRatings.length : teacherRatings.length) === 0;

  return (
    <Page>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{t(headingKeys.title)}</h2>
        <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
          {t(headingKeys.desc)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined />}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          allowClear
          style={{ flex: '1.4 1 0', minWidth: 220 }}
          placeholder={t('educationQuality.reports.searchTeacher')}
        />
        <Select
          value={yearFilter}
          onChange={(v?: string) => setParam({ year: v })}
          style={{ flex: '1 1 0', minWidth: 140 }}
          options={(academicYears ?? []).map((a) => ({ label: a.title, value: a._id }))}
          allowClear
          placeholder={t('educationQuality.common.allYears')}
        />
        <Select
          value={semesterFilter}
          onChange={(v?: Semester) => setParam({ semester: v ? String(v) : undefined })}
          style={{ flex: '0.8 1 0', minWidth: 120 }}
          options={[
            { label: t('educationQuality.semester.s1'), value: 1 as Semester },
            { label: t('educationQuality.semester.s2'), value: 2 as Semester },
          ]}
          allowClear
          placeholder={t('educationQuality.common.allSemesters')}
        />
        <Select
          value={indicatorFilter}
          onChange={(v?: string) => setParam({ indicator: v })}
          style={{ flex: '1.8 1 0', minWidth: 200 }}
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder={t('educationQuality.common.allIndicators')}
          options={(indicatorPage?.docs ?? []).map((i) => ({ label: i.title, value: i._id }))}
        />
        {kind !== 'faculty' && (
          <Select
            value={facultyFilter}
            onChange={onFacultyChange}
            style={{ flex: '1.3 1 0', minWidth: 170 }}
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder={t('educationQuality.common.allFaculties')}
            options={(faculties ?? []).map((f) => ({ label: f.title, value: f._id }))}
          />
        )}
        {kind === 'teacher' && (
          <Select
            value={deptFilter}
            onChange={(v?: string) => setParam({ department: v })}
            style={{ flex: '1.3 1 0', minWidth: 170 }}
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder={t('educationQuality.common.allDepartments')}
            options={(departments ?? []).map((d) => ({ label: d.title, value: d._id }))}
          />
        )}
        {kind === 'teacher' && (
          <Select
            value={employmentFilter}
            onChange={(v?: string) => setParam({ employmentType: v })}
            style={{ flex: '1 1 0', minWidth: 150 }}
            allowClear
            placeholder={t('educationQuality.reports.allEmploymentTypes')}
            options={[
              { label: t('educationQuality.reports.employmentAsosiy'), value: 'asosiy' },
              { label: t('educationQuality.reports.employmentOrindosh'), value: 'orindosh' },
            ]}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'flex-end' }}>
        <Tooltip title={exportDisabled ? t('educationQuality.reports.noExportData') : undefined}>
          <span>
            <Button
              icon={<FileZipOutlined />}
              loading={zipLoading}
              disabled={exportDisabled}
              onClick={downloadFiles}
            >
              {t('educationQuality.reports.downloadFiles')}
            </Button>
          </span>
        </Tooltip>
        <ExportButton
          onExport={handleExport}
          disabled={exportDisabled}
          disabledReason={t('educationQuality.reports.noExportData')}
        />
      </div>

      {kind === 'faculty' && (
        <>
          <S.ChartCard>
            <div className="chart-title">{t('educationQuality.reports.facultyChartTitle')}</div>
            <ResponsiveContainer width="100%" height={Math.max(200, facChartData.length * 48 + 24)}>
              <BarChart
                layout="vertical"
                data={facChartData}
                margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                barCategoryGap="22%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#98A2B3' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={230}
                  tick={{ fontSize: 12, fill: '#344054' }}
                  axisLine={false}
                  tickLine={false}
                />
                <RTooltip
                  cursor={{ fill: '#F9FAFB' }}
                  formatter={(v) => [
                    t('educationQuality.reports.scoreValue', { score: String(v) }),
                    t('educationQuality.reports.avgScore'),
                  ]}
                />
                <Bar dataKey="ball" radius={[0, 6, 6, 0]} maxBarSize={26} isAnimationActive={false}>
                  {facChartData.map((_f, i) => (
                    <Cell key={i} fill={barColor(i)} />
                  ))}
                  <LabelList dataKey="ball" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#475467' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </S.ChartCard>
          <TableCard>
            <Table
              rowKey="_id"
              columns={facultyColumns}
              dataSource={facultyPage}
              loading={facLoading}
              pagination={false}
              onRow={(r) => ({
                onClick: (event) => drillDown('department', { faculty: r._id }, event),
                style: { cursor: 'pointer' },
              })}
            />
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={facultyRatings.length}
              totalText={t('educationQuality.reports.totalFaculties')}
              onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
              onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
            />
          </TableCard>
        </>
      )}

      {kind === 'department' && (
        <>
          <S.ChartCard>
            <div className="chart-title">
              {t('educationQuality.reports.departmentChartTitle')}
              <span style={{ fontWeight: 400, color: 'var(--color-text-quaternary, #98A2B3)', fontSize: 12, marginLeft: 8 }}>
                &middot; {t('educationQuality.reports.deptCount', { count: deptRatings.length })}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={272}>
              <BarChart
                data={deptChartData}
                margin={{ top: 22, right: 8, left: -8, bottom: 64 }}
                barCategoryGap="18%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={64}
                  tick={{ fontSize: 9, fill: '#667085', angle: -55, textAnchor: 'end' }}
                  axisLine={{ stroke: '#EAECF0' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#98A2B3' }} axisLine={false} tickLine={false} />
                <RTooltip
                  cursor={{ fill: '#F9FAFB' }}
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.fullName ?? label
                  }
                  formatter={(v) => [
                    t('educationQuality.reports.scoreValue', { score: String(v) }),
                    t('educationQuality.reports.avgScore'),
                  ]}
                />
                <Bar dataKey="ball" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}>
                  {deptChartData.map((_d, i) => (
                    <Cell key={i} fill={barColor(i)} />
                  ))}
                  <LabelList
                    dataKey="ball"
                    position="top"
                    style={{ fontSize: 9, fontWeight: 700, fill: '#475467' }}
                    formatter={(v) => (Number(v) > 0 ? v : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </S.ChartCard>
          <TableCard>
            <Table
              rowKey="_id"
              columns={deptColumns}
              dataSource={deptPage}
              loading={deptLoading}
              pagination={false}
              onRow={(r) => ({
                onClick: (event) =>
                  drillDown('teacher', { faculty: r.facultyId, department: r._id }, event),
                style: { cursor: 'pointer' },
              })}
            />
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={rankedDept.length}
              totalText={t('educationQuality.reports.totalDepartments')}
              onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
              onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
            />
          </TableCard>
        </>
      )}

      {kind === 'teacher' && (
        <TableCard>
          <Table
            rowKey="_id"
            columns={teacherColumns}
            dataSource={teacherPage}
            loading={teacherLoading}
            pagination={false}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={rankedTeacher.length}
            totalText={t('educationQuality.reports.totalTeachers')}
            onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
          />
        </TableCard>
      )}

    </Page>
  );
}
