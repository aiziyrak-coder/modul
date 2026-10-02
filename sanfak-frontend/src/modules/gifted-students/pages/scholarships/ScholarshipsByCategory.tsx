import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { FormGroup, Label } from '../../components/common/FormElements';
import { Input, Select, Textarea, DatePicker, Switch, Checkbox } from '@/shared/ui';
import { NumberField } from '../../components/common/NumberField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { getApiErrorMessage } from '@/shared/api';
import {
  useScholarships, useCreateScholarship, useUpdateScholarship, useCriteria, useStudents,
  useApplications, useMyApplications, useApplyScholarship, useReviewApplication,
  useAcademicYears,
  useCourses,
} from '../../api/gifted-api';
import {
  MdStar, MdSchool, MdCalendarToday, MdPaid, MdTrendingUp,
  MdAdd, MdGroups, MdAssignment, MdEdit, MdArrowForward,
  MdInfoOutline, MdPerson, MdCheck, MdClose,
} from '../../icons';
import type { MockUser, Scholarship, ScholarshipApplication, ScholarshipCriterion } from '../../data/types';
import {
  academicYearOf,
  canonicalAcademicYear,
  DEFAULT_ACADEMIC_YEAR,
} from '../../lib/academic-years';
import { useYearFilter } from '../../lib/default-year';
import { pickVisibleApplication } from '../../lib/application-status';
import { courseChoices, courseLabel as courseLabelOf } from '../../lib/courses';


interface TypeMeta {
  label: string;
  desc: string;
  icon: ReactNode;
  color: string;
  bg: string;
}

const TYPE_META: Record<'nomdor' | 'rektor', TypeMeta> = {
  nomdor: {
    label: 'Nomdor stipendiyalar',
    desc: "Tarixiy shaxslar va davlat tashkilotlari nomidagi nufuzli stipendiyalar",
    icon: <MdStar />,
    color: '#F39C12',
    bg: '#FEF9E7',
  },
  rektor: {
    label: 'Rektor stipendiyasi',
    desc: "Institut rektori tomonidan iqtidorli talabalarga beriladigan maxsus mukofotlar",
    icon: <MdSchool />,
    color: '#9B59B6',
    bg: '#F5EEF8',
  },
};



const studentCourseValue = (user: MockUser | null): string => {
  if (!user) return '';
  if (typeof user.course === 'number') return String(user.course);
  return String(user.course || '');
};

type LegacyScholarshipCriterion = ScholarshipCriterion & { categoryId?: string };

interface ScholarshipFormState {
  name: string;
  description: string;
  amount: string;
  minScore: string;
  deadline: string;
  academicYear: string;
  allowedCourses: string[];
}

const EMPTY_FORM: ScholarshipFormState = {
  name: '', description: '', amount: '', minScore: '', deadline: '',
  academicYear: DEFAULT_ACADEMIC_YEAR, allowedCourses: [],
};

const APP_STATUS_LABELS: Record<string, string> = {
  pending: 'Kutmoqda',
  recommended: 'Tasdiqlangan',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
};

export default function ScholarshipsByCategory() {
  const { data: courseRows = [] } = useCourses();
  const courseOptions = courseChoices(courseRows);
  const courseLabel = (v: string): string => courseLabelOf(courseRows, v);

  const { type } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role;

  const { data: academicYearRows = [] } = useAcademicYears();
  const academicYears = academicYearRows.map((y) => y.title);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ScholarshipFormState>(EMPTY_FORM);
  const [editModal, setEditModal] = useState<Scholarship | null>(null);
  const [editForm, setEditForm] = useState<ScholarshipFormState>(EMPTY_FORM);
  const [appFilter, setAppFilter] = useState('all');
  const [approveModal, setApproveModal] = useState<ScholarshipApplication | null>(null);
  const [rejectModal, setRejectModal] = useState<ScholarshipApplication | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [noteModal, setNoteModal] = useState<string | null>(null);

  const scholarshipType = type === 'nomdor' || type === 'rektor' ? type : undefined;
  const { data: scholarships = [] } = useScholarships(scholarshipType);
  const { data: criteriaList = [] } = useCriteria();
  const { data: students = [] } = useStudents(role === 'department');
  const { data: allApplications = [] } = useApplications(role === 'department');
  const { data: myApplications = [] } = useMyApplications(role === 'student');
  const createSch = useCreateScholarship();
  const updateSch = useUpdateScholarship();
  const applyMut = useApplyScholarship();
  const reviewMut = useReviewApplication();
  const saving = createSch.isPending || updateSch.isPending;
  const reviewing = reviewMut.isPending;
  const applying = applyMut.isPending;

  const appYearOf = (a: ScholarshipApplication): string =>
    canonicalAcademicYear(a.academicYear) || academicYearOf(a.appliedAt);

  const appYears = [...allApplications, ...myApplications]
    .filter(a => scholarships.some(s => s.id === a.scholarshipId))
    .map(appYearOf);
  const [academicYear] = useYearFilter(appYears, DEFAULT_ACADEMIC_YEAR);
  const [appYearFilter, setAppYearFilter] = useYearFilter(appYears);

  const meta = type === 'nomdor' || type === 'rektor' ? TYPE_META[type] : undefined;
  if (!meta || (type !== 'nomdor' && type !== 'rektor')) return <Navigate to="/login" replace />;

  const isRektor = type === 'rektor';
  const isRektorDept = isRektor && role === 'department';
  const isRektorStudent = isRektor && role === 'student';
  const isNomdorDept = !isRektor && role === 'department';
  const isNomdorStudent = !isRektor && role === 'student';
  const itemNoun = isRektor ? "yo'nalish" : 'stipendiya';
  const addBtnLabel = isRektor ? "Yo'nalish qo'shish" : "Qo'shish";

  const getStudentApp = (schId: string): ScholarshipApplication | null =>
    pickVisibleApplication(myApplications.filter(a => a.scholarshipId === schId));

  const allOfType = scholarships;
  const items = role === 'student'
    ? allOfType.filter(s => {
        if (s.allowedCourses?.length && !s.allowedCourses.includes(studentCourseValue(user))) return false;
        return true;
      })
    : allOfType;

  const cardItems = role === 'student' ? items.filter((s) => s.active) : items;

  const allApps = role === 'department'
    ? allApplications.filter(a =>
        items.some(s => s.id === a.scholarshipId) &&
        (appYearFilter === 'all' || appYearOf(a) === appYearFilter)
      )
    : [];

  const getAppCount = (f: string): number => f === 'all'
    ? allApps.length
    : f === 'recommended'
      ? allApps.filter(a => a.status === 'recommended' || a.status === 'approved').length
      : allApps.filter(a => a.status === f).length;

  const studentApps = (isRektorStudent || isNomdorStudent)
    ? myApplications.filter(a => items.some(s => s.id === a.scholarshipId))
    : [];

  const filteredApps = appFilter === 'all'
    ? allApps
    : appFilter === 'recommended'
      ? allApps.filter(a => a.status === 'recommended' || a.status === 'approved')
      : allApps.filter(a => a.status === appFilter);

  const handleApply = (s: Scholarship) => {
    if (isRektorStudent || isNomdorStudent) {
      const existing = getStudentApp(s.id);
      if (existing && existing.status !== 'rejected') return;
      applyMut.mutate({
        scholarshipId: s.id,
        scholarshipType: s.type,
        scholarshipName: s.name,
        academicYear: s.academicYear || DEFAULT_ACADEMIC_YEAR,
      }, {
        onSuccess: () => toast(`"${s.name}" uchun ariza yuborildi!`, 'success'),

        onError: (err) => toast(getApiErrorMessage(err, 'Ariza yuborilmadi'), 'error'),
      });
      return;
    }
    toast(`"${s.name}" uchun ariza qabul qilindi (demo)`, 'success');
  };

  const handleToggleActive = (s: Scholarship) => {
    const next = !s.active;
    updateSch.mutate({ id: s.id, data: { active: next } }, {
      onSuccess: () => toast(`"${s.name}" — ${next ? "faol" : "nofaol"} holatga o'tkazildi`, 'info'),
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const handleApprove = (app: ScholarshipApplication) => {
    reviewMut.mutate({ id: app.id, status: 'recommended' }, {
      onSuccess: () => { setApproveModal(null); toast(`"${app.scholarshipName}" arizasi tasdiqlandi`, 'success'); },
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const handleReject = () => {
    if (!rejectNote.trim() || !rejectModal) return;
    reviewMut.mutate({ id: rejectModal.id, status: 'rejected', rejectReason: rejectNote.trim() }, {
      onSuccess: () => { setRejectModal(null); setRejectNote(''); toast('Ariza rad etildi', 'info'); },
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const setF = (key: keyof ScholarshipFormState, val: string | string[]) =>
    setForm(prev => ({ ...prev, [key]: val }));
  const setEF = (key: keyof ScholarshipFormState, val: string | string[]) =>
    setEditForm(prev => ({ ...prev, [key]: val }));

  const toggleCourse = (val: string) => {
    setForm(prev => ({
      ...prev,
      allowedCourses: prev.allowedCourses.includes(val)
        ? prev.allowedCourses.filter(c => c !== val)
        : [...prev.allowedCourses, val],
    }));
  };

  const toggleEditCourse = (val: string) => {
    setEditForm(prev => ({
      ...prev,
      allowedCourses: prev.allowedCourses.includes(val)
        ? prev.allowedCourses.filter(c => c !== val)
        : [...prev.allowedCourses, val],
    }));
  };

  const openNomdorEdit = (e: React.MouseEvent, s: Scholarship) => {
    e.stopPropagation();
    setEditForm({
      name: s.name,
      description: s.description || '',
      amount: s.amount,
      minScore: String(s.minScore ?? ''),
      deadline: s.deadline || '',
      academicYear: s.academicYear || DEFAULT_ACADEMIC_YEAR,
      allowedCourses: [...(s.allowedCourses || [])],
    });
    setEditModal(s);
  };

  const handleEditSave = () => {
    if (!editForm.name.trim() || !editForm.amount.trim() || !editForm.deadline || !editModal) return;
    const name = editForm.name.trim();
    updateSch.mutate({
      id: editModal.id,
      data: {
        name,
        description: editForm.description.trim(),
        minScore: Number(editForm.minScore) || 0,
        amount: editForm.amount.trim(),
        deadline: editForm.deadline,
        academicYear: editForm.academicYear,
        allowedCourses: [...editForm.allowedCourses],
      },
    }, {
      onSuccess: () => { setEditModal(null); toast(`"${name}" yangilandi`, 'success'); },
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const isEditValid = !!(editForm.name.trim() && editForm.amount.trim() && editForm.deadline);

  const openAdd = () => {
    if (isRektor) {
      navigate('/gifted-students/department/scholarships/rektor/new');
      return;
    }
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const isValid = !!(form.name.trim() && form.amount.trim() && form.deadline);

  const handleSubmit = () => {
    if (!isValid) return;
    const name = form.name.trim();
    createSch.mutate({
      name,
      description: form.description.trim(),
      type,
      minScore: Number(form.minScore) || 0,
      amount: form.amount.trim(),
      deadline: form.deadline,
      academicYear: form.academicYear,
      active: true,
      allowedCourses: [...form.allowedCourses],
    }, {
      onSuccess: () => { setShowModal(false); toast(`"${name}" qo'shildi`, 'success'); },
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  return (
    <>
      <Wrap>
        <Hero $bg={meta.bg} $color={meta.color}>
          <HeroIcon $color={meta.color}>{meta.icon}</HeroIcon>
          <HeroText>
            <HeroTitle>{meta.label}</HeroTitle>
            <HeroDesc>{meta.desc}</HeroDesc>
          </HeroText>
          <HeroRight>
            <HeroCount $color={meta.color}>{cardItems.length}</HeroCount>
            {role === 'department' && (
              <Button onClick={openAdd}>
                <MdAdd /> {addBtnLabel}
              </Button>
            )}
          </HeroRight>
        </Hero>

        {cardItems.length === 0 ? (
          <EmptyCard>
            <EmptyIcon>📭</EmptyIcon>
            <EmptyText>
              {role === 'student'
                ? `Sizning kursingiz uchun ${itemNoun} topilmadi`
                : `Bu kategoriyada hozircha ${itemNoun} yo'q`}
            </EmptyText>
            {role === 'department' && (
              <Button onClick={openAdd} style={{ marginTop: 8 }}>
                <MdAdd /> {isRektor ? "Yangi yo'nalish qo'shish" : "Yangi qo'shish"}
              </Button>
            )}
          </EmptyCard>
        ) : (
          <Grid $compact={isRektorDept || isRektorStudent}>
            {cardItems.map((s) => {
              const isExpired = !!(s.deadline && new Date(s.deadline) < new Date());
              const isCompact = isRektorDept || isRektorStudent;
              const myApp = (isRektorStudent || isNomdorStudent) ? getStudentApp(s.id) : null;

              const isApproved = myApp?.status === 'approved' || myApp?.status === 'recommended';
              const isRejected = myApp?.status === 'rejected';

              const schJudges = s.judges || [];
              const schApps = (isRektorDept || isRektorStudent)
                ? allApplications.filter(a => a.scholarshipId === s.id && a.status === 'recommended')
                : [];
              const isAllJudgesScored = schJudges.length > 0 && schApps.length > 0 &&
                schApps.every(app => schJudges.every(jId => app.judgeScores?.[jId] != null));

              const gateKnown = s.canApply != null;
              const eligible = gateKnown ? s.canApply === true : true;
              const studentFooterBtn = (isRektorStudent || isNomdorStudent)
                ? (!myApp || isRejected)
                  ? (
                    <ApplyBox>
                      <Button onClick={() => handleApply(s)} disabled={applying || !s.active || !eligible}>Ariza topshirish</Button>
                      {s.active && !eligible && s.canApplyReason && (
                        <BallHint>{s.canApplyReason}</BallHint>
                      )}
                    </ApplyBox>
                  )
                  : isApproved
                    ? (
                      <StatusChipBtn $approved>
                        Tasdiqlangan
                      </StatusChipBtn>
                    )
                    : <StatusChipBtn $pending>Ariza topshirilgan</StatusChipBtn>
                : null;

              return (
                <Item
                  key={s.id}
                  $clickable={isRektorDept || isNomdorDept}
                  onClick={isRektorDept
                    ? () => navigate(`/gifted-students/department/scholarships/rektor/${s.id}?year=${s.academicYear || academicYear}`)
                    : isNomdorDept
                      ? () => navigate(`/gifted-students/department/scholarships/nomdor/${s.id}`)
                      : undefined}
                >
                  {isRektorDept && !isExpired && !isAllJudgesScored && (
                    <EditIconBtn
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/gifted-students/department/scholarships/rektor/${s.id}/edit`);
                      }}
                      title="Tahrirlash"
                    >
                      <MdEdit />
                    </EditIconBtn>
                  )}

                  {isRektorStudent && (
                    <DetailIconBtn
                      onClick={() => navigate(`/gifted-students/student/scholarships/rektor/${s.id}?year=${s.academicYear || academicYear}`)}
                      title="Batafsil"
                    >
                      <MdArrowForward />
                    </DetailIconBtn>
                  )}
                  {isNomdorStudent && (
                    <DetailIconBtn
                      onClick={() => navigate(`/gifted-students/student/scholarships/nomdor/${s.id}`)}
                      title="Batafsil"
                    >
                      <MdArrowForward />
                    </DetailIconBtn>
                  )}

                  <ItemHeader $compact={(isRektorDept && !isExpired) || isRektorStudent || isNomdorStudent}>
                    <ItemTitle $compact={isCompact}>{s.name}</ItemTitle>
                    {isNomdorDept ? (
                      <NomdorEditBtn
                        onClick={e => openNomdorEdit(e, s)}
                        title="Tahrirlash"
                      >
                        <MdEdit />
                      </NomdorEditBtn>
                    ) : !isCompact && !isNomdorStudent && (
                      <Badge variant={s.active ? 'approved' : 'default'}>
                        {s.active ? 'Faol' : 'Nofaol'}
                      </Badge>
                    )}
                  </ItemHeader>

                  {!isCompact && <ItemDesc>{s.description}</ItemDesc>}

                  <MetaRow $compact={isCompact}>
                    <MetaCell>
                      <MetaIcon $bg="var(--brand-primary-soft)" $color="var(--brand-primary)"><MdPaid /></MetaIcon>
                      <MetaText>
                        <MetaLabel>Miqdor</MetaLabel>
                        <MetaValue>{s.amount}</MetaValue>
                      </MetaText>
                    </MetaCell>
                    <MetaCell>
                      <MetaIcon $bg="#EBF5FB" $color="#3498DB"><MdTrendingUp /></MetaIcon>
                      <MetaText>
                        <MetaLabel>Min. ball</MetaLabel>
                        <MetaValue>{s.minScore}</MetaValue>
                      </MetaText>
                    </MetaCell>
                    <MetaCell>
                      <MetaIcon $bg="#FDEDEC" $color="#E74C3C"><MdCalendarToday /></MetaIcon>
                      <MetaText>
                        <MetaLabel>Muddat</MetaLabel>
                        <MetaValue>{s.deadline}</MetaValue>
                      </MetaText>
                    </MetaCell>
                  </MetaRow>

                  {!isCompact && (s.allowedCourses?.length ?? 0) > 0 && (
                    <ChipsRow>
                      <ChipsLabel><MdGroups /> Kurslar:</ChipsLabel>
                      {s.allowedCourses?.map(c => (
                        <SmallChip key={c}>{courseLabel(c)}</SmallChip>
                      ))}
                    </ChipsRow>
                  )}

                  {!isCompact && type === 'rektor' && (s.criteria?.length ?? 0) > 0 && (
                    <ChipsRow>
                      <ChipsLabel><MdAssignment /> Faoliyatlar:</ChipsLabel>
                      {s.criteria?.flatMap((c: LegacyScholarshipCriterion, i) => {
                        const ct = criteriaList.find(x => x.id === c.criteriaId);
                        if (!ct) return [];
                        const catIds = c.categoryIds?.length
                          ? c.categoryIds
                          : (c.categoryId ? [c.categoryId] : []);
                        if (catIds.length === 0) {
                          return [<SmallChip key={`c${i}`} $accent>{ct.icon} {ct.name}</SmallChip>];
                        }
                        return catIds.map(catId => {
                          const cat = ct.categories.find(x => x.id === catId);
                          if (!cat) return null;
                          return (
                            <SmallChip key={`c${i}-${catId}`} $accent>
                              {ct.icon} {cat.name}
                            </SmallChip>
                          );
                        }).filter((x) => x !== null);
                      })}
                    </ChipsRow>
                  )}

                  <ItemFooter>
                    {studentFooterBtn || (role !== 'student' && (
                      <span
                        onClick={e => e.stopPropagation()}
                        title={s.active ? "Nofaol qilish" : "Faollashtirish"}
                      >
                        <Switch
                          checked={s.active}
                          onChange={() => handleToggleActive(s)}
                          checkedChildren="Faol"
                          unCheckedChildren="Nofaol"
                        />
                      </span>
                    ))}
                    {isRejected && (isRektorStudent || isNomdorStudent) && (
                      <RejectedFooterBadge>Rad etilgan</RejectedFooterBadge>
                    )}
                    {(isRektorDept || isRektorStudent) && isAllJudgesScored && (
                      <ScoredTag onClick={e => e.stopPropagation()}>
                        Baholash yakunlangan
                      </ScoredTag>
                    )}
                  </ItemFooter>
                </Item>
              );
            })}
          </Grid>
        )}

        {(isRektorStudent || isNomdorStudent) && (
          <MyAppsSection>
            <MySectionTitle>Arizalarim</MySectionTitle>
            <CardWrap style={{ padding: 0, overflow: 'hidden' }}>
              {studentApps.length === 0 ? (
                <MyAppsEmpty>Hali ariza topshirilmagan</MyAppsEmpty>
              ) : (
                <MyAppsList>
                  {studentApps.map(app => (
                    <MyAppItem key={app.id}>
                      <MyAppLeft>
                        <MyAppName>{app.scholarshipName}</MyAppName>
                        <MyAppDate>Yuborilgan: {app.appliedAt}</MyAppDate>
                      </MyAppLeft>
                      <MyAppRight>
                        {app.status === 'rejected' && app.note && (
                          <AppInfoBtn onClick={() => setNoteModal(app.note)} title="Rad etish sababi">
                            <MdInfoOutline />
                          </AppInfoBtn>
                        )}
                        <AppStatusBadge $status={app.status}>
                          {APP_STATUS_LABELS[app.status] ?? app.status}
                        </AppStatusBadge>
                      </MyAppRight>
                    </MyAppItem>
                  ))}
                </MyAppsList>
              )}
            </CardWrap>
          </MyAppsSection>
        )}

        {role === 'department' && (
          <AppListWrap>
            <AppListHeader>
              <AppListTitle>Arizalar ro'yxati</AppListTitle>
              <AppFilterTabs>
                <Select
                  value={appYearFilter}
                  style={{ width: 'auto', minWidth: 190 }}
                  onChange={(value) => setAppYearFilter(value)}
                  options={[
                    { value: 'all', label: "Barcha o'quv yillari" },
                    ...academicYears.map(y => ({ value: y, label: `${y} o'quv yili` })),
                  ]}
                />
                {[
                  { key: 'all', label: 'Barchasi' },
                  { key: 'pending', label: '⏳ Kutmoqda' },
                  { key: 'recommended', label: '✓ Tasdiqlangan' },
                  { key: 'rejected', label: '✗ Rad etilgan' },
                ].map(({ key, label }) => (
                  <AppFilterTab key={key} $active={appFilter === key} onClick={() => setAppFilter(key)}>
                    {label} ({getAppCount(key)})
                  </AppFilterTab>
                ))}
              </AppFilterTabs>
            </AppListHeader>
            {filteredApps.length === 0 ? (
              <AppEmpty>Arizalar topilmadi</AppEmpty>
            ) : (
              <AppTableWrap>
                <AppTable>
                  <thead>
                    <AppTr $header>
                      <AppTh>Talaba</AppTh>
                      <AppTh>Fakultet</AppTh>
                      {!isRektor && <AppTh>Yo'nalish</AppTh>}
                      <AppTh>Kurs</AppTh>
                      <AppTh>{isRektor ? "Stipendiya yo'nalishi" : 'Stipendiya nomi'}</AppTh>
                      <AppTh>Sana</AppTh>
                      <AppTh>Status</AppTh>
                      <AppTh>Faoliyat</AppTh>
                      <AppTh>Amallar</AppTh>
                    </AppTr>
                  </thead>
                  <tbody>
                    {filteredApps.map(app => {
                      const stu = students.find(s => s.id === app.studentId);
                      return (
                        <AppTr key={app.id}>
                          <AppTd>
                            <AppStudentName>{stu?.name ?? app.studentId}</AppStudentName>
                            {isRektor && <AppStudentSub>{stu?.direction}</AppStudentSub>}
                          </AppTd>
                          <AppTd>{stu?.faculty ?? '—'}</AppTd>
                          {!isRektor && <AppTd>{stu?.direction ?? '—'}</AppTd>}
                          <AppTd>{stu ? `${stu.course}-kurs` : '—'}</AppTd>
                          <AppTd>{app.scholarshipName}</AppTd>
                          <AppTd>{app.appliedAt}</AppTd>
                          <AppTd>
                            <AppStatusCell>
                              <AppStatusBadge $status={app.status}>
                                {APP_STATUS_LABELS[app.status] ?? app.status}
                              </AppStatusBadge>
                              {app.status === 'rejected' && app.note && (
                                <AppInfoBtn onClick={() => setNoteModal(app.note)} title="Rad etish sababi">
                                  <MdInfoOutline />
                                </AppInfoBtn>
                              )}
                            </AppStatusCell>
                          </AppTd>
                          <AppTd>
                            <AppIconBtn
                              onClick={() => navigate(`/gifted-students/department/students/${app.studentId}`, {
                                state: { back: `/gifted-students/department/scholarships/${type}` }
                              })}
                              title="Faoliyatlar"
                            >
                              <MdPerson />
                            </AppIconBtn>
                          </AppTd>
                          <AppTd>
                            {app.status === 'pending' && (
                              <AppActionsCell>
                                <AppIconBtn $green onClick={() => setApproveModal(app)} title="Tasdiqlash">
                                  <MdCheck />
                                </AppIconBtn>
                                <AppIconBtn $red onClick={() => { setRejectModal(app); setRejectNote(''); }} title="Rad etish">
                                  <MdClose />
                                </AppIconBtn>
                              </AppActionsCell>
                            )}
                          </AppTd>
                        </AppTr>
                      );
                    })}
                  </tbody>
                </AppTable>
              </AppTableWrap>
            )}
          </AppListWrap>
        )}
      </Wrap>

      <Modal
        open={!!approveModal}
        onClose={() => setApproveModal(null)}
        title="Arizani tasdiqlash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveModal(null)}>Bekor qilish</Button>
            <Button onClick={() => approveModal && handleApprove(approveModal)} disabled={reviewing}>Tasdiqlash</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          <b>{approveModal && (students.find(s => s.id === approveModal.studentId)?.name ?? approveModal.studentId)}</b> talabaning{' '}
          <b>{approveModal?.scholarshipName}</b> bo'yicha arizasini tasdiqlashni xohlaysizmi?
        </p>
      </Modal>

      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Arizani rad etish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModal(null)}>Bekor qilish</Button>
            <Button variant="danger" onClick={handleReject} disabled={reviewing || !rejectNote.trim()}>Rad etish</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
          <b>{rejectModal && (students.find(s => s.id === rejectModal.studentId)?.name ?? rejectModal.studentId)}</b> talabaning{' '}
          <b>{rejectModal?.scholarshipName}</b> bo'yicha arizasini rad etish sababi:
        </p>
        <Textarea
          value={rejectNote}
          onChange={(v) => setRejectNote(v)}
          placeholder="Rad etish sababini kiriting..."
          rows={4}
        />
      </Modal>

      <Modal
        open={!!noteModal}
        onClose={() => setNoteModal(null)}
        title="Rad etish sababi"
        footer={<Button variant="secondary" onClick={() => setNoteModal(null)}>Yopish</Button>}
      >
        <RejectNoteBox>{noteModal}</RejectNoteBox>
      </Modal>

      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title="Stipendiyani tahrirlash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal(null)}>Bekor qilish</Button>
            <Button onClick={handleEditSave} disabled={saving || !isEditValid}>Saqlash</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Stipendiya nomi *</Label>
          <Input
            value={editForm.name}
            style={{ width: '100%' }}
            onChange={e => setEF('name', e.target.value)}
            placeholder="Masalan: Beruniy stipendiyasi"
          />
        </FormGroup>

        <FormGroup>
          <Label>Tavsif</Label>
          <Textarea
            value={editForm.description}
            onChange={(v) => setEF('description', v)}
            placeholder="Stipendiya haqida qisqa ma'lumot"
            rows={3}
          />
        </FormGroup>

        <Grid2x2Modal>
          <FormGroup style={{ margin: 0 }}>
            <Label>O'quv yili *</Label>
            <Select
              value={editForm.academicYear}
              style={{ width: '100%' }}
              onChange={(value) => setEF('academicYear', value)}
              options={academicYears.map(y => ({ value: y, label: y }))}
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Topshirish muddati *</Label>
            <DatePicker
              size="middle"
              value={editForm.deadline || null}
              onChange={(v) => setEF('deadline', v ?? '')}
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Miqdor *</Label>
            <Input
              value={editForm.amount}
              style={{ width: '100%' }}
              onChange={e => setEF('amount', e.target.value)}
              placeholder="1,500,000 so'm/oy"
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Min. ball</Label>
            <NumberField
              min={0}
              style={{ width: '100%' }}
              value={editForm.minScore === '' ? null : Number(editForm.minScore)}
              onChange={(v) => setEF('minScore', v === null ? '' : String(v))}
              placeholder="60"
            />
          </FormGroup>
        </Grid2x2Modal>

        <FormGroup style={{ marginBottom: 0 }}>
          <Label>Kim ariza topshira oladi (kurslar)</Label>
          <Hint>Tanlangan kurslardagi talabalargina bu stipendiyani ko'radi. Bo'sh qolsa — hamma kurs.</Hint>
          <CourseGrid>
            {courseOptions.map(c => {
              const checked = editForm.allowedCourses.includes(c.value);
              return (
                <Checkbox
                  key={c.value}
                  checked={checked}
                  onChange={() => toggleEditCourse(c.value)}
                >
                  {c.label}
                </Checkbox>
              );
            })}
          </CourseGrid>
        </FormGroup>
      </Modal>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Yangi nomdor stipendiya qo'shish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Bekor qilish</Button>
            <Button onClick={handleSubmit} disabled={saving || !isValid}>Qo'shish</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Stipendiya nomi *</Label>
          <Input
            value={form.name}
            style={{ width: '100%' }}
            onChange={e => setF('name', e.target.value)}
            placeholder="Masalan: Beruniy stipendiyasi"
          />
        </FormGroup>

        <FormGroup>
          <Label>Tavsif</Label>
          <Textarea
            value={form.description}
            onChange={(v) => setF('description', v)}
            placeholder="Stipendiya haqida qisqa ma'lumot"
            rows={3}
          />
        </FormGroup>

        <Grid2x2Modal>
          <FormGroup style={{ margin: 0 }}>
            <Label>O'quv yili *</Label>
            <Select
              value={form.academicYear}
              style={{ width: '100%' }}
              onChange={(value) => setF('academicYear', value)}
              options={academicYears.map(y => ({ value: y, label: y }))}
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Topshirish muddati *</Label>
            <DatePicker
              size="middle"
              value={form.deadline || null}
              onChange={(v) => setF('deadline', v ?? '')}
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Miqdor *</Label>
            <Input
              value={form.amount}
              style={{ width: '100%' }}
              onChange={e => setF('amount', e.target.value)}
              placeholder="1,500,000 so'm/oy"
            />
          </FormGroup>
          <FormGroup style={{ margin: 0 }}>
            <Label>Min. ball</Label>
            <NumberField
              min={0}
              style={{ width: '100%' }}
              value={form.minScore === '' ? null : Number(form.minScore)}
              onChange={(v) => setF('minScore', v === null ? '' : String(v))}
              placeholder="60"
            />
          </FormGroup>
        </Grid2x2Modal>

        <FormGroup>
          <Label>Kim ariza topshira oladi (kurslar)</Label>
          <Hint>Tanlangan kurslardagi talabalargina bu stipendiyani ko'radi. Bo'sh qolsa — hamma kurs.</Hint>
          <CourseGrid>
            {courseOptions.map(c => {
              const checked = form.allowedCourses.includes(c.value);
              return (
                <Checkbox
                  key={c.value}
                  checked={checked}
                  onChange={() => toggleCourse(c.value)}
                >
                  {c.label}
                </Checkbox>
              );
            })}
          </CourseGrid>
        </FormGroup>
      </Modal>
    </>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Hero = styled(CardWrap)<{ $bg: string; $color: string }>`
  display: flex;
  align-items: center;
  gap: 16px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $color }) => `${$color}40`};
`;

const HeroIcon = styled.div<{ $color: string }>`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: white;
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
  svg { font-size: 28px; }
`;

const HeroText = styled.div`
  flex: 1;
  min-width: 0;
`;

const HeroTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.3;
`;

const HeroDesc = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 3px;
`;

const HeroRight = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
`;

const HeroCount = styled.div<{ $color: string }>`
  font-size: 32px;
  font-weight: 800;
  color: ${({ $color }) => $color};
  line-height: 1;
`;

const Grid = styled.div<{ $compact: boolean }>`
  display: grid;
  grid-template-columns: ${({ $compact }) =>
    $compact
      ? 'repeat(auto-fill, minmax(200px, 1fr))'
      : 'repeat(auto-fill, minmax(360px, 1fr))'};
  gap: ${({ $compact }) => $compact ? '12px' : '16px'};
`;

const Item = styled(CardWrap)<{ $clickable: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  cursor: ${({ $clickable }) => $clickable ? 'pointer' : 'default'};
  transition: all 0.15s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadow.md};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const EditIconBtn = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #7F8C8D;
  background: #F4F6F9;
  z-index: 1;
  transition: all 0.15s;
  &:hover {
    background: #EBF5FB;
    color: #3498DB;
  }
`;

const NomdorEditBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  color: #7F8C8D;
  background: #F4F6F9;
  transition: all 0.15s;
  &:hover { background: #EBF5FB; color: #3498DB; }
`;

const DetailIconBtn = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #9B59B6;
  background: #F5EEF8;
  z-index: 1;
  transition: all 0.15s;
  &:hover {
    background: #D7BDE2;
    color: #6C3483;
  }
`;

const ApplyBox = styled.div`
  display: flex;
  flex-direction: column;

  align-items: flex-start;
  gap: 4px;
`;

const BallHint = styled.span`
  font-size: 0.72rem;
  color: var(--brand-error);
`;

const StatusChipBtn = styled.div<{ $approved?: boolean; $pending?: boolean; $rejected?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  transition: opacity 0.15s;
  svg { font-size: 14px; }

  ${({ $approved }) => $approved && `
    background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC;
    &:hover { opacity: 0.75; }
  `}
  ${({ $pending }) => $pending && `
    background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A;
  `}
  ${({ $rejected }) => $rejected && `
    background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA;
  `}
`;

const ItemHeader = styled.div<{ $compact: boolean }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-right: ${({ $compact }) => $compact ? '38px' : '0'};
`;

const ItemTitle = styled.h3<{ $compact: boolean }>`
  font-size: ${({ $compact }) => $compact ? '13px' : '15px'};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.35;
`;

const ItemDesc = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.5;
`;

const MetaRow = styled.div<{ $compact: boolean }>`
  display: grid;
  grid-template-columns: ${({ $compact }) => ($compact ? '1fr' : 'repeat(3, 1fr)')};
  gap: 6px;
  padding: ${({ $compact }) => $compact ? '8px' : '10px'};
  background: ${({ theme }) => theme.colors.bg};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const MetaCell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const MetaIcon = styled.div<{ $bg: string; $color: string }>`
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
`;

const MetaText = styled.div`
  min-width: 0;
`;

const MetaLabel = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const MetaValue = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: break-word;
`;

const ChipsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
`;

const ChipsLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 500;
  margin-right: 2px;
  svg { font-size: 14px; }
`;

const SmallChip = styled.span<{ $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: ${({ $accent, theme }) => $accent ? '#F5EEF8' : theme.colors.primaryLight};
  color: ${({ $accent, theme }) => $accent ? '#9B59B6' : theme.colors.primary};
  border: 1px solid ${({ $accent }) => $accent ? '#D7BDE2' : '#A9DFBF'};
`;

const ItemFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
`;

const EmptyCard = styled(CardWrap)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 20px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: 40px;
`;

const EmptyText = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Grid2x2Modal = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 12px;
  row-gap: 12px;
  margin-bottom: 12px;
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const Hint = styled.p`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 8px;
  line-height: 1.4;
`;

const CourseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;

const AppListWrap = styled(CardWrap)`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow: hidden;
`;

const AppListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const AppListTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const AppFilterTabs = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const AppFilterTab = styled.button<{ $active: boolean }>`
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1.5px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) => $active ? theme.colors.primaryLight : 'white'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textMuted};
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const AppTableWrap = styled.div`
  overflow-x: auto;
`;

const AppTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const AppTr = styled.tr<{ $header?: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  ${({ $header }) => !$header && `
    &:hover { background: #F8FAFC; }
    &:last-child { border-bottom: none; }
  `}
`;

const AppTh = styled.th`
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: ${({ theme }) => theme.colors.bg};
  white-space: nowrap;
`;

const AppTd = styled.td`
  padding: 10px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  vertical-align: middle;
`;

const AppStudentName = styled.div`
  font-weight: 600;
  font-size: 13px;
`;

const AppStudentSub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const AppStatusCell = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const AppStatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  ${({ $status }) => ($status === 'pending') && `
    background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A;
  `}
  ${({ $status }) => ($status === 'recommended' || $status === 'approved') && `
    background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC;
  `}
  ${({ $status }) => $status === 'rejected' && `
    background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA;
  `}
`;

const ScoredTag = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #EBF5FB;
  color: #3498DB;
  border: 1px solid #AED6F1;
  svg { font-size: 11px; flex-shrink: 0; }
`;

const RejectNoteBox = styled.p`
  font-size: 14px; color: #1E293B; line-height: 1.6;
  padding: 12px 16px;
  background: #FEF2F2; border-left: 3px solid #EF4444; border-radius: 6px;
`;

const AppInfoBtn = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #DC2626;
  background: transparent;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.7; }
`;

const AppIconBtn = styled.button<{ $green?: boolean; $red?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s;
  ${({ $green }) => $green && `
    color: #15803D; background: #DCFCE7;
    &:hover { background: #BBF7D0; }
  `}
  ${({ $red }) => $red && `
    color: #991B1B; background: #FEE2E2;
    &:hover { background: #FECACA; }
  `}
  ${({ $green, $red }) => !$green && !$red && `
    color: #7F8C8D; background: #F4F6F9;
    &:hover { background: #EBF5FB; color: #3498DB; }
  `}
`;

const AppActionsCell = styled.div`
  display: flex;
  gap: 5px;
`;

const AppEmpty = styled.div`
  padding: 40px 20px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const MyAppsSection = styled.div``;

const MySectionTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 12px;
`;

const MyAppsList = styled.div`
  display: flex;
  flex-direction: column;
`;

const MyAppItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  &:last-child { border-bottom: none; }
`;

const MyAppLeft = styled.div`
  flex: 1;
  min-width: 0;
`;

const MyAppName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const MyAppDate = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const MyAppRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const MyAppsEmpty = styled.div`
  padding: 32px 20px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const RejectedFooterBadge = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  background: #FEE2E2;
  color: #991B1B;
  border: 1px solid #FECACA;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  pointer-events: none;
`;
