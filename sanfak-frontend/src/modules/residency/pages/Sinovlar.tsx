import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { App, DatePicker, Input, Select, Textarea } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useAcademicYears, withCurrent, useCourses } from '../api/reference-api';
import { MdAdd, MdVisibility, MdDelete, MdEdit, MdSearch, MdAttachFile } from '../icons';
import {
  PageTitle,
  FilterBar,
  Btn,
  FormGroup,
  Label,
  HelperText,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import FileUpload from '../components/common/FileUpload';
import { NumberField } from '../components/common/NumberField';
import { formatFileSize } from '../api/curriculum-types';
import { useSpecialties, useGroups, useSciences } from '../api/residency-api';
import { useResidencyCapabilities } from '../lib/capabilities';
import { useDebouncedSearch } from '../lib/use-debounced';
import {
  useTrialTests,
  useTrialTestPreview,
  useCreateTrialTest,
  useUpdateTrialTest,
  useDeleteTrialTest,
} from '../api/trial-test-api';
import type { TrialTestInput } from '../api/trial-test-api';
import type { TrialTest } from '../api/trial-test-types';

const ACCEPT = '.pdf,.docx,.doc,.xlsx,.xls';

interface FormState {
  title: string;
  academicYear: string;
  science: string;
  specialty: string;
  program: string;
  courseNumber: string;
  group: string;
  date: string;
  maxScore: string;
  questionCount: string;
  desc: string;
  file: File | null;
}

const EMPTY: FormState = {
  title: '',
  academicYear: '',
  science: '',
  specialty: '',
  program: '',
  courseNumber: '',
  group: '',
  date: '',
  maxScore: '100',
  questionCount: '',
  desc: '',
  file: null,
};

const fmtDate = (d: string | null): string => (d ? d.slice(0, 10) : '—');

const HintBox = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.successLight};
  border: 1px solid ${({ theme }) => theme.colors.successBorder};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.success};
`;

const FileCell = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 12px;
`;

export default function Sinovlar() {
  const { message } = App.useApp();

  const navigate = useNavigate();
  const { isOffice } = useResidencyCapabilities();

  const { data: courses = [] } = useCourses();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: specialties = [] } = useSpecialties();
  const { data: sciences = [] } = useSciences();
  const { data: groups = [] } = useGroups();

  const [academicYear, setAcademicYear] = useState('');
  const [course, setCourse] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrialTest | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<TrialTest | null>(null);

  const debouncedSearch = useDebouncedSearch(search);

  const { data: rows = [], isLoading } = useTrialTests({
    academicYear: academicYear || undefined,
    courseNumber: course || undefined,
    specialty: specialty || undefined,
    search: debouncedSearch || undefined,
  });

  const createM = useCreateTrialTest();
  const updateM = useUpdateTrialTest();
  const deleteM = useDeleteTrialTest();

  const { data: preview } = useTrialTestPreview(
    {
      specialty: form.specialty || undefined,
      program: form.program || undefined,
      courseNumber: form.courseNumber || undefined,
      group: form.group || undefined,
      academicYear: form.academicYear || undefined,
    },
    modalOpen,
  );

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (t: TrialTest) => {
    setEditing(t);
    setForm({
      title: t.title,
      academicYear: t.academicYearRef ?? '',
      science: t.scienceId ?? '',
      specialty: t.specialtyId ?? '',
      program: t.program ?? '',
      courseNumber: t.courseNumber === null ? '' : String(t.courseNumber),
      group: t.groupId ?? '',
      date: t.date.slice(0, 10),
      maxScore: String(t.maxScore),
      questionCount: t.questionCount === null ? '' : String(t.questionCount),
      desc: t.desc ?? '',
      file: null,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      message.warning('Sinov nomini kiriting');
      return;
    }
    if (!form.date) {
      message.warning('Sanani kiriting');
      return;
    }
    if (!editing && !form.file) {
      message.warning('Sinov faylini yuklang');
      return;
    }
    const max = Number(form.maxScore);
    if (form.maxScore !== '' && (!Number.isInteger(max) || max < 1 || max > 100)) {
      message.warning('Maksimal ball 1 va 100 orasida bo‘lishi kerak');
      return;
    }

    const payload: TrialTestInput = {
      title: form.title.trim(),
      science: form.science || null,
      scienceTitle: sciences.find((x) => x.id === form.science)?.title ?? null,
      specialty: form.specialty || null,
      specialtyTitle: specialties.find((s) => s.id === form.specialty)?.title ?? null,
      program:
        form.program === 'magistratura' || form.program === 'ordinatura' ? form.program : '',
      courseNumber: form.courseNumber ? Number(form.courseNumber) : '',
      group: form.group || null,
      groupTitle: groups.find((g) => g.id === form.group)?.title ?? null,
      academicYear: form.academicYear || '',
      date: form.date,
      maxScore: form.maxScore ? Number(form.maxScore) : '',
      questionCount: form.questionCount ? Number(form.questionCount) : '',
      desc: form.desc.trim() || '',
    };
    if (form.file) payload.file = form.file;

    try {
      if (editing) {
        await updateM.mutateAsync({ id: editing.id, data: payload });
        message.success('Sinov yangilandi');
      } else {
        await createM.mutateAsync(payload);
        message.success('Sinov qo‘shildi');
      }
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
      <PageTitle>Sinov testlari</PageTitle>

      <FilterBar>
        <Select
          value={academicYear}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setAcademicYear(value)}
          options={[
            { value: '', label: 'O‘quv yili — barchasi' },
            ...withCurrent(academicYears, academicYear).map((y) => ({
              value: y.id,
              label: y.title,
            })),
          ]}
        />
        <Select
          value={specialty}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setSpecialty(value)}
          options={[
            { value: '', label: 'Barcha mutaxassislik' },
            ...specialties.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
        <Select
          value={course}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setCourse(value)}
          options={[
            { value: '', label: 'Barcha kurs' },
            ...courses.map((c) => ({ value: String(c.number), label: c.title })),
          ]}
        />
        <Input
          placeholder="Nom yoki fan bo‘yicha qidirish..."
          value={search}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isOffice && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={openAdd}>
              <MdAdd /> Sinov qo‘shish
            </Btn>
          </div>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th>Sinov nomi</Th>
              <Th>Fan</Th>
              <Th>Mutaxassislik</Th>
              <Th style={{ width: 90 }}>Kurs</Th>
              <Th style={{ width: 110 }}>Sana</Th>
              <Th style={{ width: 80 }}>Maks. ball</Th>
              <Th style={{ width: 150 }}>Test fayli</Th>
              <Th style={{ width: 160 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <Tr key={t.id}>
                <Td>{i + 1}</Td>
                <Td style={{ fontWeight: 500 }}>{t.title}</Td>
                <Td>{t.scienceTitle || '—'}</Td>
                <Td>{t.specialtyTitle || 'Barchasi'}</Td>
                <Td>{t.courseNumber ? `${t.courseNumber}-kurs` : 'Barchasi'}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</Td>
                <Td>{t.maxScore}</Td>
                <Td>
                  <FileCell href={t.fileUrl} target="_blank" rel="noreferrer">
                    <MdAttachFile />
                    {t.format || 'Fayl'}
                    {t.fileSize === null ? '' : ` · ${formatFileSize(t.fileSize)}`}
                  </FileCell>
                </Td>
                <Td style={{ whiteSpace: 'nowrap' }}>
                  <Btn
                    $variant="ghost"
                    $size="sm"
                    onClick={() => navigate(`/residency/sinovlar/${t.id}`)}
                    title="Natijalar"
                  >
                    <MdVisibility />
                  </Btn>
                  {isOffice && (
                    <>
                      <Btn
                        $variant="ghost"
                        $size="sm"
                        onClick={() => openEdit(t)}
                        title="Tahrirlash"
                      >
                        <MdEdit />
                      </Btn>
                      <Btn
                        $variant="ghost"
                        $size="sm"
                        onClick={() => setToDelete(t)}
                        title="O‘chirish"
                      >
                        <MdDelete />
                      </Btn>
                    </>
                  )}
                </Td>
              </Tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <Tr>
                <Td colSpan={9} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  <MdSearch /> Ma’lumot topilmadi
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Sinovni tahrirlash' : 'Sinov qo‘shish'}
        width="520px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Sinov nomi *</Label>
            <Input
              value={form.title}
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Masalan: 1-oraliq sinov"
            />
          </FormGroup>

          <FormGroup>
            <Label>Fan</Label>
            <Select
              value={form.science}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, science: value }))}
              options={[
                { value: '', label: 'Tanlanmagan' },
                ...sciences.map((x) => ({ value: x.id, label: x.title })),
              ]}
            />
          </FormGroup>

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
              <Label>Dastur</Label>
              <Select
                value={form.program}
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, program: value }))}
                options={[
                  { value: '', label: 'Ikkalasi' },
                  { value: 'magistratura', label: 'Magistratura' },
                  { value: 'ordinatura', label: 'Ordinatura' },
                ]}
              />
            </FormGroup>
          </div>

          <FormGroup>
            <Label>Mutaxassislik</Label>
            <Select
              value={form.specialty}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, specialty: value }))}
              options={[
                { value: '', label: 'Barchasi' },
                ...specialties.map((s) => ({ value: s.id, label: s.title })),
              ]}
            />
          </FormGroup>

          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Kurs</Label>
              <Select
                value={form.courseNumber}
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, courseNumber: value }))}
                options={[
                  { value: '', label: 'Barchasi' },
                  ...courses.map((c) => ({ value: String(c.number), label: c.title })),
                ]}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Guruh</Label>
              <Select
                value={form.group}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, group: value }))}
                options={[
                  { value: '', label: 'Barchasi' },
                  ...groups.map((g) => ({ value: g.id, label: g.title })),
                ]}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Sana *</Label>
              <DatePicker
                value={form.date || null}
                onChange={(v) => setForm((f) => ({ ...f, date: v ?? '' }))}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Maksimal ball</Label>
              <NumberField
                style={{ width: '100%' }}
                value={form.maxScore === '' ? null : Number(form.maxScore)}
                onChange={(v) => setForm((f) => ({ ...f, maxScore: v === null ? '' : String(v) }))}
              />
              <HelperText>TZ 4.5.6 — 100 ballik tizim</HelperText>
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Savollar soni</Label>
              <NumberField
                min={1}
                style={{ width: '100%' }}
                value={form.questionCount === '' ? null : Number(form.questionCount)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, questionCount: v === null ? '' : String(v) }))
                }
              />
            </FormGroup>
          </div>

          <FormGroup>
            <Label>Izoh</Label>
            <Textarea
              rows={2}
              value={form.desc}
              onChange={(v) => setForm((f) => ({ ...f, desc: v }))}
            />
          </FormGroup>

          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Test fayli {editing ? '' : '*'}</Label>
            <FileUpload
              key={`file_${editing?.id ?? 'new'}`}
              accept={ACCEPT}
              onChange={(file) => setForm((f) => ({ ...f, file }))}
            />
            {editing && <HelperText>O‘zgartirmasangiz — eski fayl qoladi</HelperText>}
          </FormGroup>

          <HintBox>
            {preview && preview.count > 0
              ? `✓ ${preview.count} ta talaba shu sinov ro‘yxatiga kiradi`
              : 'Belgilangan parametrlarga mos talaba topilmadi'}
          </HintBox>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setModalOpen(false)}>
            Bekor qilish
          </Btn>
          <Btn $variant="primary" onClick={save} disabled={createM.isPending || updateM.isPending}>
            Saqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="420px"
      >
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{toDelete?.title}</b> sinovini o‘chirmoqchimisiz? Qo‘yilgan ballar SAQLANADI —
            ular talabaning umumiy jamlanmasiga kiradi.
          </div>
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
    </div>
  );
}
