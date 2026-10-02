import { useState } from 'react';
import { useNavigate, useParams, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styled from 'styled-components';
import { Switch } from '@/shared/ui';
import { CardWrap } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { useScholarship, useUpdateScholarship, useCriteria, useApplications, useScholarshipApplicants, useCourses } from '../../api/gifted-api';
import Loader from '../../components/common/Loader';
import {
  MdArrowBack, MdEdit, MdPaid, MdCalendarToday, MdTrendingUp,
  MdGroups, MdEmojiEvents, MdCalendarMonth,
  MdHourglassEmpty, MdPerson,
} from '../../icons';
import type { ScholarshipApplication } from '../../data/types';
import { academicYearOf, canonicalAcademicYear, DEFAULT_ACADEMIC_YEAR } from '../../lib/academic-years';
import { courseLabel as courseLabelOf } from '../../lib/courses';


interface VerdictCfg { label: string; color: string; bg: string; border: string }

const VERDICT_CFG: { pass: VerdictCfg; fail: VerdictCfg } = {
  pass: { label: 'Tavsiya etildi',   color: '#166534', bg: '#DCFCE7', border: '#22C55E' },
  fail: { label: 'Tavsiya etilmadi', color: '#991B1B', bg: '#FEE2E2', border: '#EF4444' },
};

interface CriteriaCol { key: string; label: string; max: number | null }
interface CriteriaGroup { id: string; name: string; icon: string; isGrouped: boolean; cols: CriteriaCol[] }

export default function RektorDetail() {
  const { data: courseRows = [] } = useCourses();
  const courseLabel = (v: string): string => courseLabelOf(courseRows, v);

  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const year = canonicalAcademicYear(searchParams.get('year')) || DEFAULT_ACADEMIC_YEAR;
  const { data: sch, isLoading } = useScholarship(id);
  const { data: criteriaList = [] } = useCriteria();
  const { data: applications = [] } = useApplications(!isStudent);
  const { data: publicApplicants = [] } = useScholarshipApplicants(isStudent ? id : undefined);
  const updateSch = useUpdateScholarship();
  const toggling = updateSch.isPending;
  const [viewRejectApp, setViewRejectApp] = useState<ScholarshipApplication | null>(null);

  if (isLoading) return <Loader text="Yuklanmoqda..." />;
  if (!sch || sch.type !== 'rektor') {
    return <Navigate to={isStudent ? '/gifted-students/student/scholarships/rektor' : '/gifted-students/department/scholarships/rektor'} replace />;
  }

  const criteriaGroups: CriteriaGroup[] = (sch.criteria || []).map((c): CriteriaGroup | null => {
    const ct = criteriaList.find(x => x.id === c.criteriaId);
    if (!ct) return null;
    const catIds = c.categoryIds?.length ? c.categoryIds : null;
    if (catIds) {
      const cats = catIds.map((cid): CriteriaCol | null => {
        const cat = ct.categories.find(x => x.id === cid);
        if (!cat) return null;
        const max = c.pointOverrides?.[cid] ?? cat.points;
        return { key: `${ct.id}_${cat.id}`, label: cat.name, max };
      }).filter((x): x is CriteriaCol => x !== null);
      return { id: ct.id, name: ct.name, icon: ct.icon, isGrouped: true, cols: cats };
    }
    const catSum = ct.categories?.length
      ? ct.categories.reduce((s, x) => s + (x.points || 0), 0)
      : null;
    const singleMax = c.typePointOverride != null
      ? c.typePointOverride
      : (ct.ball != null ? ct.ball : catSum);
    return {
      id: ct.id, name: ct.name, icon: ct.icon, isGrouped: false,
      cols: [{ key: ct.id, label: ct.name, max: singleMax }],
    };
  }).filter((x): x is CriteriaGroup => x !== null);

  const flatCols = criteriaGroups.flatMap(g => g.cols);
  const hasGroupCols = criteriaGroups.some(g => g.isGrouped);
  const totalHeaderRows = hasGroupCols ? 3 : 2;
  const totalMax = flatCols.reduce((s, c) => c.max != null ? s + c.max : s, 0);
  const scoreColPct = (51 / (flatCols.length + 1)).toFixed(1);

  const handleToggle = () => {
    const next = !sch.active;
    updateSch.mutate({ id: sch.id, data: { active: next } }, {
      onSuccess: () => toast(`"${sch.name}" — ${next ? 'faollashtirildi' : "nofaol qilindi"}`, 'info'),
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const appYearOf = (a: ScholarshipApplication): string =>
    canonicalAcademicYear(a.academicYear) || academicYearOf(a.appliedAt);

  const apps = applications.filter(
    a => a.scholarshipId === id
      && appYearOf(a) === year
      && a.status === 'recommended'
  );

  const judges = sch.judges || [];

  const allJudgesScored = !isStudent && judges.length > 0 && apps.length > 0 &&
    apps.every(app => judges.every(jId => app.judgeScores?.[jId] != null));

  const scoringDone = isStudent ? sch.scoringComplete === true : allJudgesScored;
  const scoringUnknown = isStudent && sch.scoringComplete == null;

  const computeAvgScore = (app: ScholarshipApplication, colKey: string): number => {
    if (!allJudgesScored || !judges.length) return 0;
    const vals = judges.map(jId => app.judgeScores?.[jId]?.[colKey] ?? 0);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const computeTotal = (app: ScholarshipApplication): number =>
    flatCols.reduce((s, c) => s + computeAvgScore(app, c.key), 0);

  const rows = isStudent
    ? publicApplicants.map(a => ({
        app: null as ScholarshipApplication | null,
        student: { name: a.name, faculty: a.faculty, direction: a.direction, course: a.course, group: a.group },
        total: 0,
        studentId: a.id,
      }))
    : apps
        .map(app => ({
          app,
          student: { name: app.studentName, faculty: app.faculty, direction: app.direction, course: app.course, group: app.group },
          total: computeTotal(app),
          studentId: app.studentId,
        }))
        .sort((a, b) => b.total - a.total);

  return (
    <>
      <PageWrap>

        <BackBar>
          <BackLeft>
            <BackBtn onClick={() => navigate(
              isStudent
                ? '/gifted-students/student/scholarships/rektor'
                : `/gifted-students/department/scholarships/rektor?year=${year}`
            )}>
              <MdArrowBack /> Rektor stipendiyasiga qaytish
            </BackBtn>
            <YearBadge><MdCalendarMonth /> {year} o'quv yili</YearBadge>
          </BackLeft>
          {!isStudent && (
            <BackRight>
              <SwitchWrap>
                <Switch size="small" checked={sch.active} onChange={handleToggle} disabled={toggling} />
                <SwitchLabel $active={sch.active}>{sch.active ? 'Faol' : 'Nofaol'}</SwitchLabel>
              </SwitchWrap>
              {allJudgesScored ? (
                <ScoringLockNote>
                  <MdEmojiEvents /> Baholash yakunlangan — tahrirlab bo'lmaydi
                </ScoringLockNote>
              ) : (
                !(sch.deadline && new Date(sch.deadline) < new Date()) && (
                  <EditBtn onClick={() => navigate(`/gifted-students/department/scholarships/rektor/${id}/edit`)}>
                    <MdEdit /> Tahrirlash
                  </EditBtn>
                )
              )}
            </BackRight>
          )}
        </BackBar>

        <InfoCard>
          <InfoTitle>{sch.name}</InfoTitle>
          {sch.description && <InfoDesc>{sch.description}</InfoDesc>}
          <MetaRow>
            <MetaCell>
              <MetaIcon $bg="var(--brand-primary-soft)" $color="var(--brand-primary)"><MdPaid /></MetaIcon>
              <MetaText><MetaLabel>Miqdor</MetaLabel><MetaValue>{sch.amount}</MetaValue></MetaText>
            </MetaCell>
            <MetaCell>
              <MetaIcon $bg="#EBF5FB" $color="#3498DB"><MdTrendingUp /></MetaIcon>
              <MetaText><MetaLabel>Min. ball</MetaLabel><MetaValue>{sch.minScore}</MetaValue></MetaText>
            </MetaCell>
            <MetaCell>
              <MetaIcon $bg="#FDEDEC" $color="#E74C3C"><MdCalendarToday /></MetaIcon>
              <MetaText><MetaLabel>Muddat</MetaLabel><MetaValue>{sch.deadline}</MetaValue></MetaText>
            </MetaCell>
          </MetaRow>
          {(sch.allowedCourses?.length ?? 0) > 0 && (
            <InfoSection>
              <InfoSectionLabel><MdGroups /> Kim ariza topshira oladi</InfoSectionLabel>
              <ChipsRow>
                {sch.allowedCourses?.map(c => <Chip key={c}>{courseLabel(c)}</Chip>)}
              </ChipsRow>
            </InfoSection>
          )}

          {criteriaGroups.length > 0 && (
            <InfoSection>
              <InfoSectionLabel>📋 Baholash mezonlari · jami {totalMax} ball</InfoSectionLabel>
              <MezonGrid>
                {criteriaGroups.map(group => (
                  <MezonItem key={group.id}>
                    <MezonHeader>
                      <MezonName>{group.icon} {group.name}</MezonName>
                      {!group.isGrouped && (
                        <MezonBall>+{group.cols[0]?.max ?? '—'}</MezonBall>
                      )}
                    </MezonHeader>
                    {group.isGrouped && (
                      <MezonSubs>
                        {group.cols.map(col => (
                          <MezonSub key={col.key}>
                            <span>{col.label}</span>
                            <MezonBall>+{col.max}</MezonBall>
                          </MezonSub>
                        ))}
                      </MezonSubs>
                    )}
                  </MezonItem>
                ))}
              </MezonGrid>
            </InfoSection>
          )}
        </InfoCard>

        <ApplicantsCard>
          <ApplicantsHeader>
            <ApplicantsTitle>
              {allJudgesScored ? <MdEmojiEvents /> : <MdGroups />}
              {allJudgesScored ? "Yakuniy natijalar (o'rtacha ball)" : 'Ariza topshirgan talabalar'}
              <CountBadge>{rows.length}</CountBadge>
            </ApplicantsTitle>
            {!scoringDone && !scoringUnknown && judges.length > 0 && rows.length > 0 && (
              <WaitingNote>
                <MdHourglassEmpty /> Hakamlar baholashini kutmoqda
              </WaitingNote>
            )}
            {isStudent && scoringDone && (
              <DoneNote>
                <MdEmojiEvents /> Baholash yakunlangan
              </DoneNote>
            )}
          </ApplicantsHeader>

          {rows.length === 0 ? (
            <Empty>
              <span>📭</span>
              <p>{year} o'quv yilida ariza topshirgan talabalar yo'q</p>
            </Empty>
          ) : allJudgesScored ? (
            <TableWrap>
              <Table>
                <colgroup>
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '16%' }} />
                  {flatCols.map(col => (
                    <col key={col.key} style={{ width: `${scoreColPct}%` }} />
                  ))}
                  <col style={{ width: `${scoreColPct}%` }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>

                <thead>
                  <tr>
                    <Th rowSpan={totalHeaderRows} $center>№</Th>
                    <Th rowSpan={totalHeaderRows}>F.I.SH</Th>
                    <Th rowSpan={totalHeaderRows}>Yo'nalishi, kursi, guruhi</Th>
                    {criteriaGroups.map(g =>
                      g.isGrouped ? (
                        <Th key={g.id} colSpan={g.cols.length} rowSpan={1} $center $group>
                          {g.icon} {g.name}
                        </Th>
                      ) : (
                        <Th key={g.id} rowSpan={hasGroupCols ? 2 : 1} $center>
                          {g.icon} {g.name}
                        </Th>
                      )
                    )}
                    <Th rowSpan={hasGroupCols ? 2 : 1} $center>Jami ball</Th>
                    <Th rowSpan={totalHeaderRows} $center>Xulosa (o'tish bali — {sch.minScore})</Th>
                    <Th rowSpan={totalHeaderRows} $center>Faoliyat</Th>
                  </tr>
                  {hasGroupCols && (
                    <tr>
                      {criteriaGroups.flatMap(g =>
                        g.isGrouped
                          ? g.cols.map(col => <Th key={col.key} $center $sub>{col.label}</Th>)
                          : []
                      )}
                    </tr>
                  )}
                  <tr>
                    {flatCols.map(col => (
                      <MaxTh key={col.key}>{col.max != null ? `${col.max} ball` : '—'}</MaxTh>
                    ))}
                    <MaxTh $total>{totalMax > 0 ? `${totalMax} ball` : '—'}</MaxTh>
                  </tr>
                </thead>

                <tbody>
                  {rows
                    .filter((r): r is typeof r & { app: ScholarshipApplication } => r.app !== null)
                    .map(({ app, student, total, studentId }, idx) => {
                    const rank = idx + 1;
                    const verdict = total >= sch.minScore ? VERDICT_CFG.pass : VERDICT_CFG.fail;
                    return (
                      <Tr key={app.id} $odd={rank % 2 === 0}>
                        <Td $center>
                          <RankCell $rank={rank}>
                            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                          </RankCell>
                        </Td>
                        <Td><StudentName>{student?.name ?? app.studentId}</StudentName></Td>
                        <Td>
                          <DirectionCell>
                            {student
                              ? `${student.direction ? student.direction + ', ' : ''}${student.course}-kurs, ${student.group}`
                              : '—'}
                          </DirectionCell>
                        </Td>
                        {flatCols.map(col => {
                          const val = computeAvgScore(app, col.key);
                          const disp = Number.isInteger(val) ? val : val.toFixed(1);
                          return (
                            <Td key={col.key} $center>
                              <ScoreDisplay $val={val} $max={col.max} $empty={false}>
                                {disp}
                              </ScoreDisplay>
                            </Td>
                          );
                        })}
                        <Td $center>
                          <TotalDisplay $pct={totalMax > 0 ? total / totalMax : null}>
                            {Number.isInteger(total) ? total : total.toFixed(1)}
                          </TotalDisplay>
                        </Td>
                        <Td $center>
                          <StatusBadge $cfg={verdict}>{verdict.label}</StatusBadge>
                        </Td>
                        <Td $center>
                          <FaoliyatBtn
                            onClick={() => navigate(`/gifted-students/department/students/${studentId}`, { state: { back: `/gifted-students/department/scholarships/rektor/${id}` } })}
                            title="Talaba batafsil"
                          >
                            <MdPerson />
                          </FaoliyatBtn>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <TableWrap>
              <Table style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <Th style={{ width: 36 }} $center>№</Th>
                    <Th>F.I.SH</Th>
                    <Th>Fakultet</Th>
                    <Th>Yo'nalish</Th>
                    <Th style={{ width: 70 }} $center>Kurs</Th>
                    <Th style={{ width: 90 }} $center>Guruh</Th>
                    <Th style={{ width: 90 }} $center>Faoliyat</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ student, studentId }, idx) => (
                    <Tr key={studentId} $odd={(idx + 1) % 2 === 0}>
                      <Td $center><SimpleNum>{idx + 1}</SimpleNum></Td>
                      <Td><StudentName>{student?.name || studentId}</StudentName></Td>
                      <Td><DirectionCell>{student?.faculty || '—'}</DirectionCell></Td>
                      <Td><DirectionCell>{student?.direction ?? '—'}</DirectionCell></Td>
                      <Td $center><DirectionCell>{student ? `${student.course}-kurs` : '—'}</DirectionCell></Td>
                      <Td $center><DirectionCell>{student?.group ?? '—'}</DirectionCell></Td>
                      <Td $center>
                        <FaoliyatBtn
                          onClick={() => navigate(`/gifted-students/department/students/${studentId}`, { state: { back: `/gifted-students/department/scholarships/rektor/${id}` } })}
                          title="Talaba batafsil"
                        >
                          <MdPerson />
                        </FaoliyatBtn>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </ApplicantsCard>
      </PageWrap>

      <Modal
        open={!!viewRejectApp}
        onClose={() => setViewRejectApp(null)}
        title="Rad etish sababi"
        footer={<Button onClick={() => setViewRejectApp(null)}>Yopish</Button>}
      >
        <RejectNote>
          {viewRejectApp?.note?.trim() ? viewRejectApp.note : "Sabab ko'rsatilmagan"}
        </RejectNote>
      </Modal>
    </>
  );
}

const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const BackBar = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px;
`;
const BackLeft = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const BackBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 13px; font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s;
  &:hover { background: ${({ theme }) => theme.colors.bg}; color: ${({ theme }) => theme.colors.primary}; }
  svg { font-size: 18px; }
`;
const YearBadge = styled.span`
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
  background: #F5EEF8; color: #9B59B6; border: 1px solid #D7BDE2;
  svg { font-size: 14px; }
`;
const BackRight = styled.div`display: flex; align-items: center; gap: 10px;`;
const SwitchWrap = styled.div`
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border}; background: white;
`;
const SwitchLabel = styled.span<{ $active: boolean }>`
  font-size: 12px; font-weight: 600;
  color: ${({ $active }) => $active ? 'var(--brand-primary)' : '#95A5A6'};
`;
const EditBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; font-size: 13px; font-weight: 600;
  color: #3498DB; background: #EBF5FB;
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s; &:hover { background: #D6EAF8; }
  svg { font-size: 16px; }
`;

const ScoringLockNote = styled.span`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; font-size: 13px; font-weight: 600;
  color: #7C3AED; background: #F3E8FF;
  border-radius: ${({ theme }) => theme.radius.md};
  svg { font-size: 16px; }
`;

const InfoCard = styled(CardWrap)`display: flex; flex-direction: column; gap: 14px;`;
const InfoTitle = styled.h2`font-size: 20px; font-weight: 800; color: ${({ theme }) => theme.colors.text};`;
const InfoDesc = styled.p`font-size: 13px; color: ${({ theme }) => theme.colors.textMuted}; line-height: 1.6;`;
const MetaRow = styled.div`
  display: grid; grid-template-columns: repeat(3,1fr); gap: 10px;
  padding: 12px; background: ${({ theme }) => theme.colors.bg};
  border-radius: ${({ theme }) => theme.radius.md};
`;
const MetaCell = styled.div`display: flex; align-items: center; gap: 10px;`;
const MetaIcon = styled.div<{ $bg: string; $color: string }>`
  width: 36px; height: 36px; border-radius: 10px;
  background: ${({ $bg }) => $bg}; color: ${({ $color }) => $color};
  display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
`;
const MetaText = styled.div``;
const MetaLabel = styled.div`font-size: 10px; color: ${({ theme }) => theme.colors.textMuted}; text-transform: uppercase; letter-spacing: 0.04em;`;
const MetaValue = styled.div`font-size: 14px; font-weight: 700; color: ${({ theme }) => theme.colors.text};`;
const InfoSection = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const InfoSectionLabel = styled.div`
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: ${({ theme }) => theme.colors.textMuted};
  svg { font-size: 15px; }
`;
const ChipsRow = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
const Chip = styled.span`
  padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 500;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary}; border: 1px solid #A9DFBF;
`;

const ApplicantsCard = styled(CardWrap)`padding: 0; overflow: hidden;`;
const ApplicantsHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;
const ApplicantsTitle = styled.h3`
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; color: ${({ theme }) => theme.colors.text};
  svg { color: #F39C12; font-size: 20px; }
`;
const CountBadge = styled.span`
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 24px; padding: 0 6px;
  border-radius: 999px; font-size: 12px; font-weight: 700;
  background: #F5EEF8; color: #9B59B6;
`;
const Empty = styled.div`
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 48px 20px;
  span { font-size: 36px; }
  p { font-size: 13px; color: ${({ theme }) => theme.colors.textMuted}; }
`;

const TableWrap = styled.div`width: 100%;`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
`;

const Th = styled.th<{ $sub?: boolean; $group?: boolean; $center?: boolean }>`
  padding: 9px 8px;
  font-size: 11px;
  font-weight: ${({ $sub }) => $sub ? '600' : '700'};
  color: ${({ $sub }) => $sub ? '#4B5E7A' : '#1E3050'};
  background: ${({ $group, $sub }) =>
    $group ? '#DDE8F5' : $sub ? '#EAF1FA' : '#E2EBF6'};
  border: 1px solid #C8D9ED;
  text-align: ${({ $center }) => $center ? 'center' : 'left'};
  vertical-align: middle;
  line-height: 1.3;
`;

const MaxTh = styled.th<{ $total?: boolean }>`
  padding: 5px 6px;
  font-size: 10px; font-weight: 500;
  color: #7F8C8D; background: #F4F7FB;
  border: 1px solid #C8D9ED;
  text-align: center; vertical-align: middle;
  font-style: italic;
  ${({ $total }) => $total && `color: #5D6D7E; font-weight: 700;`}
`;

const Tr = styled.tr<{ $odd?: boolean }>`
  background: ${({ $odd }) => $odd ? '#F7FAFF' : 'white'};
  transition: background 0.1s;
  &:hover td { background: #EEF5FF; }
`;

const Td = styled.td<{ $center?: boolean }>`
  padding: 9px 8px;
  border: 1px solid #D8E4F0;
  vertical-align: middle;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.text};
  text-align: ${({ $center }) => $center ? 'center' : 'left'};
`;

const SimpleNum = styled.span`
  font-size: 12px; font-weight: 600; color: #7F8C8D;
`;

const RankCell = styled.div<{ $rank: number }>`
  font-size: ${({ $rank }) => $rank <= 3 ? '20px' : '13px'};
  font-weight: ${({ $rank }) => $rank <= 3 ? 'normal' : '700'};
  color: ${({ $rank }) => $rank <= 3 ? 'inherit' : '#64748B'};
  line-height: 1;
`;

const StudentName = styled.div`
  font-size: 12px; font-weight: 600; color: #1E293B;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const DirectionCell = styled.div`
  font-size: 11px; color: #475569;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const ScoreDisplay = styled.span<{ $empty: boolean; $val: number | undefined; $max: number | null }>`
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 26px; border-radius: 6px;
  font-size: 13px; font-weight: 700;
  ${({ $empty, $val, $max }) => {
    if ($empty || $val === undefined) return `background:#F1F5F9; color:#CBD5E1;`;
    if ($val === 0)  return `background:#F1F5F9; color:#94A3B8;`;
    if ($max == null) return `background:#EEF2FF; color:#4338CA;`;
    if ($val >= $max) return `background:#DCFCE7; color:#15803D;`;
    if ($val >= $max * 0.6) return `background:#EEF2FF; color:#4338CA;`;
    return `background:#FFF7ED; color:#C2410C;`;
  }}
`;

const TotalDisplay = styled.span<{ $pct: number | null }>`
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 42px; height: 28px; padding: 0 6px; border-radius: 8px;
  font-size: 14px; font-weight: 800;
  ${({ $pct }) => {
    if ($pct === null) return `background:#EEF2FF; color:#4338CA;`;
    if ($pct === 0)    return `background:#F1F5F9; color:#94A3B8;`;
    if ($pct >= 0.9)   return `background:#DCFCE7; color:#15803D;`;
    if ($pct >= 0.6)   return `background:#EEF2FF; color:#4338CA;`;
    return `background:#FFF7ED; color:#C2410C;`;
  }}
`;

const StatusBadge = styled.span<{ $cfg?: VerdictCfg }>`
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 600;
  border: 1.5px solid ${({ $cfg }) => $cfg?.border || '#F59E0B'};
  background: ${({ $cfg }) => $cfg?.bg || '#FEF3C7'};
  color: ${({ $cfg }) => $cfg?.color || '#B7770D'};
  white-space: nowrap;
`;

const MezonGrid = styled.div`
  display: flex; flex-direction: column; gap: 6px;
`;

const MezonItem = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px; overflow: hidden;
`;

const MezonHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: #F0F7FF;
`;

const MezonName = styled.span`
  font-size: 12px; font-weight: 600;
  color: #1E3050;
`;

const MezonBall = styled.span`
  font-size: 11px; font-weight: 700;
  color: var(--brand-primary); background: var(--brand-primary-soft);
  padding: 2px 7px; border-radius: 999px;
  border: 1px solid #A9DFBF;
`;

const MezonSubs = styled.div`
  display: flex; flex-direction: column;
`;

const MezonSub = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 10px 5px 20px;
  font-size: 11px; color: ${({ theme }) => theme.colors.textMuted};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const WaitingNote = styled.div`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 600;
  background: #FEF3C7; color: #B45309;
  svg { font-size: 14px; }
`;

const DoneNote = styled(WaitingNote)`
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
`;

const FaoliyatBtn = styled.button`
  width: 28px; height: 28px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; color: #3498DB; background: #EBF5FB;
  transition: all 0.15s;
  &:hover { background: #D6EAF8; }
`;

const RejectNote = styled.p`
  font-size: 14px; color: #1E293B;
  line-height: 1.6;
  padding: 12px 16px;
  background: #FEF2F2;
  border-left: 3px solid #EF4444;
  border-radius: 6px;
`;
