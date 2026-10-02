import { useState } from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';
import {
  academicYearValue,
  useAcademicYears,
  withCurrent,
} from '../api/reference-api';
import { useCourses } from '../api/reference-api';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdSchool } from '../icons';
import { Select, DatePicker, App } from '@/shared/ui';
import {
  PageTitle,
  FilterBar,
  Btn,
  FormGroup,
  Label,
  HelperText,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { AsyncSelect } from '../components/common/AsyncSelect';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  useLessons,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
} from '../api/lesson-api';
import type { LessonInput } from '../api/lesson-api';
import type { Lesson } from '../api/lesson-types';
import { useSciences, useDepartments, useGroups, useSupervisorUsers } from '../api/residency-api';


const fmtDate = (s: string | null): string => (s ? s.slice(0, 10) : '—');
const toDateInput = (s: string | null): string => (s ? s.slice(0, 10) : '');

interface LessonForm {
  academicYear: string;
  courseNumber: string;
  science: string;
  department: string;
  teacher: string;
  groups: string[];
  startDate: string;
  endDate: string;
}

const EMPTY: LessonForm = {
  academicYear: '',
  courseNumber: '',
  science: '',
  department: '',
  teacher: '',
  groups: [],
  startDate: '',
  endDate: '',
};

const FanCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  .anticon {
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  }
`;

const ChipWrap = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const DateRange = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const EmptyCell = styled(Td)`
  text-align: center;
  padding: 32px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CheckboxGroup = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
`;

const CheckChip = styled.label<{ $checked: boolean }>`
  display: inline-flex;
  align-items: center;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid
    ${({ $checked, theme }) => ($checked ? theme.colors.primary : theme.colors.border)};
  background: ${({ $checked, theme }) => ($checked ? theme.colors.primaryLight : 'transparent')};
  color: ${({ $checked, theme }) => ($checked ? theme.colors.primary : theme.colors.textMuted)};

  gap: 6px;
  padding: 4px 12px;

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
  }
`;

const NativeCheck = styled.input`
  width: 15px;
  height: 15px;
  margin: 0;
  cursor: pointer;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const DangerNote = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.6;
`;

export default function UmumiyDarslar() {
  const { message } = App.useApp();

  const { data: courses = [] } = useCourses();

  const { data: academicYears = [] } = useAcademicYears();

  const can = usePermission();
  const canWrite = can('residencyLesson:create');

  const [fAcademicYear, setFAcademicYear] = useState('');
  const [fScience, setFScience] = useState('');
  const [fCourse, setFCourse] = useState('');
  const [fGroup, setFGroup] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState<LessonForm>(EMPTY);
  const [toDelete, setToDelete] = useState<Lesson | null>(null);

  const { data: sciences = [] } = useSciences();
  const { data: departments = [] } = useDepartments();
  const { data: groups = [] } = useGroups();
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherLabel, setTeacherLabel] = useState('');
  const { data: teachers = [], isFetching: teachersLoading } = useSupervisorUsers(canWrite, teacherSearch);

  const { data: lessons = [], isLoading } = useLessons({
    academicYear: fAcademicYear.trim() || undefined,
    science: fScience || undefined,
    courseNumber: fCourse || undefined,
    group: fGroup || undefined,
    fromDate: fFrom || undefined,
    toDate: fTo || undefined,
  });

  const createM = useCreateLesson();
  const updateM = useUpdateLesson();
  const deleteM = useDeleteLesson();

  const colCount = canWrite ? 8 : 7;

  const visibleTeachers = form.department
    ? teachers.filter((t) => t.departmentId === form.department)
    : teachers;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setTeacherLabel('');
    setModalOpen(true);
  };

  const openEdit = (l: Lesson) => {
    setEditing(l);
    setForm({
      academicYear: academicYearValue(l),
      courseNumber: l.courseNumber != null ? String(l.courseNumber) : '',
      science: l.scienceId ?? '',
      department: l.departmentId ?? '',
      teacher: l.teacherId ?? '',
      groups: l.groups.map((g) => g.id),
      startDate: toDateInput(l.startDate),
      endDate: toDateInput(l.endDate),
    });
    setTeacherLabel(l.teacherName ?? '');
    setModalOpen(true);
  };

  const toggleGroup = (id: string) =>
    setForm((f) => ({
      ...f,
      groups: f.groups.includes(id) ? f.groups.filter((g) => g !== id) : [...f.groups, id],
    }));

  const save = async () => {
    if (!form.science) {
      message.warning('Fanni tanlang');
      return;
    }
    if (!form.startDate || !form.endDate) {
      message.warning('Boshlanish va tugash sanasini kiriting');
      return;
    }
    if (form.endDate < form.startDate) {
      message.warning('Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas');
      return;
    }
    if (form.groups.length === 0) {
      message.warning('Kamida bitta guruh tanlang');
      return;
    }

    const payload: LessonInput = {
      academicYear: form.academicYear.trim() || null,
      courseNumber: form.courseNumber ? Number(form.courseNumber) : null,
      science: form.science,
      scienceTitle: sciences.find((s) => s.id === form.science)?.title ?? null,
      department: form.department || null,
      departmentTitle: departments.find((d) => d.id === form.department)?.title ?? null,
      teacher: form.teacher || null,
      teacherName: teacherLabel || teachers.find((t) => t.id === form.teacher)?.name || null,
      groups: form.groups.map((id) => ({
        group: id,
        title: groups.find((g) => g.id === id)?.title ?? null,
      })),
      startDate: form.startDate,
      endDate: form.endDate,
    };

    try {
      if (editing) await updateM.mutateAsync({ id: editing.id, data: payload });
      else await createM.mutateAsync(payload);
      message.success(editing ? 'Yangilandi' : 'Qo‘shildi');
      setModalOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteM.mutateAsync(toDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setToDelete(null);
  };

  return (
    <div>
      <PageTitle>Umumiy darslar</PageTitle>

      <FilterBar>
        <Select
          value={fAcademicYear}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFAcademicYear(value)}
          options={[
            { value: '', label: 'Barcha o‘quv yili' },
            ...withCurrent(academicYears, fAcademicYear).map((y) => ({
              value: y.id,
              label: y.title,
            })),
          ]}
        />
        <Select
          value={fScience}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFScience(value)}
          options={[
            { value: '', label: 'Barcha fanlar' },
            ...sciences.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
        <Select
          value={fCourse}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFCourse(value)}
          options={[
            { value: '', label: 'Barcha kurs' },
            ...courses.map((c) => ({ value: String(c.number), label: c.title })),
          ]}
        />
        <Select
          value={fGroup}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFGroup(value)}
          options={[
            { value: '', label: 'Barcha guruh' },
            ...groups.map((g) => ({ value: g.id, label: g.title })),
          ]}
        />
        <DateRange>
          <span>Sana:</span>
          <div title="Oraliq boshlanishi">
            <DatePicker
              style={{ width: '100%', minWidth: 150 }}
              value={fFrom || null}
              onChange={(v) => setFFrom(v ?? '')}
            />
          </div>
          <span>—</span>
          <div title="Oraliq tugashi">
            <DatePicker
              style={{ width: '100%', minWidth: 150 }}
              value={fTo || null}
              onChange={(v) => setFTo(v ?? '')}
            />
          </div>
        </DateRange>
        {canWrite && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={openAdd}>
              <MdAdd /> Dars qo‘shish
            </Btn>
          </div>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>#</Th>
              <Th>Fan nomi</Th>
              <Th>O‘qituvchi</Th>
              <Th style={{ width: 80 }}>Kurs</Th>
              <Th>Guruhlar</Th>
              <Th style={{ width: 120 }}>Boshlanishi</Th>
              <Th style={{ width: 120 }}>Tugashi</Th>
              {canWrite && <Th style={{ width: 110 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {lessons.map((l, i) => (
              <Tr key={l.id}>
                <Td>{i + 1}</Td>
                <Td>
                  <FanCell>
                    <MdSchool size={15} />
                    {l.scienceTitle || '—'}
                  </FanCell>
                </Td>
                <Td>{l.teacherName || '—'}</Td>
                <Td>{l.courseNumber != null ? `${l.courseNumber}-kurs` : '—'}</Td>
                <Td>
                  {l.groups.length === 0 ? (
                    '—'
                  ) : (
                    <ChipWrap>
                      {l.groups.map((g) => (
                        <Badge key={g.id} variant="info">
                          {g.title || '—'}
                        </Badge>
                      ))}
                    </ChipWrap>
                  )}
                </Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.startDate)}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.endDate)}</Td>
                {canWrite && (
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn $variant="ghost" $size="sm" onClick={() => openEdit(l)} title="Tahrirlash">
                        <MdEdit />
                      </Btn>
                      <Btn
                        $variant="ghost"
                        $size="sm"
                        onClick={() => setToDelete(l)}
                        title="O‘chirish"
                      >
                        <MdDelete />
                      </Btn>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
            {!isLoading && lessons.length === 0 && (
              <Tr>
                <EmptyCell colSpan={colCount}>
                  <MdSearch /> Ma’lumot topilmadi
                </EmptyCell>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      {canWrite && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? 'Darsni tahrirlash' : 'Yangi dars qo‘shish'}
          width="480px"
        >
          <ModalBody>
            <div style={{ display: 'flex', gap: 12 }}>
              <FormGroup style={{ flex: 1 }}>
                <Label>O‘quv yili</Label>
                <Select
                  value={form.academicYear}
                  style={{ width: '100%' }}
                  onChange={(value) => setForm((f) => ({ ...f, academicYear: value }))}
                  options={[
                    { value: '', label: 'Tanlanmagan' },
                    ...withCurrent(academicYears, form.academicYear).map((y) => ({
                      value: y.id,
                      label: y.title,
                    })),
                  ]}
                />
              </FormGroup>
              <FormGroup style={{ flex: 1 }}>
                <Label>Kurs</Label>
                <Select
                  value={form.courseNumber}
                  style={{ width: '100%' }}
                  onChange={(value) => setForm((f) => ({ ...f, courseNumber: value }))}
                  options={[
                    { value: '', label: 'Tanlang' },
                    ...courses.map((c) => ({ value: String(c.number), label: c.title })),
                  ]}
                />
              </FormGroup>
            </div>

            <FormGroup>
              <Label>Fan *</Label>
              <Select
                value={form.science}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, science: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...sciences.map((s) => ({ value: s.id, label: s.title })),
                ]}
              />
            </FormGroup>

            <FormGroup>
              <Label>Kafedra</Label>
              <Select
                value={form.department}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => {
                  setForm((f) => ({ ...f, department: value, teacher: '' }));
                  setTeacherLabel('');
                }}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...departments.map((d) => ({ value: d.id, label: d.title })),
                ]}
              />
            </FormGroup>

            <FormGroup>
              <Label>O‘qituvchi</Label>
              <AsyncSelect
                value={form.teacher}
                onChange={(id, opt) => {
                  setForm((f) => ({ ...f, teacher: id }));
                  setTeacherLabel(opt?.label ?? '');
                }}
                options={visibleTeachers.map((t) => ({ value: t.id, label: t.name }))}
                onSearch={setTeacherSearch}
                loading={teachersLoading}
                placeholder="Tanlang"
                searchPlaceholder="F.I.Sh bo‘yicha qidiring"
              />
              <HelperText>
                {form.department
                  ? visibleTeachers.length
                    ? 'Tanlangan kafedra o‘qituvchilari — qidiruv shu kafedra bo‘yicha filtrlanadi.'
                    : 'Bu kafedrada o‘qituvchi topilmadi — qidiruvni o‘zgartiring yoki kafedrani almashtiring.'
                  : 'Kafedra tanlansa ro‘yxat shu kafedra bo‘yicha qisqaradi. Qidiruv orqali istalgan o‘qituvchini toping.'}
              </HelperText>
            </FormGroup>

            <FormGroup>
              <Label>Guruhlar *</Label>
              <CheckboxGroup>
                {groups.length === 0 ? (
                  <HelperText>Guruh topilmadi</HelperText>
                ) : (
                  groups.map((g) => (
                    <CheckChip key={g.id} $checked={form.groups.includes(g.id)}>
                      <NativeCheck
                        type="checkbox"
                        checked={form.groups.includes(g.id)}
                        onChange={() => toggleGroup(g.id)}
                      />
                      {g.title}
                    </CheckChip>
                  ))
                )}
              </CheckboxGroup>
            </FormGroup>

            <div style={{ display: 'flex', gap: 12 }}>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <Label>Boshlanish sanasi *</Label>
                <DatePicker
                  value={form.startDate || null}
                  onChange={(v) => setForm((f) => ({ ...f, startDate: v ?? '' }))}
                />
              </FormGroup>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <Label>Tugash sanasi *</Label>
                <DatePicker
                  value={form.endDate || null}
                  disabledDate={
                    form.startDate
                      ? (d) => d.isBefore(dayjs(form.startDate), 'day')
                      : undefined
                  }
                  onChange={(v) => setForm((f) => ({ ...f, endDate: v ?? '' }))}
                />
              </FormGroup>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn $variant="ghost" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Btn>
            <Btn
              $variant="primary"
              onClick={save}
              disabled={createM.isPending || updateM.isPending}
            >
              Saqlash
            </Btn>
          </ModalFooter>
        </Modal>
      )}

      {canWrite && (
        <Modal
          open={!!toDelete}
          onClose={() => setToDelete(null)}
          title="O‘chirishni tasdiqlang"
          width="400px"
        >
          <ModalBody>
            <DangerNote>
              <b>{toDelete?.scienceTitle || 'Ushbu'}</b> darsini o‘chirmoqchimisiz? Bu amalni
              qaytarib bo‘lmaydi.
            </DangerNote>
          </ModalBody>
          <ModalFooter>
            <Btn $variant="ghost" onClick={() => setToDelete(null)}>
              Bekor qilish
            </Btn>
            <Btn $variant="danger" onClick={confirmDelete} disabled={deleteM.isPending}>
              O‘chirish
            </Btn>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
