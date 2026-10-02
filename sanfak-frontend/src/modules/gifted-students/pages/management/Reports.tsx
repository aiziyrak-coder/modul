import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Input, Select } from '@/shared/ui';
import { CardWrap, CardHeader, CardTitle } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import type { Column } from '../../components/common/Table';
import { useToast } from '../../components/common/Toast';
import Loader from '../../components/common/Loader';
import {
  useStudents, useAchievements, useApplications, useScholarships, useDocumentTypes, fetchRankingXlsx,
  useAcademicYears, useFaculties, useCourses,
} from '../../api/gifted-api';
import { courseNumbers } from '../../lib/courses';
import { normalizeSearch } from '../../lib/use-debounced';
import { isScholarshipWinner } from '../../lib/scholarship-score';
import type { Activity, RankingStudent, StudentRecord } from '../../data/types';
import {
  MdDownload, MdPerson, MdSchool, MdTrendingUp,
  MdFilterList, MdStarRate, MdClose, MdCalendarToday,
} from '../../icons';
import { currentAcademicYear } from '../../lib/academic-years';
import { rankingScore } from '../../lib/report-year';

const COLORS = ['var(--brand-primary)', '#3498DB', '#F39C12', '#9B59B6'];

interface Winner {
  studentId: string;
  student: StudentRecord;
  scholarshipNames: string[];
}

export default function ManagementReports() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [drawerStudent, setDrawerStudent] = useState<RankingStudent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAllRanking, setShowAllRanking] = useState(false);

  const [filterYear, setFilterYear] = useState<string>(currentAcademicYear());

  const { data: students = [], isLoading } = useStudents();
  const { data: allAchievements = [] } = useAchievements();
  const { data: allApplications = [] } = useApplications();
  const { data: scholarships = [] } = useScholarships();
  const { data: docTypes = [] } = useDocumentTypes();
  const { data: yearRows = [] } = useAcademicYears();
  const { data: facultyRows = [] } = useFaculties();
  const { data: courseRows = [] } = useCourses();

  if (isLoading) return <Loader text="Hisobot yuklanmoqda..." />;

  const ranking: RankingStudent[] = students.map(s => {
    const acts = allAchievements.filter(a => a.studentId === s.id);
    return {
      id: s.id,
      name: s.name,
      faculty: s.faculty,
      direction: s.direction,
      course: s.course,
      group: s.group,
      totalScore: s.totalScore ?? 0,

      yearScore: rankingScore(s, filterYear),
      activitiesCount: acts.length,
      approvedCount: acts.filter(a => a.status === 'approved').length,
      rank: 0,
      academicYear: s.academicYear,
    };
  });

  const academicYears = [...new Set([
    ...yearRows.map(y => y.title),
    ...ranking.map(s => s.academicYear),
    ...allApplications.map(a => a.academicYear),
  ].filter(Boolean))].sort().reverse();
  const faculties: string[] = ['all', ...[...new Set([
    ...facultyRows.map(f => f.title),
    ...ranking.map(s => s.faculty).filter(Boolean),
  ])].sort()];
  const courses: Array<string | number> = ['all', ...[...new Set([
    ...courseNumbers(courseRows),
    ...ranking.map(s => s.course).filter(c => c !== null && c !== undefined),
  ])].sort((a, b) => Number(a) - Number(b))];

  const nomdorSchIds = new Set(scholarships.filter(s => s.type === 'nomdor').map(s => s.id));
  const rektorSchIds = new Set(scholarships.filter(s => s.type === 'rektor').map(s => s.id));

  const appsForYear = filterYear === 'all'
    ? allApplications
    : allApplications.filter(a => a.academicYear === filterYear);

  const nomdorCount = new Set(appsForYear.filter(a => nomdorSchIds.has(a.scholarshipId)).map(a => a.studentId)).size;
  const rektorCount = new Set(appsForYear.filter(a => rektorSchIds.has(a.scholarshipId)).map(a => a.studentId)).size;

  const buildWinners = (schIds: Set<string>): Winner[] => {
    const byStudent = new Map<string, Winner>();
    for (const a of appsForYear) {
      if (!schIds.has(a.scholarshipId)) continue;
      const sch = scholarships.find(s => s.id === a.scholarshipId);
      if (!isScholarshipWinner(a, sch)) continue;
      const student = students.find(s => s.id === a.studentId);
      if (!student) continue;
      const row = byStudent.get(a.studentId);
      const name = sch?.name ?? a.scholarshipName;
      if (row) {
        if (name && !row.scholarshipNames.includes(name)) row.scholarshipNames.push(name);
      } else {
        byStudent.set(a.studentId, {
          studentId: a.studentId,
          student,
          scholarshipNames: name ? [name] : [],
        });
      }
    }
    return [...byStudent.values()];
  };
  const nomdorWinners = buildWinners(nomdorSchIds);
  const rektorWinners = buildWinners(rektorSchIds);

  const filteredRanking = ranking;

  const searchTerm = normalizeSearch(search);

  const filtered = [...filteredRanking]
    .sort((a, b) =>
      b.yearScore - a.yearScore
      || b.totalScore - a.totalScore
      || a.name.localeCompare(b.name))
    .map((s, i) => ({ ...s, rank: i + 1 }))
    .filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFac = filterFaculty === 'all' || s.faculty === filterFaculty;
      const matchCourse = filterCourse === 'all' || String(s.course) === String(filterCourse);
      return matchSearch && matchFac && matchCourse;
    });

  const chartData = Object.entries(
    filteredRanking.reduce<Record<string, { sum: number; count: number }>>((acc, s) => {
      const f = s.faculty || '—';
      if (!acc[f]) acc[f] = { sum: 0, count: 0 };
      acc[f].sum += s.yearScore;
      acc[f].count += 1;
      return acc;
    }, {})
  ).map(([faculty, { sum, count }]) => ({ faculty, avgScore: count ? Math.round(sum / count) : 0, students: count }));

  const isPersonal = (act: Activity) =>
    docTypes.find(d => d.id === act.criteriaId)?.personal === true;

  const studentActivities = (id: string) =>
    allAchievements.filter(a => a.studentId === id && a.status === 'approved' && !isPersonal(a));

  const handleExport = async () => {
    try {
      toast("Hisobot .xlsx formatda yuklanmoqda...", 'info');
      const q: Record<string, string> = {};

      if (filterYear !== 'all') q.scoreYear = filterYear;
      if (filterFaculty !== 'all') {
        q.faculty = facultyRows.find((f) => f.title === filterFaculty)?.id ?? filterFaculty;
      }
      if (filterCourse !== 'all') q.course = String(filterCourse);
      if (searchTerm) q.search = searchTerm;
      const blob = await fetchRankingXlsx(q);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'iqtidorli-talabalar-reyting.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Hisobot muvaffaqiyatli yuklandi!", 'success');
    } catch {
      toast("Eksport amalga oshmadi", 'error');
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#F39C12';
    if (rank === 2) return '#7F8C8D';
    if (rank === 3) return '#CD7F32';
    return '#BDC3C7';
  };

  const getScoreColor = (score: number) => {
    if (score >= 100) return 'var(--brand-primary)';
    if (score >= 60) return '#F39C12';
    return '#E74C3C';
  };

  const columns: Column<RankingStudent>[] = [
    { key: 'rank', title: '#', width: 50, render: (_v, row) => (
      <RankBadge $color={getRankColor(row.rank)}>{row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank-1] : row.rank}</RankBadge>
    )},
    { key: 'name', title: 'Talaba F.I.O.', render: (_v, row) => (
      <div>
        <div style={{ fontWeight: 600 }}>{row.name}</div>
        <div style={{ fontSize: 11, color: '#7F8C8D' }}>{row.group} guruh</div>
      </div>
    )},
    { key: 'faculty', title: 'Fakultet', render: (_v, row) => <span style={{ fontSize: 12 }}>{row.faculty}</span> },
    { key: 'direction', title: "Yo'nalish", render: (_v, row) => <span style={{ fontSize: 12 }}>{row.direction}</span> },
    { key: 'course', title: 'Kurs', width: 90, render: (_v, row) => `${row.course}-kurs` },

    ...(filterYear === 'all' ? [] : [
      { key: 'yearScore', title: `Yil bali (${filterYear})`, width: 120, render: (_v: unknown, row: RankingStudent) => (
        <ScoreChip $color={getScoreColor(row.yearScore)}>{row.yearScore}</ScoreChip>
      )},
    ]),
    { key: 'totalScore', title: 'Jami ball', width: 90, render: (_v, row) => (
      <ScoreChip $color={getScoreColor(row.totalScore)}>{row.totalScore}</ScoreChip>
    )},
    { key: 'approvedCount', title: 'Faoliyat', width: 70, render: (_v, row) => (
      <PersonIconBtn
        title="Faoliyat va hujjatlarni ko'rish"
        onClick={() => navigate(`/gifted-students/department/students/${row.id}`, { state: { back: '/gifted-students/management/reports' } })}
      >
        <MdPerson />
      </PersonIconBtn>
    )},
  ];

  return (
    <>
      <Wrap>

        <GlobalFilterBar>
          <MdCalendarToday style={{ fontSize: 16, color: '#7F8C8D' }} />
          <GlobalFilterLabel>O'quv yili:</GlobalFilterLabel>
          <Select
            value={filterYear}
            style={{ width: 'auto', minWidth: 200 }}
            onChange={(value: string) => setFilterYear(value)}
            options={[
              { value: 'all', label: "Barcha o'quv yillari" },
              ...academicYears.map(y => ({ value: y, label: `${y} o'quv yili` })),
            ]}
          />
        </GlobalFilterBar>

        <StatsRow>
          <StatCard>
            <StatIcon $bg="var(--brand-primary-soft)" $color="var(--brand-primary)"><MdPerson /></StatIcon>
            <div>
              <StatNum>{filteredRanking.length}</StatNum>
              <StatLabel>Jami iqtidorli talabalar</StatLabel>
            </div>
          </StatCard>
          <StatCard>
            <StatIcon $bg="#EBF5FB" $color="#3498DB"><MdTrendingUp /></StatIcon>
            <div>
              <StatNum>{filteredRanking.length ? Math.round(filteredRanking.reduce((s,t)=>s+t.yearScore,0)/filteredRanking.length) : 0}</StatNum>
              <StatLabel>
                {filterYear === 'all' ? "O'rtacha ball (jami)" : `O'rtacha ball (${filterYear})`}
              </StatLabel>
            </div>
          </StatCard>
          <StatCard>
            <StatIcon $bg="#F5EEF8" $color="#9B59B6"><MdStarRate /></StatIcon>
            <div>
              <StatNum>{nomdorCount}</StatNum>
              <StatLabel>Nomdor stipendiyaga talabgor</StatLabel>
            </div>
          </StatCard>
          <StatCard>
            <StatIcon $bg="#FEF9E7" $color="#F39C12"><MdSchool /></StatIcon>
            <div>
              <StatNum>{rektorCount}</StatNum>
              <StatLabel>Rektor stipendiyasiga talabgor</StatLabel>
            </div>
          </StatCard>
        </StatsRow>

        <WinnerRow>
          <WinnerCard>
            <WinnerCardHead $color="#9B59B6">
              🏅 Nomdor stipendiyasini qo'lga kiritganlar
              <WinnerCount>{nomdorWinners.length}</WinnerCount>
            </WinnerCardHead>
            {nomdorWinners.length === 0 ? (
              <WinnerEmpty>Ma'lumot yo'q</WinnerEmpty>
            ) : (
              <WinnerList>
                {nomdorWinners.map((w, i) => (
                  <WinnerItem key={w.studentId} onClick={() => navigate(`/gifted-students/department/students/${w.student.id}`, { state: { back: '/gifted-students/management/reports' } })}>
                    <WinnerAvatar>{i + 1}</WinnerAvatar>
                    <WinnerName>{w.student.name}</WinnerName>
                    <WinnerSep>·</WinnerSep>
                    <WinnerMeta>{w.student.faculty} · {w.student.direction} · {w.student.course}-kurs, {w.student.group} guruh</WinnerMeta>
                    <WinnerScholarship $color="#9B59B6">{w.scholarshipNames.join(' · ')}</WinnerScholarship>
                  </WinnerItem>
                ))}
              </WinnerList>
            )}
          </WinnerCard>

          <WinnerCard>
            <WinnerCardHead $color="#F39C12">
              🏆 Rektor stipendiyasini qo'lga kiritganlar
              <WinnerCount>{rektorWinners.length}</WinnerCount>
            </WinnerCardHead>
            {rektorWinners.length === 0 ? (
              <WinnerEmpty>Ma'lumot yo'q</WinnerEmpty>
            ) : (
              <WinnerList>
                {rektorWinners.map((w, i) => (
                  <WinnerItem key={w.studentId} onClick={() => navigate(`/gifted-students/department/students/${w.student.id}`, { state: { back: '/gifted-students/management/reports' } })}>
                    <WinnerAvatar $color="#F39C12">{i + 1}</WinnerAvatar>
                    <WinnerName>{w.student.name}</WinnerName>
                    <WinnerSep>·</WinnerSep>
                    <WinnerMeta>{w.student.faculty} · {w.student.direction} · {w.student.course}-kurs, {w.student.group} guruh</WinnerMeta>
                    <WinnerScholarship $color="#F39C12">{w.scholarshipNames.join(' · ')}</WinnerScholarship>
                  </WinnerItem>
                ))}
              </WinnerList>
            )}
          </WinnerCard>
        </WinnerRow>

        <CardWrap>
          <CardHeader>
            <CardTitle>Fakultet kesimida o'rtacha ball</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F6F9" />
              <XAxis dataKey="faculty" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E8ECEF', fontSize: 12 }}
                formatter={(v) => [`${v} ball`, "O'rtacha"]}
              />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardWrap>

        <CardWrap>
          <CardHeader>
            <CardTitle>Reyting jadvali</CardTitle>
            <RightGroup>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(f => !f)}>
                <MdFilterList /> Filtrlar
              </Button>
              <Button size="sm" onClick={handleExport}>
                <MdDownload /> Eksport
              </Button>
            </RightGroup>
          </CardHeader>

          {showFilters && (
            <FilterPanel>
              <Input
                placeholder="Talaba nomi bo'yicha qidirish..."
                value={search}
                style={{ flex: 1, minWidth: 200 }}
                allowClear
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                value={filterFaculty}
                showSearch
                optionFilterProp="label"
                style={{ width: 'auto', minWidth: 200 }}
                onChange={(value: string) => setFilterFaculty(value)}
                options={faculties.map(f => ({
                  value: f,
                  label: f === 'all' ? 'Barcha fakultetlar' : f,
                }))}
              />
              <Select
                value={filterCourse}
                style={{ width: 'auto', minWidth: 150 }}
                onChange={(value: string) => setFilterCourse(value)}
                options={courses.map(c => ({
                  value: String(c),
                  label: c === 'all' ? 'Barcha kurslar' : `${c}-kurs`,
                }))}
              />
            </FilterPanel>
          )}

          <Table columns={columns} data={showAllRanking ? filtered : filtered.slice(0, 3)} />
          {filtered.length > 3 && (
            <ShowAllRow>
              <ShowAllBtn onClick={() => setShowAllRanking(v => !v)}>
                {showAllRanking ? 'Yig\'ish' : `Barchasi (${filtered.length} ta)`}
              </ShowAllBtn>
            </ShowAllRow>
          )}
        </CardWrap>
      </Wrap>

      {drawerStudent && (
        <Overlay onClick={() => setDrawerStudent(null)}>
          <Drawer onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <DrawerHead>
              <div>
                <DrawerName>{drawerStudent.name}</DrawerName>
                <DrawerSub>{drawerStudent.faculty} · {drawerStudent.direction}</DrawerSub>
              </div>
              <CloseBtn onClick={() => setDrawerStudent(null)}><MdClose /></CloseBtn>
            </DrawerHead>

            <DrawerBody>
              <DrawerScore $color={getScoreColor(drawerStudent.totalScore)}>
                <ScoreNum>{drawerStudent.totalScore}</ScoreNum>
                <ScoreText>jami ball · {drawerStudent.rank}-o'rin</ScoreText>
              </DrawerScore>

              <DrawerSectionTitle>Tasdiqlangan faoliyatlar</DrawerSectionTitle>
              {studentActivities(drawerStudent.id).length === 0 ? (
                <p style={{ fontSize: 13, color: '#7F8C8D', textAlign: 'center', padding: 20 }}>
                  Hali tasdiqlangan faoliyat yo'q
                </p>
              ) : (
                studentActivities(drawerStudent.id).map((act) => (
                  <DrawerActItem key={act.id}>
                    <DrawerActInfo>
                      <DrawerActTitle>{act.title}</DrawerActTitle>
                      <DrawerActMeta>{act.categoryName} · {act.reviewedAt}</DrawerActMeta>
                    </DrawerActInfo>
                    <DrawerActPoints>+{act.points}</DrawerActPoints>
                  </DrawerActItem>
                ))
              )}
            </DrawerBody>
          </Drawer>
        </Overlay>
      )}
    </>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
`;

const StatCard = styled(CardWrap)`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const StatIcon = styled.div<{ $bg: string; $color: string }>`
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
`;

const StatNum = styled.div`
  font-size: 26px;
  font-weight: 800;
  color: #2C3E50;
  line-height: 1;
`;
const StatLabel = styled.div`
  font-size: 12px;
  color: #7F8C8D;
  margin-top: 2px;
`;


const RightGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const FilterPanel = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #E8ECEF;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

const RankBadge = styled.div<{ $color: string }>`
  font-size: 16px;
  font-weight: 700;
  color: ${({ $color }) => $color};
`;

const ScoreChip = styled.span<{ $color: string }>`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
  background: ${({ $color }) => `${$color}18`};
  color: ${({ $color }) => $color};
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 500;
  display: flex;
  justify-content: flex-end;
`;

const Drawer = styled.div`
  width: 400px;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0,0,0,0.12);
`;

const DrawerHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #E8ECEF;
`;
const DrawerName = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: #2C3E50;
`;
const DrawerSub = styled.p`
  font-size: 12px;
  color: #7F8C8D;
  margin-top: 2px;
`;
const CloseBtn = styled.button`
  font-size: 20px;
  color: #7F8C8D;
  display: flex;
  &:hover { color: #2C3E50; }
`;

const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const DrawerScore = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: ${({ $color }) => `${$color}15`};
  border: 2px solid ${({ $color }) => `${$color}40`};
  margin-bottom: 20px;
`;
const ScoreNum = styled.div`
  font-size: 40px;
  font-weight: 800;
  color: #2C3E50;
`;
const ScoreText = styled.div`
  font-size: 13px;
  color: #7F8C8D;
`;

const DrawerSectionTitle = styled.h4`
  font-size: 13px;
  font-weight: 600;
  color: #7F8C8D;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
`;

const DrawerActItem = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #F4F6F9;
  gap: 10px;
`;
const DrawerActInfo = styled.div`flex: 1;`;
const DrawerActTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #2C3E50;
`;
const DrawerActMeta = styled.div`
  font-size: 11px;
  color: #7F8C8D;
  margin-top: 3px;
`;
const DrawerActPoints = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: var(--brand-primary);
  flex-shrink: 0;
`;

const GlobalFilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
`;

const GlobalFilterLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #2C3E50;
  white-space: nowrap;
`;

const WinnerRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const WinnerCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
`;

const WinnerCardHead = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 700;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => `${$color}10`};
  border-bottom: 1px solid ${({ $color }) => `${$color}30`};
`;

const WinnerCount = styled.span`
  margin-left: auto;
  background: white;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
`;

const WinnerEmpty = styled.p`
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: #7F8C8D;
`;

const WinnerList = styled.div`
  display: flex;
  flex-direction: column;
`;

const WinnerItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  &:last-child { border-bottom: none; }
  &:hover { background: ${({ theme }) => theme.colors.bg}; }
`;

const WinnerAvatar = styled.div<{ $color?: string }>`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${({ $color }) => $color ? `${$color}20` : 'var(--brand-primary-soft)'};
  color: ${({ $color }) => $color || 'var(--brand-primary)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
`;

const WinnerName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #2C3E50;
  white-space: nowrap;
  flex-shrink: 0;
`;

const WinnerSep = styled.span`
  color: #CBD5E1;
  font-size: 12px;
  flex-shrink: 0;
`;

const WinnerMeta = styled.span`
  font-size: 11px;
  color: #7F8C8D;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const WinnerScholarship = styled.span<{ $color: string }>`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => `${$color}12`};
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
`;

const ShowAllRow = styled.div`
  padding: 10px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  text-align: center;
`;

const ShowAllBtn = styled.button`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.primary};
  padding: 4px 16px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  transition: all 0.15s;
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const PersonIconBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #DBEAFE;
  color: #1D4ED8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  transition: background 0.15s;
  &:hover { background: #BFDBFE; }
`;
