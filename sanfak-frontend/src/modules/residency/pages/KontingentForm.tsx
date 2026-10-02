import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  academicYearValue,
  useAcademicYears,
  withCurrent,
  useCourses,
} from '../api/reference-api';
import { MdArrowBack } from '../icons';
import {
  PageTitle,
  SectionTitle,
  FormGroup,
  Label,
  Btn,
} from '../components/common/FormElements';
import { AsyncSelect } from '../components/common/AsyncSelect';
import { NumberField } from '../components/common/NumberField';
import { formatCoordPair, parseCoordPair } from '../lib/coord-pair';
import {
  App,
  Input,
  Select,
  DatePicker,
  Checkbox,
  JshshirInput,
  PhoneInput,
  PassportSeria,
  PassportNumber,
} from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import { duplicateReasonText } from '../lib/duplicate-reason';
import {
  useResident,
  useCreateResident,
  useUpdateResident,
  useSpecialties,
  useDepartments,
  useGroups,
  useTalabaUsers,
  type OnboardResidentResult,
} from '../api/residency-api';
import type { Program, Resident } from '../api/types';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;
const Panel = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 20px 22px;
`;
const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
`;

const WarnPanel = styled.div`
  margin: 12px 0 0;
  padding: 12px 14px;
  border: 1px solid var(--brand-warning, #f0c000);
  border-radius: var(--radius-md, 8px);
  background: #fffbe6;
`;
const WarnTitle = styled.div`
  font-weight: 600;
  margin-bottom: 6px;
`;
const WarnList = styled.ul`
  margin: 0;
  padding-left: 18px;
  line-height: 1.6;
`;

const CoordNote = styled.div<{ $error?: boolean }>`
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textMuted};
  ${({ $error, theme }) => ($error ? `color: ${theme.colors.danger}; font-weight: 500;` : '')}
`;

const collectWarnings = (r: OnboardResidentResult | null): string[] => r?.warnings ?? [];

type FormState = {
  fullName: string;
  lastName: string;
  firstName: string;
  middleName: string;
  jshshir: string;
  passportSeria: string;
  passportNumber: string;
  address: string;
  workplace: string;
  workplaceLat: number | null;
  workplaceLng: number | null;
  email: string;
  phone: string;
  foreign: boolean;
  program: Program;
  fundingType: '' | 'byudjet' | 'shartnoma';
  studyPeriod: string;
  academicYear: string;
  courseNumber: string;
  admissionOrder: string;
  admissionDate: string;
  specialtyId: string;
  departmentId: string;
  groupId: string;
  diplomaSeria: string;
  diplomaNumber: string;
  diplomaDate: string;
  userId: string;
};

const splitFullName = (fullName: string): Pick<FormState, 'lastName' | 'firstName' | 'middleName'> => {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    lastName: parts[0] ?? '',
    firstName: parts[1] ?? '',
    middleName: parts.slice(2).join(' '),
  };
};

const EMPTY: FormState = {
  fullName: '', lastName: '', firstName: '', middleName: '',
  jshshir: '', passportSeria: '', passportNumber: '', address: '',
  workplace: '', workplaceLat: null, workplaceLng: null,
  email: '', phone: '', foreign: false, program: 'ordinatura',
  fundingType: '', studyPeriod: '', academicYear: '', courseNumber: '',
  admissionOrder: '', admissionDate: '', specialtyId: '', departmentId: '',
  groupId: '', diplomaSeria: '', diplomaNumber: '', diplomaDate: '', userId: '',
};

function toState(r: Resident): FormState {
  return {
    fullName: r.fullName,
    ...splitFullName(r.fullName),
    jshshir: r.jshshir ?? '', passportSeria: r.passportSeria ?? '',
    passportNumber: r.passportNumber ?? '', address: r.address ?? '', workplace: r.workplace ?? '',
    workplaceLat: r.workplaceLocation ? r.workplaceLocation.lat : null,
    workplaceLng: r.workplaceLocation ? r.workplaceLocation.lng : null,
    email: r.email ?? '', phone: r.phone ?? '', foreign: r.foreign, program: r.program,
    fundingType: r.fundingType ?? '', studyPeriod: r.studyPeriod?.toString() ?? '',
    academicYear: academicYearValue(r), courseNumber: r.courseNumber?.toString() ?? '',
    admissionOrder: r.admissionOrder ?? '', admissionDate: (r.admissionDate ?? '').slice(0, 10),
    specialtyId: r.specialtyId ?? '', departmentId: r.departmentId ?? '', groupId: r.groupId ?? '',
    diplomaSeria: r.diplomaSeria ?? '', diplomaNumber: r.diplomaNumber ?? '',
    diplomaDate: (r.diplomaDate ?? '').slice(0, 10), userId: r.userId ?? '',
  };
}

const STUDY_PERIOD_MIN = 1;
const STUDY_PERIOD_MAX = 10;

export default function KontingentForm() {
  const { message } = App.useApp();

  const { data: courses = [] } = useCourses();

  const { data: academicYears = [] } = useAcademicYears();

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const can = usePermission();
  const canSave = can(isEdit ? 'resident:update' : 'resident:create');

  const { data: existing } = useResident(id);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: specialties = [] } = useSpecialties(form.program);
  const { data: departments = [] } = useDepartments();
  const { data: groups = [] } = useGroups();
  const [coordPaste, setCoordPaste] = useState('');
  const [coordError, setCoordError] = useState<string | null>(null);
  const [talabaSearch, setTalabaSearch] = useState('');
  const { data: talabaUsers = [], isFetching: talabaLoading } = useTalabaUsers(true, talabaSearch);

  const [result, setResult] = useState<OnboardResidentResult | null>(null);

  const createM = useCreateResident();
  const updateM = useUpdateResident();

  useEffect(() => {
    if (!existing) return;
    const next = toState(existing);
    setForm(next);
    setCoordPaste(formatCoordPair(next.workplaceLat, next.workplaceLng));
    setCoordError(null);
  }, [existing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const applyCoordPaste = (text: string) => {
    setCoordPaste(text);
    const parsed = parseCoordPair(text);
    if (parsed.kind === 'error') {
      setCoordError(parsed.message);
      return;
    }
    setCoordError(null);
    if (parsed.kind === 'empty') {
      setForm((f) => ({ ...f, workplaceLat: null, workplaceLng: null }));
      return;
    }
    setForm((f) => ({ ...f, workplaceLat: parsed.value.lat, workplaceLng: parsed.value.lng }));
  };

  const setCoordNumber = (key: 'workplaceLat' | 'workplaceLng', value: number | null) => {
    setCoordError(null);
    setForm((f) => {
      const next = { ...f, [key]: value };
      setCoordPaste(formatCoordPair(next.workplaceLat, next.workplaceLng));
      return next;
    });
  };

  const save = async () => {
    if (!(form.lastName.trim() && form.firstName.trim())) {
      message.warning('Familiya va ismni kiriting');
      return;
    }
    if (form.lastName.trim().length + form.firstName.trim().length > 300) {
      message.warning('Familiya va ism jami 300 belgidan oshmasligi kerak');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      message.warning('E-pochta manzili noto‘g‘ri (masalan: ism@fjsti.uz)');
      return;
    }
    {
      const seria = form.passportSeria.trim();
      const number = form.passportNumber.trim();
      if (Boolean(seria) !== Boolean(number)) {
        message.warning(
          'Pasport seriyasi va raqami birga to‘ldirilishi kerak (yoki ikkalasi ham bo‘sh qoldirilsin)',
        );
        return;
      }
      if (seria && !/^[A-Z]{2}$/.test(seria)) {
        message.warning('Pasport seriyasi 2 ta katta lotin harfi bo‘lishi kerak (masalan: AB)');
        return;
      }
      if (number && !/^[0-9]{7}$/.test(number)) {
        message.warning('Pasport raqami 7 ta raqamdan iborat bo‘lishi kerak');
        return;
      }
    }

    const lat = form.workplaceLat;
    const lng = form.workplaceLng;
    let coords: { lat: number; lng: number } | null = null;
    if (lat !== null || lng !== null) {
      if (lat === null || lng === null) {
        message.warning('Kenglik va uzunlik — ikkalasini birga kiriting');
        return;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        message.warning('Koordinata son bo‘lishi kerak');
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        message.warning('Kenglik −90…90, uzunlik −180…180 orasida bo‘lishi kerak');
        return;
      }
      coords = { lat, lng };
    }

    let studyPeriod: number | null = null;
    if (form.studyPeriod !== '') {
      const n = Number(form.studyPeriod);
      if (!Number.isInteger(n) || n < STUDY_PERIOD_MIN || n > STUDY_PERIOD_MAX) {
        message.warning(
          `O‘qish muddati ${STUDY_PERIOD_MIN} va ${STUDY_PERIOD_MAX} yil orasida butun son bo‘lishi kerak`,
        );
        return;
      }
      studyPeriod = n;
    }

    const spec = specialties.find((s) => s.id === form.specialtyId);
    const dep = departments.find((d) => d.id === form.departmentId);
    const grp = groups.find((g) => g.id === form.groupId);

    const payload: Partial<Resident> = {
      program: form.program,
      fullName: [form.lastName, form.firstName, form.middleName]
        .map((v) => v.trim())
        .filter(Boolean)
        .join(' '),
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim(),
      jshshir: form.jshshir.trim() || null,
      passportSeria: form.passportSeria.trim() || null,
      passportNumber: form.passportNumber.trim() || null,
      address: form.address.trim() || null,
      workplace: form.workplace.trim() || null,
      workplaceLocation: coords,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      foreign: form.foreign,
      fundingType: form.fundingType || null,
      studyPeriod,
      academicYear: form.academicYear.trim() || null,
      courseNumber: form.courseNumber ? Number(form.courseNumber) : null,
      admissionOrder: form.admissionOrder.trim() || null,
      admissionDate: form.admissionDate || null,
      specialtyId: form.specialtyId || null,
      specialtyTitle: spec?.title ?? null,
      specialtyCode: spec?.code ?? null,
      departmentId: form.departmentId || null,
      departmentTitle: dep?.title ?? null,
      groupId: form.groupId || null,
      groupTitle: grp?.title ?? null,
      diplomaSeria: form.diplomaSeria.trim() || null,
      diplomaNumber: form.diplomaNumber.trim() || null,
      diplomaDate: form.diplomaDate || null,
      userId: form.userId || null,
    };

    setResult(null);
    try {
      const backToList = `/residency/kontingent?program=${form.program}`;

      if (isEdit && id) {
        const upd = await updateM.mutateAsync({ id, data: payload });
        message.success('Yangilandi');

        if ((upd?.warnings?.length ?? 0) > 0) {
          setResult({ resident: null, account: null, warnings: upd.warnings });
          return;
        }
        navigate(backToList);
        return;
      }

      const res = await createM.mutateAsync(payload);
      const status = res?.resident?.status;

      if (status === 'existing') {
        setResult(res);
        message.warning(`${duplicateReasonText(res?.resident?.matchedBy)} — yangi yozuv yaratilmadi`);
        return;
      }

      message.success(status === 'linked' ? 'Talaba akkauntga bog‘landi' : 'Talaba qo‘shildi');

      if (collectWarnings(res).length > 0) {
        setResult(res);
        return;
      }
      navigate(backToList);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik (JSHSHIR/pasport takrorlanmasligi kerak)'));
    }
  };

  return (
    <div>
      <Btn $variant="ghost" $size="sm" onClick={() => navigate('/residency/kontingent')} style={{ marginBottom: 12 }}>
        <MdArrowBack /> Kontingent
      </Btn>
      <PageTitle>{isEdit ? 'Talabani tahrirlash' : 'Yangi talaba'}</PageTitle>

      <Grid>
        <Panel>
          <SectionTitle>Shaxsiy ma’lumotlar</SectionTitle>
          <FormGroup>
            <Label>Familiya *</Label>
            <Input
              style={{ width: '100%' }}
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>Ism *</Label>
            <Input
              style={{ width: '100%' }}
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>Otasining ismi</Label>
            <Input
              style={{ width: '100%' }}
              value={form.middleName}
              onChange={(e) => set('middleName', e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>JSHSHIR</Label>
            <JshshirInput
              style={{ width: '100%' }}
              value={form.jshshir}
              onChange={(value) => set('jshshir', value)}
            />
          </FormGroup>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Pasport seriyasi</Label>
              <PassportSeria
                style={{ width: '100%' }}
                value={form.passportSeria}
                onChange={(value) => set('passportSeria', value)}
              />
            </FormGroup>
            <FormGroup style={{ flex: 2 }}>
              <Label>Pasport raqami</Label>
              <PassportNumber
                style={{ width: '100%' }}
                value={form.passportNumber}
                onChange={(value) => set('passportNumber', value)}
              />
            </FormGroup>
          </div>
          <FormGroup>
            <Label>Yashash manzili</Label>
            <Input
              style={{ width: '100%' }}
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>Ish joyi</Label>
            <Input
              style={{ width: '100%' }}
              value={form.workplace}
              onChange={(e) => set('workplace', e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>Ish joyi koordinatasi (Google Maps'dan nusxa)</Label>
            <Input
              style={{ width: '100%' }}
              placeholder="41.311081, 69.240562"
              value={coordPaste}
              onChange={(e) => applyCoordPaste(e.target.value)}
            />
            {coordError ? (
              <CoordNote $error>{coordError}</CoordNote>
            ) : (
              <CoordNote>
                Xaritadan nusxa olib shu yerga qo‘ying — kenglik va uzunlik
                o‘zi to‘ladi. Yoki quyidagi ikki maydonni qo‘lda to‘ldiring.
              </CoordNote>
            )}
          </FormGroup>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Ish joyi kengligi (lat)</Label>
              <NumberField
                style={{ width: '100%' }}
                value={form.workplaceLat}
                step={0.000001}
                placeholder="41.311081"
                onChange={(value) => setCoordNumber('workplaceLat', value as number | null)}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Ish joyi uzunligi (lng)</Label>
              <NumberField
                style={{ width: '100%' }}
                value={form.workplaceLng}
                step={0.000001}
                placeholder="69.240562"
                onChange={(value) => setCoordNumber('workplaceLng', value as number | null)}
              />
            </FormGroup>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Email</Label>
              <Input
                style={{ width: '100%' }}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Telefon</Label>
              <PhoneInput
                style={{ width: '100%' }}
                value={form.phone}
                onChange={(value) => set('phone', value)}
              />
            </FormGroup>
          </div>
          <FormGroup>
            <Checkbox checked={form.foreign} onChange={(checked) => set('foreign', checked)}>
              Chet el fuqarosi
            </Checkbox>
          </FormGroup>
          <FormGroup>
            <Label>Talaba akkaunti (OneID) — ixtiyoriy</Label>
            <AsyncSelect
              value={form.userId}
              onChange={(userId) => set('userId', userId)}
              options={talabaUsers.map((u) => ({ value: u.id, label: u.name }))}
              onSearch={setTalabaSearch}
              loading={talabaLoading}
              placeholder="Biriktirilmagan"
              searchPlaceholder="F.I.Sh bo'yicha qidiring"
              fallbackLabel="Biriktirilgan akkaunt"
            />
          </FormGroup>
        </Panel>

        <Panel>
          <SectionTitle>Ta’lim ma’lumotlari</SectionTitle>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Ta’lim yo‘nalishi</Label>
              <Select
                value={form.program}
                style={{ width: '100%' }}
                onChange={(value) => set('program', value as Program)}
                options={[
                  { value: 'ordinatura', label: 'Rezident (ordinatura)' },
                  { value: 'magistratura', label: 'Magistrant' },
                ]}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Ta’lim turi</Label>
              <Select
                value={form.fundingType}
                style={{ width: '100%' }}
                onChange={(value) => set('fundingType', value as FormState['fundingType'])}
                options={[
                  { value: '', label: '—' },
                  { value: 'byudjet', label: 'Byudjet' },
                  { value: 'shartnoma', label: 'Shartnoma' },
                ]}
              />
            </FormGroup>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>O‘quv yili</Label>
              <Select
                value={form.academicYear}
                style={{ width: '100%' }}
                onChange={(value) => set('academicYear', value)}
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
              <Label>
                O‘qish muddati (yil, {STUDY_PERIOD_MIN}–{STUDY_PERIOD_MAX})
              </Label>
              <NumberField
                style={{ width: '100%' }}
                value={form.studyPeriod === '' ? null : Number(form.studyPeriod)}
                onChange={(value) => set('studyPeriod', value === null ? '' : String(value))}
              />
            </FormGroup>
          </div>
          <FormGroup>
            <Label>Kafedra</Label>
            <Select
              value={form.departmentId}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => set('departmentId', value)}
              options={[
                { value: '', label: '—' },
                ...departments.map((d) => ({ value: d.id, label: d.title })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>Mutaxassislik</Label>
            <Select
              value={form.specialtyId}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => set('specialtyId', value)}
              options={[
                { value: '', label: '—' },
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
                onChange={(value) => set('courseNumber', value)}
                options={[
                  { value: '', label: '—' },
                  ...courses.map((c) => ({ value: String(c.number), label: c.title })),
                ]}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Guruh</Label>
              <Select
                value={form.groupId}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => set('groupId', value)}
                options={[
                  { value: '', label: '—' },
                  ...groups.map((g) => ({ value: g.id, label: g.title })),
                ]}
              />
            </FormGroup>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Qabul buyrug‘i №</Label>
              <Input
                style={{ width: '100%' }}
                value={form.admissionOrder}
                onChange={(e) => set('admissionOrder', e.target.value)}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Qabul sanasi</Label>
              <DatePicker
                value={form.admissionDate || null}
                onChange={(value) => set('admissionDate', value ?? '')}
              />
            </FormGroup>
          </div>

          <SectionTitle style={{ marginTop: 8 }}>Diplom</SectionTitle>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Seriya</Label>
              <Input
                style={{ width: '100%' }}
                value={form.diplomaSeria}
                onChange={(e) => set('diplomaSeria', e.target.value)}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Raqam</Label>
              <Input
                style={{ width: '100%' }}
                value={form.diplomaNumber}
                onChange={(e) => set('diplomaNumber', e.target.value)}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Sana</Label>
              <DatePicker
                value={form.diplomaDate || null}
                onChange={(value) => set('diplomaDate', value ?? '')}
              />
            </FormGroup>
          </div>
        </Panel>
      </Grid>

      {result && (
        <WarnPanel>
          <WarnTitle>
            {result.resident?.status === 'existing'
              ? `Yangi yozuv YARATILMADI — ${duplicateReasonText(result.resident.matchedBy).toLowerCase()}`
              : 'Saqlandi, lekin e’tibor bering'}
          </WarnTitle>
          <WarnList>
            {collectWarnings(result).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {result.resident?.status === 'existing' && collectWarnings(result).length === 0 && (
              <li>
                Mavjud yozuvni tahrirlash uchun kontingent ro‘yxatidan o‘sha talabani oching.
              </li>
            )}
          </WarnList>
        </WarnPanel>
      )}

      <Actions>
        <Btn $variant="ghost" onClick={() => navigate('/residency/kontingent')}>
          {result ? 'Ro‘yxatga qaytish' : 'Bekor qilish'}
        </Btn>
        {canSave && (
          <Btn $variant="primary" onClick={save} disabled={createM.isPending || updateM.isPending}>
            Saqlash
          </Btn>
        )}
      </Actions>
    </div>
  );
}
