import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdVisibility,
  MdSearch,
  MdWarning,
} from '../icons';
import { App, Input, Select, Textarea } from '@/shared/ui';
import {
  PageTitle,
  FilterBar,
  Btn,
  FormGroup,
  Label,
  PageBtn,
} from '../components/common/FormElements';
import { NumberField } from '../components/common/NumberField';
import {
  academicYearValue,
  useAcademicYears,
  withCurrent,
  useEducationForms,
} from '../api/reference-api';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Pager from '../components/common/Pager';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import FileUpload from '../components/common/FileUpload';
import TruncCell from '../components/common/TruncCell';
import {
  useCurriculums,
  useCreateCurriculum,
  useUpdateCurriculum,
  useDeleteCurriculum,
} from '../api/curriculum-api';
import type { CurriculumInput } from '../api/curriculum-api';
import { PROGRAM_LABEL, formatDate } from '../api/curriculum-types';
import type { Curriculum, CurriculumProgram, EducationForm } from '../api/curriculum-types';
import { useSpecialties } from '../api/residency-api';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';

const PAGE_SIZES = [12, 24, 36, 48] as const;
const STUDY_PERIODS = ['2', '3'];
const PROGRAMS: CurriculumProgram[] = ['magistratura', 'ordinatura'];

interface FormState {
  title: string;
  specialty: string;
  specialtyCode: string;
  program: CurriculumProgram;
  educationForm: EducationForm;
  studyPeriod: string;
  approvedYear: string;
  academicYear: string;
  note: string;
  processFile: File | null;
  planFile: File | null;
}

const EMPTY: FormState = {
  title: '',
  specialty: '',
  specialtyCode: '',
  program: 'magistratura',
  educationForm: 'kunduzgi',
  studyPeriod: '',
  approvedYear: '',
  academicYear: '',
  note: '',
  processFile: null,
  planFile: null,
};

const PagerBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const PageSizeGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 14px;
`;

const PageSizeLabel = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-right: 4px;
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const RowActions = styled.div`
  display: flex;
  gap: 4px;
`;

const WarnRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.warning};
`;

const MutedCell = styled.span`
  color: ${({ theme }) => theme.colors.textLight};
`;

export default function OquvReja() {
  const { message } = App.useApp();

  const { data: educationForms = [] } = useEducationForms();

  const { data: academicYears = [] } = useAcademicYears();

  const navigate = useNavigate();
  const can = usePermission();
  const canWrite = can('residencyCurriculum:create');

  const [fSpecialty, setFSpecialty] = useState('');
  const [fAcademicYear, setFAcademicYear] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Curriculum | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<Curriculum | null>(null);

  const { data: specialties = [] } = useSpecialties();
  const { data: rows = [], isLoading } = useCurriculums({
    specialty: fSpecialty || undefined,
    academicYear: fAcademicYear || undefined,
  });

  const createM = useCreateCurriculum();
  const updateM = useUpdateCurriculum();
  const deleteM = useDeleteCurriculum();

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (c: Curriculum) => {
    setEditing(c);
    setForm({
      title: c.title,
      specialty: c.specialtyId ?? '',
      specialtyCode: c.specialtyCode ?? '',
      program: c.program,
      educationForm: c.educationForm,
      studyPeriod: c.studyPeriod ? String(c.studyPeriod) : '',
      approvedYear: c.approvedYear ? String(c.approvedYear) : '',
      academicYear: academicYearValue(c),
      note: c.note ?? '',
      processFile: null,
      planFile: null,
    });
    setModalOpen(true);
  };

  const pickSpecialty = (id: string) => {
    const s = specialties.find((x) => x.id === id);
    setForm((f) => ({ ...f, specialty: id, specialtyCode: s?.code ?? '' }));
  };

  const save = async () => {
    if (!form.title.trim()) {
      message.warning('O‘quv reja nomini kiriting');
      return;
    }
    const spec = specialties.find((s) => s.id === form.specialty);
    const payload: CurriculumInput = {
      title: form.title.trim(),
      specialty: form.specialty || null,
      specialtyTitle: spec?.title ?? null,
      specialtyCode: form.specialtyCode.trim() || spec?.code || null,
      program: form.program,
      educationForm: form.educationForm,
      approvedYear: form.approvedYear ? Number(form.approvedYear) : null,
      academicYear: form.academicYear || null,
      note: form.note.trim() || null,
      processFile: form.processFile,
      planFile: form.planFile,
    };
    if (form.studyPeriod) payload.studyPeriod = Number(form.studyPeriod);

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
      <PageTitle>O‘quv reja</PageTitle>

      <FilterBar>
        <Select
          value={fSpecialty}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setFSpecialty(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Mutaxassislik — barchasi' },
            ...specialties.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />

        <Select
          value={fAcademicYear}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setFAcademicYear(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'O‘quv yili — barchasi' },
            ...withCurrent(academicYears, fAcademicYear).map((y) => ({
              value: y.id,
              label: y.title,
            })),
          ]}
        />

        {canWrite && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={openAdd}>
              <MdAdd /> O‘quv reja qo‘shish
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
              <Th>Mutaxassislik</Th>
              <Th style={{ width: 130 }}>Tasdiqlangan yili</Th>
              <Th style={{ width: 110 }}>O‘quv yili</Th>
              <Th style={{ width: 130 }}>Yuklangan sana</Th>
              <Th style={{ width: 120 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {paged.map((c, i) => (
              <Tr key={c.id}>
                <Td>{(currentPage - 1) * pageSize + i + 1}</Td>
                <Td>
                  <TruncCell text={c.title} />
                </Td>
                <Td>
                  <TruncCell text={c.specialtyTitle ?? ''} />
                </Td>
                <Td>{c.approvedYear ?? <MutedCell>—</MutedCell>}</Td>
                <Td>{c.academicYear || <MutedCell>—</MutedCell>}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.uploadedAt)}</Td>
                <Td>
                  <RowActions>
                    <Btn
                      $variant="ghost"
                      $size="sm"
                      title="Ko‘rish"
                      onClick={() => navigate(`/residency/oquv-reja/${c.id}`)}
                    >
                      <MdVisibility />
                    </Btn>
                    {canWrite && (
                      <>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="Tahrirlash"
                          onClick={() => openEdit(c)}
                        >
                          <MdEdit />
                        </Btn>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="O‘chirish"
                          onClick={() => setToDelete(c)}
                        >
                          <MdDelete />
                        </Btn>
                      </>
                    )}
                  </RowActions>
                </Td>
              </Tr>
            ))}
            {!isLoading && paged.length === 0 && (
              <Tr>
                <Td colSpan={7} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  <MdSearch /> Ma’lumot topilmadi
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <PagerBar>
        <PageSizeGroup>
          <PageSizeLabel>Qatorlar soni:</PageSizeLabel>
          {PAGE_SIZES.map((s) => (
            <PageBtn
              key={s}
              $active={pageSize === s}
              onClick={() => {
                setPageSize(s);
                setPage(1);
              }}
            >
              {s}
            </PageBtn>
          ))}
        </PageSizeGroup>

        <Pager
          page={currentPage}
          totalPages={totalPages}
          onPage={setPage}
          arrows="icons"
          hideWhenSingle={false}
        />
      </PagerBar>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'O‘quv rejani tahrirlash' : 'O‘quv reja qo‘shish'}
        width="560px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Nomi *</Label>
            <Input
              value={form.title}
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="O‘quv reja nomini kiriting"
            />
          </FormGroup>

          <Grid2>
            <FormGroup>
              <Label>Mutaxassislik</Label>
              <Select
                value={form.specialty}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => pickSpecialty(value)}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...specialties.map((s) => ({ value: s.id, label: s.title })),
                ]}
              />
            </FormGroup>
            <FormGroup>
              <Label>Mutaxassislik kodi</Label>
              <Input
                value={form.specialtyCode}
                style={{ width: '100%' }}
                onChange={(e) => setForm((f) => ({ ...f, specialtyCode: e.target.value }))}
                placeholder="Masalan: 5A510101"
              />
            </FormGroup>
          </Grid2>

          <FormGroup>
            <Label>Akademik daraja</Label>
            <Select<CurriculumProgram>
              value={form.program}
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, program: value }))}
              options={PROGRAMS.map((p) => ({ value: p, label: PROGRAM_LABEL[p] }))}
            />
          </FormGroup>

          <Grid2>
            <FormGroup>
              <Label>Ta’lim shakli</Label>
              <Select<EducationForm>
                value={form.educationForm}
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, educationForm: value }))}
                options={educationForms.map((ef) => ({ value: ef.value, label: ef.title }))}
              />
            </FormGroup>
            <FormGroup>
              <Label>O‘qish muddati</Label>
              <Select
                value={form.studyPeriod}
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, studyPeriod: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...STUDY_PERIODS.map((p) => ({ value: p, label: `${p} yil` })),
                ]}
              />
            </FormGroup>
          </Grid2>

          <Grid2>
            <FormGroup>
              <Label>Tasdiqlangan yil</Label>
              <NumberField
                style={{ width: '100%' }}
                value={form.approvedYear === '' ? null : Number(form.approvedYear)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, approvedYear: v === null ? '' : String(v) }))
                }
                placeholder="Masalan: 2025"
              />
            </FormGroup>
            <FormGroup>
              <Label>O‘quv yili</Label>
              <Select
                value={form.academicYear}
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, academicYear: value }))}
                options={[
                  { value: '', label: 'Tanlang' },
                  ...withCurrent(academicYears, form.academicYear).map((y) => ({
                    value: y.id,
                    label: y.title,
                  })),
                ]}
              />
            </FormGroup>
          </Grid2>

          <FormGroup>
            <Label>O‘quv jarayoni (fayl)</Label>
            <FileUpload
              key={`process_${editing?.id ?? 'new'}`}
              onChange={(file) => setForm((f) => ({ ...f, processFile: file }))}
            />
          </FormGroup>

          <FormGroup>
            <Label>O‘quv rejasi (fayl)</Label>
            <FileUpload
              key={`plan_${editing?.id ?? 'new'}`}
              onChange={(file) => setForm((f) => ({ ...f, planFile: file }))}
            />
          </FormGroup>

          <FormGroup>
            <Label>Izoh</Label>
            <Textarea
              value={form.note}
              rows={3}
              onChange={(value) => setForm((f) => ({ ...f, note: value }))}
              placeholder="Izoh kiriting..."
            />
          </FormGroup>
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

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="420px"
      >
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{toDelete?.title}</b> o‘quv rejasini o‘chirmoqchimisiz?
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
