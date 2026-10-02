import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  MdArrowBack,
  MdEdit,
  MdCheck,
  MdClose,
  MdDescription,
  MdFileDownload,
} from '../icons';
import { App, Input, Select, Textarea } from '@/shared/ui';
import {
  PageTitle,
  Tabs,
  Tab,
  Btn,
  FormGroup,
  Label,
} from '../components/common/FormElements';
import { NumberField } from '../components/common/NumberField';
import {
  academicYearValue,
  useAcademicYears,
  withCurrent,
  useEducationForms,
} from '../api/reference-api';
import FileUpload from '../components/common/FileUpload';
import {
  useCurriculum,
  useUpdateCurriculum,
} from '../api/curriculum-api';
import type { CurriculumInput } from '../api/curriculum-api';
import {
  PROGRAM_LABEL,
  formatFileSize,
  formatDate,
} from '../api/curriculum-types';
import type {
  Curriculum,
  CurriculumFile,
  CurriculumProgram,
  EducationForm,
} from '../api/curriculum-types';
import { useSpecialties } from '../api/residency-api';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';

const STUDY_PERIODS = ['2', '3'];
const PROGRAMS: CurriculumProgram[] = ['magistratura', 'ordinatura'];

type TabKey = 'info' | 'process' | 'plan';
type FileField = 'processFile' | 'planFile';

interface EditForm {
  title: string;
  specialty: string;
  specialtyCode: string;
  program: CurriculumProgram;
  educationForm: EducationForm;
  studyPeriod: string;
  approvedYear: string;
  academicYear: string;
  note: string;
}

const EMPTY: EditForm = {
  title: '',
  specialty: '',
  specialtyCode: '',
  program: 'magistratura',
  educationForm: 'kunduzgi',
  studyPeriod: '',
  approvedYear: '',
  academicYear: '',
  note: '',
};

const toEditForm = (c: Curriculum): EditForm => ({
  title: c.title,
  specialty: c.specialtyId ?? '',
  specialtyCode: c.specialtyCode ?? '',
  program: c.program,
  educationForm: c.educationForm,
  studyPeriod: c.studyPeriod ? String(c.studyPeriod) : '',
  approvedYear: c.approvedYear ? String(c.approvedYear) : '',
  academicYear: academicYearValue(c),
  note: c.note ?? '',
});

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  padding: 20px;
`;

const CardTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  align-items: start;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const InfoLabel = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const InfoValue = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
`;

const NoteText = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.6;
  margin: 0;
`;

const NoteEmpty = styled.span`
  font-size: 13px;
  font-style: italic;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FileCard = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bg};
`;

const FileIconWrap = styled.div`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.infoLight};
  color: ${({ theme }) => theme.colors.info};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileMeta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const DownloadLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme }) => theme.colors.successBorder};
  background: ${({ theme }) => theme.colors.successLight};
  color: ${({ theme }) => theme.colors.success};
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  &:hover {
    color: ${({ theme }) => theme.colors.primaryDark};
  }
`;

const EmptyBox = styled.div`
  padding: 30px;
  text-align: center;
  border: 1.5px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
`;

const EmptyIcon = styled.div`
  color: ${({ theme }) => theme.colors.textLight};
  margin-bottom: 8px;
`;

const UploadArea = styled.div`
  max-width: 360px;
  margin: 14px auto 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export default function OquvRejaDetail() {
  const { message } = App.useApp();

  const { data: educationForms = [] } = useEducationForms();

  const { data: academicYears = [] } = useAcademicYears();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = usePermission();
  const canWrite = can('residencyCurriculum:update');

  const { data: item, isLoading } = useCurriculum(id);
  const { data: specialties = [] } = useSpecialties();
  const updateM = useUpdateCurriculum();

  const [tab, setTab] = useState<TabKey>('info');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY);
  const [processPick, setProcessPick] = useState<File | null>(null);
  const [planPick, setPlanPick] = useState<File | null>(null);

  const backToList = () => navigate('/residency/oquv-reja');

  const startEdit = () => {
    if (!item) return;
    setForm(toEditForm(item));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(EMPTY);
  };

  const pickSpecialty = (specialtyId: string) => {
    const s = specialties.find((x) => x.id === specialtyId);
    setForm((f) => ({ ...f, specialty: specialtyId, specialtyCode: s?.code ?? '' }));
  };

  const saveEdit = async () => {
    if (!id) return;
    if (!form.title.trim()) {
      message.warning('O‘quv reja nomini kiriting');
      return;
    }
    const spec = specialties.find((s) => s.id === form.specialty);
    const data: Partial<CurriculumInput> = {
      title: form.title.trim(),
      specialty: form.specialty || null,
      specialtyTitle: spec?.title ?? null,
      specialtyCode: form.specialtyCode.trim() || spec?.code || null,
      program: form.program,
      educationForm: form.educationForm,
      approvedYear: form.approvedYear ? Number(form.approvedYear) : null,
      academicYear: form.academicYear || null,
      note: form.note.trim() || null,
    };
    if (form.studyPeriod) data.studyPeriod = Number(form.studyPeriod);

    try {
      await updateM.mutateAsync({ id, data });
      message.success('Yangilandi');
      setEditing(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const uploadFile = async (field: FileField, file: File | null) => {
    if (!id || !file) return;
    const data: Partial<CurriculumInput> =
      field === 'processFile' ? { processFile: file } : { planFile: file };
    try {
      await updateM.mutateAsync({ id, data });
      message.success('Fayl yuklandi');
      if (field === 'processFile') setProcessPick(null);
      else setPlanPick(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Fayl yuklashda xatolik'));
    }
  };

  if (isLoading) {
    return <div style={{ padding: 24 }}>Yuklanmoqda…</div>;
  }

  if (!item) {
    return (
      <div>
        <Btn $variant="ghost" $size="sm" onClick={backToList} style={{ marginBottom: 12 }}>
          <MdArrowBack /> O‘quv reja
        </Btn>
        <EmptyBox>O‘quv reja topilmadi</EmptyBox>
      </div>
    );
  }

  const renderFileTab = (
    file: CurriculumFile | null,
    field: FileField,
    pick: File | null,
    setPick: (f: File | null) => void,
    cardTitle: string,
    emptyText: string,
  ) => (
    <Card>
      <CardTitle>{cardTitle}</CardTitle>
      {file ? (
        <FileCard>
          <FileIconWrap>
            <MdDescription size={22} />
          </FileIconWrap>
          <FileInfo>
            <FileName>{file.name || cardTitle}</FileName>
            <FileMeta>
              {formatFileSize(file.size)} · Yuklangan: {formatDate(file.uploadedAt)}
            </FileMeta>
          </FileInfo>
          <DownloadLink href={file.url} target="_blank" rel="noreferrer" download>
            <MdFileDownload size={14} /> Yuklab olish
          </DownloadLink>
        </FileCard>
      ) : (
        <EmptyBox>
          <EmptyIcon>
            <MdDescription size={38} />
          </EmptyIcon>
          <div>{emptyText}</div>
          {canWrite && (
            <UploadArea>
              <FileUpload accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={setPick} />
              {pick && (
                <Btn
                  $variant="primary"
                  $size="sm"
                  onClick={() => uploadFile(field, pick)}
                  disabled={updateM.isPending}
                >
                  <MdCheck /> Yuklash
                </Btn>
              )}
            </UploadArea>
          )}
        </EmptyBox>
      )}
    </Card>
  );

  return (
    <div>
      <Btn $variant="ghost" $size="sm" onClick={backToList} style={{ marginBottom: 12 }}>
        <MdArrowBack /> O‘quv reja
      </Btn>

      <TopBar>
        <PageTitle style={{ marginBottom: 0 }}>{item.title}</PageTitle>
        {canWrite &&
          tab === 'info' &&
          (editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn $variant="ghost" onClick={cancelEdit}>
                <MdClose /> Bekor qilish
              </Btn>
              <Btn $variant="primary" onClick={saveEdit} disabled={updateM.isPending}>
                <MdCheck /> Saqlash
              </Btn>
            </div>
          ) : (
            <Btn $variant="primary" onClick={startEdit}>
              <MdEdit /> Tahrirlash
            </Btn>
          ))}
      </TopBar>

      <Tabs>
        <Tab $active={tab === 'info'} onClick={() => setTab('info')}>
          Dastlabki ma’lumotlar
        </Tab>
        <Tab
          $active={tab === 'process'}
          onClick={() => {
            setTab('process');
            if (editing) cancelEdit();
          }}
        >
          O‘quv jarayoni
        </Tab>
        <Tab
          $active={tab === 'plan'}
          onClick={() => {
            setTab('plan');
            if (editing) cancelEdit();
          }}
        >
          O‘quv rejasi
        </Tab>
      </Tabs>

      {tab === 'info' &&
        (editing ? (
          <Card>
            <FormGroup>
              <Label>Nomi *</Label>
              <Input
                value={form.title}
                style={{ width: '100%' }}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
              <Label>Izoh</Label>
              <Textarea
                value={form.note}
                rows={3}
                onChange={(value) => setForm((f) => ({ ...f, note: value }))}
                placeholder="Izoh kiriting..."
              />
            </FormGroup>
          </Card>
        ) : (
          <TwoCol>
            <Card>
              <CardTitle>Asosiy ma’lumotlar</CardTitle>
              <InfoGrid>
                <InfoItem>
                  <InfoLabel>Nomi</InfoLabel>
                  <InfoValue>{item.title}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Mutaxassislik</InfoLabel>
                  <InfoValue>{item.specialtyTitle || '—'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Mutaxassislik kodi</InfoLabel>
                  <InfoValue>{item.specialtyCode || '—'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Akademik daraja</InfoLabel>
                  <InfoValue>{PROGRAM_LABEL[item.program]}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Ta’lim shakli</InfoLabel>
                  <InfoValue>
                      {educationForms.find((ef) => ef.value === item.educationForm)
                        ?.title ?? item.educationForm ?? '—'}
                    </InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>O‘qish muddati</InfoLabel>
                  <InfoValue>{item.studyPeriod ? `${item.studyPeriod} yil` : '—'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Tasdiqlangan yil</InfoLabel>
                  <InfoValue>{item.approvedYear ?? '—'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>O‘quv yili</InfoLabel>
                  <InfoValue>{item.academicYear || '—'}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Yuklangan sana</InfoLabel>
                  <InfoValue>{formatDate(item.uploadedAt)}</InfoValue>
                </InfoItem>
              </InfoGrid>
            </Card>

            <Card>
              <CardTitle>Izoh</CardTitle>
              {item.note ? (
                <NoteText>{item.note}</NoteText>
              ) : (
                <NoteEmpty>Izoh kiritilmagan</NoteEmpty>
              )}
            </Card>
          </TwoCol>
        ))}

      {tab === 'process' &&
        renderFileTab(
          item.processFile,
          'processFile',
          processPick,
          setProcessPick,
          'O‘quv jarayoni fayli',
          'O‘quv jarayoni fayli yuklanmagan',
        )}

      {tab === 'plan' &&
        renderFileTab(
          item.planFile,
          'planFile',
          planPick,
          setPlanPick,
          'O‘quv rejasi fayli',
          'O‘quv rejasi fayli yuklanmagan',
        )}
    </div>
  );
}
