import type {
  WorkingPlan,
  WorkingPlanDetail,
  UnfilledSlot,
  WorkingPlanMeta,
  SemesterData,
  WorkingPlanBlock,
  WorkingPlanScience,
  ParticleItem,
  ParticleLabel,
  PlanRowType,
  TotalRow,
  PracticeRow,
  ElectiveUsage,
  ElectiveUsageCounts,
  ElectiveUsageInfo,
  ElectiveSwapResult,
  ElectiveAlternative,
  ElectiveAlternativesResult,
  ScienceOption,
} from '../model/types';

export interface BackendParticleItem {
  _id?: string;
  slug?: string | null;
  title?: string | null;
  value?: number | null;
  canonical?: string | null;
  colNum?: number | null;
}

export interface BackendParticleLabel {
  _id?: string;
  slug?: string | null;
  title?: string | null;
  colNum?: number | null;
}

export interface BackendAlternativeScience {
  science?: string | null;
  code?: string | null;
  title?: string | null;
  department?: string | null;
}

export interface BackendScience {
  _id: string;
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  science?: string | null;
  department?: string | null;
  particle?: BackendParticleItem[];
  totalCredit?: number | null;
  weeklyHours?: number | null;
  evaluationType?: string | null;
  alternatives?: BackendAlternativeScience[] | null;
  rowType?: string | null;
}

export interface BackendBlock {
  _id: string;
  blockCode?: string | null;
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  sciences?: BackendScience[];
}

export interface BackendTotalRow {
  title?: string | null;
  totalHour?: number | null;
  totalCredit?: number | null;
  weeklyHours?: number | null;
  particles?: BackendParticleItem[];
}

export interface BackendPracticeRow {
  title?: string | null;
  code?: string | null;
  hour?: number | null;
  credit?: number | null;
  particles?: BackendParticleItem[];
}

export interface BackendSemesterData {
  semester?: string | null;
  blocks?: BackendBlock[];
  blocksTotal?: BackendTotalRow | null;
  practice?: BackendPracticeRow | null;
  grandTotal?: BackendTotalRow | null;
}

export interface BackendWorkingPlanMeta {
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  particles?: {
    title?: string | null;
    items?: BackendParticleLabel[];
  } | null;
  distribution?: {
    title?: string | null;
    courses?: string[];
    weekly?: number[];
    semester?: number[];
  } | null;
  credit?: {
    title?: string | null;
    courses?: string[];
    weekly?: number[];
    semester?: number[];
  } | null;
  totalCredit?: string | null;
  evaluationType?: string | null;
  weeklyHours?: string | null;
}

export interface BackendWorkingPlan {
  _id: string;
  workingSchedule?:
    | {
        _id: string;
        title?: string | null;
      }
    | string
    | null;
  studyPlanLabel?: string | null;
  file?: string | null;
  date?: string | null;
  createdAt: string;
}

export interface BackendWorkingPlanDetail {
  _id: string;
  workingSchedule?:
    | {
        _id: string;
        title?: string | null;
      }
    | string
    | null;
  studyPlanLabel?: string | null;
  meta?: BackendWorkingPlanMeta | null;
  semesters?: Record<string, BackendSemesterData> | null;
  semesterNumbers?: Record<string, string> | null;
  unfilledSlots?: BackendUnfilledSlot[] | null;
  file?: string | null;
  date?: string | null;
  createdAt: string;
}

export interface BackendUnfilledSlot {
  semKey?: string | null;
  blockId?: string | null;
  rowId?: string | null;
  serialNumber?: string | null;
  credit?: number | null;
  hour?: number | null;
}

function mapParticleItem(b: BackendParticleItem): ParticleItem {
  return {
    id: b._id ?? '',
    slug: b.slug ?? '',
    title: b.title ?? '',
    value: b.value ?? 0,
    canonical: b.canonical ?? null,
    colNum: b.colNum ?? null,
  };
}

function mapParticleLabel(b: BackendParticleLabel): ParticleLabel {
  return {
    id: b._id,
    slug: b.slug ?? '',
    title: b.title ?? '',
    colNum: b.colNum ?? null,
  };
}

export function mapElectiveAlternative(b: BackendAlternativeScience): ElectiveAlternative {
  return {
    scienceId: b.science ?? null,
    code: b.code ?? null,
    title: b.title ?? null,
    departmentId: b.department ?? null,
  };
}

function mapPlanRowType(raw: string | null | undefined): PlanRowType {
  return raw === 'sectionHeader' || raw === 'aggregate' || raw === 'electiveSlot'
    ? raw
    : 'subject';
}

function mapScience(b: BackendScience): WorkingPlanScience {
  return {
    id: b._id,
    serialNumber: b.serialNumber ?? null,
    code: b.code ?? null,
    title: b.title ?? null,
    scienceRef: b.science ?? null,
    departmentRef: b.department ?? null,
    particle: (b.particle ?? []).map(mapParticleItem),
    totalCredit: b.totalCredit ?? 0,
    weeklyHours: b.weeklyHours ?? 0,
    evaluationType: b.evaluationType ?? null,
    alternatives: (b.alternatives ?? []).map(mapElectiveAlternative),
    rowType: mapPlanRowType(b.rowType),
  };
}

function mapBlock(b: BackendBlock): WorkingPlanBlock {
  return {
    id: b._id,
    blockCode: b.blockCode ?? '',
    serialNumber: b.serialNumber ?? null,
    code: b.code ?? null,
    title: b.title ?? null,
    sciences: (b.sciences ?? []).map(mapScience),
  };
}

function mapTotalRow(b: BackendTotalRow): TotalRow {
  return {
    title: b.title ?? null,
    totalHour: b.totalHour ?? 0,
    totalCredit: b.totalCredit ?? 0,
    weeklyHours: b.weeklyHours ?? 0,
    particles: (b.particles ?? []).map(mapParticleItem),
  };
}

function mapPracticeRow(b: BackendPracticeRow): PracticeRow {
  return {
    title: b.title ?? null,
    code: b.code ?? null,
    hour: b.hour ?? 0,
    credit: b.credit ?? 0,
    particles: (b.particles ?? []).map(mapParticleItem),
  };
}

function mapSemesterData(b: BackendSemesterData): SemesterData {
  return {
    semester: b.semester ?? null,
    blocks: (b.blocks ?? []).map(mapBlock),
    blocksTotal: b.blocksTotal ? mapTotalRow(b.blocksTotal) : null,
    practice: b.practice ? mapPracticeRow(b.practice) : null,
    grandTotal: b.grandTotal ? mapTotalRow(b.grandTotal) : null,
  };
}

function mapMeta(b: BackendWorkingPlanMeta): WorkingPlanMeta {
  return {
    serialNumber: b.serialNumber ?? null,
    code: b.code ?? null,
    title: b.title ?? null,
    particles: b.particles
      ? {
          title: b.particles.title ?? '',
          items: (b.particles.items ?? []).map(mapParticleLabel),
        }
      : null,
    distribution: b.distribution
      ? {
          title: b.distribution.title ?? '',
          courses: b.distribution.courses ?? [],
          weekly: b.distribution.weekly ?? [],
          semester: b.distribution.semester ?? [],
        }
      : null,
    credit: b.credit
      ? {
          title: b.credit.title ?? '',
          courses: b.credit.courses ?? [],
          weekly: b.credit.weekly ?? [],
          semester: b.credit.semester ?? [],
        }
      : null,
    totalCredit: b.totalCredit ?? null,
    evaluationType: b.evaluationType ?? null,
    weeklyHours: b.weeklyHours ?? null,
  };
}

function extractWsId(ws: BackendWorkingPlan['workingSchedule']): string | null {
  if (!ws) return null;
  if (typeof ws === 'string') return ws;
  return ws._id ?? null;
}

function extractWsTitle(
  ws: BackendWorkingPlan['workingSchedule'],
): string | null {
  if (!ws || typeof ws === 'string') return null;
  return ws.title ?? null;
}

export function mapWorkingPlan(b: BackendWorkingPlan): WorkingPlan {
  return {
    id: b._id,
    workingScheduleId: extractWsId(b.workingSchedule),
    workingScheduleTitle: extractWsTitle(b.workingSchedule),
    studyPlanLabel: b.studyPlanLabel ?? null,
    file: b.file ?? null,
    date: b.date ?? null,
    createdAt: b.createdAt,
  };
}

export function mapWorkingPlanDetail(b: BackendWorkingPlanDetail): WorkingPlanDetail {
  const semestersRaw = b.semesters ?? {};
  const semesters: Record<string, SemesterData> = {};
  for (const [key, value] of Object.entries(semestersRaw)) {
    if (value) {
      semesters[key] = mapSemesterData(value);
    }
  }

  const semesterNumbers: Record<string, string> = {};
  for (const key of Object.keys(semesters)) {
    semesterNumbers[key] = b.semesterNumbers?.[key] ?? key;
  }

  return {
    id: b._id,
    workingScheduleId: extractWsId(b.workingSchedule),
    workingScheduleTitle: extractWsTitle(b.workingSchedule),
    studyPlanLabel: b.studyPlanLabel ?? null,
    meta: b.meta ? mapMeta(b.meta) : null,
    semesters,
    semesterNumbers,
    unfilledSlots: (b.unfilledSlots ?? []).map(mapUnfilledSlot),
    file: b.file ?? null,
    date: b.date ?? null,
    createdAt: b.createdAt,
  };
}

function mapUnfilledSlot(b: BackendUnfilledSlot): UnfilledSlot {
  return {
    semKey: b.semKey ?? '',
    blockId: b.blockId ?? '',
    rowId: b.rowId ?? '',
    serialNumber: b.serialNumber ?? null,
    credit: b.credit ?? 0,
    hour: b.hour ?? 0,
  };
}

export interface BackendUsageCounts {
  total?: number | null;
  signed?: number | null;
}

export interface BackendElectiveUsage {
  science?: string | null;
  scienceProgram?: BackendUsageCounts | null;
  syllabus?: BackendUsageCounts | null;
  workload?: BackendUsageCounts | null;
  workloadDistribution?: BackendUsageCounts | null;
  total?: number | null;
  signedTotal?: number | null;
  signed?: { collection?: string | null; count?: number | null }[] | null;
}

export interface BackendElectiveUsageInfo {
  workingPlan?: string;
  studyPlan?: string | null;
  elective?: boolean | null;
  locked?: boolean | null;
  status?: string | null;
  affectedWorkingPlans?: number | null;
  lockedWorkingPlans?: number | null;
  usage?: BackendElectiveUsage | null;
  canSwap?: boolean | null;
}

export interface BackendElectiveSwapResult {
  workingPlan?: string;
  filled?: boolean | null;
  updatedPlans?: number | null;
  updatedRows?: number | null;
  studyPlanRows?: number | null;
  persisted?: boolean | null;
  persistError?: string | null;
  siblingErrors?: { workingPlan?: string; error?: string | null }[] | null;
  usage?: BackendElectiveUsage | null;
  science?: {
    from?: { science?: string | null; code?: string | null } | null;
    to?: {
      science?: string | null;
      code?: string | null;
      title?: string | null;
      department?: string | null;
    } | null;
  } | null;
}

export interface BackendScienceOption {
  _id: string;
  title?: string | null;
  scienceCode?: string | null;
}

function mapUsageCounts(b: BackendUsageCounts | null | undefined): ElectiveUsageCounts {
  return { total: b?.total ?? 0, signed: b?.signed ?? 0 };
}

export function mapElectiveUsage(b: BackendElectiveUsage | null | undefined): ElectiveUsage {
  return {
    scienceProgram: mapUsageCounts(b?.scienceProgram),
    syllabus: mapUsageCounts(b?.syllabus),
    workload: mapUsageCounts(b?.workload),
    workloadDistribution: mapUsageCounts(b?.workloadDistribution),
    total: b?.total ?? 0,
    signedTotal: b?.signedTotal ?? 0,
    signed: (b?.signed ?? []).map((s) => ({
      collection: s.collection ?? '',
      count: s.count ?? 0,
    })),
  };
}

export function mapElectiveUsageInfo(b: BackendElectiveUsageInfo): ElectiveUsageInfo {
  return {
    elective: b.elective ?? false,
    locked: b.locked ?? false,
    status: b.status ?? null,
    hasStudyPlan: Boolean(b.studyPlan),
    affectedWorkingPlans: b.affectedWorkingPlans ?? 0,
    lockedWorkingPlans: b.lockedWorkingPlans ?? 0,
    usage: mapElectiveUsage(b.usage),
    canSwap: b.canSwap ?? false,
  };
}

export function mapElectiveSwapResult(b: BackendElectiveSwapResult): ElectiveSwapResult {
  return {
    updatedPlans: b.updatedPlans ?? 0,
    updatedRows: b.updatedRows ?? 0,
    studyPlanRows: b.studyPlanRows ?? 0,
    persisted: b.persisted === true,
    persistError: b.persistError ?? null,
    siblingErrors: (b.siblingErrors ?? [])
      .map((e) => e.error ?? '')
      .filter((msg) => msg.length > 0),
    newScienceTitle: b.science?.to?.title ?? null,
    newScienceCode: b.science?.to?.code ?? null,
    filled: b.filled === true,
  };
}

export interface BackendElectiveAlternativesResult {
  workingPlan?: string;
  studyPlan?: string;
  updatedRows?: number | null;
  studyPlanRows?: number | null;
  persisted?: boolean | null;
  persistError?: string | null;
  alternatives?: BackendAlternativeScience[] | null;
}

export function mapElectiveAlternativesResult(
  b: BackendElectiveAlternativesResult,
): ElectiveAlternativesResult {
  return {
    updatedRows: b.updatedRows ?? 0,
    studyPlanRows: b.studyPlanRows ?? 0,
    persisted: b.persisted === true,
    persistError: b.persistError ?? null,
    alternatives: (b.alternatives ?? []).map(mapElectiveAlternative),
  };
}

export function mapScienceOption(b: BackendScienceOption): ScienceOption {
  return {
    id: b._id,
    title: b.title ?? '',
    code: b.scienceCode ?? null,
  };
}
