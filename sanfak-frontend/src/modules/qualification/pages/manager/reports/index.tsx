import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { EyeOutlined } from '@ant-design/icons';
import { Button, DatePicker, Flex, Progress, Select, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { useTranslation } from '@/shared/lib/i18n';
import { useProgressReport, fetchProgressReportExport } from '../../../api/monitoring-api';
import { useCourseOptions } from '../../../api/course-api';
import { EDU_FORM } from '../../../model/course.types';
import { downloadExcel } from '../../../lib/excel';
import type { ProgressReportRow } from '../../../model/monitoring.types';
import ExcelExportButton from '../../../components/excel-export-button';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const perfColor = (p: number) =>
  p >= 80 ? 'var(--brand-primary)' : p >= 60 ? 'var(--brand-warning)' : 'var(--brand-error)';

export default function ReportsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [course, setCourse] = useState<string>();
  const [dateFrom, setDateFrom] = useState<string>();
  const [dateTo, setDateTo] = useState<string>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [exporting, setExporting] = useState(false);

  const { data: courseOptions = [] } = useCourseOptions(EDU_FORM.ONLINE);
  const report = useProgressReport({ course, dateFrom, dateTo, page, limit: pageSize }, true);
  const rows = report.data?.items ?? [];
  const total = report.data?.total ?? 0;

  const columns: ColumnDef<ProgressReportRow, unknown>[] = [
    { header: '#', id: 'idx', size: 56, cell: ({ row }) => (page - 1) * pageSize + row.index + 1 },
    {
      header: t('qualification.monitoring.colFio'),
      id: 'fio',
      cell: ({ row }) => <Text strong>{row.original.fullName}</Text>,
    },
    {
      header: t('qualification.monitoring.colCourse'),
      id: 'course',
      cell: ({ row }) => row.original.courseName,
    },
    {
      header: t('qualification.monitoring.colProgress'),
      id: 'progress',
      size: 200,
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Progress
              percent={row.original.progressPercent}
              showInfo={false}
              size="small"
              strokeColor={perfColor(row.original.progressPercent)}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: perfColor(row.original.progressPercent),
              width: 36,
              textAlign: 'right',
            }}
          >
            {row.original.progressPercent}%
          </span>
        </div>
      ),
    },
    {
      header: t('qualification.reports.testScore'),
      id: 'testScore',
      size: 110,
      meta: { align: 'center' as const },
      cell: ({ row }) =>
        row.original.testScore === null ? (
          <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>—</span>
        ) : (
          <Text strong>{row.original.testScore}%</Text>
        ),
    },
    {
      header: t('qualification.reports.certificate'),
      id: 'certificate',
      size: 120,
      meta: { align: 'center' as const },
      cell: ({ row }) =>
        row.original.hasCertificate ? (
          <Tag color="green">{t('qualification.reports.yes')}</Tag>
        ) : (
          <Tag>{t('qualification.reports.no')}</Tag>
        ),
    },
    {
      header: t('qualification.reports.detail'),
      id: 'detail',
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Tooltip title={t('qualification.reports.detail')}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            disabled={!row.original.id}
            onClick={() =>
              row.original.id &&
              navigate(`/qualification/manager/reports/students/${row.original.id}`)
            }
          />
        </Tooltip>
      ),
    },
  ];

  const onExport = async () => {
    setExporting(true);
    try {
      const all = await fetchProgressReportExport({ course, dateFrom, dateTo });
      const xrows = all.map((r, i) => ({
        '#': i + 1,
        [t('qualification.monitoring.colFio')]: r.fullName,
        [t('qualification.monitoring.colCourse')]: r.courseName,
        [t('qualification.monitoring.colProgress')]: `${r.progressPercent}%`,
        [t('qualification.reports.testScore')]: r.testScore === null ? '—' : `${r.testScore}%`,
        [t('qualification.reports.certificate')]: r.hasCertificate
          ? t('qualification.reports.yes')
          : t('qualification.reports.no'),
      }));
      downloadExcel(xrows, 'hisobot-ozlashtirish', t('qualification.reports.typeProgress'), [
        5, 24, 26, 16, 12, 12,
      ]);
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageContainer title={t('qualification.reports.title')}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          style={{ width: 240 }}
          placeholder={t('qualification.reports.selectCourse')}
          options={courseOptions}
          value={course}
          onChange={(v) => {
            setCourse(v);
            setPage(1);
          }}
          showSearch
          optionFilterProp="label"
          allowClear
        />
        <RangePicker
          placeholder={[t('qualification.reports.dateFrom'), t('qualification.reports.dateTo')]}
          value={dateFrom && dateTo ? [dayjs(dateFrom), dayjs(dateTo)] : null}
          onChange={(v) => {
            setDateFrom(v?.[0] ? v[0].format('YYYY-MM-DD') : undefined);
            setDateTo(v?.[1] ? v[1].format('YYYY-MM-DD') : undefined);
            setPage(1);
          }}
        />
        <Flex align="center" gap={12} style={{ marginLeft: 'auto' }}>
          <Text type="secondary">{t('qualification.monitoring.count', { count: total })}</Text>
          <ExcelExportButton loading={exporting} disabled={total === 0} onClick={onExport} />
        </Flex>
      </div>

      <TableGap>
        <DataTable<ProgressReportRow>
          data={rows}
          columns={columns}
          loading={report.isFetching}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </TableGap>
    </PageContainer>
  );
}
