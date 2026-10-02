import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { getApiErrorMessage } from '@/shared/api';
import {
  Input,
  Select,
  JshshirInput,
  PhoneInput,
  PassportSeria,
  PassportNumber,
  phoneToStored,
} from '@/shared/ui';
import Button from '../../components/common/Button';
import { CardWrap } from '../../components/common/Card';
import { FormGroup, Label } from '../../components/common/FormElements';
import { AsyncSelect } from '../../components/common/AsyncSelect';
import { useToast } from '../../components/common/Toast';
import {
  useStudent, useCreateStudent, useUpdateStudent,
  useFaculties, useDirections, useGroups, useDepartments, useAdvisorUsers, useTalabaUsers,
  useAcademicYears,
  useCourses,
} from '../../api/gifted-api';
import type { StudentRecord } from '../../data/types';
import { MdArrowBack, MdSchool, MdPerson, MdLibraryBooks, MdGroups } from '../../icons';
import { DEFAULT_ACADEMIC_YEAR , resolveDefaultYear } from '../../lib/academic-years';
import { courseNumbers } from '../../lib/courses';


const withValue = (list: string[], val: string): string[] =>
  val && !list.includes(val) ? [...list, val] : list;

const RefHint = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: var(--brand-error, #F04438);
`;

interface FormState {
  name: string;
  workplace: string;
  lastName: string;
  firstName: string;
  middleName: string;
  passportSeria: string;
  passportNumber: string;
  jshshir: string;
  email: string;
  phone: string;
  faculty: string;
  direction: string;
  course: string;
  group: string;
  academicYear: string;
  advisorId: string;
  userId: string;
}

const EMPTY_FORM: FormState = {
  name: '', lastName: '', firstName: '', middleName: '',
  passportSeria: '', passportNumber: '', jshshir: '', email: '', phone: '', workplace: '',
  faculty: '', direction: '', course: '', group: '', academicYear: DEFAULT_ACADEMIC_YEAR,
  advisorId: '', userId: '',
};

export default function StudentForm() {
  const { data: courseRows = [] } = useCourses();
  const courses = courseNumbers(courseRows);

  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = Boolean(id);

  const { data: academicYearRows = [] } = useAcademicYears();
  const academicYears = academicYearRows.map((y) => y.title);

  const yearInit = useRef(false);
  useEffect(() => {
    if (yearInit.current || isEdit || !academicYears.length) return;
    yearInit.current = true;
    const resolved = resolveDefaultYear(academicYears);
    if (resolved !== DEFAULT_ACADEMIC_YEAR) setForm(f => ({ ...f, academicYear: resolved }));
  }, [academicYears, isEdit]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [notFound, setNotFound] = useState(false);
  const [advFacultyFilter, setAdvFacultyFilter] = useState('');
  const [advKafedraFilter, setAdvKafedraFilter] = useState('');
  const { data: editingStudent, isError } = useStudent(isEdit ? id : undefined);
  const { data: faculties = [] } = useFaculties();
  const { data: directions = [] } = useDirections();
  const { data: groups = [] } = useGroups();
  const { data: departments = [] } = useDepartments();
  const [advisorSearch, setAdvisorSearch] = useState('');
  const [talabaSearch, setTalabaSearch] = useState('');
  const { data: advisors = [], isFetching: advisorsLoading } = useAdvisorUsers(true);
  const { data: talabaUsers = [], isFetching: talabaLoading } = useTalabaUsers(true);
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const saving = createStudent.isPending || updateStudent.isPending;

  useEffect(() => {
    if (!isEdit) return;
    if (isError) { setNotFound(true); return; }
    const s = editingStudent;
    if (!s) return;
    setForm({
      name: s.name,
      lastName: '',
      firstName: '',
      middleName: '',
      passportSeria: s.passport?.series || '',
      passportNumber: s.passport?.number || '',
      jshshir: s.jshshir || '',
      email: s.email || '',
      phone: phoneToStored(s.phone),
      workplace: s.workplace || '',
      faculty: s.faculty,
      direction: s.direction,
      course: String(s.course),
      group: s.group,
      academicYear: s.academicYear || DEFAULT_ACADEMIC_YEAR,
      advisorId: s.advisorId || '',
      userId: s.userId || '',
    });
  }, [id, isEdit, editingStudent, isError]);

  useEffect(() => {
    if (notFound) {
      toast("Talaba topilmadi", 'error');
      navigate('/gifted-students/department/students', { replace: true });
    }
  }, [notFound, navigate, toast]);

  const setF = (key: keyof FormState, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const passportEmpty = !form.passportSeria && !form.passportNumber;
  const passportValid =
    passportEmpty ||
    (/^[A-Z]{2}$/.test(form.passportSeria) && /^[0-9]{7}$/.test(form.passportNumber));

  const handleFacultyChange = (val: string) => {
    setForm(prev => ({ ...prev, faculty: val, direction: '', group: '' }));
  };
  const handleDirectionChange = (val: string) => {
    setForm(prev => ({ ...prev, direction: val, group: '' }));
  };
  const handleCourseChange = (val: string) => {
    setForm(prev => ({ ...prev, course: val, group: '' }));
  };

  const facultyOptions = withValue(faculties.map(f => f.title), form.faculty);

  const dirTitlesForFaculty = directions
    .filter(d => d.facultyTitle === form.faculty)
    .map(d => d.title);
  const directionOptions = withValue(dirTitlesForFaculty, form.direction);

  const selectedCourseId =
    courseRows.find((c) => String(c.number) === String(form.course))?.id ?? '';

  const availableGroups = (() => {
    const base = groups
      .filter(g => {
        const courseOk = !form.course
          ? true
          : selectedCourseId
            ? g.courseId === selectedCourseId
            : g.course === Number(form.course);
        const dirOk = form.direction
          ? g.directionTitle === form.direction
          : dirTitlesForFaculty.includes(g.directionTitle);
        return courseOk && dirOk;
      })
      .map(g => g.title);
    return withValue([...new Set(base)].sort(), form.group);
  })();

  const selectedAdvisor = advisors.find(a => a.id === form.advisorId);
  const advisorMissing = Boolean(form.advisorId) && !selectedAdvisor;
  const legacyAdvisorName = advisorMissing ? (editingStudent?.advisorName || '') : '';

  const advFacultyOptions = [...new Set(departments.map(d => d.facultyTitle).filter(Boolean))].sort();
  const kafedraOptions = departments
    .filter(d => !advFacultyFilter || d.facultyTitle === advFacultyFilter)
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));
  const advSearchLc = advisorSearch.trim().toLowerCase();
  const filteredAdvisors = (advKafedraFilter
    ? advisors.filter(a => a.departmentId === advKafedraFilter)
    : advisors
  ).filter(a => !advSearchLc || a.name.toLowerCase().includes(advSearchLc));

  const nameOk = isEdit
    ? Boolean(form.name.trim())
    : Boolean(form.lastName.trim() && form.firstName.trim());
  const isValid = Boolean(nameOk && form.faculty && form.course && form.group) && passportValid;

  const handleSave = () => {
    if (!isValid) return;

    const advisorName =
      advisors.find(a => a.id === form.advisorId)?.name ??
      (form.advisorId ? (editingStudent?.advisorName ?? '') : '');
    const facultyId = faculties.find(f => f.title === form.faculty)?.id;
    const directionId = directions.find(
      d => d.title === form.direction && (!form.faculty || d.facultyTitle === form.faculty),
    )?.id;
    const groupId = groups.find(
      g => g.title === form.group && (!form.direction || g.directionTitle === form.direction),
    )?.id;
    const payload: Partial<StudentRecord> = {
      name: isEdit
        ? form.name.trim()
        : [form.lastName, form.firstName, form.middleName]
            .map((v) => v.trim())
            .filter(Boolean)
            .join(' '),
      ...(isEdit
        ? {}
        : {
            lastName: form.lastName.trim(),
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim(),
          }),
      passport: { series: form.passportSeria, number: form.passportNumber },
      jshshir: form.jshshir,
      email: form.email,
      phone: form.phone,
      workplace: form.workplace.trim(),
      faculty: form.faculty,
      direction: form.direction,
      course: Number(form.course),
      group: form.group,
      facultyId,
      directionId,
      groupId,
      academicYear: form.academicYear,
      advisorId: form.advisorId || '',
      advisorName,
      userId: form.userId || undefined,
    };

    const onError = (err: unknown) =>
      toast(getApiErrorMessage(err, 'Saqlashda xatolik'), 'error');

    if (isEdit && id) {
      updateStudent.mutate({ id, data: payload }, {
        onSuccess: () => {
          toast("Talaba ma'lumotlari yangilandi!", 'success');
          navigate('/gifted-students/department/students');
        },
        onError,
      });
    } else {
      createStudent.mutate(payload, {
        onSuccess: () => {
          toast("Talaba muvaffaqiyatli qo'shildi!", 'success');
          navigate('/gifted-students/department/students');
        },
        onError,
      });
    }
  };

  return (
    <Container>
      <BackBar>
        <BackBtn onClick={() => navigate('/gifted-students/department/students')}>
          <MdArrowBack /> Talabalar ro'yxatiga qaytish
        </BackBtn>
      </BackBar>

      <Section>
        <SectionHead>
          <SectionIcon $bg="var(--brand-primary-soft)" $color="var(--brand-primary)"><MdPerson /></SectionIcon>
          <div>
            <SectionTitle>Shaxsiy ma'lumotlar</SectionTitle>
            <SectionDesc>Talabaning shaxsiy va hujjat ma'lumotlari</SectionDesc>
          </div>
        </SectionHead>

        {isEdit ? (
          <FormGroup>
            <Label>FISh (to'liq ism) *</Label>
            <Input
              value={form.name}
              maxLength={300}
              showCount
              style={{ width: '100%' }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF('name', e.target.value)}
              placeholder="Familiya Ism Sharif"
            />
          </FormGroup>
        ) : (
          <ThreeCol>
            <FormGroup>
              <Label>Familiya *</Label>
              <Input
                value={form.lastName}
                style={{ width: '100%' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF('lastName', e.target.value)}
                placeholder="Aliyev"
              />
            </FormGroup>
            <FormGroup>
              <Label>Ism *</Label>
              <Input
                value={form.firstName}
                style={{ width: '100%' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF('firstName', e.target.value)}
                placeholder="Sardor"
              />
            </FormGroup>
            <FormGroup>
              <Label>Otasining ismi</Label>
              <Input
                value={form.middleName}
                style={{ width: '100%' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF('middleName', e.target.value)}
                placeholder="Botir o'g'li"
              />
            </FormGroup>
          </ThreeCol>
        )}

        <FormGroup>
          <Label>Talaba akkaunti (OneID) — odatda shart emas</Label>
          <AsyncSelect
            value={form.userId}
            onChange={(userId) => setF('userId', userId)}
            options={talabaUsers
              .filter(
                u =>
                  !talabaSearch.trim() ||
                  u.name.toLowerCase().includes(talabaSearch.trim().toLowerCase()),
              )
              .map(u => ({ value: u.id, label: u.name }))}
            onSearch={setTalabaSearch}
            loading={talabaLoading}
            placeholder="Akkaunt biriktirilmagan"
            searchPlaceholder="F.I.Sh bo'yicha qidiring"
            fallbackLabel="Biriktirilgan akkaunt"
          />
          <FieldHint>
            Bo'sh qoldiring — saqlashda akkaunt <b>JSHSHIR bo'yicha</b> o'zi
            topiladi yoki ochiladi (talaba o'sha 14 xonali raqam bilan kiradi).
            Faqat mavjud, boshqa raqamga ro'yxatdan o'tgan akkauntni bog'lash
            kerak bo'lsa shu yerdan tanlang.
          </FieldHint>
        </FormGroup>

        <Grid2>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Pasport seriyasi va raqami</Label>
            <PassportRow>
              <PassportSeria
                value={form.passportSeria}
                onChange={(value) => setF('passportSeria', value)}
                status={passportValid ? '' : 'error'}
                style={{ flexShrink: 0 }}
              />
              <PassportNumber
                value={form.passportNumber}
                onChange={(value) => setF('passportNumber', value)}
                status={passportValid ? '' : 'error'}
                style={{ flex: 1 }}
              />
            </PassportRow>
            {!passportValid && (
              <FieldHint $error>2 ta harf + 7 ta raqam (masalan: AB1234567)</FieldHint>
            )}
          </FormGroup>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>JSHSHIR</Label>
            <JshshirInput
              value={form.jshshir}
              style={{ width: '100%' }}
              onChange={(value) => setF('jshshir', value)}
              placeholder="14 xonali raqam"
            />
          </FormGroup>
        </Grid2>

        <Grid2 style={{ marginTop: 16 }}>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Elektron pochta</Label>
            <Input
              type="email"
              value={form.email}
              style={{ width: '100%' }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF('email', e.target.value)}
              placeholder="example@mail.com"
            />
          </FormGroup>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Telefon raqami</Label>
            <PhoneInput
              value={form.phone}
              style={{ width: '100%' }}
              onChange={(value) => setF('phone', value)}
            />
          </FormGroup>

          <FormGroup>
            <Label>Ish joyi</Label>
            <Input
              value={form.workplace}
              style={{ width: '100%' }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF('workplace', e.target.value)}
              placeholder="Ishlaydigan bo'lsa — tashkilot nomi"
            />
          </FormGroup>
        </Grid2>
      </Section>

      <Section>
        <SectionHead>
          <SectionIcon $bg="#EBF5FB" $color="#3498DB"><MdLibraryBooks /></SectionIcon>
          <div>
            <SectionTitle>Ta'lim ma'lumotlari</SectionTitle>
            <SectionDesc>Fakultet, yo'nalish, kurs va guruh</SectionDesc>
          </div>
        </SectionHead>

        <Grid2>
          <FormGroup>
            <Label>Fakultet *</Label>
            <Select
              value={form.faculty}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value: string) => handleFacultyChange(value)}
              options={[
                { value: '', label: 'Fakultetni tanlang' },
                ...facultyOptions.map(f => ({ value: f, label: f })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>Yo'nalish</Label>
            <Select
              value={form.direction}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value: string) => handleDirectionChange(value)}
              disabled={!form.faculty}
              options={[
                {
                  value: '',
                  label: !form.faculty
                    ? 'Avval fakultetni tanlang'
                    : directionOptions.length === 0
                      ? "Bu fakultetda yo'nalish yo'q"
                      : "Yo'nalishni tanlang",
                },
                ...directionOptions.map(d => ({ value: d, label: d })),
              ]}
            />
          </FormGroup>
        </Grid2>

        <Grid3>
          <FormGroup>
            <Label>Kurs *</Label>
            <Select
              value={form.course}
              style={{ width: '100%' }}
              onChange={(value: string) => handleCourseChange(value)}
              options={[
                { value: '', label: 'Kurs' },
                ...withValue(courses.map(String), form.course).map(c => ({
                  value: c,
                  label: `${c}-kurs`,
                })),
              ]}
            />
            {!courses.length && <RefHint>Kurslar ma'lumotnomasi o'qilmadi</RefHint>}
          </FormGroup>
          <FormGroup>
            <Label>Guruh *</Label>
            <Select
              value={form.group}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value: string) => setF('group', value)}
              disabled={!form.faculty || !form.course}
              options={[
                {
                  value: '',
                  label: !form.faculty || !form.course
                    ? "Avval fakultet va kursni tanlang"
                    : availableGroups.length === 0
                      ? "Bu kurs uchun guruh yo'q"
                      : "Guruhni tanlang",
                },
                ...availableGroups.map(g => ({ value: g, label: g })),
              ]}
            />
          </FormGroup>
          <FormGroup>
            <Label>O'quv yili *</Label>
            <Select
              value={form.academicYear}
              style={{ width: '100%' }}
              onChange={(value: string) => setF('academicYear', value)}
              options={withValue(academicYears, form.academicYear).map(y => ({
                value: y,
                label: y,
              }))}
            />
            {!academicYears.length && <RefHint>O'quv yillari ma'lumotnomasi o'qilmadi</RefHint>}
          </FormGroup>
        </Grid3>
      </Section>

      <Section>
        <SectionHead>
          <SectionIcon $bg="#FEF9E7" $color="#F39C12"><MdGroups /></SectionIcon>
          <div>
            <SectionTitle>Maslahatchi-ustoz biriktirish</SectionTitle>
            <SectionDesc>Talabaga ilmiy rahbar (advisor) tayinlash</SectionDesc>
          </div>
        </SectionHead>

        <Grid2>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Fakultet bo'yicha filtr (ixtiyoriy)</Label>
            <Select
              value={advFacultyFilter}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value: string) => {
                setAdvFacultyFilter(value);
                setAdvKafedraFilter('');
              }}
              options={[
                { value: '', label: 'Barcha fakultetlar' },
                ...advFacultyOptions.map(f => ({ value: f, label: f })),
              ]}
            />
          </FormGroup>
          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Kafedra bo'yicha filtr (ixtiyoriy)</Label>
            <Select
              value={advKafedraFilter}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value: string) => setAdvKafedraFilter(value)}
              disabled={kafedraOptions.length === 0}
              options={[
                { value: '', label: 'Barcha kafedralar' },
                ...kafedraOptions.map(d => ({ value: d.id, label: d.title })),
              ]}
            />
          </FormGroup>
        </Grid2>

        <FormGroup style={{ marginTop: 16, marginBottom: 0 }}>
          <Label>Maslahatchi (o'qituvchi)</Label>
          <AsyncSelect
            value={form.advisorId}
            onChange={(advisorId) => setF('advisorId', advisorId)}
            options={filteredAdvisors.map(a => ({ value: a.id, label: `${a.name} (${a.roleTitle})` }))}
            onSearch={setAdvisorSearch}
            loading={advisorsLoading}
            placeholder="Maslahatchi tanlang"
            searchPlaceholder="F.I.Sh bo'yicha qidiring"
            knownOption={
              form.advisorId
                ? { value: form.advisorId, label: selectedAdvisor?.name ?? editingStudent?.advisorName ?? '' }
                : null
            }
            fallbackLabel="Biriktirilgan maslahatchi"
          />
          <FieldHint>
            {advKafedraFilter
              ? "Filtr bo'yicha ro'yxat — tozalasangiz barcha o'qituvchilar ko'rinadi."
              : "Ixtiyoriy: fakultet/kafedra bo'yicha ro'yxatni toraytiring, yoki F.I.Sh bo'yicha qidiring."}
          </FieldHint>
        </FormGroup>

        {(selectedAdvisor || advisorMissing) && (
          <AdvisorPreview>
            <MdSchool style={{ color: 'var(--brand-primary)', fontSize: 20, flexShrink: 0 }} />
            <div>
              <AdvisorPreviewName>
                {selectedAdvisor
                  ? `${selectedAdvisor.degree ? selectedAdvisor.degree + ' ' : ''}${selectedAdvisor.name}`
                  : (legacyAdvisorName || 'Biriktirilgan maslahatchi')}
              </AdvisorPreviewName>
              <AdvisorPreviewMeta>
                {selectedAdvisor ? `Maslahatchi · ${selectedAdvisor.roleTitle}` : 'Biriktirilgan maslahatchi'}
              </AdvisorPreviewMeta>
            </div>
          </AdvisorPreview>
        )}
      </Section>

      <Footer>
        <Button variant="secondary" onClick={() => navigate('/gifted-students/department/students')}>
          Bekor qilish
        </Button>
        <Button onClick={handleSave} disabled={saving || !isValid}>
          {saving ? 'Saqlanmoqda…' : (isEdit ? 'Saqlash' : "Qo'shish")}
        </Button>
      </Footer>
    </Container>
  );
}

const Container = styled.div`
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const BackBar = styled.div`
  display: flex;
  align-items: center;
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.primary};
  }
  svg { font-size: 18px; }
`;

const Section = styled(CardWrap)`
  padding: 22px 24px;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const SectionIcon = styled.div<{ $bg: string; $color: string }>`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
`;

const SectionTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.3;
`;

const SectionDesc = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
`;

const ThreeCol = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const PassportRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
`;

const FieldHint = styled.span<{ $error?: boolean }>`
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: ${({ $error }) => $error ? '#EF4444' : '#94A3B8'};
`;

const Grid3 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
`;

const AdvisorPreview = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  background: ${({ theme }) => theme.colors.primaryLight};
  border: 1px solid ${({ theme }) => theme.colors.successBorder};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const AdvisorPreviewName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const AdvisorPreviewMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 0;
`;
