import dayjs from 'dayjs';
import type {
  ScienceProgram,
  ScienceProgramStatus,
  ScienceOption,
  ScienceProgramFormValues,
  ScienceProgramFormVersion,
  TopicInput,
  AssignedHours,
  LiteratureGroupPayload,
  PersonInput,
  PlanHours,
  StaffPerson,
  TopicType,
  V142Block,
  V142FormValues,
  V142Payload,
  V142PersonPayload,
  V142TopicPayload,
  WorkingPlanStatus,
} from '../model/types';
import type { ApprovalStep } from '../../distribution/model/types';
import { mapApprovalStep, type BackendApprovalStep } from '../../distribution/api/mapper';
import { effectiveCode, manualCodeOrEmpty, outcomeCode, renumberTopicCodes } from '../lib/topic-code';
import { INDEPENDENT_NOTE_DEFAULT } from '../lib/v142-defaults';

export interface BackendScienceProgramListItem {
  _id: string;
  title?: string | null;
  science?: { _id: string; title?: string | null } | string | null;
  academicYear?: { _id: string; title: string } | string | null;
  semester?: string | number | null;
  status?: string | null;
  createdAt?: string | null;
  comment?: string | null;
  rejectedReason?: string | null;
  currentStep?: string | null;
  formVersion?: string | null;
}

export interface BackendScienceOption {
  science: string | null;
  scienceName?: string | null;
  scienceCode?: string | null;
  academicYear?: string | null;
  semester?: number | string | null;
  programExists?: boolean;
  programId?: string | null;
  programStatus?: string | null;
  programCode?: string | null;
  hoursByType?: BackendHoursByType | null;
  totalHour?: number | null;
}

export interface BackendScienceProgramDetail {
  _id: string;
  science?: { _id: string; title?: string | null } | null;
  directions?: Array<{ _id: string; title?: string | null }>;
  knowledgeArea?: string[];
  educationArea?: string[];
  scienceEssence?: {
    sciencePurpose?: { desc?: string | null } | null;
    scienceTasks?: { desc?: string | null } | null;
  } | null;
  theoretical?: {
    topics?: Array<{ order?: number; title?: string; desc?: string }>;
  } | null;
  seminarRecommendation?: { title?: string | null; desc?: string | null } | null;
  independentTask?: { title?: string | null; desc?: string | null } | null;
  learningOutcome?: { desc?: string | null } | null;
  teachingMethods?: { title?: string | null; desc?: string | null } | null;
  creditRequirements?: { title?: string | null; desc?: string | null } | null;
  guidanceLiterature?: { title?: string | null; desc?: string | null } | null;
  primaryLiterature?: { title?: string | null; desc?: string | null } | null;
  additionalLiterature?: { title?: string | null; desc?: string | null } | null;
  informationSource?: { title?: string | null; desc?: string | null } | null;
  reviewer?: { title?: string | null; desc?: string | null } | null;
  responsible?: { title?: string | null; desc?: string | null } | null;
  status?: string | null;
  approvalSteps?: BackendApprovalStep[];
  formVersion?: string | null;
  language?: string | null;
  academicYear?: { _id: string; title?: string | null } | string | null;
  literatureGroups?: BackendLiteratureGroup[] | null;
  v142?: BackendV142 | null;
}

function normalizeFormVersion(v: string | null | undefined): ScienceProgramFormVersion {
  return v === 'v142' ? 'v142' : 'v259';
}

function extractAcademicYearTitle(
  ay: { _id: string; title: string } | string | null | undefined,
): string | null {
  if (!ay) return null;
  if (typeof ay === 'string') return null;
  return ay.title ?? null;
}

function extractScienceName(
  s: { _id: string; title?: string | null } | string | null | undefined,
): string | null {
  if (!s) return null;
  if (typeof s === 'string') return null;
  return s.title ?? null;
}

export function mapScienceProgram(b: BackendScienceProgramListItem): ScienceProgram {
  return {
    id: b._id,
    scienceName: extractScienceName(b.science) ?? b.title ?? null,
    semester: b.semester ?? null,
    academicYearTitle: extractAcademicYearTitle(b.academicYear),
    status: (b.status as ScienceProgramStatus) ?? 'draft',
    createdAt: b.createdAt ?? null,
    rejectedReason: b.comment ?? b.rejectedReason ?? null,
    currentStep: b.currentStep ?? null,
    formVersion: normalizeFormVersion(b.formVersion),
  };
}

export function mapScienceOption(b: BackendScienceOption): ScienceOption {
  return {
    id: b.science ?? '',
    name: b.scienceName ?? b.science ?? '—',
    code: b.scienceCode ?? null,
    academicYear: b.academicYear ?? null,
    semester: b.semester != null ? String(b.semester) : null,
    programExists: b.programExists ?? false,
    programId: b.programId ?? null,
    programStatus: (b.programStatus as ScienceProgramStatus) ?? null,
    programCode: b.programCode ?? null,
    assignedHours: mapAssignedHours(b.hoursByType, b.totalHour),
  };
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

export function dedupeScienceOptions(options: readonly ScienceOption[]): ScienceOption[] {
  const byId = new Map<string, ScienceOption>();
  const semestersById = new Map<string, Set<string>>();

  for (const opt of options) {
    const prev = byId.get(opt.id);
    const sems = semestersById.get(opt.id) ?? new Set<string>();
    if (opt.semester) sems.add(opt.semester);
    semestersById.set(opt.id, sems);

    if (!prev) {
      byId.set(opt.id, { ...opt });
      continue;
    }

    let assignedHours = prev.assignedHours;
    if (prev.assignedHours && opt.assignedHours) {
      const byType = { ...prev.assignedHours.byType };
      (Object.keys(byType) as TopicType[]).forEach((type) => {
        byType[type] = addNullable(byType[type], opt.assignedHours?.byType[type] ?? null);
      });
      assignedHours = {
        byType,
        independent: addNullable(prev.assignedHours.independent, opt.assignedHours.independent),
        total: addNullable(prev.assignedHours.total, opt.assignedHours.total),
      };
    } else if (!prev.assignedHours) {
      assignedHours = opt.assignedHours;
    }

    byId.set(opt.id, {
      ...prev,
      academicYear: prev.academicYear ?? opt.academicYear,
      programExists: prev.programExists || opt.programExists,
      programId: prev.programId ?? opt.programId,
      programStatus: prev.programStatus ?? opt.programStatus,
      programCode: prev.programCode ?? opt.programCode,
      assignedHours,
    });
  }

  return Array.from(byId.values()).map((opt) => {
    const sems = Array.from(semestersById.get(opt.id) ?? []).sort(
      (a, b) => Number(a) - Number(b) || a.localeCompare(b),
    );
    return { ...opt, semester: sems.length ? sems.join(', ') : opt.semester };
  });
}

export function mapScienceProgramDetail(b: BackendScienceProgramDetail): ScienceProgramFormValues {
  const topics: TopicInput[] = (b.theoretical?.topics ?? []).map((t, i) => ({
    order: t.order ?? i + 1,
    title: t.title ?? '',
    desc: t.desc ?? '',
  }));

  return {
    science: typeof b.science === 'object' && b.science !== null
      ? b.science._id
      : (b.science as string | undefined) ?? '',
    knowledgeArea: b.knowledgeArea?.length ? b.knowledgeArea : [''],
    educationArea: b.educationArea?.length ? b.educationArea : [''],
    directions: (b.directions ?? []).map((d) => d._id),
    sciencePurpose: b.scienceEssence?.sciencePurpose?.desc ?? '',
    scienceTasks: b.scienceEssence?.scienceTasks?.desc ?? '',
    responsible: b.responsible?.desc ?? b.responsible?.title ?? '',
    topics: topics.length > 0 ? topics : [{ order: 1, title: '', desc: '' }],

    seminarRecommendationDesc: b.seminarRecommendation?.desc ?? '',
    independentTaskDesc: b.independentTask?.desc ?? '',
    learningOutcomeDesc: b.learningOutcome?.desc ?? '',
    teachingMethodsDesc: b.teachingMethods?.desc ?? '',
    creditRequirementsDesc: b.creditRequirements?.desc ?? '',

    guidanceLiteratureDesc: b.guidanceLiterature?.desc ?? '',
    primaryLiteratureDesc: b.primaryLiterature?.desc ?? '',
    additionalLiteratureDesc: b.additionalLiterature?.desc ?? '',
    reviewerDesc: b.reviewer?.desc ?? '',
    informationSourceDesc: b.informationSource?.desc ?? '',

    language: b.language ?? '',
    formVersion: normalizeFormVersion(b.formVersion),
  };
}

export function mapScienceProgramApprovalSteps(b: BackendScienceProgramDetail): ApprovalStep[] {
  return (b.approvalSteps ?? []).map(mapApprovalStep);
}

export interface BackendHoursByType {
  lecture?: number | null;
  seminar?: number | null;
  laboratory?: number | null;
  practical?: number | null;
  independent?: number | null;
}

export const ASSIGNED_HOURS_KEY_BY_TYPE: Record<TopicType, keyof BackendHoursByType | null> = {
  maruza: 'lecture',
  amaliy: 'seminar',
  seminar: null,
  laboratoriya: 'laboratory',
  klinik_amaliyot: 'practical',
};

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapAssignedHours(
  raw: BackendHoursByType | null | undefined,
  totalHour: number | null | undefined,
): AssignedHours | null {
  if (!raw || typeof raw !== 'object') return null;
  const byType = {} as Record<TopicType, number | null>;
  (Object.keys(ASSIGNED_HOURS_KEY_BY_TYPE) as TopicType[]).forEach((type) => {
    const key = ASSIGNED_HOURS_KEY_BY_TYPE[type];
    byType[type] = key ? toNullableNumber(raw[key]) : null;
  });
  return {
    byType,
    independent: toNullableNumber(raw.independent),
    total: toNullableNumber(totalHour),
  };
}

export interface BackendWorkingPlanStatus {
  hasWorkingPlan?: boolean;
  warning?: string | null;
  planHours?: BackendPlanHours | null;
}

export interface BackendPlanHours {
  items?: Array<{
    slug?: string | null;
    title?: string | null;
    value?: number | string | null;
  }> | null;
  classroomHours?: number | string | null;
  independentHours?: number | string | null;
  totalHours?: number | string | null;
  credits?: number | string | null;
  weeklyHours?: number | string | null;
  semester?: number | string | null;
  code?: string | null;
  serialNumber?: string | null;
  moduleType?: string | null;
  warnings?: string[] | null;
  clinicalUnknown?: boolean | null;
}

export function mapPlanHours(raw: BackendPlanHours | null | undefined): PlanHours | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    items: (raw.items ?? [])
      .filter((i): i is NonNullable<typeof i> => Boolean(i))
      .map((i) => ({
        slug: i.slug ?? '',
        title: i.title ?? '',
        value: toNullableNumber(i.value) ?? 0,
      })),
    classroomHours: toNullableNumber(raw.classroomHours),
    independentHours: toNullableNumber(raw.independentHours),
    totalHours: toNullableNumber(raw.totalHours),
    credits: toNullableNumber(raw.credits),
    weeklyHours: toNullableNumber(raw.weeklyHours),
    semester: raw.semester != null && raw.semester !== '' ? String(raw.semester) : null,
    code: raw.code ?? null,
    serialNumber: raw.serialNumber ?? null,
    moduleType: raw.moduleType ?? null,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter(Boolean) : [],
    clinicalUnknown: raw.clinicalUnknown === true,
  };
}

export function mapWorkingPlanStatus(
  raw: BackendWorkingPlanStatus | null | undefined,
): WorkingPlanStatus {
  return {
    hasWorkingPlan: raw?.hasWorkingPlan === true,
    warning: raw?.warning ?? null,
    planHours: mapPlanHours(raw?.planHours),
  };
}

export interface BackendLiteratureGroup {
  slug?: string | null;
  title?: string | null;
  desc?: string | null;
  literatures?: string[] | null;
}

export interface BackendV142Person {
  fio?: string | null;
  degree?: string | null;
  title?: string | null;
  department?: string | null;
  position?: string | null;
}

export interface BackendV142Topic {
  type?: string | null;
  code?: string | null;
  title?: string | null;
  hours?: number | null;
  refs?: number[] | null;
}

export interface BackendV142 {
  educationForm?: string | null;
  prerequisites?: Array<{ code?: string | null; title?: string | null }> | null;
  outcomes?: {
    competencies?: Array<{ code?: string | null; text?: string | null }> | null;
    skills?: Array<{ code?: string | null; text?: string | null }> | null;
  } | null;
  topics?: BackendV142Topic[] | null;
  independentTasks?: Array<{
    order?: number | null;
    title?: string | null;
    hours?: number | null;
  }> | null;
  independentNote?: string | null;
  techMethods?: string[] | null;
  grading?: {
    a?: string[] | null;
    b?: string[] | null;
    d?: string[] | null;
    e?: string[] | null;
  } | null;
  authors?: BackendV142Person[] | null;
  reviewers?: BackendV142Person[] | null;
  councilProtocol?: { date?: string | null; number?: string | null } | null;
  departmentProtocol?: { date?: string | null; number?: string | null } | null;
}

const TOPIC_TYPE_SET: ReadonlySet<string> = new Set<TopicType>([
  'maruza',
  'amaliy',
  'seminar',
  'laboratoriya',
  'klinik_amaliyot',
]);

function toTopicType(v: string | null | undefined): TopicType | '' {
  return v && TOPIC_TYPE_SET.has(v) ? (v as TopicType) : '';
}

function refsToText(refs: number[] | null | undefined): string {
  return (refs ?? []).filter((n) => Number.isFinite(n)).join(', ');
}

export function parseRefs(text: string | null | undefined): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const part of text.split(/[,;\s]+/)) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

const EMPTY_PERSON_ROW = { fio: '', degree: '', title: '', department: '', position: '' };

function mapPerson(p: BackendV142Person): V142FormValues['authors'][number] {
  return {
    fio: p.fio ?? '',
    degree: p.degree ?? '',
    title: p.title ?? '',
    department: p.department ?? '',
    position: p.position ?? '',
  };
}

function literaturesBySlug(
  groups: BackendLiteratureGroup[] | null | undefined,
  slug: LiteratureGroupPayload['slug'],
): string[] {
  const g = (groups ?? []).find((x) => x.slug === slug);
  return (g?.literatures ?? []).filter((s): s is string => typeof s === 'string');
}

export function mapV142Detail(b: BackendScienceProgramDetail): V142FormValues {
  const v: BackendV142 = b.v142 ?? {};
  const rawTopics = (v.topics ?? []).map((t) => ({
    type: toTopicType(t.type),
    code: t.code ?? '',
    title: t.title ?? '',
    hours: toNullableNumber(t.hours) ?? 0,
    refs: refsToText(t.refs),
  }));
  const topics = renumberTopicCodes(rawTopics).map((auto, i) => ({
    ...rawTopics[i]!,
    code: manualCodeOrEmpty(rawTopics[i]!.code, auto.code),
  }));
  const authors = (v.authors ?? []).map(mapPerson);
  const reviewers = (v.reviewers ?? []).map(mapPerson);

  return {
    science:
      typeof b.science === 'object' && b.science !== null
        ? b.science._id
        : ((b.science as string | undefined) ?? ''),
    language: b.language ?? '',
    educationForm: v.educationForm ?? 'kunduzgi',
    knowledgeArea: b.knowledgeArea?.length ? b.knowledgeArea : [''],
    educationArea: b.educationArea?.length ? b.educationArea : [''],
    directions: (b.directions ?? []).map((d) => d._id),
    councilProtocol: {
      date: v.councilProtocol?.date ?? null,
      number: v.councilProtocol?.number ?? '',
    },
    departmentProtocol: {
      date: v.departmentProtocol?.date ?? null,
      number: v.departmentProtocol?.number ?? '',
    },
    authors: authors.length ? authors : [{ ...EMPTY_PERSON_ROW }],
    reviewers: reviewers.length ? reviewers : [{ ...EMPTY_PERSON_ROW }],

    sciencePurpose: b.scienceEssence?.sciencePurpose?.desc ?? '',
    scienceTasks: b.scienceEssence?.scienceTasks?.desc ?? '',
    prerequisites: (v.prerequisites ?? []).map((p) => ({
      code: p.code ?? '',
      title: p.title ?? '',
    })),
    competencies: (v.outcomes?.competencies ?? []).map((c, i) => ({
      code: manualCodeOrEmpty(c.code, outcomeCode(i + 1)),
      text: c.text ?? '',
    })),
    skills: (v.outcomes?.skills ?? []).map((c, i) => ({
      code: manualCodeOrEmpty(c.code, outcomeCode((v.outcomes?.competencies ?? []).length + i + 1)),
      text: c.text ?? '',
    })),

    topics: topics.length ? topics : [{ type: 'maruza', code: '', title: '', hours: 1, refs: '' }],
    independentTasks: (v.independentTasks ?? []).map((it, i) => ({
      order: toNullableNumber(it.order) ?? i + 1,
      title: it.title ?? '',
      hours: toNullableNumber(it.hours) ?? 0,
    })),
    independentNote: nonEmpty(v.independentNote ?? '') ? (v.independentNote as string) : INDEPENDENT_NOTE_DEFAULT,

    techMethods: (v.techMethods ?? []).filter((s): s is string => typeof s === 'string'),
    creditRequirements: b.creditRequirements?.desc ?? '',
    grading: {
      a: v.grading?.a ?? [],
      b: v.grading?.b ?? [],
      d: v.grading?.d ?? [],
      e: v.grading?.e ?? [],
    },

    primaryLiterature: literaturesBySlug(b.literatureGroups, 'primary'),
    additionalLiterature: literaturesBySlug(b.literatureGroups, 'additional'),
    informationSources: literaturesBySlug(b.literatureGroups, 'information'),
  };
}

const nonEmpty = (s: string | null | undefined): s is string => Boolean(s && s.trim());
const orNull = (s: string | null | undefined): string | null => (nonEmpty(s) ? s.trim() : null);
const cleanList = (list: readonly string[] | undefined): string[] =>
  (list ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
const toWholeHours = (n: number | null | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;

function toPersonPayload(p: V142FormValues['authors'][number]): V142PersonPayload | null {
  if (!nonEmpty(p.fio)) return null;
  return {
    fio: p.fio.trim(),
    degree: orNull(p.degree),
    title: orNull(p.title),
    department: orNull(p.department),
    position: orNull(p.position),
  };
}

const DATE_ONLY_RX = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (DATE_ONLY_RX.test(iso)) return iso;
  const d = dayjs(iso);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

export interface LiteratureTitles {
  primary: string;
  additional: string;
  information: string;
}

export function toV142Payload(
  values: V142FormValues,
  selectedScience: ScienceOption | null | undefined,
  isCreate: boolean,
  literatureTitles: LiteratureTitles,
): V142Payload {
  const knowledgeArea = cleanList(values.knowledgeArea);
  const educationArea = cleanList(values.educationArea);

  const topics: V142TopicPayload[] = [];
  const autoCodes = renumberTopicCodes(values.topics);
  for (const [i, t] of autoCodes.entries()) {
    if (t.type === '' || !nonEmpty(t.title)) continue;
    topics.push({
      type: t.type,
      code: effectiveCode(values.topics[i]?.code, t.code),
      title: t.title.trim(),
      hours: toWholeHours(t.hours),
      refs: parseRefs(t.refs),
    });
  }

  const v142: V142Block = {
    educationForm: values.educationForm || 'kunduzgi',
    prerequisites: values.prerequisites
      .filter((p) => nonEmpty(p.title))
      .map((p) => ({ code: orNull(p.code), title: p.title.trim() })),
    outcomes: (() => {
      const competencies = values.competencies.filter((c) => nonEmpty(c.text));
      const skills = values.skills.filter((c) => nonEmpty(c.text));
      return {
        competencies: competencies.map((c, i) => ({
          code: effectiveCode(c.code, outcomeCode(i + 1)),
          text: c.text.trim(),
        })),
        skills: skills.map((c, i) => ({
          code: effectiveCode(c.code, outcomeCode(competencies.length + i + 1)),
          text: c.text.trim(),
        })),
      };
    })(),
    topics,
    independentTasks: values.independentTasks
      .filter((it) => nonEmpty(it.title))
      .map((it, i) => ({ order: i + 1, title: it.title.trim(), hours: toWholeHours(it.hours) })),
    independentNote: nonEmpty(values.independentNote) ? values.independentNote.trim() : null,
    techMethods: cleanList(values.techMethods),
    grading: {
      a: cleanList(values.grading.a),
      b: cleanList(values.grading.b),
      d: cleanList(values.grading.d),
      e: cleanList(values.grading.e),
    },
    authors: values.authors
      .map(toPersonPayload)
      .filter((p): p is V142PersonPayload => p !== null),
    reviewers: values.reviewers
      .map(toPersonPayload)
      .filter((p): p is V142PersonPayload => p !== null),
    councilProtocol: {
      date: toDateOnly(values.councilProtocol.date),
      number: orNull(values.councilProtocol.number),
    },
    departmentProtocol: {
      date: toDateOnly(values.departmentProtocol.date),
      number: orNull(values.departmentProtocol.number),
    },
  };

  const literatureGroups: LiteratureGroupPayload[] = [
    {
      slug: 'primary',
      title: literatureTitles.primary,
      literatures: cleanList(values.primaryLiterature),
    },
    {
      slug: 'additional',
      title: literatureTitles.additional,
      literatures: cleanList(values.additionalLiterature),
    },
    {
      slug: 'information',
      title: literatureTitles.information,
      literatures: cleanList(values.informationSources),
    },
  ];

  return {
    science: values.science,
    ...(isCreate ? { formVersion: 'v142' as const } : {}),
    academicYear: selectedScience?.academicYear ?? undefined,
    semester: selectedScience?.semester ?? undefined,
    knowledgeArea: knowledgeArea.length > 0 ? knowledgeArea : undefined,
    educationArea: educationArea.length > 0 ? educationArea : undefined,
    directions: values.directions.length > 0 ? values.directions : undefined,
    language: nonEmpty(values.language) ? values.language.trim() : undefined,
    sciencePurpose: nonEmpty(values.sciencePurpose) ? { desc: values.sciencePurpose } : undefined,
    scienceTasks: nonEmpty(values.scienceTasks) ? { desc: values.scienceTasks } : undefined,
    creditRequirements: nonEmpty(values.creditRequirements)
      ? { desc: values.creditRequirements }
      : undefined,
    literatureGroups,
    v142,
  };
}

export interface BackendTeacherProfileLite {
  _id: string;
  user?: {
    _id: string;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
  } | null;
  department?: { _id: string; title?: string | null } | string | null;
  position?: { _id: string; title?: string | null } | string | null;
  academicDegree?: string | null;
  academicTitle?: string | null;
}

export const ACADEMIC_DEGREE_LABEL: Record<string, string> = {
  fan_nomzodi: 't.f.n.',
  fan_doktori: 'DSc',
  falsafa_doktori: 'PhD',
};

export const ACADEMIC_TITLE_LABEL: Record<string, string> = {
  dotsent: 'dotsent',
  professor: 'professor',
  katta_ilmiy_xodim: 'katta ilmiy xodim',
};

export function shortPersonName(
  lastName?: string | null,
  firstName?: string | null,
  middleName?: string | null,
): string {
  const initial = (s?: string | null) => (s && s.trim() ? `${s.trim()[0]!.toUpperCase()}.` : '');
  const last = (lastName ?? '').trim();
  const initials = `${initial(firstName)}${initial(middleName)}`;
  return [last, initials].filter(Boolean).join(' ');
}

function refTitle(ref: { title?: string | null } | string | null | undefined): string {
  if (!ref || typeof ref === 'string') return '';
  return (ref.title ?? '').trim();
}

export function mapStaffPerson(b: BackendTeacherProfileLite): StaffPerson | null {
  const u = b.user;
  if (!u?._id) return null;
  const fullName = [u.lastName, u.firstName, u.middleName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return {
    id: u._id,
    fio: shortPersonName(u.lastName, u.firstName, u.middleName) || fullName,
    fullName: fullName || '—',
    degree: b.academicDegree ? (ACADEMIC_DEGREE_LABEL[b.academicDegree] ?? b.academicDegree) : '',
    title: b.academicTitle ? (ACADEMIC_TITLE_LABEL[b.academicTitle] ?? b.academicTitle) : '',
    department: refTitle(b.department),
    position: refTitle(b.position),
  };
}

export function staffPersonToInput(p: StaffPerson): PersonInput {
  return {
    fio: p.fio,
    degree: p.degree,
    title: p.title,
    department: p.department,
    position: p.position,
  };
}
