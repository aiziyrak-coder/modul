import { useState } from 'react';
import styled from 'styled-components';
import { MdAdd, MdDelete, MdDownload, MdEdit, MdSearch, MdWarning } from '../icons';
import { App, Input, Select } from '@/shared/ui';
import {
  PageTitle,
  StatCards,
  FilterBar,
  Btn,
  FormGroup,
  Label,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import StatCard from '../components/common/StatCard';
import Badge from '../components/common/Badge';
import TruncCell from '../components/common/TruncCell';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import FileUpload from '../components/common/FileUpload';
import { NumberField } from '../components/common/NumberField';
import {
  useResources,
  useResourceStats,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  useDownloadResource,
} from '../api/resource-api';
import type { ResourceInput } from '../api/resource-api';
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABEL,
  RESOURCE_TYPE_EMOJI,
  formatVariant,
} from '../api/resource-types';
import type { Resource, ResourceType } from '../api/resource-types';
import { formatFileSize } from '../api/curriculum-types';
import { useSpecialties, useDepartments } from '../api/residency-api';
import { usePermission } from '@/app/session';
import { useDebouncedSearch } from '../lib/use-debounced';
import { getApiErrorMessage } from '@/shared/api';
import { theme } from '../styles/theme';

const ACCEPT = '.pdf,.docx,.mp4,.pptx';

interface FormState {
  title: string;
  resourceType: ResourceType;
  specialty: string;
  department: string;
  author: string;
  publishYear: string;
  file: File | null;
}

const EMPTY: FormState = {
  title: '',
  resourceType: 'kitob',
  specialty: '',
  department: '',
  author: '',
  publishYear: '',
  file: null,
};

const SearchWrap = styled.div`
  position: relative;
  flex: 1;
  min-width: 220px;
`;

const TypeCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
`;

const RowActions = styled.div`
  display: flex;
  gap: 4px;
`;

const MutedCell = styled.span`
  color: ${({ theme: t }) => t.colors.textLight};
`;

const CountCell = styled.span`
  font-weight: 600;
`;

const WarnRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: ${({ theme: t }) => t.colors.warning};
`;

const HintText = styled.span`
  font-weight: 400;
  color: ${({ theme: t }) => t.colors.textLight};
`;

export default function Manbalar() {
  const { message } = App.useApp();
  const can = usePermission();
  const canWrite = can('residentResource:create');

  const [fSpecialty, setFSpecialty] = useState('');
  const [fType, setFType] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<Resource | null>(null);

  const { data: specialties = [] } = useSpecialties();
  const { data: departments = [] } = useDepartments();
  const debouncedSearch = useDebouncedSearch(search);

  const resourceFilters = {
    resourceType: fType || undefined,
    specialty: fSpecialty || undefined,
    search: debouncedSearch || undefined,
  };

  const { data: stats } = useResourceStats(resourceFilters);
  const { data: rows = [], isLoading } = useResources(resourceFilters);

  const createM = useCreateResource();
  const updateM = useUpdateResource();
  const deleteM = useDeleteResource();
  const downloadM = useDownloadResource();

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({
      title: r.title,
      resourceType: r.resourceType,
      specialty: r.specialtyId ?? '',
      department: r.departmentId ?? '',
      author: r.author ?? '',
      publishYear: r.publishYear ? String(r.publishYear) : '',
      file: null,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      message.warning('Sarlavhani kiriting');
      return;
    }
    if (!editing && !form.file) {
      message.warning('Fayl tanlang');
      return;
    }
    let publishYear: number | null = null;
    if (form.publishYear !== '') {
      const y = Number(form.publishYear);
      if (!Number.isInteger(y) || y < 1800 || y > 2200) {
        message.warning('Nashr yili 1800 va 2200 orasida butun son bo‘lishi kerak');
        return;
      }
      publishYear = y;
    }

    const spec = specialties.find((s) => s.id === form.specialty);
    const payload: ResourceInput = {
      title: form.title.trim(),
      resourceType: form.resourceType,
      specialty: form.specialty || null,
      department: form.department || null,
      specialtyTitle: spec?.title ?? null,
      author: form.author.trim() || null,
      publishYear,
    };
    if (form.file) payload.file = form.file;

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

  const download = async (r: Resource) => {
    try {
      const res = await downloadM.mutateAsync(r.id);
      const url = res.fileUrl || r.fileUrl;
      if (!url) {
        message.error('Fayl topilmadi');
        return;
      }
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Yuklab olishda xatolik'));
    }
  };

  return (
    <div>
      <PageTitle>Manbalar</PageTitle>

      <StatCards>
        <StatCard
          icon="📚"
          iconBg={theme.colors.infoLight}
          number={stats?.total ?? 0}
          label="Jami manbalar"
        />
        <StatCard
          icon="📕"
          iconBg={theme.colors.dangerLight}
          number={stats?.pdf ?? 0}
          label="PDF hujjatlar"
        />
        <StatCard
          icon="🎬"
          iconBg={theme.colors.successLight}
          number={stats?.video ?? 0}
          label="Video materiallar"
        />
        <StatCard
          icon="⬇️"
          iconBg={theme.colors.warningLight}
          number={stats?.downloads ?? 0}
          label="Jami yuklamalar"
        />
      </StatCards>

      <FilterBar>
        <Select
          value={fSpecialty}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFSpecialty(value)}
          options={[
            { value: '', label: 'Mutaxassislik — barchasi' },
            ...specialties.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />

        <Select
          value={fType}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFType(value)}
          options={[
            { value: '', label: 'Tur — barchasi' },
            ...RESOURCE_TYPES.map((t) => ({ value: t, label: RESOURCE_TYPE_LABEL[t] })),
          ]}
        />

        <SearchWrap>
          <Input
            value={search}
            style={{ width: '100%' }}
            prefix={<MdSearch size={15} />}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sarlavha yoki muallif bo‘yicha qidirish..."
          />
        </SearchWrap>

        {canWrite && (
          <Btn $variant="primary" onClick={openAdd}>
            <MdAdd /> Manba qo‘shish
          </Btn>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th>Sarlavha</Th>
              <Th style={{ width: 130 }}>Tur</Th>
              <Th style={{ width: 90 }}>Format</Th>
              <Th>Muallif</Th>
              <Th style={{ width: 70 }}>Yil</Th>
              <Th>Mutaxassislik</Th>
              <Th style={{ width: 90 }}>Hajm</Th>
              <Th style={{ width: 110 }}>Yuklamalar</Th>
              <Th style={{ width: 170 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Tr key={r.id}>
                <Td>{i + 1}</Td>
                <Td>
                  <TruncCell text={r.title} />
                </Td>
                <Td>
                  <TypeCell>
                    {RESOURCE_TYPE_EMOJI[r.resourceType]} {RESOURCE_TYPE_LABEL[r.resourceType]}
                  </TypeCell>
                </Td>
                <Td>
                  {r.format ? (
                    <Badge variant={formatVariant(r.format)}>{r.format}</Badge>
                  ) : (
                    <MutedCell>—</MutedCell>
                  )}
                </Td>
                <Td>
                  <TruncCell text={r.author ?? ''} />
                </Td>
                <Td>{r.publishYear ?? <MutedCell>—</MutedCell>}</Td>
                <Td>
                  <TruncCell text={r.specialtyTitle ?? ''} />
                </Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{formatFileSize(r.fileSize)}</Td>
                <Td>
                  <CountCell>{r.downloadCount}</CountCell>
                </Td>
                <Td>
                  <RowActions>
                    <Btn
                      $variant="outline"
                      $size="sm"
                      title="Yuklab olish"
                      onClick={() => download(r)}
                      disabled={downloadM.isPending}
                    >
                      <MdDownload /> Yuklab olish
                    </Btn>
                    {canWrite && (
                      <>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="Tahrirlash"
                          onClick={() => openEdit(r)}
                        >
                          <MdEdit />
                        </Btn>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="O‘chirish"
                          onClick={() => setToDelete(r)}
                        >
                          <MdDelete />
                        </Btn>
                      </>
                    )}
                  </RowActions>
                </Td>
              </Tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <Tr>
                <Td colSpan={10} style={{ textAlign: 'center', padding: 32 }}>
                  <MutedCell>
                    <MdSearch /> Ma’lumot topilmadi
                  </MutedCell>
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Manbani tahrirlash' : 'Yangi manba qo‘shish'}
        width="500px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Sarlavha *</Label>
            <Input
              value={form.title}
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Manba sarlavhasi"
            />
          </FormGroup>

          <FormGroup>
            <Label>Tur</Label>
            <Select
              value={form.resourceType}
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, resourceType: value }))}
              options={RESOURCE_TYPES.map((t) => ({ value: t, label: RESOURCE_TYPE_LABEL[t] }))}
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
                { value: '', label: 'Tanlang' },
                ...specialties.map((s) => ({ value: s.id, label: s.title })),
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
              onChange={(value) => setForm((f) => ({ ...f, department: value }))}
              options={[
                { value: '', label: 'Tanlang' },
                ...departments.map((d) => ({ value: d.id, label: d.title })),
              ]}
            />
          </FormGroup>

          <FormGroup>
            <Label>Muallif</Label>
            <Input
              value={form.author}
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              placeholder="Muallif F.I.Sh"
            />
          </FormGroup>

          <FormGroup>
            <Label>Nashr yili</Label>
            <NumberField
              style={{ width: '100%' }}
              value={form.publishYear === '' ? null : Number(form.publishYear)}
              onChange={(v) => setForm((f) => ({ ...f, publishYear: v === null ? '' : String(v) }))}
              placeholder="Masalan: 2024"
            />
          </FormGroup>

          <FormGroup>
            <Label>
              Fayl {editing ? <HintText>(o‘zgartirmasangiz — eskisi qoladi)</HintText> : '*'}
            </Label>
            <FileUpload
              key={`file_${editing?.id ?? 'new'}`}
              accept={ACCEPT}
              onChange={(file) => setForm((f) => ({ ...f, file }))}
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

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="420px"
      >
        <ModalBody>
          <div style={{ fontSize: 13 }}>
            <b>{toDelete?.title}</b> manbasini o‘chirmoqchimisiz?
          </div>
          <WarnRow>
            <MdWarning size={15} /> Bu amalni bekor qilib bo‘lmaydi.
          </WarnRow>
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
