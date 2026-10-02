import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { NumberField } from '../../components/common/NumberField';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { useScholarships, useApplications, useCriteria, useProfile, useScoreApplication } from '../../api/gifted-api';
import Loader from '../../components/common/Loader';
import type { ScholarshipApplication } from '../../data/types';
import { averageJudgeTotal } from '../../lib/scholarship-score';
import { MdArrowBack, MdSave, MdPerson, MdAssignment } from '../../icons';

interface ScoreCol {
  key: string;
  label: string;
  max: number | null;
}

interface CriteriaGroup {
  id: string;
  name: string;
  icon: string;
  isGrouped: boolean;
  cols: ScoreCol[];
}

export default function JudgeScholarshipDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const { data: scholarships = [], isLoading } = useScholarships('rektor');
  const { data: criteriaList = [] } = useCriteria();
  const { data: applications = [] } = useApplications();
  const scoreMut = useScoreApplication();
  const savingId = scoreMut.isPending ? scoreMut.variables?.id : undefined;
  const sch = scholarships.find(s => s.id === id);
  const [localScores, setLocalScores] = useState<Record<string, Record<string, string>>>({});
  const [myScoresApp, setMyScoresApp] = useState<ScholarshipApplication | null>(null);
  const [correcting, setCorrecting] = useState(false);

  const judgeId = profile?._id ?? '';

  if (isLoading) return <Loader text="Yuklanmoqda..." />;
  if (!sch || !judgeId || !sch.judges?.includes(judgeId)) {
    return <Navigate to="/gifted-students/judge/scholarships" replace />;
  }

  const judges = sch.judges ?? [];

  const criteriaGroups: CriteriaGroup[] = (sch.criteria || []).map((c): CriteriaGroup | null => {
    const ct = criteriaList.find(x => x.id === c.criteriaId);
    if (!ct) return null;
    const catIds = c.categoryIds?.length ? c.categoryIds : null;
    if (catIds) {
      const cats = catIds.map((cid): ScoreCol | null => {
        const cat = ct.categories.find(x => x.id === cid);
        if (!cat) return null;
        const max = c.pointOverrides?.[cid] ?? cat.points;
        return { key: `${ct.id}_${cat.id}`, label: cat.name, max };
      }).filter((col): col is ScoreCol => col !== null);
      return { id: ct.id, name: ct.name, icon: ct.icon, isGrouped: true, cols: cats };
    }
    const catSum = ct.categories?.length
      ? ct.categories.reduce((s, x) => s + (x.points || 0), 0)
      : null;
    const singleMax = c.typePointOverride != null ? c.typePointOverride : (ct.ball ?? catSum);
    return {
      id: ct.id, name: ct.name, icon: ct.icon, isGrouped: false,
      cols: [{ key: ct.id, label: ct.name, max: singleMax }],
    };
  }).filter((g): g is CriteriaGroup => g !== null);

  const flatCols = criteriaGroups.flatMap(g => g.cols);
  const colKeys = flatCols.map(c => c.key);
  const totalMax = flatCols.reduce((s, c) => c.max != null ? s + c.max : s, 0);
  const apps = applications.filter(a => a.scholarshipId === id);

  const allJudgesScored = judges.length > 0 && apps.length > 0 &&
    apps.every(a => judges.every(jId => a.judgeScores?.[jId] != null));

  const showFinal = allJudgesScored && !correcting;

  const getInputVal = (appId: string, colKey: string): string => {
    const local = localScores[appId]?.[colKey];
    if (local !== undefined) return local;
    const app = apps.find(a => a.id === appId);
    const v = app?.judgeScores?.[judgeId]?.[colKey];
    return v !== undefined ? String(v) : '';
  };

  const getLiveTotal = (app: ScholarshipApplication) =>
    flatCols.reduce((sum, col) => {
      const v = getInputVal(app.id, col.key);
      return sum + (v !== '' ? Number(v) : 0);
    }, 0);

  const avgScore = (app: ScholarshipApplication, colKey: string): string => {
    const vals = judges
      .map(jId => app.judgeScores?.[jId]?.[colKey])
      .filter((v): v is number => v != null);
    if (!vals.length) return '—';
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
  };

  const avgTotal = (app: ScholarshipApplication): string => {
    const avg = averageJudgeTotal(app, judges, colKeys);
    if (avg === null) return '—';
    return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
  };

  const sortedApps = allJudgesScored
    ? [...apps].sort((a, b) => {
        const sumAvg = (app: ScholarshipApplication) => judges.reduce((s, jId) => {
          const sc = app.judgeScores?.[jId];
          return s + (sc ? flatCols.reduce((acc, c) => acc + (sc[c.key] || 0), 0) : 0);
        }, 0) / judges.length;
        return sumAvg(b) - sumAvg(a);
      })
    : apps;

  const handleSetScore = (appId: string, colKey: string, raw: string, maxVal: number | null) => {
    let v = raw;
    if (v !== '' && Number(v) < 0) v = '0';
    if (v !== '' && maxVal != null && Number(v) > maxVal) v = String(maxVal);
    setLocalScores(prev => ({
      ...prev,
      [appId]: { ...(prev[appId] || {}), [colKey]: v },
    }));
  };

  const handleSaveRow = (app: ScholarshipApplication) => {
    const scores: Record<string, number> = {};
    flatCols.forEach(col => {
      const v = getInputVal(app.id, col.key);
      scores[col.key] = v !== '' ? Number(v) : 0;
    });
    scoreMut.mutate({ id: app.id, scores }, {
      onSuccess: () => {
        setLocalScores(prev => { const next = { ...prev }; delete next[app.id]; return next; });
        toast("Baholar saqlandi!", 'success');
      },
      onError: () => toast('Saqlashda xatolik', 'error'),
    });
  };

  return (
    <>
      <PageWrap>
        <BackBar>
          <BackBtn onClick={() => navigate('/gifted-students/judge/scholarships')}>
            <MdArrowBack /> Orqaga
          </BackBtn>
          <SchTitle>{sch.name}</SchTitle>
        </BackBar>

        <TableCard>
          <TableHeaderRow>
            <TableTitle>
              {showFinal ? 'Yakuniy natijalar (o\'rtacha ball)' : 'Ariza topshirgan talabalar'}
              <CountBadge>{apps.length}</CountBadge>
            </TableTitle>
            <HeaderRight>
              {allJudgesScored && (
                <Button variant="outline" size="sm" onClick={() => setCorrecting(!correcting)}>
                  {correcting ? 'Yakuniy natijalarga qaytish' : 'Ballarimni tuzatish'}
                </Button>
              )}
              <MaxInfo>Maks: <b>{totalMax}</b> ball</MaxInfo>
            </HeaderRight>
          </TableHeaderRow>

          {correcting && (
            <CorrectionNote>
              Tuzatilgan ball <b>tarixga yoziladi</b> — kim, qachon va qaysi
              qiymatdan o'zgartirgani saqlanadi. Boshqa hakamlarning ballari
              tegilmaydi.
            </CorrectionNote>
          )}

          {apps.length === 0 ? (
            <Empty><span>📭</span><p>Ariza topshirgan talabalar yo'q</p></Empty>
          ) : (
            <ScrollWrap>
              {showFinal ? (
                <StyledTable>
                  <thead>
                    <tr>
                      <Th rowSpan={2} style={{ width: 40, textAlign: 'center' }}>№</Th>
                      <Th rowSpan={2} style={{ minWidth: 160 }}>F.I.SH</Th>
                      <Th rowSpan={2} style={{ minWidth: 150 }}>Yo'nalishi, kursi, guruhi</Th>
                      {criteriaGroups.map(g =>
                        g.isGrouped ? (
                          <ThGroup key={g.id} colSpan={g.cols.length}>{g.icon} {g.name}</ThGroup>
                        ) : (
                          <Th key={g.id} rowSpan={2} style={{ textAlign: 'center', width: 90, maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            <div style={{ fontSize: 11 }}>{g.icon} {g.name}</div>
                            {g.cols[0]?.max != null && <ColMax>Maksimal {g.cols[0].max} ball</ColMax>}
                          </Th>
                        )
                      )}
                      <Th rowSpan={2} style={{ width: 80, textAlign: 'center' }}>
                        Jami ball
                        <ColMax>Maksimal {totalMax} ball</ColMax>
                      </Th>
                      <Th rowSpan={2} style={{ width: 140, textAlign: 'center', whiteSpace: 'normal' }}>
                        Xulosa
                        <ColMax style={{ color: '#94A3B8', fontStyle: 'normal' }}>(o'tish bali — {sch.minScore})</ColMax>
                      </Th>
                      <Th rowSpan={2} style={{ width: 60, textAlign: 'center' }}>Faoliyat</Th>
                      <Th rowSpan={2} style={{ width: 90, textAlign: 'center' }}>Baholarim</Th>
                    </tr>
                    <tr>
                      {criteriaGroups
                        .filter(g => g.isGrouped)
                        .flatMap(g => g.cols.map(col => (
                          <ThSub key={col.key}>
                            {col.label}
                            {col.max != null && <ColMax>Maksimal {col.max} ball</ColMax>}
                          </ThSub>
                        )))
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {sortedApps.map((app, idx) => {
                      const student = { name: app.studentName, direction: app.direction, course: app.course, group: app.group };
                      const avg = avgTotal(app);
                      const passed = avg !== '—' && Number(avg) >= sch.minScore;
                      const medals = ['🥇', '🥈', '🥉'];
                      return (
                        <Tr key={app.id}>
                          <Td style={{ textAlign: 'center' }}>
                            {idx < 3
                              ? <MedalIcon>{medals[idx]}</MedalIcon>
                              : <RowNum>{idx + 1}</RowNum>
                            }
                          </Td>
                          <Td><SName>{student?.name || app.studentId}</SName></Td>
                          <Td>
                            <SMeta>
                              {student
                                ? `${student.direction ? student.direction + ' · ' : ''}${student.course}-kurs, ${student.group}`
                                : '—'}
                            </SMeta>
                          </Td>
                          {flatCols.map(col => {
                            const val = avgScore(app, col.key);
                            const numVal = val === '—' ? null : Number(val);
                            const ratio = numVal != null && col.max ? numVal / col.max : null;
                            const ballBg = numVal == null || numVal === 0
                              ? '#F1F5F9'
                              : (ratio != null && ratio >= 0.8) ? '#D1FAE5' : '#FEF3C7';
                            const ballText = numVal == null || numVal === 0
                              ? '#9CA3AF'
                              : (ratio != null && ratio >= 0.8) ? '#059669' : '#D97706';
                            return (
                              <Td key={col.key} style={{ textAlign: 'center' }}>
                                <ScoreBall $bg={ballBg} $text={ballText}>{val}</ScoreBall>
                              </Td>
                            );
                          })}
                          <Td style={{ textAlign: 'center' }}>
                            <JamiVal $pass={passed}>{avg}</JamiVal>
                            <TotalOf>/{totalMax}</TotalOf>
                          </Td>
                          <Td style={{ textAlign: 'center' }}>
                            <VerdictBadge $pass={passed}>
                              {passed ? 'Tavsiya etildi' : 'Tavsiya etilmadi'}
                            </VerdictBadge>
                          </Td>
                          <Td style={{ textAlign: 'center' }}>
                            <IconBtn
                              onClick={() => navigate(`/gifted-students/department/students/${app.studentId}`, { state: { back: `/gifted-students/judge/scholarships/${id}` } })}
                            >
                              <MdPerson />
                            </IconBtn>
                          </Td>
                          <Td style={{ textAlign: 'center' }}>
                            <SmallBtn $blue onClick={() => setMyScoresApp(app)}>
                              <MdPerson /> Baholarim
                            </SmallBtn>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </StyledTable>
              ) : (
                <StyledTable>
                  <thead>
                    <tr>
                      <Th rowSpan={2} style={{ width: 36, textAlign: 'center' }}>№</Th>
                      <Th rowSpan={2} style={{ minWidth: 170 }}>F.I.SH</Th>
                      {criteriaGroups.map(g =>
                        g.isGrouped ? (
                          <ThGroup key={g.id} colSpan={g.cols.length}>{g.icon} {g.name}</ThGroup>
                        ) : (
                          <Th key={g.id} rowSpan={2} style={{ textAlign: 'center', width: 90, maxWidth: 100, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            <div style={{ fontSize: 11 }}>{g.icon} {g.name}</div>
                            {g.cols[0]?.max != null && <ColMax>Maksimal {g.cols[0].max} ball</ColMax>}
                          </Th>
                        )
                      )}
                      <Th rowSpan={2} style={{ width: 72, textAlign: 'center' }}>Jami</Th>
                      <Th rowSpan={2} style={{ width: 86 }}>Faoliyat</Th>
                      <Th rowSpan={2} style={{ width: 96 }}>Saqlash</Th>
                    </tr>
                    <tr>
                      {criteriaGroups
                        .filter(g => g.isGrouped)
                        .flatMap(g => g.cols.map(col => (
                          <ThSub key={col.key}>
                            {col.label}
                            {col.max != null && <ColMax>Maksimal {col.max} ball</ColMax>}
                          </ThSub>
                        )))
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((app, idx) => {
                      const student = { name: app.studentName, direction: app.direction, course: app.course, group: app.group };
                      const liveTotal = getLiveTotal(app);
                      return (
                        <Tr key={app.id}>
                          <Td style={{ textAlign: 'center' }}><RowNum>{idx + 1}</RowNum></Td>
                          <Td>
                            <SName>{student?.name || app.studentId}</SName>
                            <SMeta>
                              {student
                                ? `${student.direction ? student.direction + ' · ' : ''}${student.course}-kurs, ${student.group}`
                                : '—'}
                            </SMeta>
                          </Td>
                          {flatCols.map(col => {
                            const raw = getInputVal(app.id, col.key);
                            return (
                              <Td key={col.key} style={{ textAlign: 'center' }}>
                                <NumberField
                                  min={0}
                                  max={col.max ?? 999}
                                  style={{ width: 72 }}
                                  value={raw === '' ? null : Number(raw)}
                                  onChange={(v) => handleSetScore(app.id, col.key, v === null ? '' : String(v), col.max)}
                                  placeholder="—"
                                />
                              </Td>
                            );
                          })}
                          <Td style={{ textAlign: 'center' }}>
                            <LiveTotal $full={liveTotal >= totalMax}>{liveTotal}</LiveTotal>
                            <TotalOf>/{totalMax}</TotalOf>
                          </Td>
                          <Td>
                            <SmallBtn onClick={() => navigate(`/gifted-students/department/students/${app.studentId}`, { state: { back: `/gifted-students/judge/scholarships/${id}` } })}>
                              <MdAssignment /> Faoliyat
                            </SmallBtn>
                          </Td>
                          <Td>
                            <SmallBtn
                              $green
                              onClick={() => handleSaveRow(app)}
                              disabled={savingId === app.id}
                            >
                              <MdSave /> {savingId === app.id ? 'Saqlanmoqda…' : 'Saqlash'}
                            </SmallBtn>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </StyledTable>
              )}
            </ScrollWrap>
          )}
        </TableCard>
      </PageWrap>

      {myScoresApp && (
        <Modal
          open={!!myScoresApp}
          onClose={() => setMyScoresApp(null)}
          title={`Baholarim: ${myScoresApp.studentName || myScoresApp.studentId}`}
          footer={<Button variant="secondary" onClick={() => setMyScoresApp(null)}>Yopish</Button>}
        >
          <ModalBody>
            {criteriaGroups.map(group => (
              <MGroup key={group.id}>
                <MGroupLabel>{group.icon} {group.name}</MGroupLabel>
                {group.cols.map(col => {
                  const v = myScoresApp.judgeScores?.[judgeId]?.[col.key];
                  return (
                    <MRow key={col.key}>
                      <MRowLabel>{group.isGrouped ? col.label : 'Ball'}</MRowLabel>
                      <MRowVal $zero={!v}>
                        {v != null ? v : '—'}
                        {col.max != null && <MMax>/{col.max}</MMax>}
                      </MRowVal>
                    </MRow>
                  );
                })}
              </MGroup>
            ))}
            <MTotalRow>
              <span>Jami ball:</span>
              <MTotalVal>
                {flatCols.reduce((s, c) => s + (myScoresApp.judgeScores?.[judgeId]?.[c.key] || 0), 0)}
                <MTotalMax>/{totalMax}</MTotalMax>
              </MTotalVal>
            </MTotalRow>
          </ModalBody>
        </Modal>
      )}
    </>
  );
}

const PageWrap = styled.div`display: flex; flex-direction: column; gap: 16px;`;

const BackBar = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap;`;

const BackBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 13px; font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s;
  &:hover { background: ${({ theme }) => theme.colors.bg}; color: ${({ theme }) => theme.colors.primary}; }
  svg { font-size: 18px; }
`;

const SchTitle = styled.h2`
  font-size: 16px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const TableCard = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  overflow: hidden;
`;

const TableHeaderRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TableTitle = styled.h3`
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const CountBadge = styled.span`
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 6px;
  border-radius: 999px; font-size: 11px; font-weight: 700;
  background: #F5EEF8; color: #9B59B6;
`;

const MaxInfo = styled.span`
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
  b { color: ${({ theme }) => theme.colors.text}; }
`;

const HeaderRight = styled.div`
  display: flex; align-items: center; gap: 12px;
`;

const CorrectionNote = styled.p`
  margin: 0 0 12px; padding: 10px 12px;
  border-radius: var(--radius-md);
  background: ${({ theme }) => theme.colors.warningLight};
  border: 1px solid ${({ theme }) => theme.colors.warningBorder};
  color: ${({ theme }) => theme.colors.text};
  font-size: 13px; line-height: 1.5;
`;

const Empty = styled.div`
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 48px 20px;
  span { font-size: 36px; }
  p { font-size: 13px; color: ${({ theme }) => theme.colors.textMuted}; }
`;

const ScrollWrap = styled.div`overflow-x: auto;`;

const StyledTable = styled.table`
  width: 100%; border-collapse: collapse;
  min-width: 700px;
`;

const thBase = `
  padding: 9px 10px;
  text-align: left;
  font-size: 11px; font-weight: 600;
  background: #F8FAFB;
  border-bottom: 1px solid #E2E8F0;
  white-space: nowrap;
`;

const Th = styled.th`
  ${thBase}
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  vertical-align: middle;
  border-right: 1px solid #E2E8F0;
  &:last-child { border-right: none; }
`;

const ThGroup = styled.th`
  ${thBase}
  color: #1E3050;
  background: #E2EBF6;
  border-bottom: 1px solid #C8D9ED;
  border-right: 1px solid #C8D9ED;
  text-align: center;
  &:last-child { border-right: none; }
`;

const ThSub = styled.th`
  ${thBase}
  color: #475569;
  font-size: 10px;
  text-align: center;
  border-right: 1px solid #E2E8F0;
  &:last-child { border-right: none; }
`;

const ColMax = styled.span`
  display: block;
  font-size: 10px; font-weight: 400;
  color: #94A3B8; margin-top: 2px;
`;

const Tr = styled.tr`
  &:not(:last-child) td { border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const Td = styled.td`
  padding: 10px 10px;
  font-size: 13px; color: ${({ theme }) => theme.colors.text};
  vertical-align: middle;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  &:last-child { border-right: none; }
`;

const RowNum = styled.div`
  width: 26px; height: 26px; border-radius: 50%;
  background: ${({ theme }) => theme.colors.bg};
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0 auto;
`;

const SName = styled.div`
  font-size: 13px; font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 180px;
`;

const SMeta = styled.div`
  font-size: 11px; color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const LiveTotal = styled.span<{ $full: boolean }>`
  font-size: 16px; font-weight: 800;
  color: ${({ $full }) => $full ? 'var(--brand-primary)' : '#2C3E50'};
`;

const TotalOf = styled.span`
  font-size: 11px; color: #94A3B8; margin-left: 1px;
`;

const SmallBtn = styled.button<{ $green?: boolean; $blue?: boolean }>`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 7px; font-size: 11px; font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s;
  svg { font-size: 14px; }

  ${({ $green }) => $green && `
    color: white; background: var(--brand-primary); border: 1px solid var(--brand-primary);
    &:hover { opacity: 0.85; }
  `}
  ${({ $blue }) => $blue && `
    color: #1D4ED8; background: #DBEAFE; border: 1px solid #BFDBFE;
    &:hover { background: #BFDBFE; }
  `}
  ${({ $green, $blue }) => !$green && !$blue && `
    color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0;
    &:hover { background: #E8F4FD; color: #3498DB; border-color: #AED6F1; }
  `}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  &:disabled:hover {
    opacity: 0.55;
  }
`;

const ModalBody = styled.div`display: flex; flex-direction: column; gap: 10px;`;

const MGroup = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px; overflow: hidden;
`;

const MGroupLabel = styled.div`
  padding: 7px 12px;
  background: #E2EBF6;
  font-size: 12px; font-weight: 700; color: #1E3050;
  border-bottom: 1px solid #C8D9ED;
`;

const MRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  &:last-child { border-bottom: none; }
`;

const MRowLabel = styled.span`font-size: 12px; color: ${({ theme }) => theme.colors.text}; flex: 1;`;

const MRowVal = styled.span<{ $zero: boolean }>`
  font-size: 14px; font-weight: 700;
  color: ${({ $zero }) => $zero ? '#94A3B8' : 'var(--brand-primary)'};
`;

const MMax = styled.span`font-size: 11px; font-weight: 400; color: #94A3B8;`;

const MTotalRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  background: #F0FDF4; border: 1.5px solid #86EFAC;
  border-radius: 10px;
  font-size: 13px; font-weight: 700; color: #15803D;
`;

const MTotalVal = styled.span`font-size: 22px; font-weight: 800; color: #15803D;`;
const MTotalMax = styled.span`font-size: 13px; font-weight: 400; color: #94A3B8;`;

const MedalIcon = styled.div`
  font-size: 20px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
`;

const ScoreBall = styled.span<{ $bg: string; $text: string }>`
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  background: ${({ $bg }) => $bg};
  color: ${({ $text }) => $text};
  font-size: 13px; font-weight: 700;
`;

const JamiVal = styled.span<{ $pass: boolean }>`
  font-size: 15px; font-weight: 800;
  color: ${({ $pass }) => $pass ? '#1D4ED8' : '#D97706'};
`;

const VerdictBadge = styled.span<{ $pass: boolean }>`
  display: inline-block;
  padding: 4px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 700;
  white-space: nowrap;
  ${({ $pass }) => $pass
    ? 'background: #DCFCE7; color: #15803D;'
    : 'background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA;'
  }
`;

const IconBtn = styled.button`
  width: 32px; height: 32px; border-radius: 50%;
  background: #DBEAFE; color: #1D4ED8;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 17px;
  transition: all 0.15s;
  &:hover { background: #BFDBFE; }
`;
