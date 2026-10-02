import { useState } from 'react';
import styled from 'styled-components';
import { Radio } from 'antd';
import {
  academicYearValue,
  useAcademicYears,
  withCurrent,
  useCourses,
} from '../api/reference-api';
import { MdAdd, MdCheck, MdDelete, MdEdit, MdSearch, MdVisibility, MdWarning } from '../icons';
import { App, Input, Select, Textarea } from '@/shared/ui';
import {
  PageTitle,
  Tabs,
  Tab,
  FilterBar,
  Btn,
  FormGroup,
  Label,
  HelperText,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import TruncCell from '../components/common/TruncCell';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { useResidencyCapabilities } from '../lib/capabilities';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  useNotices,
  useCreateNotice,
  useUpdateNotice,
  useDeleteNotice,
  useViewNotice,
  useReviewNotice,
  useProblemStudents,
  useCreateProblemStudent,
  useUpdateProblemStudent,
  useDeleteProblemStudent,
} from '../api/notice-api';
import type { ProblemStudentInput } from '../api/notice-api';
import { useAbsenceStreak, downloadNoticePdf } from '../api/notice-api';
import { useMyResidents } from '../api/residency-api';
import {
  NOTICE_STATUS_LABEL,
  NOTICE_STATUS_VARIANT,
  PROGRAM_LABEL,
  isNoticeReadonly,
} from '../api/notice-types';
import AutoNoticeBadges from '../components/AutoNoticeBadges';
import type { Notice, ProblemStudent } from '../api/notice-types';
import type { WritableNoticeKind } from '../api/notice-types';
import type { Program } from '../api/types';
import { useSpecialties, useDepartments, useGroups } from '../api/residency-api';

type TabKey = Program | 'muammoli';


const PROGRAM_BADGE: Record<Program, string> = {
  magistratura: 'info',
  ordinatura: "ta'tilda",
};

const fmtDate = (d: string | null): string => (d ? d.slice(0, 10) : '—');

interface NoticeForm {
  program: Program;
  academicYear: string;
  title: string;
  content: string;
  residentId: string;
  kind: WritableNoticeKind;
}
const EMPTY_NOTICE: NoticeForm = {
  program: 'magistratura',
  academicYear: '',
  title: '',
  content: '',
  residentId: '',
  kind: 'oddiy',
};

interface PsForm {
  academicYear: string;
  department: string;
  program: Program;
  specialty: string;
  fullName: string;
  courseNumber: string;
  group: string;
  content: string;
  conclusion: string;
}
const EMPTY_PS: PsForm = {
  academicYear: '',
  department: '',
  program: 'magistratura',
  specialty: '',
  fullName: '',
  courseNumber: '',
  group: '',
  content: '',
  conclusion: '',
};

const EmptyCell = styled(Td)`
  text-align: center;
  padding: 32px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Dash = styled.span`
  color: ${({ theme }) => theme.colors.textLight};
`;

const RowActions = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 14px;
  margin-bottom: 14px;
`;

const InfoLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 3px;
`;

const InfoValue = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.5;
`;

const InfoWide = styled.div`
  grid-column: 1 / -1;
`;

const MatnBox = styled.div`
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 12px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.6;
  margin-bottom: 14px;
  white-space: pre-wrap;
`;

const WarnBox = styled.div<{ $danger?: boolean }>`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 16px;
  background: ${({ theme, $danger }) =>
    $danger ? theme.colors.dangerLight : theme.colors.warningLight};
  border: 1px solid
    ${({ theme, $danger }) => ($danger ? theme.colors.dangerBorder : theme.colors.warningBorder)};
  color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.warning)};
`;

const WarnText = styled.p`
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
`;

const Spacer = styled.div`
  margin-left: auto;
`;

export default function Bildirgilar() {
  const { message } = App.useApp();

  const { data: courses = [] } = useCourses();

  const { data: academicYears = [] } = useAcademicYears();

  const { user, isLoading: authLoading } = useAuth();
  const {
    canDecideNotice: canWrite,
    canSendNotice,
    isMentor,
  } = useResidencyCapabilities();
  const can = usePermission();

  const [tab, setTab] = useState<TabKey>('magistratura');
  const [academicYear, setAcademicYear] = useState('');

  const activeTab: TabKey = tab === 'muammoli' && !canWrite ? 'magistratura' : tab;
  const noticeProgram: Program = activeTab === 'muammoli' ? 'magistratura' : activeTab;

  const { data: notices = [], isLoading: noticesLoading } = useNotices({
    program: noticeProgram,
    academicYear: academicYear || undefined,
  });
  const viewM = useViewNotice();
  const reviewM = useReviewNotice();
  const createNoticeM = useCreateNotice();

  const updateNoticeM = useUpdateNotice();
  const deleteNoticeM = useDeleteNotice();

  const [noticeModal, setNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [noticeForm, setNoticeForm] = useState<NoticeForm>(EMPTY_NOTICE);

  const { data: myResidents = [] } = useMyResidents({}, isMentor && noticeModal);
  const streakQ = useAbsenceStreak(noticeForm.residentId || null);
  const streak = streakQ.data;
  const [noticeToDelete, setNoticeToDelete] = useState<Notice | null>(null);

  const [viewing, setViewing] = useState<Notice | null>(null);
  const [decision, setDecision] = useState('');
  const [confirmReview, setConfirmReview] = useState(false);

  const openAddNotice = () => {
    setEditingNotice(null);
    setNoticeForm({ ...EMPTY_NOTICE, program: noticeProgram, academicYear });
    setNoticeModal(true);
  };

  const openEditNotice = (n: Notice) => {
    setEditingNotice(n);
    setNoticeForm({
      program: n.program,
      academicYear: academicYearValue(n),
      title: n.title,
      content: n.content,
      residentId: n.residentId ?? '',
      kind: n.kind === 'davomat' ? 'davomat' : 'oddiy',
    });
    setNoticeModal(true);
  };

  const noticeReady = !!noticeForm.title.trim() && !!noticeForm.content.trim();

  const saveNotice = async () => {
    if (!noticeForm.title.trim()) {
      message.warning('Sarlavhani kiriting');
      return;
    }
    if (!noticeForm.content.trim()) {
      message.warning('Bildirgi matnini kiriting');
      return;
    }
    try {
      if (editingNotice) {
        await updateNoticeM.mutateAsync({
          id: editingNotice.id,
          data: {
            title: noticeForm.title.trim(),
            content: noticeForm.content.trim(),
            academicYear: noticeForm.academicYear || null,
          },
        });
      } else {
        await createNoticeM.mutateAsync({
          program: noticeForm.program,
          title: noticeForm.title.trim(),
          content: noticeForm.content.trim(),
          academicYear: noticeForm.academicYear || null,
          ...(noticeForm.kind === 'davomat'
            ? { kind: 'davomat' as const, resident: noticeForm.residentId }
            : {}),
        });
      }
      message.success(editingNotice ? 'Yangilandi' : 'Bildirgi yuborildi');
      setNoticeModal(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const confirmDeleteNotice = async () => {
    if (!noticeToDelete) return;
    try {
      await deleteNoticeM.mutateAsync(noticeToDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setNoticeToDelete(null);
  };

  const openView = (n: Notice) => {
    setViewing(n);
    setDecision(n.decision ?? '');
    setConfirmReview(false);
  };

  const closeView = () => {
    const current = viewing;
    const typed = decision.trim();
    setViewing(null);
    setDecision('');
    setConfirmReview(false);
    if (current && current.status === 'yangi' && !typed) {
      viewM.mutate(current.id);
    }
  };

  const saveDecision = async () => {
    if (!viewing || !decision.trim()) return;
    try {
      await reviewM.mutateAsync({ id: viewing.id, decision: decision.trim() });
      message.success('Qaror saqlandi');
      setConfirmReview(false);
      setViewing(null);
      setDecision('');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Qarorni saqlashda xatolik'));
    }
  };

  const { data: problemStudents = [], isLoading: psLoading } = useProblemStudents(
    {},
    canWrite && !authLoading,
  );
  const createPsM = useCreateProblemStudent();
  const updatePsM = useUpdateProblemStudent();
  const deletePsM = useDeleteProblemStudent();

  const [psModal, setPsModal] = useState(false);
  const [editingPs, setEditingPs] = useState<ProblemStudent | null>(null);
  const [psForm, setPsForm] = useState<PsForm>(EMPTY_PS);
  const [psToDelete, setPsToDelete] = useState<ProblemStudent | null>(null);

  const refsEnabled = canWrite && !authLoading;
  const { data: departments = [] } = useDepartments(refsEnabled);
  const { data: groups = [] } = useGroups(refsEnabled);
  const { data: specialties = [] } = useSpecialties(psForm.program, refsEnabled);

  const openAddPs = () => {
    setEditingPs(null);
    setPsForm(EMPTY_PS);
    setPsModal(true);
  };

  const openEditPs = (p: ProblemStudent) => {
    setEditingPs(p);
    setPsForm({
      academicYear: academicYearValue(p),
      department: p.departmentId ?? '',
      program: p.program,
      specialty: p.specialtyId ?? '',
      fullName: p.fullName,
      courseNumber: p.courseNumber ? String(p.courseNumber) : '',
      group: p.groupId ?? '',
      content: p.content,
      conclusion: p.conclusion ?? '',
    });
    setPsModal(true);
  };

  const savePs = async () => {
    if (!psForm.fullName.trim()) {
      message.warning('Talabaning F.I.Sh ni kiriting');
      return;
    }
    if (!psForm.content.trim()) {
      message.warning('Bildirgi mazmunini kiriting');
      return;
    }
    const payload: ProblemStudentInput = {
      academicYear: psForm.academicYear || null,
      department: psForm.department || null,
      departmentTitle: departments.find((d) => d.id === psForm.department)?.title ?? null,
      program: psForm.program,
      specialty: psForm.specialty || null,
      specialtyTitle: specialties.find((s) => s.id === psForm.specialty)?.title ?? null,
      fullName: psForm.fullName.trim(),
      courseNumber: psForm.courseNumber ? Number(psForm.courseNumber) : null,
      group: psForm.group || null,
      groupTitle: groups.find((g) => g.id === psForm.group)?.title ?? null,
      content: psForm.content.trim(),
      conclusion: psForm.conclusion.trim() || null,
    };
    try {
      if (editingPs) await updatePsM.mutateAsync({ id: editingPs.id, data: payload });
      else await createPsM.mutateAsync(payload);
      message.success(editingPs ? 'Yangilandi' : 'Qo‘shildi');
      setPsModal(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const confirmDeletePs = async () => {
    if (!psToDelete) return;
    try {
      await deletePsM.mutateAsync(psToDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setPsToDelete(null);
  };

  return (
    <div>
      <PageTitle>Bildirgilar</PageTitle>

      <Tabs>
        <Tab $active={activeTab === 'magistratura'} onClick={() => setTab('magistratura')}>
          Magistratura
        </Tab>
        <Tab $active={activeTab === 'ordinatura'} onClick={() => setTab('ordinatura')}>
          Ordinatura
        </Tab>
        {canWrite && (
          <Tab $active={activeTab === 'muammoli'} onClick={() => setTab('muammoli')}>
            Muammoli talabalar
          </Tab>
        )}
      </Tabs>

      {activeTab !== 'muammoli' && (
        <>
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
            {canSendNotice && (
              <Spacer>
                <Btn $variant="primary" onClick={openAddNotice}>
                  <MdAdd /> Yangi bildirgi
                </Btn>
              </Spacer>
            )}
          </FilterBar>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th style={{ width: 190 }}>Yuboruvchi</Th>
                  <Th>Sarlavha</Th>
                  <Th>Matn</Th>
                  <Th style={{ width: 110 }}>Sana</Th>
                  <Th style={{ width: 130 }}>Holati</Th>
                  <Th>Qaror</Th>
                  <Th style={{ width: 160 }}>Amallar</Th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n, i) => {
                  const isMine = !!n.senderId && n.senderId === user.id;
                  const writableOwn = isMine && n.status === 'yangi' && !isNoticeReadonly(n);
                  const canEditOwn = writableOwn && can('residencyNotice:update');
                  const canDeleteOwn = writableOwn && can('residencyNotice:delete');
                  const showEye = n.status === 'yangi' || (!canWrite && !!n.decision);
                  const showReview = canWrite && n.status === 'kutilmoqda';
                  return (
                    <Tr key={n.id}>
                      <Td>{i + 1}</Td>
                      <Td>
                        {n.senderName || <Dash>—</Dash>}
                        <AutoNoticeBadges notice={n} />
                      </Td>
                      <Td>
                        <TruncCell text={n.title} />
                      </Td>
                      <Td>
                        <TruncCell text={n.content} />
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(n.createdAt)}</Td>
                      <Td>
                        <Badge variant={NOTICE_STATUS_VARIANT[n.status]}>
                          {NOTICE_STATUS_LABEL[n.status]}
                        </Badge>
                      </Td>
                      <Td>
                        <TruncCell text={n.decision ?? ''} blue />
                      </Td>
                      <Td>
                        <RowActions>
                          {showEye && (
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              onClick={() => openView(n)}
                              title="Ko‘rish"
                            >
                              <MdVisibility />
                            </Btn>
                          )}
                          {showReview && (
                            <Btn $variant="outline" $size="sm" onClick={() => openView(n)}>
                              <MdCheck /> Ko‘rib chiqish
                            </Btn>
                          )}
                          {canEditOwn && (
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              onClick={() => openEditNotice(n)}
                              title="Tahrirlash"
                            >
                              <MdEdit />
                            </Btn>
                          )}
                          {canDeleteOwn && (
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              onClick={() => setNoticeToDelete(n)}
                              title="O‘chirish"
                            >
                              <MdDelete />
                            </Btn>
                          )}
                          {!showEye && !showReview && !canEditOwn && !canDeleteOwn && (
                            <Dash>—</Dash>
                          )}
                        </RowActions>
                      </Td>
                    </Tr>
                  );
                })}
                {!noticesLoading && notices.length === 0 && (
                  <Tr>
                    <EmptyCell colSpan={8}>
                      <MdSearch /> Ma’lumot topilmadi
                    </EmptyCell>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}

      {activeTab === 'muammoli' && (
        <>
          <FilterBar>
            <Spacer>
              <Btn $variant="primary" onClick={openAddPs}>
                <MdAdd /> Qo‘shish
              </Btn>
            </Spacer>
          </FilterBar>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th>F.I.Sh</Th>
                  <Th style={{ width: 140 }}>Ta’lim yo‘nalishi</Th>
                  <Th style={{ width: 170 }}>Mutaxassislik</Th>
                  <Th style={{ width: 80 }}>Kurs</Th>
                  <Th style={{ width: 110 }}>Guruh</Th>
                  <Th style={{ width: 110 }}>Sana</Th>
                  <Th>Bildirgi mazmuni</Th>
                  <Th>Xulosa</Th>
                  <Th style={{ width: 110 }}>Amallar</Th>
                </tr>
              </thead>
              <tbody>
                {problemStudents.map((p, i) => (
                  <Tr key={p.id}>
                    <Td>{i + 1}</Td>
                    <Td style={{ fontWeight: 500 }}>{p.fullName}</Td>
                    <Td>
                      <Badge variant={PROGRAM_BADGE[p.program]}>{PROGRAM_LABEL[p.program]}</Badge>
                    </Td>
                    <Td>{p.specialtyTitle || <Dash>—</Dash>}</Td>
                    <Td>{p.courseNumber ? `${p.courseNumber}-kurs` : <Dash>—</Dash>}</Td>
                    <Td>{p.groupTitle || <Dash>—</Dash>}</Td>
                    <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.date)}</Td>
                    <Td>
                      <TruncCell text={p.content} />
                    </Td>
                    <Td>
                      <TruncCell text={p.conclusion ?? ''} blue />
                    </Td>
                    <Td>
                      <RowActions>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          onClick={() => openEditPs(p)}
                          title="Tahrirlash"
                        >
                          <MdEdit />
                        </Btn>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          onClick={() => setPsToDelete(p)}
                          title="O‘chirish"
                        >
                          <MdDelete />
                        </Btn>
                      </RowActions>
                    </Td>
                  </Tr>
                ))}
                {!psLoading && problemStudents.length === 0 && (
                  <Tr>
                    <EmptyCell colSpan={10}>
                      <MdSearch /> Ma’lumot topilmadi
                    </EmptyCell>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}

      <Modal
        open={!!viewing}
        onClose={closeView}
        title="Bildirgini ko‘rish"
        width="520px"
      >
        {viewing && (
          <>
            <ModalBody>
              <InfoGrid>
                <div>
                  <InfoLabel>Yuboruvchi</InfoLabel>
                  <InfoValue>{viewing.senderName || '—'}</InfoValue>
                </div>
                <div>
                  <InfoLabel>Sana</InfoLabel>
                  <InfoValue>{fmtDate(viewing.createdAt)}</InfoValue>
                </div>
                <InfoWide>
                  <InfoLabel>Sarlavha</InfoLabel>
                  <InfoValue>{viewing.title}</InfoValue>
                </InfoWide>
              </InfoGrid>

              {viewing.absence && (
                <InfoGrid style={{ marginBottom: 12 }}>
                  {viewing.absence.windowDays != null ? (
                    <>
                      <div>
                        <InfoLabel>Sababsiz qoldirgan</InfoLabel>
                        <InfoValue>
                          {`${viewing.absence.days} kun (oxirgi ${viewing.absence.windowDays} kunda)`}
                        </InfoValue>
                      </div>
                      <div>
                        <InfoLabel>Tekshirilgan davr</InfoLabel>
                        <InfoValue>
                          {fmtDate(viewing.absence.windowFrom)} —{' '}
                          {fmtDate(viewing.absence.windowTo)}
                        </InfoValue>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <InfoLabel>Ketma-ket qoldirgan</InfoLabel>
                        <InfoValue>{viewing.absence.days} kun</InfoValue>
                      </div>
                      <div>
                        <InfoLabel>Davri</InfoLabel>
                        <InfoValue>
                          {fmtDate(viewing.absence.from)} — {fmtDate(viewing.absence.to)}
                        </InfoValue>
                      </div>
                    </>
                  )}
                </InfoGrid>
              )}

              <MatnBox>{viewing.content}</MatnBox>

              {viewing.document && (
                <Btn
                  $variant="ghost"
                  style={{ marginBottom: 12 }}
                  onClick={() => {
                    const d = viewing.document;
                    if (!d) return;
                    downloadNoticePdf(viewing.id, d.fileName).catch((e) =>
                      message.error(getApiErrorMessage(e, 'Hujjatni yuklab bo\u2018lmadi')),
                    );
                  }}
                >
                  Hujjatni yuklab olish (PDF)
                </Btn>
              )}

              <FormGroup style={{ marginBottom: 0 }}>
                <Label>Qaror</Label>
                {canWrite ? (
                  <Textarea
                    rows={4}
                    value={decision}
                    onChange={(v) => setDecision(v)}
                    placeholder="Bildirgi bo‘yicha qaror matnini kiriting..."
                  />
                ) : (
                  <Textarea
                    rows={4}
                    readOnly
                    variant="filled"
                    value={viewing.decision ?? ''}
                    placeholder="Qaror hali kiritilmagan"
                    style={{ cursor: 'default' }}
                  />
                )}
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <Btn $variant="ghost" onClick={closeView}>
                Yopish
              </Btn>
              {canWrite && (
                <Btn
                  $variant="primary"
                  onClick={() => setConfirmReview(true)}
                  disabled={!decision.trim()}
                >
                  Tasdiqlash
                </Btn>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>

      <Modal
        open={confirmReview}
        onClose={() => setConfirmReview(false)}
        title="Qarorni tasdiqlash"
        width="460px"
      >
        <ModalBody>
          <WarnBox>
            <MdWarning size={22} />
            <WarnText>
              Qarorni qayta tahrirlash imkoniyati mavjud emas. Tasdiqlashdan oldin uning
              to‘g‘riligiga ishonch hosil qiling.
            </WarnText>
          </WarnBox>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setConfirmReview(false)}>
            Orqaga
          </Btn>
          <Btn $variant="primary" onClick={saveDecision} disabled={reviewM.isPending}>
            Tasdiqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={noticeModal}
        onClose={() => setNoticeModal(false)}
        title={editingNotice ? 'Bildirgini tahrirlash' : 'Yangi bildirgi'}
        width="520px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Yo‘nalish</Label>
            <Radio.Group
              name="notice-program"
              value={noticeForm.program}
              disabled={!!editingNotice}
              onChange={(e) =>
                setNoticeForm((f) => ({ ...f, program: e.target.value as Program }))
              }
            >
              <Radio value="magistratura">Magistratura</Radio>
              <Radio value="ordinatura">Klinik ordinatura</Radio>
            </Radio.Group>
          </FormGroup>

          {isMentor && !editingNotice && (
            <FormGroup>
              <Label>Talaba (davomat bildirgisi uchun)</Label>
              <Select
                value={noticeForm.residentId}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) =>
                  setNoticeForm((f) => ({
                    ...f,
                    residentId: value,
                    kind: 'oddiy',
                  }))
                }
                options={[
                  { value: '', label: 'Tanlanmagan (oddiy bildirgi)' },
                  ...myResidents.map((r) => ({ value: r.id, label: r.fullName })),
                ]}
              />

              {noticeForm.residentId && streakQ.isLoading && (
                <HelperText>Davomat tekshirilmoqda…</HelperText>
              )}

              {noticeForm.residentId && streak && (
                <>
                  <HelperText>
                    {streak.windowDays != null ? (
                      <>
                        {`Oxirgi ${streak.windowDays} kunda (${fmtDate(streak.windowFrom)} — ${fmtDate(streak.windowTo)}) sababsiz qoldirgan: `}
                        <b>{streak.days} kun</b>
                        {streak.dayKeys.length > 0
                          ? ` — ${streak.dayKeys.map((d) => fmtDate(d)).join(', ')}`
                          : ''}
                      </>
                    ) : (
                      <>
                        Sababsiz qoldirgan: <b>{streak.days} kun</b>
                        {streak.from && streak.to
                          ? ` (${fmtDate(streak.from)} — ${fmtDate(streak.to)})`
                          : ''}
                      </>
                    )}
                    {streak.threshold != null ? ` · ostona: ${streak.threshold} kun` : ''}
                  </HelperText>

                  {streak.lastNotice && (
                    <WarnBox style={{ marginTop: 8 }}>
                      <MdWarning size={22} />
                      <WarnText>
                        {`Bu rezident uchun ${fmtDate(streak.lastNotice.createdAt)} da davomat bildirgisi yuborilgan (${fmtDate(streak.lastNotice.from)} — ${fmtDate(streak.lastNotice.to)}, ${streak.lastNotice.days} kun). Yana yuborish mumkin.`}
                      </WarnText>
                    </WarnBox>
                  )}

                  {streak.eligible ? (
                    <label style={{ display: 'block', marginTop: 6, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={noticeForm.kind === 'davomat'}
                        onChange={(e) =>
                          setNoticeForm((f) => ({
                            ...f,
                            kind: e.target.checked ? 'davomat' : 'oddiy',
                          }))
                        }
                        style={{ marginRight: 6 }}
                      />
                      Davomat bildirgisi sifatida yuborish (PDF hujjat ilova qilinadi)
                    </label>
                  ) : (
                    <HelperText>
                      {streak.windowDays != null && streak.threshold != null
                        ? `Davomat bildirgisi oxirgi ${streak.windowDays} kunda kamida ${streak.threshold} kun sababsiz qoldirilganda yuboriladi.`
                        : 'Davomat bildirgisi ostonaga yetganda yuboriladi.'}
                    </HelperText>
                  )}
                </>
              )}
            </FormGroup>
          )}
          <FormGroup>
            <Label>O‘quv yili</Label>
            <Select
              value={noticeForm.academicYear}
              style={{ width: '100%' }}
              onChange={(value) => setNoticeForm((f) => ({ ...f, academicYear: value }))}
              options={[
                { value: '', label: 'Tanlang' },
                ...withCurrent(academicYears, noticeForm.academicYear).map((y) => ({
                  value: y.id,
                  label: y.title,
                })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>Sarlavha *</Label>
            <Input
              value={noticeForm.title}
              style={{ width: '100%' }}
              onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Bildirgi sarlavhasini kiriting"
            />
          </FormGroup>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Matn *</Label>
            <Textarea
              rows={5}
              value={noticeForm.content}
              onChange={(v) => setNoticeForm((f) => ({ ...f, content: v }))}
              placeholder="Bildirgi matnini kiriting..."
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setNoticeModal(false)}>
            Bekor qilish
          </Btn>
          <Btn
            $variant="primary"
            onClick={saveNotice}
            disabled={createNoticeM.isPending || updateNoticeM.isPending || !noticeReady}
            title={noticeReady ? undefined : 'Sarlavha va matnni to‘ldiring'}
          >
            {editingNotice ? 'Saqlash' : 'Yuborish'}
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!noticeToDelete}
        onClose={() => setNoticeToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="440px"
      >
        <ModalBody>
          <WarnBox $danger>
            <MdWarning size={22} />
            <WarnText>
              <b>{noticeToDelete?.title}</b> bildirgisi o‘chiriladi. Bu amalni bekor qilib
              bo‘lmaydi.
            </WarnText>
          </WarnBox>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setNoticeToDelete(null)}>
            Bekor qilish
          </Btn>
          <Btn $variant="danger" onClick={confirmDeleteNotice} disabled={deleteNoticeM.isPending}>
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={psModal}
        onClose={() => setPsModal(false)}
        title={editingPs ? 'Muammoli talabani tahrirlash' : 'Muammoli talaba qo‘shish'}
        width="580px"
      >
        <ModalBody>
          <Grid2>
            <FormGroup>
              <Label>O‘quv yili</Label>
              <Select
                value={psForm.academicYear}
                style={{ width: '100%' }}
                onChange={(value) => setPsForm((f) => ({ ...f, academicYear: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...withCurrent(academicYears, psForm.academicYear).map((y) => ({
                    value: y.id,
                    label: y.title,
                  })),
                ]}
              />
            </FormGroup>
            <FormGroup>
              <Label>Kafedra</Label>
              <Select
                value={psForm.department}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => setPsForm((f) => ({ ...f, department: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...departments.map((d) => ({ value: d.id, label: d.title })),
                ]}
              />
            </FormGroup>
          </Grid2>

          <FormGroup>
            <Label>Ta’lim yo‘nalishi</Label>
            <Radio.Group
              name="ps-program"
              value={psForm.program}
              onChange={(e) =>
                setPsForm((f) => ({ ...f, program: e.target.value as Program, specialty: '' }))
              }
            >
              <Radio value="magistratura">Magistratura</Radio>
              <Radio value="ordinatura">Klinik ordinatura</Radio>
            </Radio.Group>
          </FormGroup>

          <Grid2>
            <FormGroup>
              <Label>Mutaxassislik</Label>
              <Select
                value={psForm.specialty}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => setPsForm((f) => ({ ...f, specialty: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...specialties.map((s) => ({ value: s.id, label: s.title })),
                ]}
              />
            </FormGroup>
            <FormGroup>
              <Label>F.I.Sh *</Label>
              <Input
                value={psForm.fullName}
                style={{ width: '100%' }}
                onChange={(e) => setPsForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Talabaning to‘liq ismi"
              />
            </FormGroup>
          </Grid2>

          <Grid2>
            <FormGroup>
              <Label>Kurs</Label>
              <Select
                value={psForm.courseNumber}
                style={{ width: '100%' }}
                onChange={(value) => setPsForm((f) => ({ ...f, courseNumber: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...courses.map((c) => ({ value: String(c.number), label: c.title })),
                ]}
              />
            </FormGroup>
            <FormGroup>
              <Label>Guruh</Label>
              <Select
                value={psForm.group}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => setPsForm((f) => ({ ...f, group: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...groups.map((g) => ({ value: g.id, label: g.title })),
                ]}
              />
            </FormGroup>
          </Grid2>

          <FormGroup>
            <Label>Bildirgi mazmuni *</Label>
            <Textarea
              rows={4}
              value={psForm.content}
              onChange={(v) => setPsForm((f) => ({ ...f, content: v }))}
              placeholder="Muammoli holat tavsifi..."
            />
          </FormGroup>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Xulosa</Label>
            <Textarea
              rows={3}
              value={psForm.conclusion}
              onChange={(v) => setPsForm((f) => ({ ...f, conclusion: v }))}
              placeholder="Ko‘rilgan choralar va xulosalar..."
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setPsModal(false)}>
            Bekor qilish
          </Btn>
          <Btn
            $variant="primary"
            onClick={savePs}
            disabled={createPsM.isPending || updatePsM.isPending}
          >
            Saqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!psToDelete}
        onClose={() => setPsToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="440px"
      >
        <ModalBody>
          <WarnBox $danger>
            <MdWarning size={22} />
            <WarnText>
              <b>{psToDelete?.fullName}</b> haqidagi yozuv o‘chiriladi. Bu amalni bekor qilib
              bo‘lmaydi.
            </WarnText>
          </WarnBox>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setPsToDelete(null)}>
            Bekor qilish
          </Btn>
          <Btn $variant="danger" onClick={confirmDeletePs} disabled={deletePsM.isPending}>
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>
    </div>
  );
}
