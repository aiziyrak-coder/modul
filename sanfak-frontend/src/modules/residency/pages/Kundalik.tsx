import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdVisibility, MdCheck, MdClose, MdEdit } from '../icons';
import { App, DatePicker, Select, Textarea } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useAcademicYears, useCourses, academicYearWindow } from '../api/reference-api';
import {
  PageTitle,
  FilterBar,
  Btn,
  Tabs,
  Tab,
  FormGroup,
  Label,
  StatCards,
  HelperText,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import StatCard from '../components/common/StatCard';
import TruncCell from '../components/common/TruncCell';
import { skillLabel, skillsText } from '../lib/skills';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { NumberField } from '../components/common/NumberField';
import { useSkills } from '../api/skill-api';
import { SEMESTERS } from '../api/skill-types';
import { useResidencyCapabilities } from '../lib/capabilities';
import {
  useDailyLogs,
  useDailyLogStats,
  useCreateDailyLog,
  useUpdateDailyLog,
  useApproveDailyLog,
  useReturnDailyLog,
  useMyResident,
  useGroups,
} from '../api/residency-api';
import type { DailyLog, DailyLogStatus, SkillEntry } from '../api/types';

const STATUS_LABEL: Record<DailyLogStatus, string> = {
  kutilmoqda: 'Kutilmoqda',
  tasdiqlangan: 'Tasdiqlangan',
  qaytarilgan: 'Qaytarilgan',
};
const PAGE_LIMIT = 100;

const WORK_TYPES = ['Amaliy ko‘nikma', 'Klinik ish', 'Muolaja', 'Jarrohlik ko‘nikmasi'];

const fmtDate = (d: string | null) => (d ? d.slice(0, 10) : '—');

export default function Kundalik() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { isStudent, canApproveDailyLog: isMentor } = useResidencyCapabilities();

  const [status, setStatus] = useState('');
  const [workType, setWorkType] = useState('');
  const [tab, setTab] = useState<'songi' | 'barchasi'>('songi');
  const [fYear, setFYear] = useState('');
  const [fKurs, setFKurs] = useState('');
  const [fGuruh, setFGuruh] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DailyLog | null>(null);
  const [approveTarget, setApproveTarget] = useState<DailyLog | null>(null);
  const [returnTarget, setReturnTarget] = useState<DailyLog | null>(null);

  const { data: stats } = useDailyLogStats();
  const { data: paged } = useDailyLogs({ status: status || undefined, limit: PAGE_LIMIT });

  const { data: academicYears = [] } = useAcademicYears();
  const { data: courses = [] } = useCourses();
  const { data: groups = [] } = useGroups();
  const yearWindow = useMemo(() => academicYearWindow(fYear), [fYear]);
  const groupTitleById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.title])),
    [groups],
  );
  const { data: myResident } = useMyResident();
  const createM = useCreateDailyLog();
  const updateM = useUpdateDailyLog();
  const approveM = useApproveDailyLog();
  const returnM = useReturnDailyLog();

  const rows = useMemo(() => paged?.items ?? [], [paged]);

  const truncated = (paged?.total ?? 0) > rows.length;

  const clientFilterActive = !!(workType || fYear || fKurs || fGuruh);

  const studentRows = useMemo(
    () => rows.filter((r) => !workType || r.workType === workType),
    [rows, workType],
  );

  const latestDate = useMemo(
    () => rows.reduce((max, r) => (fmtDate(r.date) > max ? fmtDate(r.date) : max), ''),
    [rows],
  );
  const mentorRows = useMemo(
    () =>
      rows.filter((r) => {
        const res = r.resident;
        if (tab === 'songi' && latestDate && fmtDate(r.date) !== latestDate) return false;
        if (yearWindow) {
          const d = fmtDate(r.date);
          if (d < yearWindow.from || d > yearWindow.to) return false;
        }
        if (fKurs && String(res?.courseNumber ?? '') !== fKurs) return false;
        if (fGuruh) {
          const byId = !!res?.groupId && res.groupId === fGuruh;
          const byTitle = !res?.groupId && res?.groupTitle === groupTitleById.get(fGuruh);
          if (!byId && !byTitle) return false;
        }
        return true;
      }),
    [rows, tab, latestDate, yearWindow, fKurs, fGuruh, groupTitleById],
  );

  const submitForm = async (p: {
    date: string;
    workType: string;
    clinicalWork: string;
    skills: SkillEntry[];
  }) => {
    const data: Partial<DailyLog> = { date: p.date, clinicalWork: p.clinicalWork, skills: p.skills };
    if (p.workType) data.workType = p.workType;
    if (!editing && myResident?.id) data.residentId = myResident.id;
    try {
      if (editing) await updateM.mutateAsync({ id: editing.id, data });
      else await createM.mutateAsync(data);
      message.success(editing ? 'Yozuv yangilandi' : 'Yozuv yuborildi');
      setFormOpen(false);
      setEditing(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const doApprove = async (comment: string) => {
    if (!approveTarget) return;
    try {
      await approveM.mutateAsync({ id: approveTarget.id, comment: comment || undefined });
      message.success('Yozuv tasdiqlandi');
      setApproveTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };
  const doReturn = async (reason: string) => {
    if (!returnTarget) return;
    try {
      await returnM.mutateAsync({ id: returnTarget.id, reason });
      message.success('Yozuv qaytarildi');
      setReturnTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  return (
    <div>
      <PageTitle>Elektron kundalik</PageTitle>

      <StatCards>
        <StatCard icon="📔" iconBg="#EBF5FB" number={stats?.total ?? 0} label="Jami yozuvlar" />
        <StatCard icon="✅" iconBg="#EAFAF1" number={stats?.tasdiqlangan ?? 0} label="Tasdiqlangan" />
        <StatCard icon="⏳" iconBg="#FEF9E7" number={stats?.kutilmoqda ?? 0} label="Kutilmoqda" />
        <StatCard icon="↩️" iconBg="#FDEDEC" number={stats?.qaytarilgan ?? 0} label="Qaytarilgan" />
      </StatCards>

      {truncated && (
        <HelperText $error>
          Faqat oxirgi {rows.length} ta yozuv ko‘rsatilmoqda (jami{' '}
          {paged?.total ?? 0} ta).{' '}
          {clientFilterActive
            ? 'O‘quv yili · kurs · guruh · ish turi filtrlari FAQAT shu yuklangan yozuvlar ustidan ishlaydi — undan eskiroq mos yozuv ro‘yxatga tushmaydi. Avval holat filtri bilan ro‘yxatni toraytiring.'
            : 'Ro‘yxatni toraytirish uchun holat filtridan foydalaning.'}
        </HelperText>
      )}

      {isStudent && (
        <>
          <FilterBar>
            <Select
              value={status}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => setStatus(value)}
              options={[
                { value: '', label: 'Holat — barchasi' },
                ...(Object.keys(STATUS_LABEL) as DailyLogStatus[]).map((s) => ({
                  value: String(s),
                  label: STATUS_LABEL[s],
                })),
              ]}
            />
            <Select
              value={workType}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => setWorkType(value)}
              options={[
                { value: '', label: 'Ish turi — barchasi' },
                ...WORK_TYPES.map((w) => ({ value: w, label: w })),
              ]}
            />
            <div style={{ marginLeft: 'auto' }}>
              <Btn
                $variant="primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <MdAdd /> Yozuv qo‘shish
              </Btn>
            </div>
          </FilterBar>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th>Sana</Th>
                  <Th>Ish turi</Th>
                  <Th>Ko‘nikmalar</Th>
                  <Th>Holat</Th>
                  <Th>Tavsif</Th>
                  <Th>Ustoz izohi</Th>
                  <Th style={{ width: 90 }}>Amallar</Th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((r, i) => (
                  <Tr key={r.id}>
                    <Td>{i + 1}</Td>
                    <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</Td>
                    <Td style={{ fontWeight: 500 }}>{r.workType || '—'}</Td>
                    <Td>
                      <TruncCell text={skillsText(r.skills)} />
                    </Td>
                    <Td>
                      <Badge variant={r.status}>{STATUS_LABEL[r.status]}</Badge>
                    </Td>
                    <Td>
                      <TruncCell text={r.clinicalWork ?? ''} />
                    </Td>
                    <Td>
                      <TruncCell text={r.supervisorComment ?? ''} blue />
                    </Td>
                    <Td>

                      {r.status !== 'tasdiqlangan' ? (
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="Tahrirlash"
                          onClick={() => {
                            setEditing(r);
                            setFormOpen(true);
                          }}
                        >
                          <MdEdit />
                        </Btn>
                      ) : (
                        <span style={{ color: '#CBD5E1', fontSize: 13 }}>—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
                {studentRows.length === 0 && (
                  <Tr>
                    <Td colSpan={8} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                      Yozuv topilmadi
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}

      {isMentor && (
        <>
          <Tabs>
            <Tab $active={tab === 'songi'} onClick={() => setTab('songi')}>
              So‘nggi yozuvlar
            </Tab>
            <Tab $active={tab === 'barchasi'} onClick={() => setTab('barchasi')}>
              Barchasi
            </Tab>
          </Tabs>

          <FilterBar>
            <Select
              value={fYear}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => setFYear(value)}
              options={[
                { value: '', label: 'Barcha o‘quv yili' },
                ...academicYears.map((y) => ({ value: y.title, label: y.title })),
              ]}
            />
            <Select
              value={fKurs}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => setFKurs(value)}
              options={[
                { value: '', label: 'Barcha kurs' },
                ...courses.map((c) => ({ value: String(c.number), label: c.title })),
              ]}
            />
            <Select
              value={fGuruh}
              showSearch
              optionFilterProp="label"
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => setFGuruh(value)}
              options={[
                { value: '', label: 'Barcha guruh' },
                ...groups.map((g) => ({ value: g.id, label: g.title })),
              ]}
            />
          </FilterBar>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th>Talaba</Th>
                  <Th>Sana</Th>
                  <Th>Ish turi</Th>
                  <Th>Ko‘nikmalar</Th>
                  <Th>Mutaxassislik</Th>
                  <Th>Kurs</Th>
                  <Th>Holat</Th>
                  <Th>Tavsif</Th>
                  <Th>Ustoz izohi</Th>
                  <Th style={{ width: 140 }}>Amallar</Th>
                </tr>
              </thead>
              <tbody>
                {mentorRows.map((r, i) => (
                  <Tr key={r.id}>
                    <Td>{i + 1}</Td>
                    <Td style={{ fontWeight: 500 }}>{r.resident?.fullName ?? '—'}</Td>
                    <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</Td>
                    <Td>{r.workType || '—'}</Td>
                    <Td>
                      <TruncCell text={skillsText(r.skills)} />
                    </Td>
                    <Td>{r.resident?.specialtyTitle ?? '—'}</Td>
                    <Td>{r.resident?.courseNumber ?? '—'}</Td>
                    <Td>
                      <Badge variant={r.status}>{STATUS_LABEL[r.status]}</Badge>
                    </Td>
                    <Td>
                      <TruncCell text={r.clinicalWork ?? ''} />
                    </Td>
                    <Td>
                      <TruncCell text={r.supervisorComment ?? ''} blue />
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="Ko‘rish"
                          onClick={() => navigate(`/residency/kundalik/${r.residentId}`)}
                        >
                          <MdVisibility />
                        </Btn>
                        {r.status === 'kutilmoqda' && (
                          <>
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              title="Tasdiqlash"
                              style={{ color: '#27AE60' }}
                              onClick={() => setApproveTarget(r)}
                            >
                              <MdCheck />
                            </Btn>
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              title="Qaytarish"
                              style={{ color: '#E74C3C' }}
                              onClick={() => setReturnTarget(r)}
                            >
                              <MdClose />
                            </Btn>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
                {mentorRows.length === 0 && (
                  <Tr>
                    <Td colSpan={11} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                      Yozuv topilmadi
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}

      {!isStudent && !isMentor && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: 48 }}>№</Th>
                <Th>Talaba</Th>
                <Th>Sana</Th>
                <Th>Ish turi</Th>
                <Th>Ko‘nikmalar</Th>
                <Th>Holat</Th>
                <Th>Tavsif</Th>
                <Th>Ustoz izohi</Th>
                <Th style={{ width: 90 }}>Batafsil</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Tr key={r.id}>
                  <Td>{i + 1}</Td>
                  <Td style={{ fontWeight: 500 }}>{r.resident?.fullName ?? '—'}</Td>
                  <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</Td>
                  <Td>{r.workType || '—'}</Td>
                  <Td>
                    <TruncCell text={skillsText(r.skills)} />
                  </Td>
                  <Td>
                    <Badge variant={r.status}>{STATUS_LABEL[r.status]}</Badge>
                  </Td>
                  <Td>
                    <TruncCell text={r.clinicalWork ?? ''} />
                  </Td>
                  <Td>
                    <TruncCell text={r.supervisorComment ?? ''} blue />
                  </Td>
                  <Td>
                    <Btn
                      $variant="ghost"
                      $size="sm"
                      title="Batafsil"
                      onClick={() => navigate(`/residency/kundalik/${r.residentId}`)}
                    >
                      <MdVisibility />
                    </Btn>
                  </Td>
                </Tr>
              ))}
              {rows.length === 0 && (
                <Tr>
                  <Td colSpan={9} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                    Yozuv topilmadi
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {isStudent && formOpen && (
        <LogFormModal
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={submitForm}
          pending={createM.isPending || updateM.isPending}
        />
      )}

      {isMentor && approveTarget && (
        <ApproveLogModal
          target={approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={doApprove}
          pending={approveM.isPending}
        />
      )}
      {isMentor && returnTarget && (
        <ReturnLogModal
          target={returnTarget}
          onClose={() => setReturnTarget(null)}
          onConfirm={doReturn}
          pending={returnM.isPending}
        />
      )}
    </div>
  );
}

function LogFormModal({
  editing,
  onClose,
  onSubmit,
  pending,
}: {
  editing: DailyLog | null;
  onClose: () => void;
  onSubmit: (p: { date: string; workType: string; clinicalWork: string; skills: SkillEntry[] }) => void;
  pending: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(editing?.date ? editing.date.slice(0, 10) : today);
  const [workType, setWorkType] = useState(editing?.workType ?? '');
  const [clinicalWork, setClinicalWork] = useState(editing?.clinicalWork ?? '');
  const [skills, setSkills] = useState<SkillEntry[]>(editing?.skills ?? []);
  const [semester, setSemester] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skillCount, setSkillCount] = useState('1');

  const { data: catalog = [] } = useSkills({ semester: semester || undefined, active: true });

  const skillCountNum = Number(skillCount);
  const skillCountValid =
    skillCount.trim() !== '' && Number.isInteger(skillCountNum) && skillCountNum >= 1;

  const addSkill = () => {
    const picked = catalog.find((c) => c.id === selectedSkillId);
    if (!picked || !skillCountValid) return;
    const count = skillCountNum;
    setSkills((prev) => [
      ...prev.filter((s) => s.skillId !== picked.id),
      { skillId: picked.id, skill: picked.practicalSkill, count },
    ]);
    setSelectedSkillId('');
    setSkillCount('1');
  };
  const removeSkill = (idx: number) => setSkills((prev) => prev.filter((_, i) => i !== idx));

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Kundalik yozuvini tahrirlash' : 'Kundalik yozuv qo‘shish'}
      width="560px"
    >
      <ModalBody>
        <FormGroup>
          <Label>Sana</Label>
          <DatePicker value={date || null} onChange={(v) => setDate(v ?? '')} />
        </FormGroup>
        <FormGroup>
          <Label>Ish turi</Label>
          <Select
            value={workType}
            style={{ width: '100%' }}
            onChange={(value) => setWorkType(value)}
            options={[
              { value: '', label: 'Tanlang' },
              ...WORK_TYPES.map((w) => ({ value: w, label: w })),
            ]}
          />
        </FormGroup>

        <FormGroup>
          <Label>
            Ko‘nikmalar <span style={{ fontWeight: 400, color: '#94A3B8' }}>(katalogdan)</span>
          </Label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Select
              value={semester}
              onChange={(value) => {
                setSemester(value);
                setSelectedSkillId('');
              }}
              style={{ width: 160 }}
              options={[
                { value: '', label: 'Barcha semestr' },
                ...SEMESTERS.map((s) => ({ value: String(s), label: s })),
              ]}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              value={selectedSkillId}
              showSearch
              optionFilterProp="label"
              style={{ flex: 1, minWidth: 0 }}
              popupMatchSelectWidth={false}
              onChange={(value) => setSelectedSkillId(value)}
              options={[
                { value: '', label: 'Ko‘nikmani tanlang' },
                ...catalog.map((c) => ({
                  value: c.id,
                  label: `${c.theoryTopicTitle ? `${c.theoryTopicTitle} — ` : ''}${c.practicalSkill} (${c.patientCount} ta)`,
                })),
              ]}
            />
            <NumberField
              min={1}
              aria-label="Ko‘nikma soni"
              style={{ width: 90, flexShrink: 0 }}
              value={skillCount === '' ? null : Number(skillCount)}
              onChange={(v) => setSkillCount(v === null ? '' : String(v))}
            />
            <Btn
              $variant="outline"
              onClick={addSkill}
              disabled={!selectedSkillId || !skillCountValid}
            >
              Qo‘shish
            </Btn>
          </div>
          {!skillCountValid && (
            <HelperText $error>Ko‘nikma soni butun son va kamida 1 bo‘lishi kerak</HelperText>
          )}
          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {skills.map((s, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    background: '#EAFAF1',
                    color: '#27AE60',
                    border: '1px solid #A9DFBF',
                  }}
                >
                  {skillLabel(s)}
                  <button
                    type="button"
                    onClick={() => removeSkill(i)}
                    aria-label="O‘chirish"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#27AE60',
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </FormGroup>

        <FormGroup>
          <Label>Batafsil tavsif *</Label>
          <Textarea
            rows={3}
            value={clinicalWork}
            onChange={(v) => setClinicalWork(v)}
            placeholder="Bajarilgan ishlarni batafsil yozing..."
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn
          $variant="primary"
          disabled={pending || !clinicalWork.trim()}
          onClick={() => onSubmit({ date, workType, clinicalWork: clinicalWork.trim(), skills })}
        >
          {editing ? 'Saqlash' : 'Yuborish'}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

function ApproveLogModal({
  target,
  onClose,
  onConfirm,
  pending,
}: {
  target: DailyLog;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  pending: boolean;
}) {
  const [comment, setComment] = useState('');
  return (
    <Modal open onClose={onClose} title="Yozuvni tasdiqlash" width="440px">
      <ModalBody>
        <div
          style={{
            fontSize: 13,
            marginBottom: 14,
            padding: '10px 12px',
            background: '#EAFAF1',
            border: '1px solid #A9DFBF',
            borderRadius: 8,
          }}
        >
          <b>{target.resident?.fullName ?? '—'}</b> — yozuvni tasdiqlayapsiz
        </div>
        <FormGroup>
          <Label>Izoh (ixtiyoriy)</Label>
          <Textarea
            rows={3}
            value={comment}
            onChange={(v) => setComment(v)}
            placeholder="Tasdiqlash bo‘yicha izoh..."
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn $variant="success" disabled={pending} onClick={() => onConfirm(comment.trim())}>
          <MdCheck /> Tasdiqlash
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

function ReturnLogModal({
  target,
  onClose,
  onConfirm,
  pending,
}: {
  target: DailyLog;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onClose} title="Yozuvni qaytarish" width="440px">
      <ModalBody>
        <div
          style={{
            fontSize: 13,
            marginBottom: 14,
            padding: '10px 12px',
            background: '#FDEDEC',
            border: '1px solid #F1948A',
            borderRadius: 8,
          }}
        >
          <b>{target.resident?.fullName ?? '—'}</b> — yozuvni qaytarayapsiz
        </div>
        <FormGroup>
          <Label>Qaytarish sababi *</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(v) => setReason(v)}
            placeholder="Nima sababdan qaytarilmoqda..."
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn $variant="danger" disabled={pending || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
          <MdClose /> Qaytarish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
