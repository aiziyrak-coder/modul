import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import Button from '../../components/common/Button';
import { Input, Select, DatePicker, Textarea, Checkbox } from '@/shared/ui';
import { NumberField } from '../../components/common/NumberField';
import { FormGroup, Label } from '../../components/common/FormElements';
import { useToast } from '../../components/common/Toast';
import { useScholarship, useCreateScholarship, useUpdateScholarship, useAcademicYears, useCourses } from '../../api/gifted-api';
import Loader from '../../components/common/Loader';
import type { Scholarship } from '../../data/types';
import { MdArrowBack, MdSave } from '../../icons';
import { DEFAULT_ACADEMIC_YEAR , resolveDefaultYear } from '../../lib/academic-years';
import { courseChoices } from '../../lib/courses';



interface NomdorFormState {
  name: string;
  description: string;
  amount: string;
  minScore: string;
  deadline: string;
  academicYear: string;
  allowedCourses: string[];
}

const EMPTY_FORM: NomdorFormState = {
  name: '', description: '', amount: '', minScore: '', deadline: '',
  academicYear: DEFAULT_ACADEMIC_YEAR, allowedCourses: [],
};

export default function NomdorForm() {
  const navigate = useNavigate();
  const { data: courseRows = [] } = useCourses();
  const courseOptions = courseChoices(courseRows);

  const { id } = useParams();
  const { toast } = useToast();

  const isEdit = !!id;
  const { data: existing, isLoading } = useScholarship(isEdit ? id : undefined);
  const createSch = useCreateScholarship();
  const updateSch = useUpdateScholarship();
  const saving = createSch.isPending || updateSch.isPending;

  const { data: academicYearRows = [] } = useAcademicYears();
  const academicYears = academicYearRows.map((y) => y.title);

  const yearInit = useRef(false);
  useEffect(() => {
    if (yearInit.current || isEdit || !academicYears.length) return;
    yearInit.current = true;
    const resolved = resolveDefaultYear(academicYears);
    if (resolved !== DEFAULT_ACADEMIC_YEAR) setForm(f => ({ ...f, academicYear: resolved }));
  }, [academicYears, isEdit]);

  const [form, setForm] = useState<NomdorFormState>(EMPTY_FORM);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        description: existing.description || '',
        amount: existing.amount,
        minScore: String(existing.minScore ?? ''),
        deadline: existing.deadline || '',
        academicYear: existing.academicYear || DEFAULT_ACADEMIC_YEAR,
        allowedCourses: [...(existing.allowedCourses || [])],
      });
    }
  }, [existing]);

  if (isEdit && isLoading) return <Loader text="Yuklanmoqda..." />;

  if (isEdit && !isLoading && (!existing || existing.type !== 'nomdor'))
    return <Navigate to="/gifted-students/department/scholarships/nomdor" replace />;

  const setF = (key: keyof NomdorFormState, val: string | string[]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const toggleCourse = (val: string) => setForm(prev => ({
    ...prev,
    allowedCourses: prev.allowedCourses.includes(val)
      ? prev.allowedCourses.filter(c => c !== val)
      : [...prev.allowedCourses, val],
  }));

  const isValid = !!(form.name.trim() && form.amount.trim() && form.deadline);

  const handleSave = () => {
    if (!isValid) return;
    const name = form.name.trim();
    const payload: Partial<Scholarship> = {
      name,
      description: form.description.trim(),
      type: 'nomdor',
      minScore: Number(form.minScore) || 0,
      amount: form.amount.trim(),
      deadline: form.deadline,
      academicYear: form.academicYear,
      allowedCourses: [...form.allowedCourses],
    };
    const done = (msg: string) => {
      toast(msg, 'success');
      navigate('/gifted-students/department/scholarships/nomdor');
    };
    const fail = () => toast('Xatolik yuz berdi', 'error');
    if (isEdit) {
      updateSch.mutate({ id: id as string, data: payload }, { onSuccess: () => done(`"${name}" yangilandi`), onError: fail });
    } else {
      createSch.mutate({ ...payload, active: true }, { onSuccess: () => done(`"${name}" qo'shildi`), onError: fail });
    }
  };

  return (
    <Container>

      <BackBar>
        <BackBtn onClick={() => navigate('/gifted-students/department/scholarships/nomdor')}>
          <MdArrowBack /> Nomdor stipendiyalarga qaytish
        </BackBtn>
      </BackBar>

      <Section>
        <SectionTitle>Asosiy ma'lumotlar</SectionTitle>

        <FormGroup>
          <Label>Stipendiya nomi *</Label>
          <Input
            value={form.name}
            style={{ width: '100%' }}
            onChange={e => setF('name', e.target.value)}
            placeholder="Masalan: Prezident stipendiyasi"
          />
        </FormGroup>

        <FormGroup>
          <Label>Tavsif</Label>
          <Textarea
            value={form.description}
            onChange={value => setF('description', value)}
            placeholder="Stipendiya haqida qisqa ma'lumot"
            rows={3}
          />
        </FormGroup>

        <Grid4>
          <FormGroup style={{ margin: 0 }}>
            <Label>O'quv yili *</Label>
            <Select
              value={form.academicYear}
              style={{ width: '100%' }}
              onChange={value => setF('academicYear', value)}
              options={academicYears.map(y => ({ value: y, label: y }))}
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Miqdor *</Label>
            <Input
              value={form.amount}
              style={{ width: '100%' }}
              onChange={e => setF('amount', e.target.value)}
              placeholder="2,000,000 so'm/oy"
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Min. ball</Label>
            <NumberField
              value={form.minScore === '' ? null : Number(form.minScore)}
              onChange={value => setF('minScore', value === null ? '' : String(value))}
              placeholder="60"
              min={0}
              style={{ width: '100%' }}
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Topshirish muddati *</Label>
            <DatePicker
              size="middle"
              value={form.deadline || null}
              onChange={value => setF('deadline', value ?? '')}
            />
          </FormGroup>
        </Grid4>
      </Section>

      <Section>
        <SectionTitle>Kim ariza topshira oladi (kurslar)</SectionTitle>
        <SectionDesc>Tanlangan kurslardagi talabalargina bu stipendiyani ko'radi. Bo'sh qolsa — hamma kurs.</SectionDesc>
        <CourseGrid>
          {courseOptions.map(c => (
            <Checkbox
              key={c.value}
              checked={form.allowedCourses.includes(c.value)}
              onChange={() => toggleCourse(c.value)}
            >
              {c.label}
            </Checkbox>
          ))}
        </CourseGrid>
      </Section>

      <SaveBar>
        <Button variant="secondary" onClick={() => navigate('/gifted-students/department/scholarships/nomdor')}>
          Bekor qilish
        </Button>
        <Button onClick={handleSave} disabled={saving || !isValid}>
          <MdSave /> {saving ? 'Saqlanmoqda…' : (isEdit ? 'Saqlash' : "Qo'shish")}
        </Button>
      </SaveBar>

    </Container>
  );
}

const Container = styled.div`
  display: flex; flex-direction: column; gap: 20px; max-width: 760px;
`;

const BackBar = styled.div``;

const BackBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 13px; font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s;
  &:hover { background: white; color: ${({ theme }) => theme.colors.primary}; }
  svg { font-size: 18px; }
`;

const Section = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 24px;
  display: flex; flex-direction: column; gap: 16px;
`;

const SectionTitle = styled.h3`
  font-size: 14px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 4px;
`;

const SectionDesc = styled.p`
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
  margin-top: -8px;
`;

const Grid4 = styled.div`
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px;
  @media (max-width: 700px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 420px) { grid-template-columns: 1fr; }
`;

const CourseGrid = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px;
`;

const SaveBar = styled.div`
  display: flex; justify-content: flex-end; gap: 10px;
`;
