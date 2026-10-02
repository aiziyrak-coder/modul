import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import Button from '../../components/common/Button';
import { FormGroup, Label } from '../../components/common/FormElements';
import { Input, Select, Textarea, DatePicker, Checkbox } from '@/shared/ui';
import { NumberField } from '../../components/common/NumberField';
import { useToast } from '../../components/common/Toast';
import { useScholarship, useCreateScholarship, useUpdateScholarship, useCriteria, useJudgeUsers, useAcademicYears, useCourses } from '../../api/gifted-api';
import { AsyncSelect } from '../../components/common/AsyncSelect';
import Loader from '../../components/common/Loader';
import {
  MdArrowBack, MdInfo, MdGroups, MdAssignment, MdAdd, MdClose, MdLock,
} from '../../icons';
import type { Scholarship, ScholarshipCriterion } from '../../data/types';
import { DEFAULT_ACADEMIC_YEAR , resolveDefaultYear } from '../../lib/academic-years';
import { courseChoices } from '../../lib/courses';
import {
  availableCriteria, findDuplicateCriteriaId, takenCriteriaIds,
} from '../../lib/criteria-picker';



interface RektorFormState {
  name: string;
  description: string;
  amount: string;
  minScore: string;
  deadline: string;
  allowedCourses: string[];
  academicYear: string;
}

interface CriterionFormEntry {
  criteriaId: string;
  categoryIds: string[];
  pointOverrides: Record<string, number | undefined>;
  typePointOverride: number | null;
}

const EMPTY_FORM: RektorFormState = {
  name: '', description: '', amount: '', minScore: '', deadline: '',
  allowedCourses: [], academicYear: DEFAULT_ACADEMIC_YEAR,
};

const isDeadlinePast = (deadline: string | undefined): boolean =>
  !!(deadline && new Date(deadline) < new Date());

export default function RektorYonalishForm() {
  const navigate = useNavigate();
  const { data: courseRows = [] } = useCourses();
  const courseOptions = courseChoices(courseRows);

  const { id } = useParams();
  const { toast } = useToast();

  const isEdit = !!id;
  const { data: existing, isLoading } = useScholarship(isEdit ? id : undefined);
  const { data: criteriaList = [] } = useCriteria();
  const { data: academicYearRows = [] } = useAcademicYears();
  const academicYears = academicYearRows.map((y) => y.title);

  const yearInit = useRef(false);
  useEffect(() => {
    if (yearInit.current || isEdit || !academicYears.length) return;
    yearInit.current = true;
    const resolved = resolveDefaultYear(academicYears);
    if (resolved !== DEFAULT_ACADEMIC_YEAR) setForm(f => ({ ...f, academicYear: resolved }));
  }, [academicYears, isEdit]);

  const [judgeSearch, setJudgeSearch] = useState('');
  const { data: judgeUsers = [], isFetching: judgesLoading } = useJudgeUsers(true);
  const createSch = useCreateScholarship();
  const updateSch = useUpdateScholarship();
  const saving = createSch.isPending || updateSch.isPending;

  const locked = isEdit && isDeadlinePast(existing?.deadline);

  const [form, setForm] = useState<RektorFormState>(EMPTY_FORM);

  const detailPath = `/gifted-students/department/scholarships/rektor/${id}?year=${encodeURIComponent(form.academicYear)}`;

  const [criteriaForm, setCriteriaForm] = useState<CriterionFormEntry[]>([]);
  const [judgeIds, setJudgeIds] = useState<string[]>([]);
  const [judgeNames, setJudgeNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (judgeUsers.length === 0) return;
    setJudgeNames(prev => {
      let changed = false;
      const next = { ...prev };
      for (const j of judgeUsers) {
        if (next[j.id] !== j.name) {
          next[j.id] = j.name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [judgeUsers]);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      description: existing.description || '',
      amount: existing.amount,
      minScore: String(existing.minScore ?? ''),
      deadline: existing.deadline,
      allowedCourses: [...(existing.allowedCourses || [])],
      academicYear: existing.academicYear || DEFAULT_ACADEMIC_YEAR,
    });
    setCriteriaForm(
      existing.criteria?.map(c => ({
        criteriaId: c.criteriaId,
        categoryIds: [...(c.categoryIds || [])],
        pointOverrides: { ...(c.pointOverrides || {}) },
        typePointOverride: c.typePointOverride ?? null,
      })) || []
    );
    setJudgeIds([...(existing.judges || [])]);
  }, [existing]);

  if (isEdit && isLoading) return <Loader text="Yuklanmoqda..." />;

  if (isEdit && !isLoading && (!existing || existing.type !== 'rektor'))
    return <Navigate to="/gifted-students/department/scholarships/rektor" replace />;

  const setF = (key: keyof RektorFormState, val: string | string[]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const toggleCourse = (val: string) => {
    setForm(prev => ({
      ...prev,
      allowedCourses: prev.allowedCourses.includes(val)
        ? prev.allowedCourses.filter(c => c !== val)
        : [...prev.allowedCourses, val],
    }));
  };

  const addCriterion = () => {
    setCriteriaForm(prev => [
      ...prev,
      { criteriaId: '', categoryIds: [], pointOverrides: {}, typePointOverride: null },
    ]);
  };

  const updateCriteriaId = (i: number, criteriaId: string) => {
    setCriteriaForm(prev => prev.map((c, idx) =>
      idx === i
        ? { criteriaId, categoryIds: [], pointOverrides: {}, typePointOverride: null }
        : c
    ));
  };

  const toggleCategory = (i: number, categoryId: string) => {
    setCriteriaForm(prev => prev.map((c, idx) => {
      if (idx !== i) return c;
      const has = c.categoryIds.includes(categoryId);
      return {
        ...c,
        categoryIds: has
          ? c.categoryIds.filter(cid => cid !== categoryId)
          : [...c.categoryIds, categoryId],
      };
    }));
  };

  const updatePointOverride = (i: number, catId: string, val: string) => {
    setCriteriaForm(prev => prev.map((c, idx) => {
      if (idx !== i) return c;
      return {
        ...c,
        pointOverrides: { ...c.pointOverrides, [catId]: val === '' ? undefined : Number(val) },
      };
    }));
  };

  const updateTypePointOverride = (i: number, val: string) => {
    setCriteriaForm(prev => prev.map((c, idx) =>
      idx === i
        ? { ...c, typePointOverride: val === '' ? null : Number(val) }
        : c
    ));
  };

  const removeCriterion = (i: number) => {
    setCriteriaForm(prev => prev.filter((_, idx) => idx !== i));
  };

  const toggleJudge = (jid: string) =>
    setJudgeIds(prev => (prev.includes(jid) ? prev.filter(x => x !== jid) : [...prev, jid]));

  const taken = takenCriteriaIds(criteriaForm);

  const isValid = !!(
    form.name.trim() &&
    form.amount.trim() &&
    form.deadline &&
    form.allowedCourses.length > 0
  );

  const handleSave = () => {
    if (!isValid || locked) return;
    const duplicateId = findDuplicateCriteriaId(criteriaForm);
    if (duplicateId) {
      const name = criteriaList.find(x => x.id === duplicateId)?.name ?? 'Faoliyat';
      toast(`"${name}" ikki marta qo'shilgan — bittasini o'chiring`, 'error');
      return;
    }

    const criteria: ScholarshipCriterion[] = criteriaForm
      .filter(c => c.criteriaId)
      .map(c => {
        const entry: ScholarshipCriterion = {
          criteriaId: c.criteriaId,
          categoryIds: [...c.categoryIds],
        };
        const overrides: Record<string, number> = Object.fromEntries(
          Object.entries(c.pointOverrides || {}).filter(
            (pair): pair is [string, number] => pair[1] !== undefined
          )
        );
        if (Object.keys(overrides).length > 0) entry.pointOverrides = overrides;
        if (c.typePointOverride != null) entry.typePointOverride = c.typePointOverride;
        return entry;
      });

    const name = form.name.trim();
    const payload: Partial<Scholarship> = {
      name,
      description: form.description.trim(),
      type: 'rektor',
      minScore: Number(form.minScore) || 0,
      amount: form.amount.trim(),
      deadline: form.deadline,
      allowedCourses: [...form.allowedCourses],
      academicYear: form.academicYear,
      judges: judgeIds,
      criteria,
    };
    const fail = () => toast('Xatolik yuz berdi', 'error');
    if (isEdit) {
      updateSch.mutate({ id: id as string, data: payload }, {
        onSuccess: () => {
          toast(`"${name}" yo'nalishi yangilandi`, 'success');
          navigate(detailPath);
        },
        onError: fail,
      });
    } else {
      createSch.mutate({ ...payload, active: true }, {
        onSuccess: () => {
          toast(`"${name}" yo'nalishi qo'shildi`, 'success');
          navigate('/gifted-students/department/scholarships/rektor');
        },
        onError: fail,
      });
    }
  };

  return (
    <Container>
      <BackBar>
        <BackBtn onClick={() => isEdit
          ? navigate(detailPath)
          : navigate('/gifted-students/department/scholarships/rektor')
        }>
          <MdArrowBack /> {isEdit ? "Yo'nalishga qaytish" : "Rektor stipendiyasiga qaytish"}
        </BackBtn>
      </BackBar>

      {locked && (
        <LockedBanner>
          <MdLock />
          <div>
            <LockedTitle>Tahrirlash mumkin emas</LockedTitle>
            <LockedDesc>
              Ariza topshirish muddati (<b>{existing?.deadline}</b>) o'tib ketgan.
              Muddati o'tgan yo'nalishni tahrirlash taqiqlangan.
            </LockedDesc>
          </div>
        </LockedBanner>
      )}

      <Section $locked={locked}>
        <SectionHead>
          <SectionIcon $bg="#F5EEF8" $color="#9B59B6"><MdInfo /></SectionIcon>
          <div>
            <SectionTitle>Asosiy ma'lumotlar</SectionTitle>
            <SectionDesc>Yo'nalish nomi, tavsifi va asosiy parametrlari</SectionDesc>
          </div>
        </SectionHead>

        <NameYearRow>
          <FormGroup style={{ margin: 0 }}>
            <Label>Yo'nalish nomi *</Label>
            <Input
              value={form.name}
              style={{ width: '100%' }}
              onChange={e => setF('name', e.target.value)}
              placeholder="Masalan: Eng a'lochi talaba"
              disabled={locked}
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>O'quv yili</Label>
            <Select
              value={form.academicYear}
              style={{ width: '100%' }}
              onChange={value => setF('academicYear', value)}
              disabled={locked}
              options={academicYears.map(y => ({ value: y, label: y }))}
            />
          </FormGroup>
        </NameYearRow>

        <FormGroup>
          <Label>Tavsif</Label>
          <Textarea
            value={form.description}
            onChange={value => setF('description', value)}
            placeholder="Yo'nalish haqida qisqa ma'lumot"
            rows={3}
            disabled={locked}
          />
        </FormGroup>

        <Grid3>
          <FormGroup>
            <Label>Miqdor *</Label>
            <Input
              value={form.amount}
              style={{ width: '100%' }}
              onChange={e => setF('amount', e.target.value)}
              placeholder="2,000,000 so'm/oy"
              disabled={locked}
            />
          </FormGroup>
          <FormGroup>
            <Label>Min. ball</Label>
            <NumberField
              min={0}
              style={{ width: '100%' }}
              value={form.minScore === '' ? null : Number(form.minScore)}
              onChange={value => setF('minScore', value == null ? '' : String(value))}
              placeholder="60"
              disabled={locked}
            />
          </FormGroup>
          <FormGroup>
            <Label>Topshirish muddati *</Label>
            <DatePicker
              size="middle"
              value={form.deadline || null}
              onChange={value => setF('deadline', value ?? '')}
              disabled={locked}
            />
          </FormGroup>
        </Grid3>
      </Section>

      <Section $locked={locked}>
        <SectionHead>
          <SectionIcon $bg="#EBF5FB" $color="#3498DB"><MdGroups /></SectionIcon>
          <div>
            <SectionTitle>Kim ariza topshira oladi *</SectionTitle>
            <SectionDesc>Tanlangan kurslardagi talabalargina bu yo'nalishni ko'radi</SectionDesc>
          </div>
        </SectionHead>

        <CourseGrid>
          {courseOptions.map(c => (
            <Checkbox
              key={c.value}
              checked={form.allowedCourses.includes(c.value)}
              onChange={() => !locked && toggleCourse(c.value)}
            >
              {c.label}
            </Checkbox>
          ))}
        </CourseGrid>
      </Section>

      <Section $locked={locked}>
        <SectionHead>
          <SectionIcon $bg="#FEF9E7" $color="#F39C12"><MdAssignment /></SectionIcon>
          <div>
            <SectionTitle>Baholash mezonlari (faoliyatlar)</SectionTitle>
            <SectionDesc>
              Bu yo'nalish uchun talab qilinadigan faoliyatlar.
              Kategoriya tanlanmasa, faoliyat ichidagi har qanday kategoriya hisobga olinadi.
              Har bir kategoriyaning ballini o'zgartirish mumkin.
            </SectionDesc>
          </div>
        </SectionHead>

        {criteriaForm.length === 0 ? (
          <EmptyCriteria>Hozircha faoliyat qo'shilmagan</EmptyCriteria>
        ) : (
          <CriteriaList>
            {criteriaForm.map((c, i) => {
              const ct = criteriaList.find(x => x.id === c.criteriaId);
              const isSingleBall = ct && ct.ball != null && ct.categories.length === 0;
              return (
                <CriterionCard key={i}>
                  <CriterionHead>
                    <CriterionLabel>Faoliyat</CriterionLabel>
                    <Select
                      value={c.criteriaId}
                      showSearch
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      onChange={value => updateCriteriaId(i, value)}
                      disabled={locked}

                      options={[
                        { value: '', label: 'Faoliyat tanlang' },
                        ...availableCriteria(criteriaList, taken, c.criteriaId).map(opt => ({
                          value: opt.id,
                          label: `${opt.icon} ${opt.name}`,
                        })),
                      ]}
                    />
                    <RemoveBtn
                      type="button"
                      onClick={() => removeCriterion(i)}
                      title="O'chirish"
                      disabled={locked}
                    >
                      <MdClose />
                    </RemoveBtn>
                  </CriterionHead>

                  {ct && (
                    <CriterionBody>
                      {isSingleBall ? (
                        <SingleBallRow>
                          <SingleBallLabel>Maksimal ball:</SingleBallLabel>
                          <NumberField
                            size="small"
                            controls={false}
                            min={0}
                            max={200}
                            style={{ width: BALL_INPUT_WIDTH, flexShrink: 0 }}
                            value={c.typePointOverride ?? ct.ball}
                            onChange={value => updateTypePointOverride(i, value == null ? '' : String(value))}
                            disabled={locked}
                            onClick={e => e.stopPropagation()}
                          />
                          {c.typePointOverride != null && c.typePointOverride !== ct.ball && (
                            <OrigBall>asl: {ct.ball}</OrigBall>
                          )}
                        </SingleBallRow>
                      ) : (
                        <>
                          <CriterionLabel>
                            Kategoriyalar (bittasini yoki bir nechtasini tanlang)
                          </CriterionLabel>
                          <FaoliyatGrid>
                            {ct.categories.filter(cat => cat.active).map(cat => {
                              const checked = c.categoryIds.includes(cat.id);
                              const overrideVal = c.pointOverrides[cat.id];
                              const displayVal = overrideVal !== undefined ? overrideVal : cat.points;
                              return (
                                <FaoliyatRow key={cat.id}>
                                  <Checkbox
                                    checked={checked}
                                    onChange={() => !locked && toggleCategory(i, cat.id)}
                                  >
                                    {cat.name}
                                  </Checkbox>
                                  <BallInputWrap>
                                    <NumberField
                                      size="small"
                                      controls={false}
                                      min={0}
                                      max={200}
                                      style={{ width: BALL_INPUT_WIDTH, flexShrink: 0 }}
                                      value={displayVal}
                                      disabled={locked}
                                      onClick={e => e.stopPropagation()}
                                      onChange={value => updatePointOverride(i, cat.id, value == null ? '' : String(value))}
                                    />
                                    {overrideVal !== undefined && overrideVal !== cat.points && (
                                      <OrigBall>asl: {cat.points}</OrigBall>
                                    )}
                                  </BallInputWrap>
                                </FaoliyatRow>
                              );
                            })}
                          </FaoliyatGrid>
                          {c.categoryIds.length === 0 && (
                            <AllNote><MdInfo /> Hech narsa tanlanmadi — har qanday kategoriya hisobga olinadi</AllNote>
                          )}
                        </>
                      )}
                    </CriterionBody>
                  )}
                </CriterionCard>
              );
            })}
          </CriteriaList>
        )}

        {!locked && (
          <Button variant="outline" size="md" onClick={addCriterion} style={{ marginTop: 12 }}>
            <MdAdd /> Faoliyat qo'shish
          </Button>
        )}
      </Section>

      <Section $locked={locked}>
        <SectionHead>
          <SectionIcon $bg="#EBF5FB" $color="#3498DB"><MdGroups /></SectionIcon>
          <div>
            <SectionTitle>Hakamlar</SectionTitle>
            <SectionDesc>
              Bu yo'nalish arizalarini baholaydigan hakamlar. Har bir hakam mustaqil ball qo'yadi;
              yakuniy natija o'rtacha ball bo'yicha hisoblanadi.
            </SectionDesc>
          </div>
        </SectionHead>

        {!locked && (
          <FormGroup style={{ marginBottom: judgeIds.length ? 12 : 0 }}>
            <Label>Hakam qidirish va qo'shish</Label>
            <AsyncSelect
              value=""
              onChange={(jid, opt) => {
                if (!jid || judgeIds.includes(jid)) return;
                setJudgeIds(prev => [...prev, jid]);
                if (opt) setJudgeNames(prev => ({ ...prev, [jid]: opt.label }));
              }}
              options={judgeUsers
                .filter(j => !judgeIds.includes(j.id))
                .filter(
                  j =>
                    !judgeSearch.trim() ||
                    j.name.toLowerCase().includes(judgeSearch.trim().toLowerCase()),
                )
                .map(j => ({ value: j.id, label: j.name }))}
              onSearch={setJudgeSearch}
              loading={judgesLoading}
              placeholder="Hakamni qidiring va tanlang"
              searchPlaceholder="F.I.Sh bo'yicha qidiring"
              allowClear={false}
            />
          </FormGroup>
        )}

        {judgeIds.length === 0 ? (
          <EmptyCriteria>Hozircha hakam tanlanmagan</EmptyCriteria>
        ) : (
          <CourseGrid>
            {judgeIds.map(jid => (
              <CourseChip
                key={jid}
                type="button"
                $active
                $locked={locked}
                onClick={() => !locked && toggleJudge(jid)}
                title={locked ? undefined : "Olib tashlash uchun bosing"}
              >
                <CheckBox $checked>✓</CheckBox>
                {judgeNames[jid] ?? "Noma'lum hakam"}
                {!locked && <MdClose style={{ marginLeft: 'auto', flexShrink: 0 }} />}
              </CourseChip>
            ))}
          </CourseGrid>
        )}
      </Section>

      <Footer>
        <Button variant="secondary" onClick={() => isEdit
          ? navigate(detailPath)
          : navigate('/gifted-students/department/scholarships/rektor')
        }>
          {locked ? 'Orqaga' : 'Bekor qilish'}
        </Button>
        {!locked && (
          <Button onClick={handleSave} disabled={saving || !isValid}>
            {saving ? 'Saqlanmoqda…' : (isEdit ? 'Yangilash' : 'Saqlash')}
          </Button>
        )}
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

const BackBar = styled.div`display: flex; align-items: center;`;

const BackBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 13px; font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: all 0.15s;
  &:hover { background: ${({ theme }) => theme.colors.bg}; color: ${({ theme }) => theme.colors.primary}; }
  svg { font-size: 18px; }
`;

const LockedBanner = styled.div`
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 18px;
  background: #FEF2F2; border: 1.5px solid #FECACA;
  border-radius: ${({ theme }) => theme.radius.md};
  color: #991B1B;
  svg { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
`;

const LockedTitle = styled.div`font-size: 14px; font-weight: 700; margin-bottom: 3px;`;
const LockedDesc = styled.div`font-size: 13px; line-height: 1.5; color: #7F1D1D; b { color: #991B1B; }`;

const Section = styled(CardWrap)<{ $locked: boolean }>`
  padding: 22px 24px;
  opacity: ${({ $locked }) => $locked ? 0.75 : 1};
  pointer-events: ${({ $locked }) => $locked ? 'none' : 'auto'};
`;

const SectionHead = styled.div`
  display: flex; align-items: flex-start; gap: 12px;
  padding-bottom: 14px; margin-bottom: 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const SectionIcon = styled.div<{ $bg: string; $color: string }>`
  width: 38px; height: 38px; border-radius: 10px;
  background: ${({ $bg }) => $bg}; color: ${({ $color }) => $color};
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0; svg { font-size: 20px; }
`;

const SectionTitle = styled.h3`font-size: 15px; font-weight: 700; color: ${({ theme }) => theme.colors.text}; line-height: 1.3;`;
const SectionDesc = styled.p`font-size: 12px; color: ${({ theme }) => theme.colors.textMuted}; margin-top: 3px; line-height: 1.5;`;

const NameYearRow = styled.div`display: grid; grid-template-columns: 3fr 1fr; gap: 14px; margin-bottom: 16px;`;

const Grid3 = styled.div`display: grid; grid-template-columns: 2fr 1fr 1.4fr; gap: 14px;`;

const CourseGrid = styled.div`display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;`;

const CourseChip = styled.button<{ $active: boolean; $locked: boolean }>`
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px;
  border: 1.5px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ $active, theme }) => $active ? theme.colors.primaryLight : 'white'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.text};
  font-size: 13px; font-weight: 500; text-align: left;
  cursor: ${({ $locked }) => $locked ? 'default' : 'pointer'};
  transition: all 0.15s;
  &:hover { border-color: ${({ $locked, theme }) => $locked ? 'inherit' : theme.colors.primary}; }
`;

const CheckBox = styled.span<{ $checked: boolean }>`
  width: 18px; height: 18px; border-radius: 4px;
  border: 1.5px solid ${({ $checked, theme }) => $checked ? theme.colors.primary : theme.colors.borderDark};
  background: ${({ $checked, theme }) => $checked ? theme.colors.primary : 'white'};
  color: white;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
`;

const CriteriaList = styled.div`display: flex; flex-direction: column; gap: 12px;`;

const CriterionCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 14px;
  background: ${({ theme }) => theme.colors.bg};
`;

const CriterionHead = styled.div`
  display: grid; grid-template-columns: auto 1fr 32px;
  align-items: center; gap: 10px; margin-bottom: 12px;
`;

const CriterionLabel = styled.div`
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const CriterionBody = styled.div`display: flex; flex-direction: column; gap: 8px;`;

const SingleBallRow = styled.div`
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const SingleBallLabel = styled.span`
  font-size: 12px; font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FaoliyatGrid = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`;

const FaoliyatRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  min-width: 0;
  padding: 9px 12px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: white;

  > label { flex: 1; min-width: 0; }
  > label > span:last-child {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
`;

const BallInputWrap = styled.div`
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
`;

const BALL_INPUT_WIDTH = 64;

const OrigBall = styled.span`
  font-size: 10px; color: #9CA3AF; white-space: nowrap;
`;

const AllNote = styled.div`
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; color: ${({ theme }) => theme.colors.info};
  background: ${({ theme }) => theme.colors.infoLight};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 6px 10px; width: fit-content;
  svg { font-size: 14px; }
`;

const RemoveBtn = styled.button`
  width: 32px; height: 32px;
  border-radius: ${({ theme }) => theme.radius.sm};
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: ${({ theme }) => theme.colors.danger};
  background: ${({ theme }) => theme.colors.dangerLight};
  &:hover { opacity: 0.7; }
  &:disabled { opacity: 0.3; cursor: default; }
`;

const EmptyCriteria = styled.p`
  padding: 18px; text-align: center; font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const Footer = styled.div`
  display: flex; justify-content: flex-end; gap: 10px; padding: 10px 0 24px;
`;
