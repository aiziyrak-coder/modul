import { useState } from 'react';
import styled from 'styled-components';
import { useCourses, useAcademicYears, withCurrent } from '../api/reference-api';
import { activeWithCurrent } from '../api/reference-options';
import { MdAdd, MdEdit, MdDelete, MdSearch } from '../icons';
import { App, Input, Select, Switch } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  FilterBar,
  Btn,
  Tabs,
  Tab,
  FormGroup,
  Label,
  HelperText,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import Pager from '../components/common/Pager';
import TruncCell from '../components/common/TruncCell';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { NumberField } from '../components/common/NumberField';
import {
  useTheoryTopics,
  useCreateTheoryTopic,
  useUpdateTheoryTopic,
  useDeleteTheoryTopic,
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
  useSkillProgress,
} from '../api/skill-api';
import type { SkillInput } from '../api/skill-api';
import { SEMESTERS } from '../api/skill-types';
import type { Skill, TheoryTopic } from '../api/skill-types';
import { useSpecialties, useGroups } from '../api/residency-api';

const PAGE_SIZE = 10;

type TabKey = 'jarayon' | 'konikmalar' | 'nazariy';

interface SkillForm {
  specialty: string;
  semester: string;
  theoryTopic: string;
  practicalSkill: string;
  patientCount: string;
}
const EMPTY_SKILL: SkillForm = {
  specialty: '',
  semester: '',
  theoryTopic: '',
  practicalSkill: '',
  patientCount: '',
};

interface TopicForm {
  title: string;
  active: boolean;
}
const EMPTY_TOPIC: TopicForm = { title: '', active: true };

const ProgressCell = styled.span<{ $done: boolean }>`
  font-size: 13px;
  font-weight: ${({ $done }) => ($done ? 700 : 500)};
  color: ${({ $done, theme }) => ($done ? theme.colors.success : theme.colors.text)};
`;

const StatusToggle = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
`;

export default function Konikmalar() {
  const { message } = App.useApp();

  const { data: courses = [] } = useCourses();
  const { data: academicYears = [] } = useAcademicYears();

  const [tab, setTab] = useState<TabKey>('jarayon');

  const can = usePermission();
  const canCreateSkill = can('residencySkill:create');
  const canUpdateSkill = can('residencySkill:update');
  const canDeleteSkill = can('residencySkill:delete');
  const skillActions = canUpdateSkill || canDeleteSkill;
  const canCreateTopic = can('residencyTheoryTopic:create');
  const canUpdateTopic = can('residencyTheoryTopic:update');
  const canDeleteTopic = can('residencyTheoryTopic:delete');
  const topicActions = canUpdateTopic || canDeleteTopic;

  const { data: specialties = [] } = useSpecialties();
  const { data: groups = [] } = useGroups();

  const [pAcademicYear, setPAcademicYear] = useState('');
  const [pSpecialty, setPSpecialty] = useState('');
  const [pSemester, setPSemester] = useState('');
  const [pCourse, setPCourse] = useState('');
  const [pGroup, setPGroup] = useState('');
  const [pPage, setPPage] = useState(1);

  const { data: progress = [], isLoading: progressLoading } = useSkillProgress({
    academicYear: pAcademicYear.trim() || undefined,
    specialty: pSpecialty || undefined,
    semester: pSemester || undefined,
    courseNumber: pCourse || undefined,
    group: pGroup || undefined,
  });

  const progressPages = Math.max(1, Math.ceil(progress.length / PAGE_SIZE));
  const progressRows = progress.slice((pPage - 1) * PAGE_SIZE, pPage * PAGE_SIZE);

  const [sSpecialty, setSSpecialty] = useState('');
  const [sSemester, setSSemester] = useState('');
  const [skillModal, setSkillModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [skillForm, setSkillForm] = useState<SkillForm>(EMPTY_SKILL);
  const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null);

  const { data: skills = [], isLoading: skillsLoading } = useSkills({
    specialty: sSpecialty || undefined,
    semester: sSemester || undefined,
  });
  const createSkillM = useCreateSkill();
  const updateSkillM = useUpdateSkill();
  const deleteSkillM = useDeleteSkill();

  const [topicModal, setTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TheoryTopic | null>(null);
  const [topicForm, setTopicForm] = useState<TopicForm>(EMPTY_TOPIC);
  const [topicToDelete, setTopicToDelete] = useState<TheoryTopic | null>(null);

  const { data: topics = [], isLoading: topicsLoading } = useTheoryTopics();
  const createTopicM = useCreateTheoryTopic();
  const updateTopicM = useUpdateTheoryTopic();
  const deleteTopicM = useDeleteTheoryTopic();

  const specialtyOptions = activeWithCurrent(specialties, skillForm.specialty);
  const topicOptions = activeWithCurrent(topics, skillForm.theoryTopic);

  const openAddSkill = () => {
    setEditingSkill(null);
    setSkillForm(EMPTY_SKILL);
    setSkillModal(true);
  };
  const openEditSkill = (s: Skill) => {
    setEditingSkill(s);
    setSkillForm({
      specialty: s.specialtyId ?? '',
      semester: s.semester,
      theoryTopic: s.theoryTopicId ?? '',
      practicalSkill: s.practicalSkill,
      patientCount: String(s.patientCount),
    });
    setSkillModal(true);
  };

  const patientCountEmpty = skillForm.patientCount.trim() === '';
  const patientCountNum = Number(skillForm.patientCount);
  const patientCountValid =
    patientCountEmpty || (Number.isInteger(patientCountNum) && patientCountNum >= 1);

  const saveSkill = async () => {
    if (
      !skillForm.specialty ||
      !skillForm.semester ||
      !skillForm.theoryTopic ||
      !skillForm.practicalSkill.trim()
    ) {
      message.warning('Barcha majburiy maydonlarni to‘ldiring');
      return;
    }
    const payload: SkillInput = {
      specialty: skillForm.specialty,
      specialtyTitle: specialties.find((s) => s.id === skillForm.specialty)?.title ?? null,
      semester: skillForm.semester,
      theoryTopic: skillForm.theoryTopic,
      theoryTopicTitle: topics.find((t) => t.id === skillForm.theoryTopic)?.title ?? null,
      practicalSkill: skillForm.practicalSkill.trim(),
      ...(patientCountEmpty ? {} : { patientCount: patientCountNum }),
    };
    try {
      if (editingSkill) await updateSkillM.mutateAsync({ id: editingSkill.id, data: payload });
      else await createSkillM.mutateAsync(payload);
      message.success(editingSkill ? 'Yangilandi' : 'Qo‘shildi');
      setSkillModal(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const confirmDeleteSkill = async () => {
    if (!skillToDelete) return;
    try {
      await deleteSkillM.mutateAsync(skillToDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setSkillToDelete(null);
  };

  const openAddTopic = () => {
    setEditingTopic(null);
    setTopicForm(EMPTY_TOPIC);
    setTopicModal(true);
  };
  const openEditTopic = (t: TheoryTopic) => {
    setEditingTopic(t);
    setTopicForm({ title: t.title, active: t.active });
    setTopicModal(true);
  };

  const saveTopic = async () => {
    if (!topicForm.title.trim()) {
      message.warning('Nomini kiriting');
      return;
    }
    try {
      if (editingTopic) {
        await updateTopicM.mutateAsync({
          id: editingTopic.id,
          data: { title: topicForm.title.trim(), active: topicForm.active },
        });
      } else {
        await createTopicM.mutateAsync({ title: topicForm.title.trim(), active: topicForm.active });
      }
      message.success(editingTopic ? 'Yangilandi' : 'Qo‘shildi');
      setTopicModal(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const toggleTopic = async (t: TheoryTopic) => {
    try {
      await updateTopicM.mutateAsync({ id: t.id, data: { active: !t.active } });
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Statusni o‘zgartirishda xatolik'));
    }
  };

  const confirmDeleteTopic = async () => {
    if (!topicToDelete) return;
    try {
      await deleteTopicM.mutateAsync(topicToDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setTopicToDelete(null);
  };

  return (
    <div>
      <PageTitle>Ko‘nikmalar</PageTitle>

      <Tabs>
        <Tab $active={tab === 'jarayon'} onClick={() => setTab('jarayon')}>
          Bajarish jarayoni
        </Tab>
        <Tab $active={tab === 'konikmalar'} onClick={() => setTab('konikmalar')}>
          Ko‘nikmalar
        </Tab>
        <Tab $active={tab === 'nazariy'} onClick={() => setTab('nazariy')}>
          Nazariy va umumiy bilim
        </Tab>
      </Tabs>

      {tab === 'jarayon' && (
        <>
          <FilterBar>
            <Select
              value={pAcademicYear}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => {
                setPAcademicYear(value);
                setPPage(1);
              }}
              options={[
                { value: '', label: 'Barcha o‘quv yili' },
                ...withCurrent(academicYears, pAcademicYear).map((y) => ({
                  value: y.id,
                  label: y.title,
                })),
              ]}
            />
            <Select
              value={pSpecialty}
              showSearch
              optionFilterProp="label"
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => {
                setPSpecialty(value);
                setPPage(1);
              }}
              options={[
                { value: '', label: 'Barcha mutaxassislik' },
                ...specialtyOptions.map((s) => ({ value: s.id, label: s.title })),
              ]}
            />
            <Select
              value={pSemester}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => {
                setPSemester(value);
                setPPage(1);
              }}
              options={[
                { value: '', label: 'Barcha semestr' },
                ...SEMESTERS.map((s) => ({ value: String(s), label: s })),
              ]}
            />
            <Select
              value={pCourse}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => {
                setPCourse(value);
                setPPage(1);
              }}
              options={[
                { value: '', label: 'Barcha kurs' },
                ...courses.map((c) => ({ value: String(c.number), label: c.title })),
              ]}
            />
            <Select
              value={pGroup}
              showSearch
              optionFilterProp="label"
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => {
                setPGroup(value);
                setPPage(1);
              }}
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
                  <Th>Talaba F.I.Sh</Th>
                  <Th style={{ width: 80 }}>Kurs</Th>
                  <Th style={{ width: 100 }}>Guruh</Th>
                  <Th>Nazariy va umumiy bilim</Th>
                  <Th>Tajriba va ko‘nikma</Th>
                  <Th style={{ width: 120 }}>Bemorlar soni</Th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((row, i) => (
                  <Tr key={`${row.residentId}_${row.skillId}`}>
                    <Td>{(pPage - 1) * PAGE_SIZE + i + 1}</Td>
                    <Td style={{ fontWeight: 500 }}>{row.fullName}</Td>
                    <Td>{row.courseNumber ? `${row.courseNumber}-kurs` : '—'}</Td>
                    <Td>{row.groupTitle || '—'}</Td>
                    <Td>
                      <TruncCell text={row.theoryTopicTitle ?? ''} />
                    </Td>
                    <Td>
                      <TruncCell text={row.practicalSkill} />
                    </Td>
                    <Td>
                      <ProgressCell $done={row.done}>
                        {row.completed}/{row.target}
                      </ProgressCell>
                    </Td>
                  </Tr>
                ))}
                {!progressLoading && progressRows.length === 0 && (
                  <Tr>
                    <Td colSpan={7} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                      <MdSearch /> Ma’lumot topilmadi
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>

          <Pager page={pPage} totalPages={progressPages} onPage={setPPage} />
        </>
      )}

      {tab === 'konikmalar' && (
        <>
          <FilterBar>
            <Select
              value={sSpecialty}
              showSearch
              optionFilterProp="label"
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => setSSpecialty(value)}
              options={[
                { value: '', label: 'Barcha mutaxassislik' },
                ...specialtyOptions.map((s) => ({ value: s.id, label: s.title })),
              ]}
            />
            <Select
              value={sSemester}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value) => setSSemester(value)}
              options={[
                { value: '', label: 'Barcha semestr' },
                ...SEMESTERS.map((s) => ({ value: String(s), label: s })),
              ]}
            />
            {canCreateSkill && (
              <div style={{ marginLeft: 'auto' }}>
                <Btn $variant="primary" onClick={openAddSkill}>
                  <MdAdd /> Qo‘shish
                </Btn>
              </div>
            )}
          </FilterBar>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th>Mutaxassislik</Th>
                  <Th style={{ width: 120 }}>Semestr</Th>
                  <Th>Nazariy bilim</Th>
                  <Th>Tajriba ko‘nikma</Th>
                  <Th style={{ width: 120 }}>Bemorlar soni</Th>
                  {skillActions && <Th style={{ width: 110 }}>Amallar</Th>}
                </tr>
              </thead>
              <tbody>
                {skills.map((s, i) => (
                  <Tr key={s.id}>
                    <Td>{i + 1}</Td>
                    <Td>{s.specialtyTitle || '—'}</Td>
                    <Td>{s.semester}</Td>
                    <Td>
                      <TruncCell text={s.theoryTopicTitle ?? ''} />
                    </Td>
                    <Td>
                      <TruncCell text={s.practicalSkill} />
                    </Td>
                    <Td>
                      <Badge variant="success">{s.patientCount} ta</Badge>
                    </Td>
                    {skillActions && (
                      <Td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {canUpdateSkill && (
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              onClick={() => openEditSkill(s)}
                              title="Tahrirlash"
                            >
                              <MdEdit />
                            </Btn>
                          )}
                          {canDeleteSkill && (
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              onClick={() => setSkillToDelete(s)}
                              title="O‘chirish"
                            >
                              <MdDelete />
                            </Btn>
                          )}
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
                {!skillsLoading && skills.length === 0 && (
                  <Tr>
                    <Td
                      colSpan={skillActions ? 7 : 6}
                      style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                    >
                      <MdSearch /> Ma’lumot topilmadi
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}

      {tab === 'nazariy' && (
        <>
          <FilterBar>
            {canCreateTopic && (
              <div style={{ marginLeft: 'auto' }}>
                <Btn $variant="primary" onClick={openAddTopic}>
                  <MdAdd /> Qo‘shish
                </Btn>
              </div>
            )}
          </FilterBar>

          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th>Nomi</Th>
                  <Th style={{ width: 130 }}>Status</Th>
                  {topicActions && <Th style={{ width: 110 }}>Amallar</Th>}
                </tr>
              </thead>
              <tbody>
                {topics.map((t, i) => (
                  <Tr key={t.id}>
                    <Td>{i + 1}</Td>
                    <Td>{t.title}</Td>
                    <Td>
                      {canUpdateTopic ? (
                        <StatusToggle
                          onClick={() => toggleTopic(t)}
                          title="Statusni o‘zgartirish"
                          disabled={updateTopicM.isPending}
                        >
                          <Badge variant={t.active ? 'faol' : 'nofaol'}>
                            {t.active ? 'Faol' : 'Nofaol'}
                          </Badge>
                        </StatusToggle>
                      ) : (
                        <Badge variant={t.active ? 'faol' : 'nofaol'}>
                          {t.active ? 'Faol' : 'Nofaol'}
                        </Badge>
                      )}
                    </Td>
                    {topicActions && (
                      <Td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {canUpdateTopic && (
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              onClick={() => openEditTopic(t)}
                              title="Tahrirlash"
                            >
                              <MdEdit />
                            </Btn>
                          )}
                          {canDeleteTopic && (
                            <Btn
                              $variant="ghost"
                              $size="sm"
                              onClick={() => setTopicToDelete(t)}
                              title="O‘chirish"
                            >
                              <MdDelete />
                            </Btn>
                          )}
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
                {!topicsLoading && topics.length === 0 && (
                  <Tr>
                    <Td
                      colSpan={topicActions ? 4 : 3}
                      style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                    >
                      <MdSearch /> Ma’lumot topilmadi
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}

      <Modal
        open={skillModal}
        onClose={() => setSkillModal(false)}
        title={editingSkill ? 'Ko‘nikmani tahrirlash' : 'Ko‘nikma qo‘shish'}
        width="500px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Mutaxassislik *</Label>
            <Select
              value={skillForm.specialty}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => setSkillForm((f) => ({ ...f, specialty: value }))}
              options={[
                { value: '', label: 'Tanlang' },
                ...specialtyOptions.map((s) => ({ value: s.id, label: s.title })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>Semestr *</Label>
            <Select
              value={skillForm.semester}
              style={{ width: '100%' }}
              onChange={(value) => setSkillForm((f) => ({ ...f, semester: value }))}
              options={[
                { value: '', label: 'Tanlang' },
                ...SEMESTERS.map((s) => ({ value: String(s), label: s })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>Nazariy va umumiy bilim *</Label>
            <Select
              value={skillForm.theoryTopic}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => setSkillForm((f) => ({ ...f, theoryTopic: value }))}
              options={[
                { value: '', label: 'Tanlang' },
                ...topicOptions.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>Tajriba va ko‘nikma *</Label>
            <Input
              value={skillForm.practicalSkill}
              style={{ width: '100%' }}
              onChange={(e) => setSkillForm((f) => ({ ...f, practicalSkill: e.target.value }))}
              placeholder="Tajriba ko‘nikmasi nomini kiriting"
            />
          </FormGroup>
          <FormGroup>
            <Label>Bemorlar soni (talab qilinadigan)</Label>
            <NumberField
              min={1}
              style={{ width: '100%' }}
              value={skillForm.patientCount === '' ? null : Number(skillForm.patientCount)}
              onChange={(v) =>
                setSkillForm((f) => ({ ...f, patientCount: v === null ? '' : String(v) }))
              }
              placeholder="Masalan: 10"
            />
            {!patientCountValid && (
              <HelperText $error>Butun son va kamida 1 bo‘lishi kerak</HelperText>
            )}
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setSkillModal(false)}>
            Bekor qilish
          </Btn>
          <Btn
            $variant="primary"
            onClick={saveSkill}
            disabled={createSkillM.isPending || updateSkillM.isPending || !patientCountValid}
          >
            Saqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!skillToDelete}
        onClose={() => setSkillToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="420px"
      >
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{skillToDelete?.practicalSkill}</b> ko‘nikmasini o‘chirmoqchimisiz? Bu amalni bekor
            qilib bo‘lmaydi.
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setSkillToDelete(null)}>
            Bekor qilish
          </Btn>
          <Btn $variant="danger" onClick={confirmDeleteSkill} disabled={deleteSkillM.isPending}>
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={topicModal}
        onClose={() => setTopicModal(false)}
        title={editingTopic ? 'Nazariy bilimni tahrirlash' : 'Nazariy bilim qo‘shish'}
        width="460px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Nomi *</Label>
            <Input
              value={topicForm.title}
              style={{ width: '100%' }}
              onChange={(e) => setTopicForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Nazariy va umumiy bilim nomini kiriting"
            />
          </FormGroup>
          <FormGroup>
            <Label>Status</Label>
            <Switch
              checked={topicForm.active}
              onChange={(checked) => setTopicForm((f) => ({ ...f, active: checked }))}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setTopicModal(false)}>
            Bekor qilish
          </Btn>
          <Btn
            $variant="primary"
            onClick={saveTopic}
            disabled={createTopicM.isPending || updateTopicM.isPending}
          >
            Saqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!topicToDelete}
        onClose={() => setTopicToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="420px"
      >
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{topicToDelete?.title}</b> nazariy bilimini o‘chirmoqchimisiz? Bu amalni bekor qilib
            bo‘lmaydi.
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setTopicToDelete(null)}>
            Bekor qilish
          </Btn>
          <Btn $variant="danger" onClick={confirmDeleteTopic} disabled={deleteTopicM.isPending}>
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>
    </div>
  );
}
