import type { Workload } from '../model/types';
import type {
  StaffPositionItem,
  StaffPositions,
  WorkloadDetail,
  WorkloadEntry,
  WorkloadRow,
} from '../model/detail-types';

export interface BackendWorkload {
  _id: string;
  title?: string | null;
  department?: { _id: string; title: string } | string | null;
  academicYear?: { _id: string; title: string } | string | null;
  status?: string;
  date?: string | null;
  totalLectures?: number;
  totalHours?: number;
  currentStep?: string | null;
  lastEditedAfterApprovalAt?: string | null;
  needsRecalculation?: boolean | null;
  version?: number | null;
  previousVersion?: string | null;
  supersededBy?: string | null;
  supersededAt?: string | null;
}

function mapVersionFields(b: {
  version?: number | null;
  previousVersion?: string | null;
  supersededBy?: string | null;
  supersededAt?: string | null;
}) {
  const v = Number(b.version);
  return {
    version: Number.isInteger(v) && v >= 1 ? v : 1,
    previousVersionId: b.previousVersion ? String(b.previousVersion) : null,
    supersededById: b.supersededBy ? String(b.supersededBy) : null,
    supersededAt: b.supersededAt ?? null,
  };
}

function extractRef(
  ref: { _id: string; title: string } | string | null | undefined,
): { id: string | null; title: string | null } {
  if (!ref) return { id: null, title: null };
  if (typeof ref === 'string') return { id: ref, title: null };
  return { id: ref._id ?? null, title: ref.title ?? null };
}

export function mapWorkload(b: BackendWorkload): Workload {
  const department = extractRef(b.department);
  const academicYear = extractRef(b.academicYear);

  return {
    id: b._id,
    title: b.title ?? null,
    departmentId: department.id,
    departmentTitle: department.title,
    academicYearId: academicYear.id,
    academicYearTitle: academicYear.title,
    totalLectures: b.totalLectures ?? 0,
    totalHours: b.totalHours ?? 0,
    currentStep: b.currentStep ?? null,
    status: b.status ?? 'draft',
    date: b.date ?? null,
    lastEditedAfterApprovalAt: b.lastEditedAfterApprovalAt ?? null,
    needsRecalculation: b.needsRecalculation === true,
    ...mapVersionFields(b),
  };
}

export interface BackendWorkItem {
  _id: string;
  slug?: string;
  title?: string | null;
  canonical?: string | null;
  colNum?: number | null;
  stream?: number;
  total?: number;
  value?: number;
}

interface BackendWorkloadBlockDetail {
  _id: string;
  section?: string | null;
  science?: { _id: string; title: string } | null;
  practiceTitle?: string | null;
  course?: number;
  student?: number;
  studyWork?: {
    group?: number;
    stream?: number;
    semester?: number;
    thisSemester?: { totalHour?: number; auditoriumHour?: number };
    classTypes?: BackendWorkItem[];
    items?: BackendWorkItem[];
  };
  otherWork?: { items?: BackendWorkItem[] };
  leadership?: number;
  totalHour?: number;
}

interface BackendWorkloadDirectionDetail {
  _id?: string;
  direction?: { _id: string; title: string } | string | null;
  blocks?: BackendWorkloadBlockDetail[];
}

export interface BackendStaffPositionItem {
  _id?: string;
  category?: string;
  slug?: string;
  positions?: number;
  load?: number;
  totalHours?: number;
  hourly?: number;
}

export interface BackendStaffPositions {
  items?: BackendStaffPositionItem[];
  totalPositions?: number;
  hourly?: number;
}

export interface BackendWorkloadDetailFull {
  _id: string;
  title?: string | null;
  department?: { _id: string; title: string } | string | null;
  academicYear?: { _id: string; title: string } | string | null;
  status?: string;
  directions?: BackendWorkloadDirectionDetail[];
  staffPositions?: BackendStaffPositions;
  lastEditedAfterApprovalAt?: string | null;
  needsRecalculation?: boolean | null;
  version?: number | null;
  previousVersion?: string | null;
  supersededBy?: string | null;
  supersededAt?: string | null;
}

function findWorkItem(
  list: BackendWorkItem[] | undefined,
  canonical: string,
  slugFallback: string,
): BackendWorkItem | undefined {
  if (!Array.isArray(list)) return undefined;
  return (
    list.find((it) => it.canonical === canonical) ?? list.find((it) => it.slug === slugFallback)
  );
}

function entryOf(
  list: BackendWorkItem[] | undefined,
  canonical: string,
  slugFallback: string,
  field: 'stream' | 'value',
): WorkloadEntry {
  const it = findWorkItem(list, canonical, slugFallback);
  return { entryId: it?._id ?? null, value: (it ? it[field] : undefined) ?? 0 };
}

function totalOf(list: BackendWorkItem[] | undefined, canonical: string, slugFallback: string): number {
  return findWorkItem(list, canonical, slugFallback)?.total ?? 0;
}

const WC = {
  LECTURE: 'lecture',
  CLINICAL_PRACTICE: 'clinical_practice',
  SEMINAR: 'seminar',
  LAB_TRAINING: 'lab_training',
  PRACTICAL: 'practical',
  STUDENT_WORK: 'student_work',
  YAN: 'yan',
  MISSED: 'missed_lesson',
  SKILLED_PRACTICE: 'skilled_practice',
  SPECIAL: 'special',
  PARTICIPATION: 'participation',
  RECEPTION: 'reception',
  CONSULTING: 'consulting',
  OPEN_DEPARTMENT: 'open_department',
  OPEN_INTEGRAL: 'open_integral',
} as const;

function mapWorkloadBlockRow(block: BackendWorkloadBlockDetail, directionTitle: string): WorkloadRow {
  const sw = block.studyWork ?? {};
  const ow = block.otherWork ?? {};
  const classTypes = sw.classTypes;
  const studyItems = sw.items;
  const otherItems = ow.items;
  const group = sw.group ?? 0;
  const student = block.student ?? 0;

  return {
    blockId: block._id,
    direction: directionTitle,
    section: block.section ?? '—',
    science: block.science?.title ?? block.practiceTitle ?? '—',
    course: block.course ?? 0,
    student,
    group,
    perGroup: group && student ? Math.round(student / group) : 0,
    streamCount: sw.stream ?? 0,
    semester: sw.semester ?? 0,
    semTotal: sw.thisSemester?.totalHour ?? 0,
    semAud: sw.thisSemester?.auditoriumHour ?? 0,
    lectStr: entryOf(classTypes, WC.LECTURE, 'maruza', 'stream'),
    lectTot: totalOf(classTypes, WC.LECTURE, 'maruza'),
    clinStr: entryOf(classTypes, WC.CLINICAL_PRACTICE, 'klinik_amaliyot', 'stream'),
    clinTot: totalOf(classTypes, WC.CLINICAL_PRACTICE, 'klinik_amaliyot'),
    semStr: entryOf(classTypes, WC.SEMINAR, 'seminar', 'stream'),
    semTot: totalOf(classTypes, WC.SEMINAR, 'seminar'),
    labStr: entryOf(classTypes, WC.LAB_TRAINING, 'laboratoriya', 'stream'),
    pratStr: entryOf(classTypes, WC.PRACTICAL, 'amaliy', 'stream'),
    labTot: totalOf(classTypes, WC.LAB_TRAINING, 'laboratoriya'),
    pratTot: totalOf(classTypes, WC.PRACTICAL, 'amaliy'),
    on: entryOf(studyItems, WC.STUDENT_WORK, 'on', 'value'),
    yan: entryOf(studyItems, WC.YAN, 'yan', 'value'),
    missed: entryOf(studyItems, WC.MISSED, 'qoldirilgan', 'value'),
    skilled: entryOf(studyItems, WC.SKILLED_PRACTICE, 'malakaviy', 'value'),
    vada: entryOf(otherItems, WC.PARTICIPATION, 'yada_qatnashish', 'value'),
    reception: entryOf(otherItems, WC.RECEPTION, 'qabul', 'value'),
    consulting: entryOf(otherItems, WC.CONSULTING, 'maslahatchilik', 'value'),
    openDep: entryOf(otherItems, WC.OPEN_DEPARTMENT, 'ochiq_kafedra', 'value'),
    integral: entryOf(otherItems, WC.OPEN_INTEGRAL, 'ochiq_integral', 'value'),
    special: entryOf(otherItems, WC.SPECIAL, 'yada_umumiy', 'value'),
    leadership: { entryId: null, value: block.leadership ?? 0 },
    total: block.totalHour ?? 0,
  };
}

export function mapStaffPositions(sp: BackendStaffPositions | undefined): StaffPositions {
  const items: StaffPositionItem[] = (sp?.items ?? []).map((it) => ({
    id: it._id ?? null,
    category: it.category ?? '',
    slug: it.slug ?? '',
    positions: it.positions ?? 0,
    load: it.load ?? 0,
    totalHours: it.totalHours ?? 0,
    hourly: it.hourly ?? 0,
  }));
  return {
    items,
    totalPositions: sp?.totalPositions ?? 0,
    hourly: sp?.hourly ?? 0,
  };
}

export function mapWorkloadDetail(b: BackendWorkloadDetailFull): WorkloadDetail {
  const department = extractRef(b.department);
  const academicYear = extractRef(b.academicYear);
  const rows: WorkloadRow[] = [];
  for (const dir of b.directions ?? []) {
    const directionTitle = extractRef(dir.direction).title ?? '—';
    for (const block of dir.blocks ?? []) rows.push(mapWorkloadBlockRow(block, directionTitle));
  }

  return {
    id: b._id,
    title: b.title ?? null,
    departmentTitle: department.title,
    academicYearTitle: academicYear.title,
    status: b.status ?? 'draft',
    rows,
    staffPositions: mapStaffPositions(b.staffPositions),
    lastEditedAfterApprovalAt: b.lastEditedAfterApprovalAt ?? null,
    needsRecalculation: b.needsRecalculation === true,
    ...mapVersionFields(b),
  };
}
