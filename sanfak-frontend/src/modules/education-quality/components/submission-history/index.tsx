import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { Table, Segmented, Button, Input, Select, Tag, Tooltip, App as AntApp } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined, SearchOutlined, InfoCircleOutlined, TrophyOutlined, FileZipOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { Semester, Submission, SubmissionStatus } from '../../model/types';
import {
  useSubmissionList,
  useAcademicYears,
  useTeacherTotalScore,
  downloadSubmissionFilesZip,
} from '../../api/education-quality-api';
import { PERIOD_MIN_SCORE, periodScoreColor } from '../../lib/score-threshold';
import SubmissionDrawer from '../submission-drawer';
import { TablePagination } from '../../components/table-pagination';
import { Page, TableCard } from '../../components/table-pagination/style';
import { ExportButton } from '../../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../../lib/excel';
import { useDebouncedSearch } from '../../lib/use-debounced';

interface Props {
  teacherId: string | undefined;
  header: ReactNode;
  initialAcademicYear?: string;
  initialSemester?: Semester;
  showFilesZip?: boolean;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_META: Record<SubmissionStatus, { labelKey: string; color: string }> = {
  pending: { labelKey: 'educationQuality.status.pending', color: 'processing' },
  approved: { labelKey: 'educationQuality.status.approved', color: 'success' },
  rejected: { labelKey: 'educationQuality.status.rejected', color: 'error' },
};

type FilterKey = 'all' | SubmissionStatus;

export default function SubmissionHistory({
  teacherId,
  header,
  initialAcademicYear,
  initialSemester,
  showFilesZip = false,
}: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string | undefined>(initialAcademicYear);
  const [semesterFilter, setSemesterFilter] = useState<Semester | undefined>(initialSemester);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const { message } = AntApp.useApp();

  const debouncedSearch = useDebouncedSearch(search);

  const { data: subData, isLoading } = useSubmissionList({
    teacherId,
    status: filter !== 'all' ? filter : undefined,
    indicatorSearch: debouncedSearch || undefined,
    academicYear: yearFilter,
    semester: semesterFilter,
  });

  const { data: academicYears } = useAcademicYears();
  const { data: totalScore = 0 } = useTeacherTotalScore({
    teacherId,
    academicYear: yearFilter,
    semester: semesterFilter,
  });

  const submissions = useMemo(() => subData?.docs ?? [], [subData]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  useEffect(() => { setPage(1); }, [filter, debouncedSearch, yearFilter, semesterFilter]);
  const pageRows = useMemo(
    () => submissions.slice((page - 1) * pageSize, page * pageSize),
    [submissions, page, pageSize],
  );

  const periodSelected = yearFilter !== undefined && semesterFilter !== undefined;
  const scoreColor = periodScoreColor(totalScore, periodSelected);

  const view = useCallback((r: Submission) => {
    setSelected(r);
    setDrawerOpen(true);
  }, []);

  const downloadFiles = useCallback(async () => {
    if (!teacherId) return;
    setZipLoading(true);
    try {
      await downloadSubmissionFilesZip({
        teacher: teacherId,
        academicYear: yearFilter,
        semester: semesterFilter,
        status: filter !== 'all' ? filter : undefined,
      });
    } catch {
      message.error(t('educationQuality.reports.noFiles'));
    } finally {
      setZipLoading(false);
    }
  }, [teacherId, yearFilter, semesterFilter, filter, message, t]);

  const columns: ColumnsType<Submission> = [
    {
      title: '#',
      width: 56,
      align: 'center',
      render: (_v, _r, idx) => idx + 1,
    },
    {
      title: t('educationQuality.common.indicator'),
      render: (_v, r) => (
        <span style={{ fontWeight: 600 }}>{r.indicator.title}</span>
      ),
    },
    {
      title: t('educationQuality.common.authors'),
      width: 100,
      align: 'center',
      render: (_v, r) => Math.max(1, Math.round(100 / r.authorShare)),
    },
    {
      title: t('educationQuality.history.submitted'),
      width: 170,
      render: (_v, r) => formatDateTime(r.createdAt),
    },
    {
      title: t('educationQuality.common.score'),
      width: 90,
      align: 'center',
      render: (_v, r) =>
        r.score ? (
          <strong style={{ color: 'var(--brand-primary, #0B843F)' }}>{r.score}</strong>
        ) : (
          <span style={{ color: 'var(--color-text-quaternary, #D0D5DD)' }}>—</span>
        ),
    },
    {
      title: t('educationQuality.common.status'),
      width: 170,
      render: (_v, r) => {
        const meta = STATUS_META[r.status];
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Tag color={meta.color}>{t(meta.labelKey)}</Tag>
            {r.status === 'rejected' && r.comment && (
              <Tooltip title={r.comment}>
                <InfoCircleOutlined style={{ color: 'var(--brand-error, #F04438)', cursor: 'help' }} />
              </Tooltip>
            )}
          </span>
        );
      },
    },
    {
      title: t('educationQuality.common.actions'),
      width: 80,
      align: 'right',
      render: (_v, r) => (
        <Tooltip title={t('educationQuality.common.view')}>
          <Button type="text" icon={<EyeOutlined />} onClick={() => view(r)} />
        </Tooltip>
      ),
    },
  ];

  const exportRows = () => {
    const excelRows: ExcelRow[] = submissions.map((r, i) => ({
      '#': i + 1,
      [t('educationQuality.common.indicator')]: r.indicator.title,
      [t('educationQuality.common.authors')]: Math.max(1, Math.round(100 / r.authorShare)),
      [t('educationQuality.history.submitted')]: formatDateTime(r.createdAt),
      [t('educationQuality.common.score')]: r.score,
      [t('educationQuality.common.status')]: t(STATUS_META[r.status].labelKey),
    }));
    downloadExcel(
      excelRows,
      datedFileName(t('educationQuality.history.exportFile')),
      t('educationQuality.history.exportSheet'),
      [5, 44, 11, 18, 8, 15],
    );
  };

  return (
    <Page>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 20,
      }}>
        {header}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 18px',
          background: 'var(--bg-surface, #fff)',
          border: '1px solid var(--border-secondary, #eaecf0)',
          borderRadius: 'var(--radius-lg, 12px)',
          minWidth: 210,
        }}>
          <TrophyOutlined style={{ fontSize: 22, color: scoreColor }} />
          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: 'var(--color-text-tertiary, #667085)',
            }}>
              {t('educationQuality.history.totalScore')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor, lineHeight: 1.2 }}>
              {totalScore}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #667085)', marginTop: 2 }}>
              {periodSelected
                ? t('educationQuality.history.minRequired', { score: PERIOD_MIN_SCORE })
                : t('educationQuality.history.selectPeriod')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
          options={[
            { label: t('educationQuality.common.all'), value: 'all' },
            { label: t('educationQuality.status.approved'), value: 'approved' },
            { label: t('educationQuality.status.pending'), value: 'pending' },
            { label: t('educationQuality.status.rejected'), value: 'rejected' },
          ]}
        />
        <Select
          value={yearFilter}
          onChange={setYearFilter}
          style={{ width: 170 }}
          options={(academicYears ?? []).map((a) => ({ label: a.title, value: a._id }))}
          allowClear
          placeholder={t('educationQuality.common.allYears')}
        />
        <Select
          value={semesterFilter}
          onChange={setSemesterFilter}
          style={{ width: 150 }}
          options={[
            { label: t('educationQuality.semester.s1'), value: 1 as Semester },
            { label: t('educationQuality.semester.s2'), value: 2 as Semester },
          ]}
          allowClear
          placeholder={t('educationQuality.common.allSemesters')}
        />
        <Input
          placeholder={t('educationQuality.history.searchPlaceholder')}
          prefix={<SearchOutlined />}
          style={{ width: 260 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
          {showFilesZip && (
            <Tooltip title={submissions.length === 0 ? t('educationQuality.history.noExportData') : undefined}>
              <span>
                <Button
                  icon={<FileZipOutlined />}
                  loading={zipLoading}
                  disabled={submissions.length === 0}
                  onClick={downloadFiles}
                >
                  {t('educationQuality.reports.downloadFiles')}
                </Button>
              </span>
            </Tooltip>
          )}
          <ExportButton
            onExport={exportRows}
            disabled={submissions.length === 0}
            disabledReason={t('educationQuality.history.noExportData')}
          />
        </span>
      </div>

      <TableCard>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={pageRows}
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: t('educationQuality.history.empty') }}
        />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={submissions.length}
          totalText={t('educationQuality.common.total')}
          onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
      </TableCard>

      <SubmissionDrawer
        open={drawerOpen}
        submission={selected}
        onClose={() => setDrawerOpen(false)}
        readOnly
      />
    </Page>
  );
}
