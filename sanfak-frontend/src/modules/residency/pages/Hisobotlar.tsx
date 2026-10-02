import { useState } from 'react';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { useAcademicYears, withCurrent } from '../api/reference-api';
import { MdBarChart, MdDownload, MdSearch } from '../icons';
import { Select } from '@/shared/ui';
import {
  PageTitle,
  StatCards,
  FilterBar,
  Btn,
  Tabs,
  Tab,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import StatCard from '../components/common/StatCard';
import { useReport } from '../api/report-api';
import { ATTENDANCE_BANDS, CHART_PALETTE, SCORE_BANDS } from '../api/report-types';
import type { FullReport } from '../api/report-types';
import { useSpecialties } from '../api/residency-api';
import { usePermission } from '@/app/session';
import { theme } from '../styles/theme';
import { downloadExcelAoa, reportFileName } from '../lib/excel';
import type { ExcelAoaSheet } from '../lib/excel';


const CHART_H = 300;

type TabKey = 'umumiy' | 'davomat' | 'ball' | 'kontingent';

function buildReportSheets(
  r: FullReport,
  meta: { academicYear: string; specialty: string; withContingent: boolean },
): ExcelAoaSheet[] {
  const s = r.summary;
  const sheets: ExcelAoaSheet[] = [];

  sheets.push({
    name: 'Umumiy',
    colWidths: [32, 18],
    aoa: [
      ['Magistratura va klinik ordinatura — hisobot'],
      ['O‘quv yili', meta.academicYear || 'Barchasi'],
      ['Mutaxassislik', meta.specialty || 'Barchasi'],
      [],
      ['Ko‘rsatkich', 'Qiymat'],
      ['Jami talabalar', s.totalStudents],
      ['O‘rtacha davomat (%)', s.avgAttendance],
      ['O‘rtacha ball', s.avgScore],
      ['Bajarilgan baholashlar', s.completedAssessments],
      [],
      ['Magistrantlar', s.magistrants],
      ['Rezidentlar', s.rezidentlar],
      ['Byudjet', s.byudjet],
      ['Shartnoma', s.shartnoma],
    ],
  });

  const br = r.attendanceBreakdown;
  sheets.push({
    name: 'Davomat',
    colWidths: [14, 12, 14, 12, 12],
    aoa: [
      ['Oy', 'Kelgan', 'Kelmagan', 'Sababli', 'Foiz (%)'],
      ...r.attendanceMonthly.map((m) => [
        `${m.label} ${m.year}`,
        m.present,
        m.absent,
        m.excused,
        m.percent,
      ]),
      [],
      ['Jami', br.present, br.absent, br.excused, br.total],
    ],
  });

  const d = r.scoreDistribution;
  sheets.push({
    name: 'Ball',
    colWidths: [40, 16, 14],
    aoa: [
      ['Fan', 'O‘rtacha ball', 'Baholar soni'],
      ...r.scoreByScience.map((x) => [x.title, x.avgScore, x.count]),
      [],
      ['Ball taqsimoti', 'Soni'],
      ...SCORE_BANDS.map((b) => [b.label, d[b.key]]),
    ],
  });

  if (meta.withContingent) {
    sheets.push({
      name: 'Kontingent',
      colWidths: [40, 18],
      aoa: [
        ['Mutaxassislik', 'Talabalar soni'],
        ...r.specialtyDistribution.map((x) => [x.title, x.count]),
        [],
        ['Ta’lim turi', 'Soni'],
        ['Byudjet', r.fundingDistribution.byudjet],
        ['Shartnoma', r.fundingDistribution.shartnoma],
        [],
        ['O‘qish muddati', 'Talabalar soni'],
        ...r.studyPeriodDistribution.map((x) => [x.title, x.count]),
      ],
    });
  }

  sheets.push({
    name: 'Amaliyot',
    colWidths: [40, 18, 16, 16],
    aoa: [
      ['Klinik amaliyot faolligi', ''],
      ['Jami kundalik yozuvlari', r.clinicalActivity.total],
      ['Tasdiqlangan', r.clinicalActivity.byStatus.tasdiqlangan],
      ['Kutilmoqda', r.clinicalActivity.byStatus.kutilmoqda],
      ['Qaytarilgan', r.clinicalActivity.byStatus.qaytarilgan],
      ['Kundalik yuritayotgan rezidentlar', r.clinicalActivity.activeResidents],
      ['Kundalik yuritmayotganlar', r.clinicalActivity.silentResidents],
      ['Har rezidentga o‘rtacha', r.clinicalActivity.avgPerResident],
      [],
      ['Ilmiy rahbar / klinik ustoz', 'Jami', 'Magistrant', 'Rezident'],
      ...r.supervisorWorkload.map((x) => [x.name, x.total, x.magistratura, x.ordinatura]),
    ],
  });

  return sheets;
}

interface Slice {
  name: string;
  value: number;
  color: string;
}

const paletteAt = (i: number): string =>
  CHART_PALETTE[i % CHART_PALETTE.length] ?? theme.colors.primary;

const percentLabel = ({ percent }: PieLabelRenderProps): string =>
  typeof percent === 'number' && percent >= 0.05 ? `${Math.round(percent * 100)}%` : '';

const pct = (value: number, total: number): number =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const Spacer = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const HintText = styled.span`
  font-size: 12px;
  color: ${({ theme: t }) => t.colors.textLight};
`;

const Notice = styled.div<{ $error?: boolean }>`
  padding: 28px;
  text-align: center;
  font-size: 13px;
  border-radius: 14px;
  border: 1px solid ${({ theme: t }) => t.colors.border};
  background: ${({ theme: t }) => t.colors.white};
  color: ${({ theme: t, $error }) => ($error ? t.colors.danger : t.colors.textMuted)};
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.div`
  background: ${({ theme: t }) => t.colors.white};
  border: 1px solid ${({ theme: t }) => t.colors.border};
  border-radius: 14px;
  box-shadow: ${({ theme: t }) => t.shadow.sm};
  padding: 18px 20px;
`;

const ChartTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme: t }) => t.colors.text};
  margin-bottom: 14px;
`;

const EmptyBox = styled.div<{ $h: number }>`
  height: ${({ $h }) => $h}px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme: t }) => t.colors.textMuted};
`;

const BandRow = styled.div`
  margin-bottom: 18px;
  &:last-child {
    margin-bottom: 0;
  }
`;

const BandHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  color: ${({ theme: t }) => t.colors.text};
  margin-bottom: 6px;
`;

const BandValue = styled.span`
  font-weight: 600;
`;

const ProgressTrack = styled.div`
  height: 10px;
  border-radius: 999px;
  background: ${({ theme: t }) => t.colors.bg};
  border: 1px solid ${({ theme: t }) => t.colors.border};
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $color: string; $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ $color }) => $color};
  border-radius: 999px;
  transition: width 0.3s;
`;

const BandsBox = styled.div<{ $h: number }>`
  min-height: ${({ $h }) => $h}px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const TotalNote = styled.div`
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid ${({ theme: t }) => t.colors.border};
  font-size: 12px;
  color: ${({ theme: t }) => t.colors.textMuted};
`;

interface ChartPanelProps {
  title: string;
  empty: boolean;
  height?: number;
  children: ReactNode;
}

function ChartPanel({ title, empty, height = CHART_H, children }: ChartPanelProps) {
  return (
    <ChartCard>
      <ChartTitle>
        <MdBarChart size={15} /> {title}
      </ChartTitle>
      {empty ? (
        <EmptyBox $h={height}>
          <MdSearch /> Ma’lumot topilmadi
        </EmptyBox>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export default function Hisobotlar() {
  const { data: academicYears = [] } = useAcademicYears();

  const can = usePermission();
  const isRahbar = !can('resident:create');

  const [tab, setTab] = useState<TabKey>('umumiy');
  const [academicYear, setAcademicYear] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const activeTab: TabKey = tab === 'kontingent' && isRahbar ? 'umumiy' : tab;

  const { data: specialties = [] } = useSpecialties();
  const {
    data: report,
    isFetching,
    isError,
  } = useReport({
    academicYear: academicYear || undefined,
    specialty: isRahbar ? undefined : specialty || undefined,
  });

  const onExport = async () => {
    if (!report) return;
    setExporting(true);
    setExportError('');
    try {
      const academicYearTitle =
        academicYears.find((y) => y.id === academicYear)?.title ?? academicYear;
      const sheets = buildReportSheets(report, {
        academicYear: academicYearTitle,
        specialty: specialties.find((s) => s.id === specialty)?.title ?? '',
        withContingent: !isRahbar,
      });
      await downloadExcelAoa(sheets, reportFileName('hisobot', academicYearTitle));
    } catch {
      setExportError('Faylni yaratib bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageTitle>Hisobotlar</PageTitle>

      <FilterBar>
        <Select
          value={academicYear}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setAcademicYear(value)}
          options={[
            { value: '', label: 'Barcha o‘quv yili' },
            ...withCurrent(academicYears, academicYear).map((y) => ({
              value: y.id,
              label: y.title,
            })),
          ]}
        />

        {!isRahbar && (
          <Select
            value={specialty}
            showSearch
            optionFilterProp="label"
            style={{ width: 'auto', minWidth: 150 }}
            onChange={(value) => setSpecialty(value)}
            options={[
              { value: '', label: 'Mutaxassislik — barchasi' },
              ...specialties.map((s) => ({ value: s.id, label: s.title })),
            ]}
          />
        )}

        <Spacer>
          {exportError && <HintText>{exportError}</HintText>}
          <Btn $variant="primary" onClick={onExport} disabled={!report || exporting || isFetching}>
            <MdDownload /> {exporting ? 'Tayyorlanmoqda…' : 'Hisobotni yuklab olish'}
          </Btn>
        </Spacer>
      </FilterBar>

      {isFetching && (
        <Notice>{report ? 'Hisobot yangilanmoqda…' : 'Hisobot yuklanmoqda…'}</Notice>
      )}

      {!isFetching && (isError || !report) && (
        <Notice $error>Hisobotni yuklashda xatolik yuz berdi. Keyinroq urinib ko‘ring.</Notice>
      )}

      {!isError && report && (
        <div
          aria-busy={isFetching}
          style={{ opacity: isFetching ? 0.55 : 1, transition: 'opacity 150ms ease' }}
        >
          <ReportBody
            report={report}
            activeTab={activeTab}
            onTab={setTab}
            showKontingent={!isRahbar}
          />
        </div>
      )}
    </div>
  );
}

interface ReportBodyProps {
  report: FullReport;
  activeTab: TabKey;
  onTab: (t: TabKey) => void;
  showKontingent: boolean;
}

function ReportBody({ report, activeTab, onTab, showKontingent }: ReportBodyProps) {
  const { summary, attendanceMonthly, attendanceBreakdown, specialtyDistribution } = report;
  const { fundingDistribution, scoreByScience, scoreDistribution } = report;
  const { studyPeriodDistribution, clinicalActivity, supervisorWorkload } = report;

  const specialtySlices: Slice[] = specialtyDistribution.map((s, i) => ({
    name: s.title,
    value: s.count,
    color: paletteAt(i),
  }));

  const scoreSlices: Slice[] = SCORE_BANDS.map((b) => ({
    name: b.label,
    value: scoreDistribution[b.key],
    color: b.color,
  }));

  const fundingSlices: Slice[] = [
    { name: 'Byudjet', value: fundingDistribution.byudjet, color: paletteAt(1) },
    { name: 'Shartnoma', value: fundingDistribution.shartnoma, color: paletteAt(6) },
  ];

  const attendanceColor = ATTENDANCE_BANDS[0].color;

  const noMonthly = attendanceMonthly.length === 0;
  const noSpecialty = specialtySlices.every((s) => s.value === 0);
  const noScoreDist = scoreSlices.every((s) => s.value === 0);
  const noFunding = fundingSlices.every((s) => s.value === 0);
  const noScience = scoreByScience.length === 0;
  const noBreakdown = attendanceBreakdown.total === 0;

  const studyPeriodSlices: Slice[] = studyPeriodDistribution.map((r, i) => ({
    name: r.title,
    value: r.count,
    color: paletteAt(i),
  }));
  const noStudyPeriod = studyPeriodSlices.every((r) => r.value === 0);

  const noSupervisors = supervisorWorkload.length === 0;
  const supervisorH = Math.max(CHART_H, supervisorWorkload.length * 38);

  const clinicalSlices: Slice[] = [
    { name: 'Kundalik yuritmoqda', value: clinicalActivity.activeResidents, color: paletteAt(1) },
    { name: 'Yuritmayapti', value: clinicalActivity.silentResidents, color: paletteAt(6) },
  ];
  const noClinical = clinicalSlices.every((r) => r.value === 0);

  const scienceH = Math.max(CHART_H, scoreByScience.length * 38);

  const gridStroke = theme.colors.border;
  const tickStyle = { fontSize: 11, fill: theme.colors.textMuted };
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 12,
  };
  const legendStyle = { fontSize: 12 };

  return (
    <>
      <StatCards>
        <StatCard
          icon="👥"
          iconBg={theme.colors.infoLight}
          number={summary.totalStudents}
          label="Jami talabalar"
        />
        <StatCard
          icon="📈"
          iconBg={theme.colors.successLight}
          number={`${Math.round(summary.avgAttendance)}%`}
          label="O‘rtacha davomat"
        />
        <StatCard
          icon="⭐"
          iconBg={theme.colors.warningLight}
          number={Math.round(summary.avgScore)}
          label="O‘rtacha ball"
        />
        <StatCard
          icon="📝"
          iconBg={theme.colors.dangerLight}
          number={summary.completedAssessments}
          label="Bajarilgan baholashlar"
        />
      </StatCards>

      <Tabs>
        <Tab $active={activeTab === 'umumiy'} onClick={() => onTab('umumiy')}>
          Umumiy statistika
        </Tab>
        <Tab $active={activeTab === 'davomat'} onClick={() => onTab('davomat')}>
          Davomat
        </Tab>
        <Tab $active={activeTab === 'ball'} onClick={() => onTab('ball')}>
          Ball / Baholash
        </Tab>
        {showKontingent && (
          <Tab $active={activeTab === 'kontingent'} onClick={() => onTab('kontingent')}>
            Kontingent
          </Tab>
        )}
      </Tabs>

      {activeTab === 'umumiy' && (
        <>
          <Grid2>
            <ChartPanel title="Oylik davomat foizi" empty={noMonthly}>
              <BarChart data={attendanceMonthly} margin={{ top: 5, right: 10, bottom: 5, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="label" tick={tickStyle} />
                <YAxis
                  domain={[0, 100]}
                  tick={tickStyle}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="percent"
                  name="Davomat"
                  unit="%"
                  fill={attendanceColor}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartPanel>

            <ChartPanel title="Mutaxassislik bo‘yicha taqsimot" empty={noSpecialty}>
              <PieChart>
                <Pie
                  data={specialtySlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  label={percentLabel}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {specialtySlices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={9}
                  wrapperStyle={legendStyle}
                />
              </PieChart>
            </ChartPanel>
          </Grid2>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Ko‘rsatkich</Th>
                  <Th style={{ width: 200 }}>Qiymat</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>Magistrantlar</Td>
                  <Td>{summary.magistrants}</Td>
                </Tr>
                <Tr>
                  <Td>Rezidentlar (klinik ordinatura)</Td>
                  <Td>{summary.rezidentlar}</Td>
                </Tr>
                <Tr>
                  <Td>Byudjet asosida</Td>
                  <Td>{summary.byudjet}</Td>
                </Tr>
                <Tr>
                  <Td>Shartnoma asosida</Td>
                  <Td>{summary.shartnoma}</Td>
                </Tr>
                <Tr>
                  <Td>O‘rtacha davomat</Td>
                  <Td>{Math.round(summary.avgAttendance)}%</Td>
                </Tr>
                <Tr>
                  <Td>O‘rtacha ball</Td>
                  <Td>{Math.round(summary.avgScore)}</Td>
                </Tr>
              </tbody>
            </Table>
          </TableWrap>

          <Grid2>
            <ChartPanel title="O‘qish muddati bo‘yicha taqsimot" empty={noStudyPeriod}>
              <PieChart>
                <Pie
                  data={studyPeriodSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  label={percentLabel}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {studyPeriodSlices.map((r) => (
                    <Cell key={r.name} fill={r.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={9}
                  wrapperStyle={legendStyle}
                />
              </PieChart>
            </ChartPanel>

            <ChartPanel title="Klinik amaliyot faolligi" empty={noClinical}>
              <PieChart>
                <Pie
                  data={clinicalSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  label={percentLabel}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {clinicalSlices.map((r) => (
                    <Cell key={r.name} fill={r.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={9}
                  wrapperStyle={legendStyle}
                />
              </PieChart>
            </ChartPanel>
          </Grid2>

          <TotalNote>
            Kundalik yozuvlari: <b>{clinicalActivity.total}</b> · tasdiqlangan{' '}
            <b>{clinicalActivity.byStatus.tasdiqlangan}</b> · kutilmoqda{' '}
            <b>{clinicalActivity.byStatus.kutilmoqda}</b> · qaytarilgan{' '}
            <b>{clinicalActivity.byStatus.qaytarilgan}</b> · har rezidentga o‘rtacha{' '}
            <b>{clinicalActivity.avgPerResident}</b>
          </TotalNote>

          <ChartCard style={{ height: supervisorH + 56 }}>
            <ChartTitle>Ilmiy rahbar / klinik ustoz yuklamasi</ChartTitle>
            {noSupervisors ? (
              <EmptyBox $h={supervisorH}>Biriktirilgan ustoz yo‘q</EmptyBox>
            ) : (
              <ResponsiveContainer width="100%" height={supervisorH}>
                <BarChart
                  data={supervisorWorkload}
                  layout="vertical"
                  margin={{ top: 5, right: 16, bottom: 5, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis type="number" allowDecimals={false} tick={tickStyle} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={tickStyle}
                    interval={0}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={9}
                    wrapperStyle={legendStyle}
                  />
                  <Bar dataKey="magistratura" name="Magistrant" stackId="s" fill={paletteAt(1)} />
                  <Bar
                    dataKey="ordinatura"
                    name="Rezident"
                    stackId="s"
                    fill={paletteAt(6)}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}

      {activeTab === 'davomat' && (
        <Grid2>
          <ChartPanel title="Oylik davomat trendi" empty={noMonthly}>
            <LineChart data={attendanceMonthly} margin={{ top: 5, right: 12, bottom: 5, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="label" tick={tickStyle} />
              <YAxis domain={[0, 100]} tick={tickStyle} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="percent"
                name="Davomat"
                unit="%"
                stroke={attendanceColor}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartPanel>

          <ChartCard>
            <ChartTitle>
              <MdBarChart size={15} /> Davomat holati taqsimoti
            </ChartTitle>
            {noBreakdown ? (
              <EmptyBox $h={CHART_H}>
                <MdSearch /> Ma’lumot topilmadi
              </EmptyBox>
            ) : (
              <BandsBox $h={CHART_H}>
                {ATTENDANCE_BANDS.map((b) => {
                  const value = attendanceBreakdown[b.key];
                  const share = pct(value, attendanceBreakdown.total);
                  return (
                    <BandRow key={b.key}>
                      <BandHead>
                        <span>{b.label}</span>
                        <BandValue>
                          {value} ta ({share}%)
                        </BandValue>
                      </BandHead>
                      <ProgressTrack>
                        <ProgressFill $color={b.color} $pct={share} />
                      </ProgressTrack>
                    </BandRow>
                  );
                })}
                <TotalNote>Jami qayd etilgan darslar: {attendanceBreakdown.total} ta</TotalNote>
              </BandsBox>
            )}
          </ChartCard>
        </Grid2>
      )}

      {activeTab === 'ball' && (
        <Grid2>
          <ChartPanel
            title="Fanlar bo‘yicha o‘rtacha ball"
            empty={noScience}
            height={scienceH}
          >
            <BarChart
              data={scoreByScience}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" domain={[0, 100]} tick={tickStyle} />
              <YAxis type="category" dataKey="title" tick={tickStyle} width={140} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="avgScore"
                name="O‘rtacha ball"
                fill={paletteAt(1)}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ChartPanel>

          <ChartPanel title="Ball taqsimoti" empty={noScoreDist}>
            <PieChart>
              <Pie
                data={scoreSlices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={90}
                label={percentLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {scoreSlices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={9}
                wrapperStyle={legendStyle}
              />
            </PieChart>
          </ChartPanel>
        </Grid2>
      )}

      {activeTab === 'kontingent' && showKontingent && (
        <Grid2>
          <ChartPanel title="Mutaxassislik bo‘yicha talabalar soni" empty={noSpecialty}>
            <BarChart
              data={specialtyDistribution}
              margin={{ top: 5, right: 10, bottom: 5, left: -18 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="title"
                tick={tickStyle}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={72}
              />
              <YAxis allowDecimals={false} tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Talabalar" radius={[4, 4, 0, 0]}>
                {specialtyDistribution.map((s, i) => (
                  <Cell key={s.title} fill={paletteAt(i)} />
                ))}
              </Bar>
            </BarChart>
          </ChartPanel>

          <ChartPanel title="Ta’lim turi (byudjet / shartnoma)" empty={noFunding}>
            <PieChart>
              <Pie
                data={fundingSlices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={90}
                label={percentLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {fundingSlices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={9}
                wrapperStyle={legendStyle}
              />
            </PieChart>
          </ChartPanel>
        </Grid2>
      )}
    </>
  );
}
