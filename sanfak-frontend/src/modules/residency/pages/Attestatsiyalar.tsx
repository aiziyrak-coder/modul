import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAcademicYears, withCurrent, useCourses } from '../api/reference-api';
import { MdAdd, MdVisibility, MdDelete, MdSearch } from '../icons';
import { App, Input, Select, DatePicker } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  FilterBar,
  Btn,
  FormGroup,
  Label,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { useAttestations, useAttestationPreview, useCreateAttestation, useDeleteAttestation } from '../api/attestation-api';
import type { AttestationInput } from '../api/attestation-api';
import type { Attestation } from '../api/attestation-types';
import { useSpecialties, useGroups, useSciences } from '../api/residency-api';
import { useDebouncedSearch } from '../lib/use-debounced';

interface AttForm {
  academicYear: string;
  science: string;
  scienceTitle: string;
  specialty: string;
  courseNumber: string;
  group: string;
  date: string;
}
const EMPTY: AttForm = {
  academicYear: '',
  science: '',
  scienceTitle: '',
  specialty: '',
  courseNumber: '',
  group: '',
  date: '',
};

const fmtDate = (d: string | null): string => (d ? d.slice(0, 10) : '—');

function enrolledOf(res: unknown): number | null {
  if (typeof res !== 'object' || res === null || !('enrolled' in res)) return null;
  const value = (res as { enrolled: unknown }).enrolled;
  return typeof value === 'number' ? value : null;
}

const HintBox = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.successLight};
  border: 1px solid ${({ theme }) => theme.colors.successBorder};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.success};
`;

export default function Attestatsiyalar() {
  const { message } = App.useApp();

  const can = usePermission();
  const canCreate = can('residencyAttestation:create');
  const canDelete = can('residencyAttestation:delete');

  const { data: courses = [] } = useCourses();

  const { data: academicYears = [] } = useAcademicYears();

  const navigate = useNavigate();

  const [academicYear, setAcademicYear] = useState('');
  const [course, setCourse] = useState('');
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AttForm>(EMPTY);
  const [toDelete, setToDelete] = useState<Attestation | null>(null);

  const { data: specialties = [] } = useSpecialties();
  const { data: sciences = [] } = useSciences();
  const { data: groups = [] } = useGroups();

  const debouncedSearch = useDebouncedSearch(search);

  const { data: rows = [], isLoading } = useAttestations({
    academicYear: academicYear.trim() || undefined,
    courseNumber: course || undefined,
    group: group || undefined,
    search: debouncedSearch || undefined,
  });

  const createM = useCreateAttestation();
  const deleteM = useDeleteAttestation();

  const { data: preview } = useAttestationPreview(
    {
      specialty: form.specialty || undefined,
      courseNumber: form.courseNumber || undefined,
      group: form.group || undefined,
      academicYear: form.academicYear.trim() || undefined,
    },
    modalOpen,
  );

  const openAdd = () => {
    setForm(EMPTY);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.science) {
      message.warning('Fanni tanlang');
      return;
    }
    if (!form.date) {
      message.warning('Sanani kiriting');
      return;
    }
    const payload: AttestationInput = {
      science: form.science,
      scienceTitle: sciences.find((x) => x.id === form.science)?.title ?? '',
      specialty: form.specialty || undefined,
      specialtyTitle: specialties.find((s) => s.id === form.specialty)?.title ?? null,
      courseNumber: form.courseNumber ? Number(form.courseNumber) : undefined,
      group: form.group || undefined,
      groupTitle: groups.find((g) => g.id === form.group)?.title ?? null,
      academicYear: form.academicYear.trim() || undefined,
      date: form.date,
    };
    try {
      const res = await createM.mutateAsync(payload);
      const enrolled = enrolledOf(res);
      message.success(
        enrolled === null
          ? 'Attestatsiya qo‘shildi'
          : `Attestatsiya qo‘shildi — ${enrolled} ta talaba biriktirildi`,
      );
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
      <PageTitle>Attestatsiyalar</PageTitle>

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
          value={course}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setCourse(value)}
          options={[
            { value: '', label: 'Barcha kurs' },
            ...courses.map((c) => ({ value: String(c.number), label: c.title })),
          ]}
        />
        <Select
          value={group}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setGroup(value)}
          options={[
            { value: '', label: 'Barcha guruh' },
            ...groups.map((g) => ({ value: g.id, label: g.title })),
          ]}
        />
        <Input
          placeholder="Fan yoki mutaxassislik bo‘yicha qidirish..."
          value={search}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canCreate && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={openAdd}>
              <MdAdd /> Attestatsiya qo‘shish
            </Btn>
          </div>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th>Fan</Th>
              <Th>Mutaxassislik</Th>
              <Th style={{ width: 90 }}>Kurs</Th>
              <Th style={{ width: 120 }}>Guruh</Th>
              <Th style={{ width: 120 }}>Sana</Th>
              <Th style={{ width: 90 }}>Batafsil</Th>
              {canDelete && <Th style={{ width: 90 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <Tr key={a.id}>
                <Td>{i + 1}</Td>
                <Td style={{ fontWeight: 500 }}>{a.scienceTitle}</Td>
                <Td>{a.specialtyTitle || 'Barchasi'}</Td>
                <Td>{a.courseNumber ? `${a.courseNumber}-kurs` : 'Barchasi'}</Td>
                <Td>{a.groupTitle || 'Barchasi'}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.date)}</Td>
                <Td>
                  <Btn
                    $variant="ghost"
                    $size="sm"
                    onClick={() => navigate(`/residency/attestatsiyalar/${a.id}`)}
                    title="Batafsil ko‘rish"
                  >
                    <MdVisibility />
                  </Btn>
                </Td>
                {canDelete && (
                  <Td>
                    <Btn
                      $variant="ghost"
                      $size="sm"
                      onClick={() => setToDelete(a)}
                      title="O‘chirish"
                    >
                      <MdDelete />
                    </Btn>
                  </Td>
                )}
              </Tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <Tr>
                <Td
                  colSpan={canDelete ? 8 : 7}
                  style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                >
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
        title="Attestatsiya qo‘shish"
        width="480px"
      >
        <ModalBody>
          <FormGroup>
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
          <FormGroup>
            <Label>Fan *</Label>
            <Select
              value={form.science}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, science: value }))}
              options={[
                { value: '', label: 'Fanni tanlang' },
                ...sciences.map((x) => ({ value: x.id, label: x.title })),
              ]}
            />
          </FormGroup>
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
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Sana *</Label>
            <DatePicker
              value={form.date || null}
              onChange={(v) => setForm((f) => ({ ...f, date: v ?? '' }))}
            />
          </FormGroup>

          <HintBox>
            {preview && preview.count > 0
              ? `✓ ${preview.count} ta talaba avtomatik qo‘shiladi`
              : 'Belgilangan parametrlarga mos talaba topilmadi'}
          </HintBox>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setModalOpen(false)}>
            Bekor qilish
          </Btn>
          <Btn $variant="primary" onClick={save} disabled={createM.isPending}>
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
            <b>{toDelete?.scienceTitle}</b> attestatsiyasini o‘chirmoqchimisiz? Talabalar natijalari
            ham o‘chadi. Bu amalni bekor qilib bo‘lmaydi.
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
