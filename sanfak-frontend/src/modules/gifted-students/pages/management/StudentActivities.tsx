import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import Badge, { statusLabel } from '../../components/common/Badge';
import type { BadgeVariant } from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';
import { useStudent, useStudentAchievements, useDocumentTypes } from '../../api/gifted-api';
import type { Activity } from '../../data/types';
import {
  MdArrowBack, MdDownload, MdOpenInNew, MdInfoOutline, MdAssignment, MdAdd, MdRemove, MdPerson,
} from '../../icons';
import { safeExternalLink } from '../../lib/safe-link';

const FILTER_TABS = [
  { key: 'all', label: 'Barchasi' },
  { key: 'approved', label: 'Tasdiqlangan' },
  { key: 'pending', label: 'Kutmoqda' },
  { key: 'rejected', label: 'Rad etilgan' },
];

export default function ManagementStudentActivities() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('all');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [rejectNote, setRejectNote] = useState<string | null>(null);

  const { data: student, isLoading, isError } = useStudent(id);
  const { data: docTypes = [] } = useDocumentTypes();
  const { data: allAch = [], isLoading: achLoading } = useStudentAchievements(id);
  const personalIds = new Set(docTypes.filter(d => d.personal).map(d => d.id));
  const activities = allAch.filter(a => !personalIds.has(a.criteriaId));

  const filtered = filterStatus === 'all'
    ? activities
    : activities.filter(a => a.status === filterStatus);

  const grouped = Object.entries(
    filtered.reduce<Record<string, Activity[]>>((acc, act) => {
      const key = act.criteriaName || 'Boshqa';
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(act);
      return acc;
    }, {})
  );

  const toggleGroup = (name: string) =>
    setOpenGroups(prev => ({ ...prev, [name]: !prev[name] }));

  const backBar = (
    <BackBar>
      <BackBtn onClick={() => navigate('/gifted-students/management/reports')}>
        <MdArrowBack /> Orqaga
      </BackBtn>
    </BackBar>
  );

  if (isLoading) {
    return (
      <PageWrap>
        {backBar}
        <Loader text="Talaba ma'lumoti yuklanmoqda..." />
      </PageWrap>
    );
  }

  if (!student) {
    return (
      <PageWrap>
        {backBar}
        <SectionCard>
          <SectionEmpty>
            {isError
              ? "Talaba ma'lumotini yuklab bo'lmadi — ruxsat yo'q yoki so'rov muvaffaqiyatsiz"
              : 'Talaba topilmadi'}
          </SectionEmpty>
        </SectionCard>
      </PageWrap>
    );
  }

  return (
    <>
      <PageWrap>
        <BackBar>
          <BackBtn onClick={() => navigate('/gifted-students/management/reports')}>
            <MdArrowBack /> Orqaga
          </BackBtn>
          {student && (
            <StudentMeta>
              <AvatarCircle><MdPerson /></AvatarCircle>
              <div>
                <StudentName>{student.name}</StudentName>
                <StudentSub>
                  {student.faculty} · {student.direction} · {student.course}-kurs, {student.group} guruh
                </StudentSub>
              </div>
            </StudentMeta>
          )}
        </BackBar>

        <SectionCard>
          <SectionHead>
            <MdAssignment />
            Faoliyat va hujjatlar
            <SectionCount>{filtered.length}</SectionCount>
          </SectionHead>

          <FilterRow>
            {FILTER_TABS.map(t => (
              <FilterTab key={t.key} $active={filterStatus === t.key} onClick={() => setFilterStatus(t.key)}>
                {t.label}
              </FilterTab>
            ))}
          </FilterRow>

          {achLoading ? (
            <Loader text="Faoliyatlar yuklanmoqda..." />
          ) : filtered.length === 0 ? (
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
                        {idx > 0 && <SpacerRow><td colSpan={6} /></SpacerRow>}
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
                        {isOpen && groupActs.map(act => (
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
      </PageWrap>

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

const PageWrap = styled.div`display: flex; flex-direction: column; gap: 16px;`;

const BackBar = styled.div`
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
`;

const BackBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 13px; font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s; flex-shrink: 0;
  &:hover { background: ${({ theme }) => theme.colors.bg}; color: ${({ theme }) => theme.colors.primary}; }
  svg { font-size: 18px; }
`;

const StudentMeta = styled.div`
  display: flex; align-items: center; gap: 12px;
  background: white; border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 10px 16px; flex: 1;
`;

const AvatarCircle = styled.div`
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
`;

const StudentName = styled.div`font-size: 14px; font-weight: 700; color: #2C3E50;`;
const StudentSub = styled.div`font-size: 12px; color: #7F8C8D; margin-top: 2px;`;

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
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
`;

const FilterRow = styled.div`
  display: flex; gap: 4px;
  padding: 12px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const FilterTab = styled.button<{ $active: boolean }>`
  padding: 6px 14px; border-radius: 999px;
  font-size: 13px; font-weight: 500; white-space: nowrap;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) => $active ? theme.colors.primary : 'white'};
  color: ${({ $active, theme }) => $active ? 'white' : theme.colors.textMuted};
  transition: all 0.15s;
`;

const SectionEmpty = styled.p`
  padding: 32px 18px; font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted}; text-align: center;
`;

const TableWrap = styled.div`overflow-x: auto;`;
const InnerTable = styled.table`width: 100%; border-collapse: collapse;`;

const InnerTh = styled.th`
  padding: 8px 14px; text-align: left;
  font-size: 11px; font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const SpacerRow = styled.tr`
  height: 5px; background: white;
  td { border: none; padding: 0; }
`;

const GroupRow = styled.tr`
  background: ${({ theme }) => theme.colors.bg};
  cursor: pointer; user-select: none;
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
  td {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const GroupRowInner = styled.div`
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px;
`;

const GroupRowTitle = styled.span`
  font-size: 13px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text}; flex: 1;
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

const InnerTr = styled.tr`
  background: white;
  &:not(:last-child) td { border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const InnerTd = styled.td`
  padding: 10px 14px; font-size: 13px;
  color: ${({ theme }) => theme.colors.text}; vertical-align: middle;
`;

const ActName = styled.div`font-size: 13px; font-weight: 600;`;

const IzohCell = styled.div`
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 240px;
`;

const Dash = styled.span`color: #CBD5E1;`;
const Meta = styled.span`font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};`;

const ActIconBtn = styled.button<{ $green?: boolean }>`
  width: 28px; height: 28px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px;
  color: ${({ $green }) => $green ? 'var(--brand-primary)' : '#3498DB'};
  background: ${({ $green }) => $green ? 'var(--brand-primary-soft)' : '#EBF5FB'};
  text-decoration: none; transition: all 0.15s;
  &:hover { opacity: 0.75; }
`;

const StatusCell = styled.div`display: inline-flex; align-items: center; gap: 5px;`;

const InfoBtn = styled.button`
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #DC2626; background: transparent;
  transition: opacity 0.15s; &:hover { opacity: 0.7; }
`;

const RejectNoteBox = styled.p`
  font-size: 14px; color: #1E293B; line-height: 1.6;
  padding: 12px 16px;
  background: #FEF2F2; border-left: 3px solid #EF4444; border-radius: 6px;
`;
