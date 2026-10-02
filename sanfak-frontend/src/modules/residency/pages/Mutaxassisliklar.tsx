import { useMemo, useState } from 'react';
import { MdAdd, MdEdit, MdDelete, MdSearch } from '../icons';
import { App, Input, Select } from '@/shared/ui';
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
import TruncCell from '../components/common/TruncCell';
import Badge from '../components/common/Badge';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import {
  useSpecialties,
  useCreateSpecialty,
  useUpdateSpecialty,
  useDeleteSpecialty,
  useDepartments,
} from '../api/residency-api';
import type { Program, Specialty } from '../api/types';

type FormState = {
  title: string;
  code: string;
  studyPeriod: string;
  departmentId: string;
  active: boolean;
};
const EMPTY: FormState = {
  title: '',
  code: '',
  studyPeriod: '',
  departmentId: '',
  active: true,
};

export default function Mutaxassisliklar() {
  const { message } = App.useApp();

  const can = usePermission();
  const canCreate = can('residencySpecialty:create');
  const canUpdate = can('residencySpecialty:update');
  const canDelete = can('residencySpecialty:delete');
  const rowActions = canUpdate || canDelete;

  const [program, setProgram] = useState<Program>('ordinatura');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Specialty | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [modalOpen, setModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Specialty | null>(null);
  const { data: departments = [] } = useDepartments(modalOpen);

  const { data: specialties = [], isLoading } = useSpecialties(program);
  const createM = useCreateSpecialty();
  const updateM = useUpdateSpecialty();
  const deleteM = useDeleteSpecialty();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return specialties;
    return specialties.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.code ?? '').toLowerCase().includes(q),
    );
  }, [specialties, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };
  const openEdit = (s: Specialty) => {
    setEditing(s);
    setForm({
      title: s.title,
      code: s.code ?? '',
      studyPeriod: s.studyPeriod != null ? String(s.studyPeriod) : '',
      departmentId: s.departmentId ?? '',
      active: s.active,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      message.warning('Mutaxassislik nomini kiriting');
      return;
    }
    const rawPeriod = form.studyPeriod.trim().replace(',', '.');
    let studyPeriod: number | null = null;
    if (rawPeriod !== '') {
      const n = Number(rawPeriod);
      if (!Number.isFinite(n) || n < 1 || n > 10) {
        message.warning('O‘qish muddati 1 va 10 yil orasida bo‘lishi kerak');
        return;
      }
      if (!Number.isInteger(n)) {
        message.warning('O‘qish muddati butun son bo‘lishi kerak (yil)');
        return;
      }
      studyPeriod = n;
    }

    const dept = departments.find((d) => d.id === form.departmentId);
    const payload: Partial<Specialty> = {
      title: form.title.trim(),
      code: form.code.trim() || null,
      program,
      studyPeriod,
      departmentId: form.departmentId || null,
      departmentTitle: dept?.title ?? null,
      active: form.active,
    };
    try {
      if (editing) await updateM.mutateAsync({ id: editing.id, data: payload });
      else await createM.mutateAsync(payload);
      message.success(editing ? 'Yangilandi' : 'Qo‘shildi');
      setModalOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik (kod takrorlanmasligi kerak)'));
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
      <PageTitle>Mutaxassisliklar</PageTitle>

      <Tabs>
        <Tab $active={program === 'ordinatura'} onClick={() => setProgram('ordinatura')}>
          Klinik ordinatura
        </Tab>
        <Tab $active={program === 'magistratura'} onClick={() => setProgram('magistratura')}>
          Magistratura
        </Tab>
      </Tabs>

      <FilterBar>
        <Input
          placeholder="Nomi yoki kod bo‘yicha qidirish..."
          value={search}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canCreate && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={openAdd}>
              <MdAdd /> Mutaxassislik qo‘shish
            </Btn>
          </div>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>#</Th>
              <Th>Mutaxassislik nomi</Th>
              <Th>Kodi</Th>
              <Th style={{ width: 110 }}>O‘qish muddati</Th>
              <Th>Kafedra</Th>
              <Th>Status</Th>
              {rowActions && <Th style={{ width: 110 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <Tr key={s.id}>
                <Td>{i + 1}</Td>
                <Td><TruncCell text={s.title} /></Td>
                <Td style={{ fontFamily: 'monospace' }}>{s.code || '—'}</Td>
                <Td>{s.studyPeriod != null ? `${s.studyPeriod} yil` : '—'}</Td>
                <Td>{s.departmentTitle || '—'}</Td>
                <Td>
                  <Badge variant={s.active ? 'faol' : 'umumiy'}>{s.active ? 'Faol' : 'Nofaol'}</Badge>
                </Td>
                {rowActions && (
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {canUpdate && (
                        <Btn $variant="ghost" $size="sm" onClick={() => openEdit(s)} title="Tahrirlash">
                          <MdEdit />
                        </Btn>
                      )}
                      {canDelete && (
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          onClick={() => setToDelete(s)}
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
            {!isLoading && rows.length === 0 && (
              <Tr>
                <Td
                  colSpan={rowActions ? 7 : 6}
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
        title={editing ? 'Mutaxassislikni tahrirlash' : 'Mutaxassislik qo‘shish'}
      >
        <ModalBody>
          <FormGroup>
            <Label>Mutaxassislik nomi *</Label>
            <Input
              value={form.title}
              maxLength={300}
              showCount
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Masalan: Kardiologiya"
            />
          </FormGroup>
          <FormGroup>
            <Label>Mutaxassislik kodi</Label>
            <Input
              value={form.code}
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Masalan: 5A510101"
            />
          </FormGroup>
          <FormGroup>
            <Label>O‘qish muddati (yil)</Label>

            <Input
              type="text"
              inputMode="numeric"
              placeholder="Masalan: 2"
              value={form.studyPeriod}
              onChange={(e) => setForm((f) => ({ ...f, studyPeriod: e.target.value }))}
            />
            <HelperText>
              Rezident qo‘shilganda muddat SHU YERDAN olinadi (TZ 4.5.1). Yozuvda
              qiymat allaqachon bo‘lsa — tegilmaydi.
            </HelperText>
          </FormGroup>
          <FormGroup>
            <Label>Kafedra</Label>
            <Select
              value={form.departmentId}
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, departmentId: value }))}
              options={[
                { value: '', label: '— Tanlanmagan —' },
                ...departments.map((d) => ({ value: d.id, label: d.title })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>Status</Label>
            <Select
              value={form.active ? '1' : '0'}
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, active: value === '1' }))}
              options={[
                { value: '1', label: 'Faol' },
                { value: '0', label: 'Nofaol' },
              ]}
            />
          </FormGroup>
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

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="O‘chirishni tasdiqlang" width="400px">
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{toDelete?.title}</b> mutaxassisligini o‘chirmoqchimisiz? Bu amalni bekor qilib
            bo‘lmaydi. (Ilgari biriktirilgan talabalarga ta’sir qilmaydi.)
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
