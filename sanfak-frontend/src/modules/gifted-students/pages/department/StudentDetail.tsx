import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/AuthContext';
import { CardWrap } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge, { statusLabel } from '../../components/common/Badge';
import type { BadgeVariant } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { useStudent, useStudentAchievements, useApplications, useDocumentTypes, useAdvisorUsers } from '../../api/gifted-api';
import Loader from '../../components/common/Loader';
import type { Activity } from '../../data/types';
import {
  MdArrowBack, MdEdit, MdPerson, MdAssignment, MdStarRate,
  MdCheckCircle, MdHourglassEmpty, MdCancel, MdDownload, MdOpenInNew, MdInfoOutline,
  MdAdd, MdRemove,
} from '../../icons';
import { safeExternalLink } from '../../lib/safe-link';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [rejectNote, setRejectNote] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const backUrl = (location.state as { back?: string } | null)?.back || null;

  const { data: student, isLoading } = useStudent(id);
  const { data: rawActivities = [] } = useStudentAchievements(id);
  const { data: allApplications = [] } = useApplications();
  const { data: docTypes = [] } = useDocumentTypes();
  const { data: advisors = [] } = useAdvisorUsers(user?.role === 'department');
  if (isLoading) return <Loader text="Yuklanmoqda..." />;
  if (!student) {
    return (
      <CardWrap>
        <NotFound>
          <MdPerson style={{ fontSize: 48, color: '#BDC3C7' }} />
          <p>Talaba topilmadi</p>
          <Button onClick={() => navigate('/gifted-students/department/students')}>
            <MdArrowBack /> Orqaga
          </Button>
        </NotFound>
      </CardWrap>
    );
  }

  const isPersonal = (a: Activity) => docTypes.find(d => d.id === a.criteriaId)?.personal === true;
  const acts = rawActivities.filter(a =>
    user?.role === 'department' || user?.role === 'student' || !isPersonal(a)
  );
  const apps = allApplications.filter(a => a.studentId === id);
  const liveAdvisor = advisors.find(a => a.id === student.advisorId);
  const advisorDegree = liveAdvisor?.degree;

  const approvedCnt = acts.filter(a => a.status === 'approved').length;
  const pendingCnt  = acts.filter(a => a.status === 'pending').length;
  const rejectedCnt = acts.filter(a => a.status === 'rejected').length;

  const grouped = Object.entries(
    acts.reduce<Record<string, Activity[]>>((acc, act) => {
      const key = act.criteriaName || 'Boshqa';
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(act);
      return acc;
    }, {})
  );

  return (
    <>
      <PageWrap>

        <TopBar>
          <BackBtn onClick={() => navigate(backUrl || (user?.role === 'management' ? '/gifted-students/management/reports' : '/gifted-students/department/students'))}>
            <MdArrowBack /> Orqaga
          </BackBtn>
          {user?.role === 'department' && (
            <Button onClick={() => navigate(`/gifted-students/department/students/edit/${id}`)}>
              <MdEdit /> Tahrirlash
            </Button>
          )}
        </TopBar>

        <HeaderCard>
          <HeaderAvatar>{student.name[0] ?? ''}</HeaderAvatar>
          <HeaderInfo>
            <StudentName>{student.name}</StudentName>
            <StudentMeta>
              {student.faculty}
              {student.direction ? ` · ${student.direction}` : ''}
              {` · ${student.course}-kurs · ${student.group}`}
            </StudentMeta>
            {(liveAdvisor?.name || student.advisorName) && (
              <AdvisorLine>
                👨‍🏫 {advisorDegree ? `${advisorDegree} ` : ''}
                {liveAdvisor?.name ?? student.advisorName}
              </AdvisorLine>
            )}
            {student.academicYear && (
              <YearLine>O'quv yili: {student.academicYear}</YearLine>
            )}
            {student.workplace && <YearLine>Ish joyi: {student.workplace}</YearLine>}
          </HeaderInfo>
        </HeaderCard>

        <StatsRow>
          <StatCard $color="var(--brand-primary)">
            <StatBig $color="var(--brand-primary)">{acts.length}</StatBig>
            <StatLabel>Jami so'rovlar</StatLabel>
          </StatCard>
          <StatCard $color="var(--brand-primary)">
            <StatIcon $color="var(--brand-primary)"><MdCheckCircle /></StatIcon>
            <StatBig $color="var(--brand-primary)">{approvedCnt}</StatBig>
            <StatLabel>Tasdiqlangan</StatLabel>
          </StatCard>
          <StatCard $color="#F39C12">
            <StatIcon $color="#F39C12"><MdHourglassEmpty /></StatIcon>
            <StatBig $color="#F39C12">{pendingCnt}</StatBig>
            <StatLabel>Kutmoqda</StatLabel>
          </StatCard>
          <StatCard $color="#E74C3C">
            <StatIcon $color="#E74C3C"><MdCancel /></StatIcon>
            <StatBig $color="#E74C3C">{rejectedCnt}</StatBig>
            <StatLabel>Rad etilgan</StatLabel>
          </StatCard>
        </StatsRow>

        <SectionCard>
          <SectionHead>
            <MdAssignment /> Faoliyat va hujjatlar
            <SectionCount>{acts.length}</SectionCount>
          </SectionHead>

          {acts.length === 0 ? (
            <SectionEmpty>Hali faoliyat yuborilmagan</SectionEmpty>
          ) : (
            <TableWrap>
              <InnerTable>
                <thead>
                  <tr>
                    <InnerTh>Sarlavha</InnerTh>
                    <InnerTh>Izoh</InnerTh>
                    <InnerTh style={{ width: 60, textAlign: 'center' }}>Fayl</InnerTh>
                    <InnerTh style={{ width: 60, textAlign: 'center' }}>Havola</InnerTh>
                    <InnerTh style={{ width: 110 }}>Sana</InnerTh>
                    <InnerTh style={{ width: 150 }}>Status</InnerTh>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([groupName, groupActs], idx) => {
                    const isOpen = !!openGroups[groupName];
                    return (
                      <React.Fragment key={groupName}>
                        {idx > 0 && <SpacerRow><td colSpan={6} /></SpacerRow>}
                        <GroupRow onClick={() => setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}>
                          <td colSpan={6}>
                            <GroupRowInner>
                              <GroupRowTitle>{groupName} ({groupActs.length})</GroupRowTitle>
                              <AccordionToggle $open={isOpen}>{isOpen ? <MdRemove /> : <MdAdd />}</AccordionToggle>
                            </GroupRowInner>
                          </td>
                        </GroupRow>
                        {isOpen && groupActs.map(act => (
                          <InnerTr key={act.id}>
                            <InnerTd><ActName>{act.title}</ActName></InnerTd>
                            <InnerTd>
                              {(() => {
                                const izoh = act.description || act.note;
                                return izoh
                                  ? <IzohCell>{izoh}</IzohCell>
                                  : <span style={{ color: '#CBD5E1' }}>—</span>;
                              })()}
                            </InnerTd>
                            <InnerTd style={{ textAlign: 'center' }}>
                              {act.fileName
                                ? <ActIconBtn as="a" href={act.fileUrl || '#'} download={act.fileName} title={act.fileName} $green>
                                    <MdDownload />
                                  </ActIconBtn>
                                : <span style={{ color: '#CBD5E1' }}>—</span>
                              }
                            </InnerTd>
                            <InnerTd style={{ textAlign: 'center' }}>
                              {safeExternalLink(act.link)
                                ? <ActIconBtn as="a" href={safeExternalLink(act.link)!} target="_blank" rel="noopener noreferrer" title={act.link}>
                                    <MdOpenInNew />
                                  </ActIconBtn>
                                : <span style={{ color: '#CBD5E1' }}>—</span>
                              }
                            </InnerTd>
                            <InnerTd><Meta>{act.submittedAt}</Meta></InnerTd>
                            <InnerTd>
                              <SDStatusCell>
                                <Badge variant={act.status as BadgeVariant}>{statusLabel[act.status]}</Badge>
                                {act.status === 'rejected' && (
                                  <SDInfoBtn onClick={(e: React.MouseEvent) => { e.stopPropagation(); setRejectNote(act.reviewNote || "Sabab ko'rsatilmagan"); }}>
                                    <MdInfoOutline />
                                  </SDInfoBtn>
                                )}
                              </SDStatusCell>
                            </InnerTd>
                          </InnerTr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </InnerTable>
            </TableWrap>
          )}
        </SectionCard>

        <SectionCard>
          <SectionHead>
            <MdStarRate /> Stipendiya arizalari
            <SectionCount>{apps.length}</SectionCount>
          </SectionHead>

          {apps.length === 0 ? (
            <SectionEmpty>Hali ariza topshirilmagan</SectionEmpty>
          ) : (
            <TableWrap>
              <StyledTable>
                <thead>
                  <tr>
                    <Th style={{ width: 40 }}>№</Th>
                    <Th>Stipendiya nomi</Th>
                    <Th style={{ width: 120 }}>Yuborilgan</Th>
                    <Th style={{ width: 150 }}>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app, i) => (
                    <Tr key={app.id}>
                      <Td><Num>{i + 1}</Num></Td>
                      <Td><AppName>{app.scholarshipName}</AppName></Td>
                      <Td><Meta>{app.appliedAt}</Meta></Td>
                      <Td>
                        <SDStatusCell>
                          <Badge variant={app.status as BadgeVariant}>{statusLabel[app.status]}</Badge>
                          {app.status === 'rejected' && (
                            <SDInfoBtn onClick={() => setRejectNote(app.note || "Sabab ko'rsatilmagan")}>
                              <MdInfoOutline />
                            </SDInfoBtn>
                          )}
                        </SDStatusCell>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </StyledTable>
            </TableWrap>
          )}
        </SectionCard>

      </PageWrap>

      <Modal
        open={!!rejectNote}
        onClose={() => setRejectNote(null)}
        title="Rad etish sababi"
        footer={<Button variant="secondary" onClick={() => setRejectNote(null)}>Yopish</Button>}
      >
        <SDRejectNoteBox>{rejectNote}</SDRejectNoteBox>
      </Modal>
    </>
  );
}

const PageWrap = styled.div`
  display: flex; flex-direction: column; gap: 16px;
`;

const TopBar = styled.div`
  display: flex; align-items: center; justify-content: space-between;
`;

const BackBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 13px; font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s;
  &:hover { background: white; color: ${({ theme }) => theme.colors.primary}; }
  svg { font-size: 18px; }
`;

const HeaderCard = styled(CardWrap)`
  display: flex; align-items: center; gap: 16px;
`;

const HeaderAvatar = styled.div`
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; flex-shrink: 0;
`;

const HeaderInfo = styled.div`display: flex; flex-direction: column; gap: 4px;`;

const StudentName = styled.h2`
  font-size: 18px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const StudentMeta = styled.p`
  font-size: 13px; color: ${({ theme }) => theme.colors.textMuted};
`;

const AdvisorLine = styled.p`
  font-size: 12px; font-weight: 500;
  color: ${({ theme }) => theme.colors.primary};
`;

const YearLine = styled.p`
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
`;

const StatsRow = styled.div`
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
`;

const StatCard = styled(CardWrap)<{ $color: string }>`
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; padding: 18px 12px;
`;

const StatIcon = styled.div<{ $color: string }>`
  font-size: 22px; color: ${({ $color }) => $color};
  display: flex;
`;

const StatBig = styled.div<{ $color: string }>`
  font-size: 32px; font-weight: 800; line-height: 1;
  color: ${({ $color }) => $color};
`;

const StatLabel = styled.div`
  font-size: 11px; color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const SectionCard = styled(CardWrap)`padding: 0; overflow: hidden;`;

const SectionHead = styled.div`
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px;
  font-size: 14px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  background: var(--brand-primary-soft);
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  svg { font-size: 18px; color: ${({ theme }) => theme.colors.primary}; }
`;

const SectionCount = styled.span`
  margin-left: auto;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
`;

const SectionEmpty = styled.p`
  padding: 28px 18px;
  font-size: 13px; color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const TableWrap = styled.div`overflow-x: auto;`;

const StyledTable = styled.table`
  width: 100%; border-collapse: collapse;
`;

const Th = styled.th`
  padding: 10px 14px;
  text-align: left;
  font-size: 11px; font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Tr = styled.tr`
  &:not(:last-child) td { border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const Td = styled.td`
  padding: 11px 14px;
  font-size: 13px; color: ${({ theme }) => theme.colors.text};
  vertical-align: middle;
`;

const Num = styled.span`
  font-size: 12px; font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ActName = styled.div`
  font-size: 13px; font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const ActIconBtn = styled.button<{ $green?: boolean }>`
  width: 28px; height: 28px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px;
  color: ${({ $green }) => $green ? 'var(--brand-primary)' : '#3498DB'};
  background: ${({ $green }) => $green ? 'var(--brand-primary-soft)' : '#EBF5FB'};
  text-decoration: none; transition: all 0.15s;
  &:hover { opacity: 0.75; }
`;

const Meta = styled.span`
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
`;

const AppName = styled.div`
  font-size: 13px; font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const SDStatusCell = styled.div`
  display: inline-flex; align-items: center; gap: 5px;
`;

const SDInfoBtn = styled.button`
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #DC2626; background: transparent;
  transition: opacity 0.15s; &:hover { opacity: 0.7; }
`;

const SDRejectNoteBox = styled.p`
  font-size: 14px; color: #1E293B; line-height: 1.6;
  padding: 12px 16px;
  background: #FEF2F2; border-left: 3px solid #EF4444; border-radius: 6px;
`;

const NotFound = styled.div`
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 48px;
  p { font-size: 14px; color: ${({ theme }) => theme.colors.textMuted}; }
`;

const SpacerRow = styled.tr`
  height: 5px;
  background: white;
  td { border: none; padding: 0; }
`;

const GroupRow = styled.tr`
  background: ${({ theme }) => theme.colors.bg};
  cursor: pointer;
  user-select: none;
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
  td { border-bottom: 1px solid ${({ theme }) => theme.colors.border};
       border-top: 1px solid ${({ theme }) => theme.colors.border}; }
`;

const GroupRowInner = styled.div`
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px;
`;

const GroupRowTitle = styled.span`
  font-size: 13px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  flex: 1;
`;

const AccordionToggle = styled.span<{ $open: boolean }>`
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;
  font-size: 16px;
  color: ${({ $open, theme }) => $open ? theme.colors.primary : theme.colors.textMuted};
  background: ${({ $open, theme }) => $open ? theme.colors.primaryLight : 'white'};
  border: 1px solid ${({ $open, theme }) => $open ? theme.colors.primary : theme.colors.border};
  transition: all 0.15s;
`;

const InnerTable = styled.table`
  width: 100%; border-collapse: collapse;
`;

const InnerTh = styled.th`
  padding: 8px 14px; text-align: left;
  font-size: 11px; font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const InnerTr = styled.tr`
  background: white;
  &:not(:last-child) td { border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const InnerTd = styled.td`
  padding: 10px 14px; font-size: 13px;
  color: ${({ theme }) => theme.colors.text}; vertical-align: middle;
`;

const IzohCell = styled.div`
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  max-width: 240px;
`;
