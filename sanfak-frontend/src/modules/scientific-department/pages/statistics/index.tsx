import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, DatePicker, Empty, Segmented, Spin, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ApartmentOutlined,
  BankOutlined,
  BranchesOutlined,
  FileExcelOutlined,
  RightOutlined,
  DollarOutlined,
  FileTextOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { PageContainer, Flex } from '@/shared/ui';
import { useSessionStore, usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useContractsSeries,
  useScientificStatistics,
  type Granularity,
  type ScientificStatistics,
} from '../../api/statistics-api';
import { StatsWrap } from './style';
import { exportToExcel } from '../../lib/excel';

const OK = '#34c18c';
const WAIT = '#F0C000';
const BAD = '#F04438';

const ACCENTS = {
  green: { from: '#34c18c', to: '#12a67a' },
  blue: { from: '#4a82c8', to: '#2f6fb5' },
  pink: { from: '#e0409a', to: '#c02a80' },
  orange: { from: '#f59e0b', to: '#e07b05' },
  purple: { from: '#7c3aed', to: '#6025c9' },
  teal: { from: '#06b6d4', to: '#0891b2' },
} as const;
type Accent = keyof typeof ACCENTS;

const TYPES: { key: string; labelKey: string; color: string }[] = [
  { key: 'article', labelKey: 'scientificDepartment.nav.articles', color: '#2f6fb5' },
  { key: 'thesis', labelKey: 'scientificDepartment.nav.theses', color: '#4a82c8' },
  { key: 'monograph', labelKey: 'scientificDepartment.nav.monographs', color: '#6b96d0' },
  { key: 'methodical', labelKey: 'scientificDepartment.nav.methodical', color: '#8bb0dc' },
  { key: 'patent', labelKey: 'scientificDepartment.nav.patents', color: '#3f9fb0' },
  { key: 'copyright', labelKey: 'scientificDepartment.nav.certificates', color: '#5fb8bf' },
  { key: 'defense', labelKey: 'scientificDepartment.nav.defense', color: '#7fc9c2' },
  { key: 'degree', labelKey: 'scientificDepartment.nav.degrees', color: '#12a67a' },
  { key: 'title', labelKey: 'scientificDepartment.nav.titles', color: '#34c18c' },
  { key: 'conference', labelKey: 'scientificDepartment.nav.conferences', color: '#66d0a6' },
  { key: 'workPlan', labelKey: 'scientificDepartment.nav.workPlans', color: '#0f766e' },
  { key: 'annualReport', labelKey: 'scientificDepartment.nav.annualReports', color: '#1d8fa0' },
  { key: 'economicContract', labelKey: 'scientificDepartment.nav.contracts', color: '#527a9e' },
];

const PIE_COLORS = [
  '#3f74c0',
  '#22b0a0',
  '#f0a02a',
  '#8b5cf6',
  '#e0567a',
  '#2fa2d8',
  '#5fb84a',
  '#ef6b3d',
];
const SERIES = '#4a82c8';

const nf = new Intl.NumberFormat('uz-UZ');

const LIST_H = 300;

function Panel({
  accent,
  icon,
  title,
  hint,
  children,
  style,
  exportRows,
  to,
  toPermission,
}: {
  accent: Accent;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  exportRows?: () => Record<string, unknown>[];
  to?: string;
  toPermission?: string;
}) {
  const a = ACCENTS[accent];
  const { t } = useTranslation();
  const can = usePermission();
  const showLink = !!to && (!toPermission || can(toPermission));
  return (
    <div
      style={{
        background: `linear-gradient(90deg, ${a.from}, ${a.to}) no-repeat top / 100% 3px, #fff`,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        ...style,
      }}
    >
      <div style={{ padding: '17px 18px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Flex align="center" gap={10} style={{ marginBottom: 12 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
            }}
          >
            {icon}
          </span>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)' }}>
              {title}
            </div>
            {hint ? (
              <div style={{ fontSize: 11.5, color: 'var(--color-text-mute)' }}>{hint}</div>
            ) : null}
          </div>
          {exportRows ? (
            <Tooltip title={t('scientificDepartment.stats.exportExcel')}>
              <Button
                type="text"
                size="small"
                aria-label={t('scientificDepartment.stats.exportExcel')}
                icon={<FileExcelOutlined style={{ fontSize: 13 }} />}
                style={{
                  marginLeft: 'auto',
                  flexShrink: 0,
                  height: 22,
                  padding: '0 6px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: a.to,
                }}
                onClick={() => {
                  const rows = exportRows();
                  if (!rows.length) return;
                  const name = `${title}-${dayjs().format('YYYY-MM-DD')}`;
                  exportToExcel(rows, name, title);
                }}
              >
                Excel
              </Button>
            </Tooltip>
          ) : null}
          {showLink ? (
            <Link
              to={to as string}
              style={{
                marginLeft: exportRows ? 4 : 'auto',
                fontSize: 12.5,
                fontWeight: 500,
                color: a.to,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {t('scientificDepartment.stats.details')}
              <RightOutlined style={{ fontSize: 10 }} />
            </Link>
          ) : null}
        </Flex>
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  accent,
  icon,
  label,
  value,
}: {
  accent: Accent;
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  const a = ACCENTS[accent];
  return (
    <div
      style={{
        flex: '1 1 200px',
        minWidth: 185,
        background: `linear-gradient(90deg, ${a.from}, ${a.to}) no-repeat top / 100% 3px, #fff`,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
      }}
    >
      <Flex align="center" gap={12} style={{ padding: '17px 18px 14px' }}>
        <span
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 11,
            background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          {icon}
        </span>
        <div style={{ lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-mute)' }}>{label}</div>
        </div>
      </Flex>
    </div>
  );
}

function ChipLegend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <Flex gap={12} wrap style={{ marginTop: 10 }}>
      {items.map((x) => (
        <Flex key={x.name} align="center" gap={6}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 3,
              background: x.color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--color-text-soft)' }}>{x.name}</span>
        </Flex>
      ))}
    </Flex>
  );
}

const typeLabelKey = (key: string) =>
  TYPES.find((x) => x.key === key)?.labelKey ?? key;

function YearTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload?: Record<string, number | string> }[];
  label?: string;
}) {
  const { t: tt } = useTranslation();
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  const parts = TYPES.filter((x) => Number(row[x.key] || 0) > 0);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 4px 14px rgba(16,24,40,0.10)',
        minWidth: 190,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        {label} — {String(row.total ?? 0)}
      </div>
      {parts.map((x) => (
        <Flex key={x.key} align="center" justify="space-between" gap={14}>
          <Flex align="center" gap={6}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: x.color,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-soft)' }}>{tt(typeLabelKey(x.key))}</span>
          </Flex>
          <b style={{ fontSize: 12 }}>{String(row[x.key])}</b>
        </Flex>
      ))}
    </div>
  );
}

const CARD = { flex: '1 1 360px', minWidth: 320 } as const;
const AXIS = { fontSize: 12, fill: 'var(--color-text-soft)' } as const;
const noRows = (msg: string) => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={msg} />;

function ShareTile({
  name,
  value,
  share,
  color,
  rank,
}: {
  name: string;
  value: number;
  share: number;
  color: string;
  rank?: number;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '11px 14px 12px',
        borderRadius: 'var(--radius-md)',
        background: `color-mix(in srgb, ${color} 8%, #fff)`,
        border: `1px solid color-mix(in srgb, ${color} 22%, #fff)`,
      }}
    >
      <Flex align="center" justify="space-between" gap={12}>
        <Flex align="center" gap={9} style={{ minWidth: 0 }}>
          {rank ? (
            <span
              style={{
                flexShrink: 0,
                width: 19,
                height: 19,
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: color,
              }}
            >
              {rank}
            </span>
          ) : null}
          <span
            title={name}
            style={{
              fontSize: 13,
              color: 'var(--color-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        </Flex>
        <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
          <span
            style={{
              minWidth: 28,
              padding: '2px 9px',
              borderRadius: 999,
              background: `color-mix(in srgb, ${color} 18%, #fff)`,
              border: `1px solid color-mix(in srgb, ${color} 30%, #fff)`,
              color,
              fontSize: 14.5,
              fontWeight: 700,
              lineHeight: 1.35,
              textAlign: 'center',
            }}
          >
            {nf.format(value)}
          </span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--color-text-mute)',
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {share >= 10 ? Math.round(share) : Math.round(share * 10) / 10}%
          </span>
        </Flex>
      </Flex>
      <div
        style={{
          height: 5,
          marginTop: 9,
          borderRadius: 99,
          background: `color-mix(in srgb, ${color} 16%, #fff)`,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${share}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function RankList({
  rows,
  color,
  showRank,
}: {
  rows: { name: string; value: number; color?: string }[];
  color: string;
  showRank?: boolean;
}) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  const long = rows.length > 4;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
        alignContent: 'start',
        ...(long ? { height: LIST_H, overflowY: 'auto' as const } : {}),
      }}
    >
      {rows.map((r, i) => (
        <ShareTile
          key={r.name}
          name={r.name}
          value={r.value}
          share={total ? (r.value / total) * 100 : 0}
          color={r.color ?? color}
          rank={showRank ? i + 1 : undefined}
        />
      ))}
    </div>
  );
}

function Donut({
  rows,
  height = 230,
  centerLabel,
  stack,
}: {
  rows: { name: string; value: number; fill: string }[];
  height?: number;
  centerLabel?: string;
  stack?: boolean;
}) {
  const total = rows.reduce((a, x) => a + x.value, 0);
  const ring = Math.min(height, 210);
  return (
    <Flex
      gap={stack ? 16 : 20}
      align="center"
      wrap={!stack}
      vertical={stack}
      style={{ width: '100%', ...(stack ? { flex: 1 } : {}) }}
    >
      <div style={{ position: 'relative', width: ring, height: ring, flexShrink: 0 }}>
        <PieChart width={ring} height={ring}>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {rows.map((r) => (
                <Cell key={r.name} fill={r.fill} />
              ))}
            </Pie>
          </PieChart>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            lineHeight: 1.15,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)' }}>
            {nf.format(total)}
          </div>
          {centerLabel ? (
            <div style={{ fontSize: 11.5, color: 'var(--color-text-mute)', marginTop: 2 }}>
              {centerLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          ...(stack
            ? { width: '100%', flex: 1 }
            : {
                flex: '1 1 210px',
                maxHeight: ring,
                overflowY: 'auto' as const,
                alignContent: rows.length <= 4 ? 'center' : ('start' as const),
              }),
          minWidth: 0,
          display: 'grid',
          gridTemplateColumns: '1fr',
          ...(stack && rows.length <= 4 ? { gridAutoRows: '1fr' as const } : {}),
          gap: 10,
        }}
      >
        {rows.map((r) => (
          <ShareTile
            key={r.name}
            name={r.name}
            value={r.value}
            share={total ? (r.value / total) * 100 : 0}
            color={r.fill}
          />
        ))}
      </div>
    </Flex>
  );
}

export default function StatisticsPage() {
  const { t } = useTranslation();
  const user = useSessionStore((x) => x.user);
  const { data, isLoading } = useScientificStatistics();

  const [grain, setGrain] = useState<Granularity>('month');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const { data: series = [] } = useContractsSeries(grain, {
    from: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
    to: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
  });

  if (isLoading || !data) {
    return (
      <PageContainer title={t('scientificDepartment.stats.title')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  const s: ScientificStatistics = data;
  const noData = t('scientificDepartment.stats.noData');

  const sum = Object.values(s.byType).reduce(
    (a, v) => ({
      total: a.total + v.total,
      approved: a.approved + (v.approved || 0),
      pending: a.pending + (v.new || 0),
      rejected: a.rejected + (v.rejected || 0),
    }),
    { total: 0, approved: 0, pending: 0, rejected: 0 },
  );

  const share = (v: number, total: number) =>
    total ? Math.round((v / total) * 1000) / 10 : 0;

  const typeRows = TYPES.map((x) => ({
    name: t(x.labelKey),
    value: s.byType[x.key]?.total || 0,
    color: x.color,
  }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const statusRows = [
    { name: t('scientificDepartment.stats.approved'), value: sum.approved, fill: OK },
    { name: t('scientificDepartment.stats.pending'), value: sum.pending, fill: WAIT },
    { name: t('scientificDepartment.stats.rejected'), value: sum.rejected, fill: BAD },
  ].filter((d) => d.value > 0);

  const activeTypes = (rows: Record<string, unknown>[]) =>
    TYPES.filter((x) => rows.some((r) => Number(r[x.key] || 0) > 0));

  const deptRows = s.byDepartment.slice(0, 8).map((d) => ({ ...d, name: d.department }));
  const deptTypes = activeTypes(deptRows as unknown as Record<string, unknown>[]);

  const yearRows = s.byYear.map((y) => ({ ...y, name: y.year }));

  const facultyRows = s.byFaculty.slice(0, 8).map((f, i) => ({
    name: f.faculty,
    value: f.total,
    fill: PIE_COLORS[i % PIE_COLORS.length] ?? ACCENTS.teal.from,
  }));
  const directionRows = s.byDirection.slice(0, 8).map((d, i) => ({
    name: d.direction,
    value: d.total,
    fill: PIE_COLORS[(i + 3) % PIE_COLORS.length] ?? ACCENTS.pink.from,
  }));

  return (
    <PageContainer title={t('scientificDepartment.stats.title')}>
      <StatsWrap>
      <div
        style={{
          background:
            'linear-gradient(120deg, var(--brand-primary-soft), color-mix(in srgb, var(--brand-primary) 18%, #fff))',
          border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '18px 22px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-primary)' }}>
            {t('scientificDepartment.stats.bannerTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-soft)', marginTop: 4 }}>
            {t('scientificDepartment.stats.bannerDesc')}
          </div>
        </div>
        {user ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
              {t('scientificDepartment.dashboard.loggedIn')}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user.fullName}</div>
          </div>
        ) : null}
      </div>

      <Flex gap={16} wrap align="stretch" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Panel
          accent="green"
          icon={<TrophyOutlined />}
          title={t('scientificDepartment.stats.byType')}
          exportRows={() =>
            typeRows.map((r) => ({
              [t('scientificDepartment.stats.byType')]: r.name,
              [t('scientificDepartment.stats.count')]: r.value,
            }))
          }
          hint={t('scientificDepartment.stats.byTypeHint')}
          style={{ flex: '2 1 520px', minWidth: 320 }}
        >
          {typeRows.length ? (
            <ResponsiveContainer width="100%" height={Math.max(240, typeRows.length * 34 + 30)}>
              <BarChart
                data={typeRows}
                layout="vertical"
                margin={{ left: 8, right: 28, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f6" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={175}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12.5, fill: 'var(--color-text)' }}
                />
                <ReTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar
                  dataKey="value"
                  name={t('scientificDepartment.stats.count')}
                  radius={[0, 5, 5, 0]}
                  barSize={18}
                  fill={SERIES}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            noRows(noData)
          )}
        </Panel>

        <Panel
          accent="pink"
          icon={<SafetyCertificateOutlined />}
          title={t('scientificDepartment.stats.statusShare')}
          exportRows={() =>
            statusRows.map((r) => ({
              [t('scientificDepartment.stats.statusShare')]: r.name,
              [t('scientificDepartment.stats.count')]: r.value,
              '%': share(r.value, statusRows.reduce((a, x) => a + x.value, 0)),
            }))
          }
          hint={t('scientificDepartment.stats.statusShareHint')}
          style={{ flex: '1 1 300px', minWidth: 280 }}
        >
          {statusRows.length ? <Donut
              rows={statusRows}
              height={240}
              centerLabel={t('scientificDepartment.stats.total')}
              stack
            /> : noRows(noData)}
        </Panel>
      </Flex>

      <Panel
        accent="blue"
        icon={<RiseOutlined />}
        title={t('scientificDepartment.stats.byYear')}
        exportRows={() =>
          yearRows.map((y) => ({
            [t('scientificDepartment.stats.byYear')]: y.name,
            ...Object.fromEntries(
      TYPES.map((x) => [t(x.labelKey), Number((y as Record<string, unknown>)[x.key] || 0)]),
    ),
            [t('scientificDepartment.stats.total')]: y.total,
          }))
        }
        hint={t('scientificDepartment.stats.byYearHint')}
        style={{ marginBottom: 16 }}
      >
        {yearRows.length ? (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={yearRows} margin={{ left: 0, right: 14, top: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="ar-total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENTS.blue.from} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={ACCENTS.blue.from} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={AXIS} />
                <YAxis
                  allowDecimals={false}
                  width={34}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS}
                />
                <ReTooltip content={<YearTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name={t('scientificDepartment.stats.total')}
                  stroke={ACCENTS.blue.to}
                  strokeWidth={2.5}
                  fill="url(#ar-total)"
                  dot={{ r: 4, fill: ACCENTS.blue.to, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 6 }}>
              {t('scientificDepartment.stats.hoverHint')}
            </div>
          </>
        ) : (
          noRows(noData)
        )}
      </Panel>

      <Panel
        accent="purple"
        icon={<ApartmentOutlined />}
        title={t('scientificDepartment.stats.byDepartment')}
        exportRows={() =>
          deptRows.map((d) => ({
            [t('scientificDepartment.stats.byDepartment')]: d.name,
            ...Object.fromEntries(
      TYPES.map((x) => [t(x.labelKey), Number((d as Record<string, unknown>)[x.key] || 0)]),
    ),
            [t('scientificDepartment.stats.total')]: d.total,
          }))
        }
        hint={t('scientificDepartment.stats.byDepartmentHint')}
        style={{ marginBottom: 16 }}
      >
        {deptRows.length ? (
          <ResponsiveContainer width="100%" height={Math.max(240, deptRows.length * 62 + 60)}>
            <BarChart
              data={deptRows}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 6, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f6" />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={200}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12.5, fill: 'var(--color-text)' }}
              />
              <ReTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              {deptTypes.map((x, i) => (
                <Bar
                  key={x.key}
                  dataKey={x.key}
                  name={t(x.labelKey)}
                  stackId="d"
                  fill={x.color}
                  barSize={26}
                  radius={i === deptTypes.length - 1 ? [0, 5, 5, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          noRows(noData)
        )}
        {deptRows.length ? (
          <ChipLegend items={deptTypes.map((x) => ({ name: t(x.labelKey), color: x.color }))} />
        ) : null}
      </Panel>

      <Flex gap={16} wrap align="stretch" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Panel
          accent="teal"
          icon={<BankOutlined />}
          title={t('scientificDepartment.stats.byFaculty')}
          exportRows={() =>
            facultyRows.map((r) => ({
              [t('scientificDepartment.stats.byFaculty')]: r.name,
              [t('scientificDepartment.stats.count')]: r.value,
              '%': share(r.value, facultyRows.reduce((a, x) => a + x.value, 0)),
            }))
          }
          hint={t('scientificDepartment.stats.byFacultyHint')}
          style={CARD}
        >
          {facultyRows.length ? <Donut rows={facultyRows} centerLabel={t('scientificDepartment.stats.total')} /> : noRows(noData)}
        </Panel>
        <Panel
          accent="pink"
          icon={<BranchesOutlined />}
          title={t('scientificDepartment.stats.byDirection')}
          exportRows={() =>
            directionRows.map((r) => ({
              [t('scientificDepartment.stats.byDirection')]: r.name,
              [t('scientificDepartment.stats.count')]: r.value,
              '%': share(r.value, directionRows.reduce((a, x) => a + x.value, 0)),
            }))
          }
        to="/scientific-department/methodical"
        toPermission="methodicalRecommendation:readAll"
          hint={t('scientificDepartment.stats.byDirectionHint')}
          style={CARD}
        >
          {directionRows.length ? <Donut rows={directionRows} centerLabel={t('scientificDepartment.stats.total')} /> : noRows(noData)}
        </Panel>
      </Flex>

      <Flex gap={16} wrap align="stretch" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Panel
          accent="orange"
          icon={<SolutionOutlined />}
          title={t('scientificDepartment.stats.bySpecialty')}
          exportRows={() =>
            s.bySpecialty.map((x) => ({
              [t('scientificDepartment.stats.bySpecialty')]: x.specialty,
              [t('scientificDepartment.stats.count')]: x.total,
              '%': share(x.total, s.bySpecialty.reduce((a, y) => a + y.total, 0)),
            }))
          }
        to="/scientific-department/defense"
        toPermission="defense:read"
          hint={t('scientificDepartment.stats.bySpecialtyHint')}
          style={CARD}
        >
          {s.bySpecialty.length ? (
            <RankList
              rows={s.bySpecialty.slice(0, 8).map((x) => ({ name: x.specialty, value: x.total }))}
              color={ACCENTS.orange.from}
            />
          ) : (
            noRows(noData)
          )}
        </Panel>
        <Panel
          accent="green"
          icon={<TeamOutlined />}
          title={t('scientificDepartment.stats.topAuthors')}
          exportRows={() =>
            s.topAuthors.map((a, i) => ({
              '№': i + 1,
              [t('scientificDepartment.stats.topAuthors')]: a.name,
              [t('scientificDepartment.stats.count')]: a.count,
            }))
          }
          hint={t('scientificDepartment.stats.topAuthorsHint')}
          style={CARD}
        >
          {s.topAuthors.length ? (
            <RankList
              rows={s.topAuthors.slice(0, 8).map((a) => ({ name: a.name, value: a.count }))}
              color={ACCENTS.green.from}
              showRank
            />
          ) : (
            noRows(noData)
          )}
        </Panel>
      </Flex>

      <Flex gap={14} wrap style={{ marginBottom: 16, flexShrink: 0 }}>
        <Kpi
          accent="blue"
          icon={<TeamOutlined />}
          label={t('scientificDepartment.stats.hProfiles')}
          value={s.hIndex.profiles}
        />
        <Kpi
          accent="purple"
          icon={<RiseOutlined />}
          label={`Scopus · ${t('scientificDepartment.stats.avgMax')}`}
          value={`${s.hIndex.scopusAvg} / ${s.hIndex.scopusMax}`}
        />
        <Kpi
          accent="green"
          icon={<RiseOutlined />}
          label={`Scholar · ${t('scientificDepartment.stats.avgMax')}`}
          value={`${s.hIndex.scholarAvg} / ${s.hIndex.scholarMax}`}
        />
        <Kpi
          accent="teal"
          icon={<DollarOutlined />}
          label={t('scientificDepartment.stats.contracts')}
          value={nf.format(s.contracts.totalAmount)}
        />
      </Flex>

      <Panel
        accent="teal"
        icon={<DollarOutlined />}
        title={t('scientificDepartment.stats.contractsDynamics')}
        exportRows={() =>
          series.map((x) => ({
            [t('scientificDepartment.stats.contractsDynamics')]: x.period,
            [t('scientificDepartment.stats.amount')]: x.amount,
            [t('scientificDepartment.stats.contractsCount')]: x.count,
          }))
        }
        to="/scientific-department/industry-orders"
        toPermission="economicContract:readAll"
        hint={t('scientificDepartment.stats.contractsHint')}
        style={{ marginBottom: 16 }}
      >
        <Flex gap={12} wrap align="center" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-mute)' }}>
            {t('scientificDepartment.stats.periodTotal')}:{' '}
            <b style={{ color: 'var(--color-text)' }}>
              {nf.format(series.reduce((a, x) => a + x.amount, 0))}
            </b>{' '}
            · {series.reduce((a, x) => a + x.count, 0)} {t('scientificDepartment.stats.pcs')}
          </div>
          <div style={{ flex: 1 }} />
          {range ? (
            <a onClick={() => setRange(null)} style={{ fontSize: 12.5 }}>
              {t('scientificDepartment.stats.clear')}
            </a>
          ) : null}
          <Segmented
            size="small"
            value={grain}
            onChange={(v) => setGrain(v as Granularity)}
            options={[
              { value: 'year', label: t('scientificDepartment.stats.byYearUnit') },
              { value: 'month', label: t('scientificDepartment.stats.byMonthUnit') },
              { value: 'day', label: t('scientificDepartment.stats.byDayUnit') },
            ]}
          />
          <DatePicker.RangePicker
            size="small"
            value={range}
            onChange={(v) => setRange(v as [Dayjs | null, Dayjs | null] | null)}
            format="DD.MM.YYYY"
            allowEmpty={[true, true]}
            placeholder={[
              t('scientificDepartment.stats.dateFrom'),
              t('scientificDepartment.stats.dateTo'),
            ]}
          />
        </Flex>

        {!series.length ? (
          noRows(noData)
        ) : (
          <>
            <Flex gap={12} wrap style={{ marginBottom: 14 }}>
              {[
                {
                  label: t('scientificDepartment.stats.amount'),
                  value: nf.format(series.reduce((a, x) => a + x.amount, 0)),
                  color: ACCENTS.teal.to,
                },
                {
                  label: t('scientificDepartment.stats.contractsCount'),
                  value: nf.format(series.reduce((a, x) => a + x.count, 0)),
                  color: ACCENTS.blue.to,
                },
                {
                  label: t('scientificDepartment.stats.avgContract'),
                  value: nf.format(
                    Math.round(
                      series.reduce((a, x) => a + x.amount, 0) /
                        Math.max(1, series.reduce((a, x) => a + x.count, 0)),
                    ),
                  ),
                  color: ACCENTS.purple.to,
                },
              ].map((x) => (
                <div
                  key={x.label}
                  style={{
                    flex: '1 1 170px',
                    minWidth: 150,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'color-mix(in srgb, var(--color-border) 22%, #fff)',
                    lineHeight: 1.25,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, color: x.color }}>{x.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>{x.label}</div>
                </div>
              ))}
            </Flex>

            <ResponsiveContainer width="100%" height={250}>
              <AreaChart
                data={series.map((x) => ({ ...x, name: x.period }))}
                margin={{ left: 4, right: 16, top: 18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ct-amount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENTS.teal.from} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={ACCENTS.teal.from} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS}
                  padding={{ left: 24, right: 24 }}
                />
                <YAxis
                  width={70}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${Math.round(v / 1_000_000)} mln` : nf.format(v)
                  }
                />
                <ReTooltip formatter={(v) => nf.format(Number(v) || 0)} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name={t('scientificDepartment.stats.amount')}
                  stroke={ACCENTS.teal.to}
                  strokeWidth={2.5}
                  fill="url(#ct-amount)"
                  dot={{ r: 4, fill: ACCENTS.teal.to, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList
                    dataKey="amount"
                    position="top"
                    offset={10}
                    formatter={(v) => {
                      const n = Number(v) || 0;
                      return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} mln` : nf.format(n);
                    }}
                    style={{ fontSize: 11.5, fill: 'var(--color-text-soft)' }}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>

            {series.length === 1 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 6 }}>
                {t('scientificDepartment.stats.singlePointHint')}
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <Flex gap={16} wrap align="stretch" style={{ flexShrink: 0 }}>
        <Panel
          accent="orange"
          icon={<FileTextOutlined />}
          title={t('scientificDepartment.stats.exam')}
          exportRows={() => {
            const rows = [
              [t('scientificDepartment.stats.approved'), s.exam.approved ?? 0],
              [t('scientificDepartment.stats.pending'), s.exam.new ?? 0],
              [t('scientificDepartment.stats.rejected'), s.exam.rejected ?? 0],
            ] as [string, number][];
            const total = rows.reduce((a, [, v]) => a + v, 0);
            return rows.map(([name, value]) => ({
              [t('scientificDepartment.stats.statusShare')]: name,
              [t('scientificDepartment.stats.count')]: value,
              '%': share(value, total),
            }));
          }}
        to="/scientific-department/qualification-exam"
        toPermission="qualifyingApplicant:readAll"
          hint={t('scientificDepartment.stats.examHint')}
          style={CARD}
        >
          {s.exam.total ? (
            <Donut
              rows={[
                {
                  name: t('scientificDepartment.stats.approved'),
                  value: s.exam.approved ?? 0,
                  fill: OK,
                },
                {
                  name: t('scientificDepartment.stats.pending'),
                  value: s.exam.new ?? 0,
                  fill: WAIT,
                },
                {
                  name: t('scientificDepartment.stats.rejected'),
                  value: s.exam.rejected ?? 0,
                  fill: BAD,
                },
              ].filter((x) => x.value > 0)}
              height={230}
              centerLabel={t('scientificDepartment.stats.examTotal')}
            />
          ) : (
            noRows(noData)
          )}
        </Panel>

        <Panel
          accent="blue"
          icon={<SolutionOutlined />}
          title={t('scientificDepartment.stats.examBySpecialty')}
          exportRows={() =>
            s.exam.bySpecialty.map((x) => ({
              [t('scientificDepartment.stats.examBySpecialty')]: x.label || x.key,
              [t('scientificDepartment.stats.count')]: x.count,
              '%': share(x.count, s.exam.bySpecialty.reduce((a, y) => a + y.count, 0)),
            }))
          }
        to="/scientific-department/exam-specialties"
        toPermission="examSpecialty:create"
          hint={t('scientificDepartment.stats.examBySpecialtyHint')}
          style={CARD}
        >
          {s.exam.bySpecialty.length ? (
            <RankList
              rows={s.exam.bySpecialty.map((x) => ({
                name:
                  x.label && x.label !== x.key
                    ? x.label
                    : `${x.key} — ${t('scientificDepartment.stats.unknownSpecialty')}`,
                value: x.count,
              }))}
              color={ACCENTS.blue.from}
            />
          ) : (
            noRows(noData)
          )}
        </Panel>
      </Flex>

      <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
      </StatsWrap>
    </PageContainer>
  );
}
