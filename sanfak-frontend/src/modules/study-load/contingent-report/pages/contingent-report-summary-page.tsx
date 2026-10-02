import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Empty, Select, Skeleton, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import { openPdf } from '../../lib/open-pdf';
import { downloadFile } from '../../lib/download-file';
import { useAcademicYearsRef } from '../../workload/api/workload-api';
import { httpStatus } from '../../department-contingent/api/department-contingent-api';
import { useContingentSummary } from '../api/contingent-report-api';
import type { ContingentNumField, ContingentNumbers, SummaryView } from '../model/types';
import ForeignTable from '../components/foreign-table';

const { Title, Text } = Typography;
const ROOT = '/contingent-reports';
const TOTAL_BG = 'var(--color-bg-layout, #F5F7FB)';

type Line =
  | { kind: 'row'; key: string; label: string; course: number | string; numbers: ContingentNumbers; span: number }
  | { kind: 'total'; key: string; label: string; numbers: ContingentNumbers };

const NumbersTable = ({ lines, k }: { lines: Line[]; k: (s: string) => string }) => {
  const numColumn = (field: ContingentNumField, title: string, width = 78) => ({
    title,
    key: field,
    width,
    align: 'center' as const,
    render: (_: unknown, line: Line) =>
      line.kind === 'total' ? <Text strong>{line.numbers[field]}</Text> : line.numbers[field],
  });
  const columns: ColumnsType<Line> = [
    {
      title: k('direction'),
      key: 'direction',
      width: 260,
      fixed: 'left',
      onCell: (line) => (line.kind === 'row' ? { rowSpan: line.span } : { colSpan: 2, style: { background: TOTAL_BG } }),
      render: (_: unknown, line) => (line.kind === 'row' ? <Text style={{ fontSize: 12 }}>{line.label}</Text> : <Text strong>{line.label}</Text>),
    },
    {
      title: k('course'),
      key: 'course',
      width: 64,
      align: 'center',
      fixed: 'left',
      onCell: (line) => (line.kind === 'total' ? { colSpan: 0 } : {}),
      render: (_: unknown, line) => (line.kind === 'row' ? line.course : null),
    },
    numColumn('total', k('total')),
    numColumn('boys', k('boys')),
    numColumn('girls', k('girls')),
    numColumn('grant', k('grant')),
    numColumn('contract', k('contract')),
    { title: k('grant'), children: [numColumn('grantBoys', k('boys')), numColumn('grantGirls', k('girls'))] },
    { title: k('contract'), children: [numColumn('contractBoys', k('boys')), numColumn('contractGirls', k('girls'))] },
    numColumn('groupCount', k('groupCount')),
    numColumn('streamCount', k('streamCount')),
    numColumn('mobilityOut', k('mobilityOut'), 96),
    numColumn('mobilityIn', k('mobilityIn'), 96),
  ];
  return (
    <Table<Line>
      rowKey="key"
      size="small"
      bordered
      columns={columns}
      dataSource={lines}
      pagination={false}
      scroll={{ x: 1400 }}
      onRow={(line) => (line.kind === 'total' ? { style: { background: TOTAL_BG } } : {})}
    />
  );
};

function table1Lines(s: SummaryView, t: (k: string, o?: Record<string, unknown>) => string): Line[] {
  const out: Line[] = [];
  for (const fb of s.facultyBlocks) {
    for (const d of fb.directions) {
      d.rows.forEach((r, i) => {
        const { course, ...numbers } = r;
        out.push({ kind: 'row', key: `${fb.facultyId}|${d.key}|${course}`, label: d.label, course, numbers, span: i === 0 ? d.rows.length : 0 });
      });
      out.push({ kind: 'total', key: `${fb.facultyId}|${d.key}|t`, label: t('studyLoad.contingentReport.totalRow'), numbers: d.total });
    }
    out.push({ kind: 'total', key: `${fb.facultyId}|ft`, label: t('studyLoad.contingentReport.facultyTotalRow', { faculty: fb.facultyTitle }), numbers: fb.total });
  }
  if (s.facultyBlocks.length) out.push({ kind: 'total', key: 'grand', label: t('studyLoad.contingentReport.totalRow'), numbers: s.grandTotal });
  return out;
}

function table2Lines(s: SummaryView, t: (k: string, o?: Record<string, unknown>) => string): Line[] {
  const rows: Line[] = s.byCourse.rows.map((r) => {
    const { course, ...numbers } = r;
    return {
      kind: 'row',
      key: `c${course}`,
      label: t('studyLoad.contingentReport.courseLabel', { n: course }),
      course: '',
      numbers,
      span: 1,
    };
  });
  rows.push({ kind: 'total', key: 'ct', label: t('studyLoad.contingentReport.totalRow'), numbers: s.byCourse.total });
  return rows;
}

const ContingentReportSummaryPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [yearId, setYearId] = useState<string | undefined>(undefined);
  const [fileLoading, setFileLoading] = useState<'pdf' | 'xlsx' | null>(null);
  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsRef();
  const { data, isLoading, isError, error } = useContingentSummary(yearId);
  const k = (s: string) => t(`studyLoad.contingentReport.col.${s}`);

  const lines1 = useMemo(() => (data ? table1Lines(data, t) : []), [data, t]);
  const lines2 = useMemo(() => (data ? table2Lines(data, t) : []), [data, t]);

  const withFile = async (kind: 'pdf' | 'xlsx', fn: () => Promise<unknown>) => {
    setFileLoading(kind);
    try {
      await fn();
    } finally {
      setFileLoading(null);
    }
  };
  const yearTitle = (data?.academicYearTitle ?? '').replace(/[^0-9]+/g, '-');
  const handlePdf = () => yearId && withFile('pdf', () => openPdf(`${ROOT}/summary/pdf?academicYear=${yearId}`, message, t));
  const handleXlsx = () =>
    yearId &&
    withFile('xlsx', () =>
      downloadFile(`${ROOT}/summary/xlsx`, { academicYear: yearId }, `kontingent-hisoboti-${yearTitle}.xlsx`, message, t),
    );

  type FacultyLine = { key: string; name: string; courses: number[]; total: number; isTotal?: boolean };
  const facultyColumns: ColumnsType<FacultyLine> = [
    { title: t('studyLoad.contingentReport.col.facultyName'), dataIndex: 'name', render: (v: string, r) => (r.isTotal ? <Text strong>{v}</Text> : v) },
    ...[1, 2, 3, 4, 5, 6].map((c) => ({
      title: String(c),
      key: `c${c}`,
      width: 64,
      align: 'center' as const,
      render: (_: unknown, r: FacultyLine) => (r.isTotal ? <Text strong>{r.courses[c - 1] ?? 0}</Text> : (r.courses[c - 1] ?? 0)),
    })),
    { title: t('studyLoad.contingentReport.totalRow'), dataIndex: 'total', width: 80, align: 'center', render: (v: number) => <Text strong>{v}</Text> },
  ];
  const facultyLines: FacultyLine[] = data
    ? [
        ...data.facultyByCourse.rows.map((r, i) => ({ key: String(i), name: r.facultyShort, courses: r.courses, total: r.total })),
        { key: 'total', name: t('studyLoad.contingentReport.totalRow'), courses: data.facultyByCourse.total.courses, total: data.facultyByCourse.total.total, isTotal: true },
      ]
    : [];

  return (
    <PageContainer
      title={t('studyLoad.contingentReport.summary.title')}
      extra={
        <Space size={8} wrap>
          <Button icon={<ArrowLeftOutlined />} style={{ height: 38 }} onClick={() => navigate('/study-load/contingent-reports')}>
            {t('studyLoad.common.back')}
          </Button>
          <Select
            style={{ minWidth: 200 }}
            placeholder={t('studyLoad.contingentReport.form.academicYearPlaceholder')}
            loading={yearsLoading}
            value={yearId}
            onChange={(v: string) => setYearId(v)}
            options={years.map((y) => ({ value: y.id, label: y.title }))}
            showSearch
            optionFilterProp="label"
            aria-label={t('studyLoad.contingentReport.form.academicYear')}
          />
          <Can perform="contingentReport:export">
            <Button icon={<FilePdfOutlined />} style={{ height: 38 }} disabled={!data} loading={fileLoading === 'pdf'} onClick={() => void handlePdf()}>
              {t('studyLoad.contingentReport.pdf')}
            </Button>
            <Button icon={<FileExcelOutlined />} style={{ height: 38 }} disabled={!data} loading={fileLoading === 'xlsx'} onClick={() => void handleXlsx()}>
              {t('studyLoad.contingentReport.excel')}
            </Button>
          </Can>
        </Space>
      }
    >
      {!yearId ? (
        <Empty description={t('studyLoad.contingentReport.summary.pickYear')} />
      ) : isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : isError || !data ? (
        httpStatus(error) === 403 ? (
          <Alert type="warning" showIcon message={t('studyLoad.contingentReport.summary.forbidden')} />
        ) : (
          <Alert
            type="error"
            showIcon
            message={t('studyLoad.contingentReport.summary.loadError')}
            description={error ? getApiErrorMessage(error) : undefined}
          />
        )
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          {data.pendingFaculties.length ? (
            <Alert
              type="warning"
              showIcon
              message={t('studyLoad.contingentReport.summary.pending', { count: data.pendingFaculties.length })}
              description={data.pendingFaculties.join(', ')}
            />
          ) : (
            <Alert type="success" showIcon message={t('studyLoad.contingentReport.summary.allApproved', { count: data.approvedCount })} />
          )}
          <div>
            <Title level={5}>{t('studyLoad.contingentReport.summary.table1')}</Title>
            {lines1.length ? <NumbersTable lines={lines1} k={k} /> : <Empty description={t('studyLoad.contingentReport.summary.empty')} />}
          </div>
          <div>
            <Title level={5}>{t('studyLoad.contingentReport.summary.table2')}</Title>
            <NumbersTable lines={lines2} k={k} />
          </div>
          <div style={{ maxWidth: 820 }}>
            <Title level={5}>{t('studyLoad.contingentReport.summary.table3')}</Title>
            <Table<FacultyLine> rowKey="key" size="small" bordered pagination={false} columns={facultyColumns} dataSource={facultyLines} onRow={(r) => (r.isTotal ? { style: { background: TOTAL_BG } } : {})} />
          </div>
          <div style={{ maxWidth: 720 }}>
            <Title level={5}>{t('studyLoad.contingentReport.foreignTitle')}</Title>
            <ForeignTable rows={data.countries.rows} />
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ContingentReportSummaryPage;
