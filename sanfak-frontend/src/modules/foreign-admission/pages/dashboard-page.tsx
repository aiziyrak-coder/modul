import { useState } from 'react';
import { Button, Card, Empty, Flex, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageContainer } from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { useTranslation } from '@/shared/lib/i18n';
import { useApplicantStats } from '../api/foreign-admission-api';
import { useAcademicYears } from '../api/season-api';
import { refName } from '../model/content-lang';
import { useCountryLocalizer } from '../lib/use-country-localizer';
import { downloadExcelSheets } from '../lib/excel';
import { StatCard } from '../components/stat-card';
import { DirectionBars } from '../components/direction-bars';
import { PageBottomGap } from '../components/page-bottom-gap';

const AXIS = { fontSize: 11, fill: 'var(--color-text-mute, #94a3b8)' };
const BAR_IDLE = '#E5E7EB';
const BAR_ACTIVE = 'var(--brand-primary)';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const MONTHS_FULL: Record<string, string[]> = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

interface TooltipEntry {
  value: number;
}

function DarkTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#1e293b',
        color: '#fff',
        padding: '4px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {payload[0]?.value}
    </div>
  );
}

function fillMonths(raw: { month: string; count: number }[]): { name: string; value: number }[] {
  if (!raw.length) return [];
  const toIndex = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return (y ?? 0) * 12 + ((mo ?? 1) - 1);
  };
  const byIndex = new Map(raw.map((r) => [toIndex(r.month), r.count]));
  const first = toIndex(raw[0]!.month);
  const last = toIndex(raw[raw.length - 1]!.month);

  const out: { name: string; value: number }[] = [];
  for (let i = first; i <= last; i++) {
    out.push({ name: MONTHS[i % 12] ?? '', value: byIndex.get(i) ?? 0 });
  }
  return out;
}

export default function DashboardPage() {
  const { t, lang } = useTranslation();
  usePageTitle(t('foreignAdmission.nav.dashboard'));
  const [year, setYear] = useState<string>();
  const [exporting, setExporting] = useState(false);

  const academicYears = useAcademicYears();
  const { data, isLoading } = useApplicantStats(year ? { academicYear: year } : undefined);

  const localizeCountry = useCountryLocalizer();

  if (isLoading || !data) {
    return (
      <PageContainer title={t('foreignAdmission.nav.dashboard')}>
        <Flex justify="center" style={{ padding: 64 }}>
          <Spin size="large" />
        </Flex>
      </PageContainer>
    );
  }

  const months = fillMonths(data.byMonth);
  const countries = data.byCountry.map((c) => ({ name: localizeCountry(c.country), value: c.count }));
  const directions = data.byDirection.map((d) => ({
    id: d.id,
    name: refName(d, lang),
    count: d.count,
  }));

  const handleExport = () => {
    setExporting(true);
    const sheets = [
      {
        name: t('foreignAdmission.export.sheetKpi'),
        rows: [
          { [t('foreignAdmission.export.metric')]: t('foreignAdmission.kpi.total'), [t('foreignAdmission.export.value')]: data.total },
          { [t('foreignAdmission.export.metric')]: t('foreignAdmission.kpi.yangi'), [t('foreignAdmission.export.value')]: data.byStatus.new },
          { [t('foreignAdmission.export.metric')]: t('foreignAdmission.kpi.tasdiqlangan'), [t('foreignAdmission.export.value')]: data.byStatus.approved },
          { [t('foreignAdmission.export.metric')]: t('foreignAdmission.kpi.radEtilgan'), [t('foreignAdmission.export.value')]: data.byStatus.rejected },
        ],
        colWidths: [28, 12],
      },
      {
        name: t('foreignAdmission.export.sheetDirection'),
        rows: directions.map((d) => ({
          [t('foreignAdmission.export.name')]: d.name,
          [t('foreignAdmission.export.count')]: d.count,
        })),
        colWidths: [32, 10],
      },
      {
        name: t('foreignAdmission.export.sheetMonth'),
        rows: data.byMonth.map((m) => {
          const mo = Number(m.month.split('-')[1]);
          const names = MONTHS_FULL[lang] ?? MONTHS_FULL.uz!;
          return {
            [t('foreignAdmission.export.name')]: names[(mo || 1) - 1] ?? '',
            [t('foreignAdmission.export.count')]: m.count,
          };
        }),
        colWidths: [16, 10],
      },
      {
        name: t('foreignAdmission.export.sheetCountry'),
        rows: countries.map((c) => ({
          [t('foreignAdmission.export.name')]: c.name,
          [t('foreignAdmission.export.count')]: c.value,
        })),
        colWidths: [24, 10],
      },
    ];
    const fileName = `${t('foreignAdmission.nav.dashboard')}-${year || t('foreignAdmission.seasons.year_all')}-${dayjs().format('YYYY-MM-DD')}`;
    setTimeout(() => {
      try {
        downloadExcelSheets(sheets, fileName);
      } finally {
        setExporting(false);
      }
    }, 50);
  };

  return (
    <PageContainer title={t('foreignAdmission.nav.dashboard')}>
      <Flex align="center" gap={12} wrap className="fa-dashboard-toolbar" style={{ marginBottom: 12 }}>
        <style>{`.fa-dashboard-toolbar .ant-btn { height: 38px; }`}</style>
        <Select
          value={year}
          onChange={setYear}
          placeholder={t('foreignAdmission.seasons.year_all')}
          allowClear
          loading={academicYears.isLoading}
          style={{ width: 220, height: 38 }}
          options={(academicYears.data ?? []).map((y) => ({ value: y, label: y }))}
        />
        <div style={{ flex: 1 }} />
        <Button
          icon={<FileExcelOutlined />}
          loading={exporting}
          onClick={handleExport}
          style={{
            background: 'var(--brand-primary)',
            borderColor: 'var(--brand-primary)',
            color: '#fff',
          }}
        >
          {t('foreignAdmission.export.excel')}
        </Button>
      </Flex>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <StatCard
          icon={<ReadOutlined />}
          value={data.total}
          label={t('foreignAdmission.kpi.total')}
          bg="#DBEAFE"
          color="#2563EB"
        />
        <StatCard
          icon={<ClockCircleOutlined />}
          value={data.byStatus.new}
          label={t('foreignAdmission.kpi.yangi')}
          bg="#FEF3C7"
          color="#B45309"
        />
        <StatCard
          icon={<CheckCircleOutlined />}
          value={data.byStatus.approved}
          label={t('foreignAdmission.kpi.tasdiqlangan')}
          bg="#DCFCE7"
          color="#16A34A"
        />
        <StatCard
          icon={<CloseCircleOutlined />}
          value={data.byStatus.rejected}
          label={t('foreignAdmission.kpi.radEtilgan')}
          bg="#FEE2E2"
          color="#DC2626"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Card
          title={t('foreignAdmission.chart.by_direction')}
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          <DirectionBars items={directions} />
        </Card>

        <Card
          title={t('foreignAdmission.chart.by_month')}
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          {months.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={months} margin={{ left: -20, top: 6, bottom: 0, right: 4 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef2f6" />
                <XAxis
                  dataKey="name"
                  tick={AXIS}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={20}
                />
                <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip cursor={false} content={<DarkTooltip />} />
                <Bar
                  dataKey="value"
                  fill={BAR_IDLE}
                  activeBar={{ fill: BAR_ACTIVE }}
                  radius={[5, 5, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </div>

      <Card
        title={t('foreignAdmission.chart.by_country')}
        style={{ borderRadius: 'var(--radius-lg)' }}
      >
        {countries.length ? (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={countries} margin={{ left: -20, top: 6, bottom: 0, right: 4 }}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef2f6" />
              <XAxis
                dataKey="name"
                tick={{ ...AXIS, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                height={20}
              />
              <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip cursor={false} content={<DarkTooltip />} />
              <Bar
                dataKey="value"
                fill={BAR_IDLE}
                activeBar={{ fill: BAR_ACTIVE }}
                radius={[5, 5, 0, 0]}
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <PageBottomGap />
    </PageContainer>
  );
}
