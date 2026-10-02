import React, { useState } from 'react';
import styled from 'styled-components';
import ChatPanel from '../../components/chat';
import { CardWrap } from '../../components/common/Card';
import Badge, { statusLabel } from '../../components/common/Badge';
import type { BadgeVariant } from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Loader from '../../components/common/Loader';
import {
  useProfile, useMyAdvisees, useStudentAchievements, useStudentApplications, useDocumentTypes,
} from '../../api/gifted-api';
import type {
  Activity, ScholarshipApplication, StudentRecord,
} from '../../data/types';
import { isReviewPassed } from '../../lib/application-status';
import {
  MdPerson, MdSend,
  MdAssignment, MdSchool, MdAdd, MdRemove, MdDownload,
  MdOpenInNew, MdInfoOutline, MdTrendingUp, MdStar,
} from '../../icons';
import { safeExternalLink } from '../../lib/safe-link';

const FILTER_TABS = [
  { key: 'all', label: 'Barchasi' },
  { key: 'approved', label: 'Tasdiqlangan' },
  { key: 'pending', label: 'Kutmoqda' },
  { key: 'rejected', label: 'Rad etilgan' },
];

export default function AdvisorStudentView() {
  const [tab, setTab] = useState('profil');
  const [selectedId, setSelectedId] = useState<string>('');

  const { data: profile } = useProfile();
  const { data: students = [], isLoading: studentsLoading } = useMyAdvisees();
  const { data: docTypes = [] } = useDocumentTypes();
  const advisorId = profile?._id ?? '';
  const student = students.find((s) => s.id === selectedId) ?? students[0];
  const { data: rawActivities = [] } = useStudentAchievements(student?.id);
  const { data: schApps = [] } = useStudentApplications(student?.id);

  const isPersonal = (a: Activity) =>
    docTypes.find((d) => d.id === a.criteriaId)?.personal === true;

  const activities = student ? rawActivities.filter((a) => !isPersonal(a)) : [];
  const approved = activities.filter((a) => a.status === 'approved');
  const totalPoints = approved.reduce((sum, a) => sum + (a.points || 0), 0);

  return (
    <PageWrap>
      {students.length > 1 && (
        <StudentPicker>
          <PickerLabel>Talaba:</PickerLabel>
          <PickerRow>
            {students.map((s) => (
              <PickerChip
                key={s.id}
                $active={s.id === student?.id}
                onClick={() => setSelectedId(s.id)}
                type="button"
              >
                {s.name}
              </PickerChip>
            ))}
          </PickerRow>
        </StudentPicker>
      )}

      {student ? (
        <TopCard>
          <TopAvatar>{student.name[0]}</TopAvatar>
          <TopInfo>
            <TopName>{student.name}</TopName>
            <TopMeta>
              {student.faculty} · {student.direction} · {student.course}-kurs, {student.group} guruh
            </TopMeta>
            {student.academicYear && <YearChip>{student.academicYear}</YearChip>}
          </TopInfo>
        </TopCard>
      ) : studentsLoading ? (
        <Loader />
      ) : (
        <EmptyCard>
          <EmptyIcon>👤</EmptyIcon>
          <EmptyText>Sizga biriktirilgan talaba topilmadi</EmptyText>
        </EmptyCard>
      )}

      <TabBar>
        <TabBtn $active={tab === 'profil'} onClick={() => setTab('profil')}>
          <MdPerson /> Profil
        </TabBtn>
        <TabBtn $active={tab === 'chat'} onClick={() => setTab('chat')}>
          <MdSend /> Chat
        </TabBtn>
      </TabBar>

      {tab === 'profil' && student && (
        <ProfileContent
          student={student}
          activities={activities}
          approved={approved}
          totalPoints={totalPoints}
          schApps={schApps}
        />
      )}
      {tab === 'chat' && student && (
        <ChatContent student={student} advisorId={advisorId} peerUserId={student.userId} />
      )}
    </PageWrap>
  );
}

interface ProfileContentProps {
  student: StudentRecord;
  activities: Activity[];
  approved: Activity[];
  totalPoints: number;
  schApps: ScholarshipApplication[];
}

function ProfileContent({ activities, approved, totalPoints, schApps }: ProfileContentProps) {
  const recommendedApps = schApps.filter((a) => isReviewPassed(a.status));
  const [filterStatus, setFilterStatus] = useState('all');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [rejectNote, setRejectNote] = useState<string | null>(null);

  const filtered = filterStatus === 'all'
    ? activities
    : activities.filter((a) => a.status === filterStatus);

  const grouped = Object.entries(
    filtered.reduce<Record<string, Activity[]>>((acc, act) => {
      const key = act.criteriaName || 'Boshqa';
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(act);
      return acc;
    }, {})
  );

  const toggleGroup = (name: string) =>
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <>
      <StatsRow>
        <StatCard>
          <StatIcon $bg="var(--brand-primary-soft)" $color="var(--brand-primary)"><MdTrendingUp /></StatIcon>
          <StatBody>
            <StatNum>{totalPoints}</StatNum>
            <StatLabel>Umumiy ball</StatLabel>
          </StatBody>
        </StatCard>
        <StatCard>
          <StatIcon $bg="#EBF5FB" $color="#3498DB"><MdAssignment /></StatIcon>
          <StatBody>
            <StatNum>{activities.length}</StatNum>
            <StatLabel>Jami faoliyat</StatLabel>
          </StatBody>
        </StatCard>
        <StatCard>
          <StatIcon $bg="#F3E8FF" $color="#7C3AED"><MdStar /></StatIcon>
          <StatBody>
            <StatNum>{approved.length}</StatNum>
            <StatLabel>Tasdiqlangan</StatLabel>
          </StatBody>
        </StatCard>
        <StatCard>
          <StatIcon $bg="#FEF3C7" $color="#D97706"><MdSchool /></StatIcon>
          <StatBody>
            <StatNum>{recommendedApps.length}</StatNum>
            <StatLabel>Stipendiya</StatLabel>
          </StatBody>
        </StatCard>
      </StatsRow>

      <SectionCard>
        <SectionHead>
          <MdSchool />
          Stipendiya arizalari
          <SectionCount>{schApps.length}</SectionCount>
        </SectionHead>
        {schApps.length === 0 ? (
          <SectionEmpty>Stipendiya arizalari mavjud emas</SectionEmpty>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Stipendiya nomi</Th>
                  <Th>O'quv yili</Th>
                  <Th>Ariza sanasi</Th>
                  <Th>Holat</Th>
                </tr>
              </thead>
              <tbody>
                {schApps.map((app, idx) => (
                  <tr key={app.id}>
                    <Td>{idx + 1}</Td>
                    <Td><SchName>{app.scholarshipName}</SchName></Td>
                    <Td>{app.academicYear || '—'}</Td>
                    <Td>{app.appliedAt}</Td>
                    <Td><Badge variant={app.status as BadgeVariant}>{statusLabel[app.status]}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>

      <SectionCard>
        <SectionHead>
          <MdAssignment />
          Faoliyat va hujjatlar
          <SectionCount>{activities.length}</SectionCount>
        </SectionHead>

        <FilterRow>
          {FILTER_TABS.map((t) => (
            <FilterTab key={t.key} $active={filterStatus === t.key} onClick={() => setFilterStatus(t.key)}>
              {t.label}
            </FilterTab>
          ))}
        </FilterRow>

        {filtered.length === 0 ? (
          <SectionEmpty>
            {filterStatus === 'all' ? 'Hali faoliyat yuborilmagan' : "Bu bo'limda faoliyat yo'q"}
          </SectionEmpty>
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
                      {idx > 0 && <SpacerTr><td colSpan={6} /></SpacerTr>}
                      <GroupRow onClick={() => toggleGroup(groupName)}>
                        <td colSpan={6}>
                          <GroupRowInner>
                            <GroupRowTitle>{groupName} ({groupActs.length})</GroupRowTitle>
                            <AccordionToggle $open={isOpen}>
                              {isOpen ? <MdRemove /> : <MdAdd />}
                            </AccordionToggle>
                          </GroupRowInner>
                        </td>
                      </GroupRow>
                      {isOpen && groupActs.map((act) => (
                        <InnerTr key={act.id}>
                          <InnerTd><ActName>{act.title}</ActName></InnerTd>
                          <InnerTd>
                            {act.description || act.note
                              ? <IzohCell>{act.description || act.note}</IzohCell>
                              : <Dash>—</Dash>}
                          </InnerTd>
                          <InnerTd style={{ textAlign: 'center' }}>
                            {act.fileName
                              ? <ActIconBtn as="a" href={act.fileUrl || '#'} download={act.fileName} title={act.fileName} $green>
                                  <MdDownload />
                                </ActIconBtn>
                              : <Dash>—</Dash>}
                          </InnerTd>
                          <InnerTd style={{ textAlign: 'center' }}>
                            {safeExternalLink(act.link)
                              ? <ActIconBtn as="a" href={safeExternalLink(act.link)!} target="_blank" rel="noopener noreferrer" title={act.link}>
                                  <MdOpenInNew />
                                </ActIconBtn>
                              : <Dash>—</Dash>}
                          </InnerTd>
                          <InnerTd><Meta>{act.submittedAt}</Meta></InnerTd>
                          <InnerTd>
                            <StatusCell>
                              <Badge variant={act.status as BadgeVariant}>{statusLabel[act.status]}</Badge>
                              {act.status === 'rejected' && (
                                <InfoBtn onClick={(e: React.MouseEvent) => { e.stopPropagation(); setRejectNote(act.reviewNote || "Sabab ko'rsatilmagan"); }}>
                                  <MdInfoOutline />
                                </InfoBtn>
                              )}
                            </StatusCell>
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

      <Modal
        open={!!rejectNote}
        onClose={() => setRejectNote(null)}
        title="Rad etish sababi"
        footer={<Button variant="secondary" onClick={() => setRejectNote(null)}>Yopish</Button>}
      >
        <RejectNoteBox>{rejectNote}</RejectNoteBox>
      </Modal>
    </>
  );
}

interface ChatContentProps {
  student: StudentRecord;
  advisorId: string;
  peerUserId?: string;
}

function ChatContent({ student, advisorId, peerUserId }: ChatContentProps) {
  return (
    <ChatLayout>
      <ChatSideCard>
        <SideAvatarWrap>
          <SideAvatar>{student.name[0]}</SideAvatar>
        </SideAvatarWrap>
        <SideName>{student.name}</SideName>
        <SideFaculty>{student.faculty}</SideFaculty>
        <SideDetail>{student.direction}</SideDetail>
        <SideDivider />
        <SideRow><SideLabel>Kurs</SideLabel><SideVal>{student.course}-kurs</SideVal></SideRow>
        <SideRow><SideLabel>Guruh</SideLabel><SideVal>{student.group}</SideVal></SideRow>
        {student.academicYear && (
          <SideRow><SideLabel>O'quv yili</SideLabel><SideVal>{student.academicYear}</SideVal></SideRow>
        )}
      </ChatSideCard>

      <ChatPanel
        peerUserId={peerUserId}
        myId={advisorId}
        peerName={student.name}
        emptyHint="Chat mavjud emas: talaba platforma akkauntiga bog‘lanmagan."
      />
    </ChatLayout>
  );
}

const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
`;

const StudentPicker = styled(CardWrap)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  flex-wrap: wrap;
`;

const PickerLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PickerRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const PickerChip = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.border)};
  background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : theme.colors.white)};
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.text)};
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const TopCard = styled(CardWrap)`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
`;

const TopAvatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  flex-shrink: 0;
`;

const TopInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TopName = styled.h2`
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const TopMeta = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0;
`;

const YearChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid #A9DFBF;
  width: fit-content;
`;

const EmptyCard = styled(CardWrap)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px;
`;

const EmptyIcon = styled.div`font-size: 40px;`;
const EmptyText = styled.p`font-size: 13px; color: ${({ theme }) => theme.colors.textMuted};`;

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 4px;
  width: fit-content;
`;

const TabBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
  background: ${({ $active, theme }) => $active ? theme.colors.primary : 'transparent'};
  color: ${({ $active, theme }) => $active ? 'white' : theme.colors.textMuted};
  svg { font-size: 16px; }
  &:hover {
    background: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.primaryLight};
    color: ${({ $active, theme }) => $active ? 'white' : theme.colors.primary};
  }
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
`;

const StatCard = styled(CardWrap)`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
`;

const StatIcon = styled.div<{ $bg: string; $color: string }>`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
`;

const StatBody = styled.div``;
const StatNum = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1;
`;
const StatLabel = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const SectionCard = styled(CardWrap)`
  padding: 0;
  overflow: hidden;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  background: var(--brand-primary-soft);
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  svg { font-size: 18px; color: ${({ theme }) => theme.colors.primary}; }
`;

const SectionCount = styled.span`
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
`;

const SectionEmpty = styled.p`
  padding: 32px 18px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const TableWrap = styled.div`overflow-x: auto;`;
const Table = styled.table`width: 100%; border-collapse: collapse;`;
const Th = styled.th`
  padding: 10px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: ${({ theme }) => theme.colors.bg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;
const Td = styled.td`
  padding: 12px 16px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  vertical-align: middle;
  &:last-child { border-bottom: none; }
`;
const SchName = styled.span`font-weight: 600;`;

const FilterRow = styled.div`
  display: flex;
  gap: 4px;
  padding: 12px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const FilterTab = styled.button<{ $active: boolean }>`
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) => $active ? theme.colors.primary : 'white'};
  color: ${({ $active, theme }) => $active ? 'white' : theme.colors.textMuted};
  transition: all 0.15s;
`;

const InnerTable = styled.table`width: 100%; border-collapse: collapse;`;
const InnerTh = styled.th`
  padding: 8px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const SpacerTr = styled.tr`
  height: 5px;
  background: white;
  td { border: none; padding: 0; }
`;

const GroupRow = styled.tr`
  background: ${({ theme }) => theme.colors.bg};
  cursor: pointer;
  user-select: none;
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
  td {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const GroupRowInner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
`;

const GroupRowTitle = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  flex: 1;
`;

const AccordionToggle = styled.span<{ $open: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
  font-size: 16px;
  color: ${({ $open, theme }) => $open ? theme.colors.primary : theme.colors.textMuted};
  background: ${({ $open, theme }) => $open ? theme.colors.primaryLight : 'white'};
  border: 1px solid ${({ $open, theme }) => $open ? theme.colors.primary : theme.colors.border};
  transition: all 0.15s;
`;

const InnerTr = styled.tr`
  background: white;
  &:not(:last-child) td { border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const InnerTd = styled.td`
  padding: 10px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  vertical-align: middle;
`;

const ActName = styled.div`font-size: 13px; font-weight: 600;`;
const IzohCell = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  max-width: 240px;
`;
const Dash = styled.span`color: #CBD5E1;`;
const Meta = styled.span`font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};`;

const ActIconBtn = styled.button<{ $green?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: ${({ $green }) => $green ? 'var(--brand-primary)' : '#3498DB'};
  background: ${({ $green }) => $green ? 'var(--brand-primary-soft)' : '#EBF5FB'};
  text-decoration: none;
  transition: all 0.15s;
  &:hover { opacity: 0.75; }
`;

const StatusCell = styled.div`display: inline-flex; align-items: center; gap: 5px;`;
const InfoBtn = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #DC2626;
  background: transparent;
  transition: opacity 0.15s;
  &:hover { opacity: 0.7; }
`;
const RejectNoteBox = styled.p`
  font-size: 14px;
  color: #1E293B;
  line-height: 1.6;
  padding: 12px 16px;
  background: #FEF2F2;
  border-left: 3px solid #EF4444;
  border-radius: 6px;
`;

const ChatLayout = styled.div`
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
`;

const ChatSideCard = styled(CardWrap)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 16px;
`;

const SideAvatarWrap = styled.div`margin-bottom: 8px;`;
const SideAvatar = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
`;

const SideName = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #2C3E50;
  text-align: center;
`;
const SideFaculty = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 500;
  text-align: center;
`;
const SideDetail = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const SideDivider = styled.hr`
  border: none;
  border-top: 1px solid #E8ECEF;
  width: 100%;
  margin: 10px 0;
`;

const SideRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 4px 0;
`;
const SideLabel = styled.span`font-size: 11px; color: ${({ theme }) => theme.colors.textMuted};`;
const SideVal = styled.span`font-size: 12px; font-weight: 600; color: ${({ theme }) => theme.colors.text};`;
