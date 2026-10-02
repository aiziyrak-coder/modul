import type {
  Distribution,
  DistributionDetail,
  DistributionTeacher,
  DistributionBlock,
  ClassTypeEntry,
  StudyWorkItem,
  WorkloadBlockOption,
  TeacherOption,
  GroupOption,
  ApprovalStep,
  Vacancy,
  VacancyBlock,
  VacancyRef,
  TeacherAcceptanceStatus,
  ElectiveOption,
  ElectiveOptions,
  ElectiveChoiceResult,
} from '../model/types';
import type { BlockJustification, SuitabilityFlag } from '../lib/suitability';

export const DEFAULT_ALLOWED_STAKES: number[] = [0.25, 0.5, 0.75, 1.0];

export interface BackendDistributionListItem {
  _id: string;
  title?: string | null;
  department?: { _id: string; title?: string | null } | string | null;
  academicYear?: { _id: string; title: string } | string | null;
  scienceNumber?: number;
  totalHour?: number;
  residueHour?: number;
  course?: number;
  status?: string;
  date?: string | null;
}

interface BackendTeacher {
  _id: string;
  teacher?: { _id: string; firstName?: string; lastName?: string; middleName?: string } | null;
  stavka?: number;
  position?: string | null;
  minHour?: number | null;
  maxHour?: number | null;
  isVacant?: boolean;
  vacantLabel?: string | null;
  totalHour?: number;
  auditoriumHour?: number;
  blocks?: BackendBlock[];
  acceptanceStatus?: string;
  rejectionReason?: string | null;
  respondedAt?: string | null;
}

interface BackendClassType {
  slug: string;
  title?: string | null;
  canonical?: string | null;
  colNum?: number | null;
  stream?: number | null;
  total?: number | null;
}

interface BackendStudyWorkItem {
  slug: string;
  title?: string | null;
  canonical?: string | null;
  colNum?: number | null;
  value?: number | null;
}

interface BackendStream {
  studentCount?: number;
}

interface BackendBlock {
  _id: string;
  science?: { _id: string; title: string } | null;
  course?: number;
  semester?: number;
  totalHour?: number;
  student?: number;
  workloadBlockId?: string | null;
  groups?: unknown[];
  streams?: BackendStream[];
  classTypeSlugs?: string[] | null;
  studyWork?: {
    group?: number;
    stream?: number;
    thisSemester?: {
      totalHour?: number;
      auditoriumHour?: number;
    };
    classTypes?: BackendClassType[];
    items?: BackendStudyWorkItem[];
  };
  suitability?: { flag?: SuitabilityFlag | null } | null;
  justification?: {
    basis?: string | null;
    note?: string | null;
    declaredBy?: { _id: string; firstName?: string | null; lastName?: string | null } | string | null;
    declaredAt?: string | null;
  } | null;
}

export interface BackendApprovalStep {
  step?: string | number | null;
  label?: string | null;
  approvedBy?: {
    _id: string;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
  } | string | null;
  status?: 'pending' | 'approved' | 'rejected' | null;
  date?: string | null;
  comment?: string | null;
}

export interface BackendDistributionDetail {
  _id: string;
  title?: string | null;
  status?: string;
  date?: string | null;
  scienceNumber?: number;
  totalHour?: number;
  residueHour?: number;
  department?: { _id: string; title?: string; name?: string } | null;
  workload?: {
    _id: string;
    academicYear?: { _id: string; title: string } | string | null;
    title?: string | null;
    date?: string | null;
  } | null;
  teachers?: BackendTeacher[];
  approvalSteps?: BackendApprovalStep[];
  allowedStakes?: number[];
}

function extractAcademicYearTitle(
  ay: { _id: string; title: string } | string | null | undefined,
): string | null {
  if (!ay) return null;
  if (typeof ay === 'string') return null;
  return ay.title ?? null;
}

export function lookupClassType(
  classTypes: ClassTypeEntry[],
  canonical: string,
  slugFallback?: string,
): { stream: number; total: number } {
  let entry = classTypes.find(
    (ct) => ct.canonical !== null && ct.canonical === canonical,
  );
  if (!entry && slugFallback) {
    entry = classTypes.find((ct) => ct.slug === slugFallback);
  }
  return {
    stream: entry?.stream ?? 0,
    total: entry?.total ?? 0,
  };
}

export function lookupStudyWorkItem(
  items: StudyWorkItem[],
  canonical: string,
  slugFallback?: string,
): number {
  let entry = items.find(
    (it) => it.canonical !== null && it.canonical === canonical,
  );
  if (!entry && slugFallback) {
    entry = items.find((it) => it.slug === slugFallback);
  }
  return entry?.value ?? 0;
}

function mapClassType(ct: BackendClassType): ClassTypeEntry {
  return {
    slug: ct.slug,
    title: ct.title ?? null,
    canonical: ct.canonical ?? null,
    colNum: ct.colNum ?? null,
    stream: ct.stream ?? 0,
    total: ct.total ?? 0,
  };
}

function mapStudyWorkItem(it: BackendStudyWorkItem): StudyWorkItem {
  return {
    slug: it.slug,
    title: it.title ?? null,
    canonical: it.canonical ?? null,
    colNum: it.colNum ?? null,
    value: it.value ?? 0,
  };
}

function toGroupIds(groups: unknown[] | undefined): string[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((g) => {
      if (typeof g === 'string') return g;
      if (g && typeof g === 'object' && '_id' in g) return String((g as { _id: unknown })._id);
      return '';
    })
    .filter(Boolean);
}

function calcStudentCount(b: BackendBlock): number {
  if (b.student != null && b.student > 0) return b.student;
  if (Array.isArray(b.streams) && b.streams.length > 0) {
    return b.streams.reduce((sum, s) => sum + (s.studentCount ?? 0), 0);
  }
  return 0;
}

function mapJustification(raw: BackendBlock['justification']): BlockJustification {
  const declaredByRaw = raw?.declaredBy;
  let declaredBy: string | null = null;
  if (declaredByRaw && typeof declaredByRaw === 'object') {
    const parts = [declaredByRaw.lastName, declaredByRaw.firstName].filter(Boolean);
    declaredBy = parts.join(' ') || null;
  }
  return {
    basis: (raw?.basis as BlockJustification['basis']) ?? null,
    note: raw?.note ?? null,
    declaredBy,
    declaredAt: raw?.declaredAt ?? null,
  };
}

function mapBlock(b: BackendBlock): DistributionBlock {
  const sw = b.studyWork;
  return {
    id: b._id,
    scienceId: b.science?._id ?? null,
    scienceName: b.science?.title ?? null,
    course: b.course ?? 0,
    semester: b.semester ?? 1,
    groupCount: sw?.group ?? (Array.isArray(b.groups) ? b.groups.length : 0),
    streamCount: sw?.stream ?? (Array.isArray(b.streams) ? b.streams.length : 0),
    studentCount: calcStudentCount(b),
    semTotalHour: sw?.thisSemester?.totalHour ?? 0,
    auditoriumHour: sw?.thisSemester?.auditoriumHour ?? 0,
    classTypes: (sw?.classTypes ?? []).map(mapClassType),
    studyWorkItems: (sw?.items ?? []).map(mapStudyWorkItem),
    totalHour: b.totalHour ?? 0,
    workloadBlockId: b.workloadBlockId ? String(b.workloadBlockId) : null,
    groupIds: toGroupIds(b.groups),
    suitability: b.suitability?.flag ?? 'unknown',
    justification: mapJustification(b.justification),
    classTypeSlugs: Array.isArray(b.classTypeSlugs) ? b.classTypeSlugs.map(String) : [],
  };
}

function normalizeAcceptanceStatus(raw: string | undefined): TeacherAcceptanceStatus {
  if (raw === 'accepted' || raw === 'rejected') return raw;
  return 'pending';
}

function mapTeacher(t: BackendTeacher): DistributionTeacher {
  const teacher = t.teacher;
  let fullName = 'Vakant';
  if (teacher) {
    const parts = [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean);
    fullName = parts.join(' ') || 'Nomsiz';
  }
  return {
    id: t._id,
    userId: teacher?._id ?? null,
    fullName,
    stavka: t.stavka ?? 1,
    position: t.position ?? null,
    isVacant: t.isVacant ?? false,
    vacantLabel: t.vacantLabel ?? null,
    blocks: (t.blocks ?? []).map(mapBlock),
    totalHour: t.totalHour ?? 0,
    auditoriumHour: t.auditoriumHour ?? null,
    minHour: t.minHour ?? null,
    maxHour: t.maxHour ?? null,
    acceptanceStatus: normalizeAcceptanceStatus(t.acceptanceStatus),
    rejectionReason: t.rejectionReason ?? null,
    respondedAt: t.respondedAt ?? null,
  };
}

export function mapDistribution(b: BackendDistributionListItem): Distribution {
  return {
    id: b._id,
    title: b.title ?? null,
    departmentTitle:
      b.department && typeof b.department === 'object' ? (b.department.title ?? null) : null,
    academicYearTitle: extractAcademicYearTitle(b.academicYear),
    scienceNumber: b.scienceNumber ?? 0,
    totalHour: b.totalHour ?? 0,
    residueHour: b.residueHour ?? 0,
    course: b.course ?? 0,
    status: b.status ?? 'draft',
    date: b.date ?? null,
  };
}

interface BackendWorkloadBlock {
  _id: string;
  science?: { _id: string; title: string; department?: { _id: string } | string | null } | null;
  course?: number;
  studyWork?: {
    semester?: number;
    stream?: number | null;
    group?: number | null;
    isLastSemester?: boolean;
    thisSemester?: { totalHour?: number };
    classTypes?: BackendClassType[];
    items?: BackendStudyWorkItem[];
  };
  otherWork?: { items?: Array<{ value?: number | null }> | null } | null;
  leadership?: number | null;
  totalHour?: number;
  groups?: Array<{ _id: string } | string>;
}

interface BackendWorkloadDirection {
  _id?: string;
  direction?: string | { _id: string } | null;
  blocks?: BackendWorkloadBlock[];
}

export interface BackendWorkloadDetail {
  _id: string;
  academicYear?: string | { _id: string } | null;
  department?: string | { _id: string } | null;
  directions?: BackendWorkloadDirection[];
}

export function mapWorkloadBlocks(b: BackendWorkloadDetail): WorkloadBlockOption[] {
  const result: WorkloadBlockOption[] = [];
  const academicYearId =
    typeof b.academicYear === 'string' ? b.academicYear : (b.academicYear?._id ?? null);
  const departmentId =
    typeof b.department === 'string' ? b.department : (b.department?._id ?? null);

  for (const dir of b.directions ?? []) {
    const directionId =
      typeof dir.direction === 'string' ? dir.direction : (dir.direction?._id ?? null);

    for (const blk of dir.blocks ?? []) {
      const scienceName = blk.science?.title ?? null;
      const course = blk.course ?? 0;
      const semester = blk.studyWork?.semester ?? 1;
      const totalHour = blk.totalHour ?? 0;
      const groupIds = (blk.groups ?? []).map((g) =>
        typeof g === 'string' ? g : (g as { _id: string })._id,
      );
      const classTypes = (blk.studyWork?.classTypes ?? []).map(mapClassType);
      const studyWorkItems = (blk.studyWork?.items ?? []).map(mapStudyWorkItem);
      const scienceDepartmentId =
        typeof blk.science?.department === 'string'
          ? blk.science.department
          : (blk.science?.department?._id ?? null);
      const isLastSemester = blk.studyWork?.isLastSemester !== false;
      const nonAuditHour =
        (blk.otherWork?.items ?? []).reduce((sum, it) => sum + (Number(it.value) || 0), 0) +
        (Number(blk.leadership) || 0);
      result.push({
        id: blk._id,
        scienceName,
        course,
        semester,
        totalHour,
        directionId,
        academicYearId,
        groupIds,
        classTypes,
        studyWorkItems,
        scienceDepartmentId,
        isLastSemester,
        nonAuditHour,
        departmentId,
        streamCount: typeof blk.studyWork?.stream === 'number' ? blk.studyWork.stream : null,
        groupCount: typeof blk.studyWork?.group === 'number' ? blk.studyWork.group : null,
      });
    }
  }
  return result;
}

interface BackendTeacherProfile {
  _id: string;
  user?: {
    _id: string;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
  } | null;
  department?: { _id: string; title?: string | null } | string | null;
  teachingSpecialtyName?: string | null;
  teachingSpecialtyCode?: string | null;
  academicDegree?: string | null;
}

export function mapTeacherOption(b: BackendTeacherProfile): TeacherOption | null {
  const u = b.user;
  if (!u?._id) return null;
  const parts = [u.lastName, u.firstName, u.middleName].filter(Boolean);
  const dept = b.department && typeof b.department === 'object' ? b.department : null;
  return {
    id: u._id,
    fullName: parts.join(' ') || 'Nomsiz',
    departmentId: dept ? dept._id : typeof b.department === 'string' ? b.department : null,
    departmentTitle: dept?.title ?? null,
    specialtyName: b.teachingSpecialtyName ?? null,
    specialtyCode: b.teachingSpecialtyCode ?? null,
    academicDegree: b.academicDegree ?? null,
  };
}

type BackendRef = string | { _id: string; title?: string | null } | null;

interface BackendGroup {
  _id: string;
  title?: string | null;
  studentNumber?: number | null;
  direction?: BackendRef;
  course?: BackendRef;
  academicYear?: BackendRef;
}

function refId(ref: BackendRef | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function courseTitleToNumber(ref: BackendRef | undefined): number | null {
  if (!ref || typeof ref === 'string') return null;
  const m = /(\d+)/.exec(ref.title ?? '');
  return m ? Number(m[1]) : null;
}

export function mapGroupOption(b: BackendGroup): GroupOption {
  return {
    id: b._id,
    title: b.title ?? b._id,
    directionId: refId(b.direction),
    courseNumber: courseTitleToNumber(b.course),
    academicYearId: refId(b.academicYear),
    studentNumber: typeof b.studentNumber === 'number' ? b.studentNumber : null,
  };
}

export function mapApprovalStep(b: BackendApprovalStep): ApprovalStep {
  let approverName: string | null = null;
  if (b.approvedBy && typeof b.approvedBy === 'object') {
    const parts = [b.approvedBy.lastName, b.approvedBy.firstName, b.approvedBy.middleName].filter(
      Boolean,
    );
    approverName = parts.join(' ') || null;
  }
  return {
    step: b.step ?? '',
    label: b.label ?? '',
    approverName,
    status: b.status ?? 'pending',
    date: b.date ?? null,
    comment: b.comment ?? null,
  };
}

export interface BackendVacancyRef {
  _id: string;
  title: string | null;
}

export interface BackendVacancyBlock {
  science: string | null;
  scienceTitle: string | null;
  course: number;
  semester: number;
  totalHour: number;
}

export interface BackendVacancy {
  distributionId: string;
  distributionTitle: string | null;
  distributionStatus: string;
  course: number;
  department: BackendVacancyRef | null;
  academicYear: BackendVacancyRef | null;
  teacherEntryId: string;
  vacancyNumber: number | null;
  vacantLabel: string | null;
  vacancyReason: string | null;
  vacantSince: string | null;
  leave?: { type?: string | null; fromDate?: string | null; toDate?: string | null } | null;
  totalHour: number;
  blocks: BackendVacancyBlock[];
  requiredPosition: string | null;
  requiredSpecialization: string | null;
  requiredAcademicTitle: string | null;
  deadline: string | null;
  postedAt: string | null;
}

function mapVacancyRef(ref: BackendVacancyRef | null | undefined): VacancyRef | null {
  if (!ref?._id) return null;
  return { id: ref._id, title: ref.title ?? '—' };
}

function mapVacancyBlock(b: BackendVacancyBlock): VacancyBlock {
  return {
    science: b.science ?? null,
    scienceTitle: b.scienceTitle ?? null,
    course: b.course ?? 0,
    semester: b.semester ?? 1,
    totalHour: b.totalHour ?? 0,
  };
}

export function mapVacancy(b: BackendVacancy): Vacancy {
  return {
    distributionId: b.distributionId,
    distributionTitle: b.distributionTitle ?? null,
    distributionStatus: b.distributionStatus ?? 'draft',
    course: b.course ?? 0,
    department: mapVacancyRef(b.department),
    academicYear: mapVacancyRef(b.academicYear),
    teacherEntryId: b.teacherEntryId,
    vacancyNumber: b.vacancyNumber ?? null,
    vacantLabel: b.vacantLabel ?? null,
    vacancyReason: b.vacancyReason ?? null,
    vacantSince: b.vacantSince ?? null,
    leave: b.leave?.type
      ? { type: b.leave.type, fromDate: b.leave.fromDate ?? null, toDate: b.leave.toDate ?? null }
      : null,
    totalHour: b.totalHour ?? 0,
    blocks: (b.blocks ?? []).map(mapVacancyBlock),
    requiredPosition: b.requiredPosition ?? null,
    requiredSpecialization: b.requiredSpecialization ?? null,
    requiredAcademicTitle: b.requiredAcademicTitle ?? null,
    deadline: b.deadline ?? null,
    postedAt: b.postedAt ?? null,
  };
}

export interface BackendElectiveOption {
  science?: string | null;
  code?: string | null;
  title?: string | null;
  department?: string | null;
  selectable?: boolean | null;
  reason?: string | null;
  suitability?: SuitabilityFlag | null;
}

export interface BackendElectiveOptions {
  main?: BackendElectiveOption | null;
  alternatives?: BackendElectiveOption[] | null;
}

export interface BackendElectiveChoiceResult {
  distribution?: string;
  blockId?: string;
  science?: string | null;
  electiveSlot?: string | null;
  totalHour?: number | null;
}

function mapElectiveOption(
  b: BackendElectiveOption,
  defaultSelectable: boolean,
): ElectiveOption {
  return {
    scienceId: b.science ?? null,
    code: b.code ?? null,
    title: b.title ?? null,
    departmentId: b.department ?? null,
    selectable: b.selectable ?? defaultSelectable,
    reason: b.reason ?? null,
    suitability: b.suitability ?? 'unknown',
  };
}

export function mapElectiveOptions(b: BackendElectiveOptions): ElectiveOptions {
  return {
    main: b.main ? mapElectiveOption(b.main, true) : null,
    alternatives: (b.alternatives ?? []).map((a) => mapElectiveOption(a, false)),
  };
}

export function mapElectiveChoiceResult(
  b: BackendElectiveChoiceResult,
): ElectiveChoiceResult {
  return {
    blockId: b.blockId ?? '',
    scienceId: b.science ?? null,
    electiveSlotScienceId: b.electiveSlot ?? null,
    totalHour: b.totalHour ?? 0,
  };
}

export function mapDistributionDetail(b: BackendDistributionDetail): DistributionDetail {
  const wl = b.workload;
  const workloadTitle = wl?.title ?? null;
  const workloadDate = wl?.date ?? null;
  const academicYearTitle = wl
    ? extractAcademicYearTitle(wl.academicYear)
    : null;

  return {
    id: b._id,
    title: b.title ?? null,
    departmentName: b.department?.title ?? b.department?.name ?? null,
    workloadTitle,
    workloadDate,
    academicYearTitle,
    scienceNumber: b.scienceNumber ?? 0,
    totalHour: b.totalHour ?? 0,
    residueHour: b.residueHour ?? 0,
    status: b.status ?? 'draft',
    date: b.date ?? null,
    teachers: (b.teachers ?? []).map(mapTeacher),
    workloadId: wl?._id ?? null,
    approvalHistory: (b.approvalSteps ?? []).map(mapApprovalStep),
    allowedStakes: b.allowedStakes?.length ? b.allowedStakes : DEFAULT_ALLOWED_STAKES,
  };
}
