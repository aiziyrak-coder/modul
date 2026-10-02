import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api';
import type {
  StudyPlanDetail,
  LpRef,
  LpProcessKey,
  LpCourse,
  LpLegendKey,
  LpAllValues,
  LpAllValueStat,
} from '../model/detail-types';

export const STUDY_PLAN_DETAIL_KEY = 'study-plan-detail';
const LP_ROOT = '/learning-process';

interface BackendRef {
  _id: string;
  title?: string | null;
}

interface BackendProcessKey {
  _id?: string;
  key?: string | null;
  title?: string | null;
  week?: number | string | null;
  semester?: string | null;
}

interface BackendCourseMonth {
  _id?: string;
  month?: string;
  weeks?: { week?: number; key?: string; _id?: string }[];
}

interface BackendCourseStat {
  _id?: string;
  key?: string | null;
  slug?: string;
  title?: string;
  value?: number;
}

interface BackendCourse {
  _id?: string;
  course?: string;
  courseNum?: number;
  months?: BackendCourseMonth[];
  weeks?: Record<string, string>;
  total?: number;
  statistics?: BackendCourseStat[];
}

interface BackendLegendKey {
  _id?: string;
  key?: string;
  title?: string;
}

interface BackendAllValueStat {
  _id?: string;
  slug?: string;
  title?: string;
  value?: number;
}

interface BackendAllValues {
  total?: number;
  statistics?: BackendAllValueStat[];
}

interface BackendDetail {
  _id: string;
  title?: string | null;
  direction?: BackendRef | string | null;
  academicLevel?: BackendRef | string | null;
  educationForm?: BackendRef | string | null;
  readingForm?: BackendRef | string | null;
  specialization?: BackendRef | string | null;
  studyPeriod?: BackendRef | string | null;
  year?: string | null;
  comment?: string | null;
  file?: string | null;
  planFile?: string | null;
  keys?: BackendLegendKey[];
  courses?: BackendCourse[];
  allValues?: BackendAllValues | null;
  learningProcess?: {
    keys?: BackendProcessKey[];
    title?: string | null;
  } | null;
}

function mapRef(raw: BackendRef | string | null | undefined): LpRef | null {
  if (!raw) return null;
  if (typeof raw === 'string') return null;
  return { id: raw._id, title: raw.title ?? '' };
}

function mapProcessKey(b: BackendProcessKey): LpProcessKey {
  return {
    id: b._id ?? '',
    key: b.key ?? '',
    title: b.title ?? '',
    week: b.week ?? 0,
    semester: b.semester ?? null,
  };
}

function mapCourse(b: BackendCourse): LpCourse {
  return {
    _id: b._id,
    course: b.course,
    courseNum: b.courseNum,
    months: b.months,
    weeks: b.weeks,
    total: b.total,
    statistics: b.statistics,
  };
}

function mapLegendKey(b: BackendLegendKey): LpLegendKey {
  return { _id: b._id, key: b.key, title: b.title };
}

function mapAllValueStat(b: BackendAllValueStat): LpAllValueStat {
  return {
    _id: b._id,
    slug: b.slug,
    title: b.title,
    value: b.value,
  };
}

function mapAllValues(b: BackendAllValues | null | undefined): LpAllValues | undefined {
  if (!b) return undefined;
  return {
    total: b.total,
    statistics: (b.statistics ?? []).map(mapAllValueStat),
  };
}

function mapDetail(b: BackendDetail): StudyPlanDetail {
  return {
    id: b._id,
    title: b.title ?? null,
    direction: mapRef(b.direction),
    academicLevel: mapRef(b.academicLevel),
    educationForm: mapRef(b.educationForm),
    readingForm: mapRef(b.readingForm),
    specialization: mapRef(b.specialization),
    studyPeriod: mapRef(b.studyPeriod),
    year: b.year ?? null,
    comment: b.comment ?? null,
    file: b.file ?? null,
    planFile: b.planFile ?? null,
    keys: (b.keys ?? []).map(mapLegendKey),
    courses: (b.courses ?? []).map(mapCourse),
    allValues: mapAllValues(b.allValues),
    learningProcess: {
      keys: (b.learningProcess?.keys ?? []).map(mapProcessKey),
      title: b.learningProcess?.title ?? null,
    },
  };
}

export function useStudyPlanDetail(id: string | undefined) {
  return useQuery({
    queryKey: [STUDY_PLAN_DETAIL_KEY, id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const res = await apiClient.get<BackendDetail>(`${LP_ROOT}/${id}`);
      return mapDetail(res.data);
    },
    enabled: Boolean(id),
  });
}

export function useUpdateStudyPlanDetail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      apiClient
        .put<BackendDetail>(`${LP_ROOT}/fullupdate/${id}`, formData)
        .then((r) => mapDetail(r.data)),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, vars.id] });
    },
  });
}

export function useUpdateSpecialPart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      keys,
    }: {
      id: string;
      keys: { _id: string; week?: number | string; semester?: string }[];
    }) =>
      apiClient
        .put<BackendDetail>(`${LP_ROOT}/special-part/${id}`, {
          learningProcess: { keys },
        })
        .then((r) => mapDetail(r.data)),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, vars.id] });
    },
  });
}

interface BackendStudyPlanSemester {
  hour?: number | null;
  credit?: number | null;
  weeklyHours?: number | null;
  assessmentType?: string | null;
}

interface BackendStudyPlanScience {
  _id: string;
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  totalCredit?: number | null;
  science?: string | { _id?: string } | null;
  rowType?: 'subject' | 'practice' | 'sectionHeader' | 'aggregate' | 'electiveSlot';
  particle?: { slug?: string; title?: string; value?: number }[];
  semesters?: Record<string, BackendStudyPlanSemester> | null;
  alternatives?: { title?: string | null }[];
}

interface BackendStudyPlanBlock {
  _id: string;
  blockCode?: string;
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  totalCredit?: number | null;
  sciences?: BackendStudyPlanScience[];
  semesters?: Record<string, BackendStudyPlanSemester> | null;
}

interface BackendStudyPlanParticleLabel {
  _id?: string;
  slug?: string | null;
  title?: string | null;
}

interface BackendStudyPlan {
  _id: string;
  meta?: {
    particles?: {
      items?: BackendStudyPlanParticleLabel[];
    } | null;
    distribution?: {
      audience?: number[];
      semester?: number[];
    } | null;
  } | null;
  blocks?: BackendStudyPlanBlock[];
  file?: string | null;
}

export interface StudyPlanPlan {
  id: string;
  particleLabels: { slug: string; title: string }[];
  distribution: {
    audience: number[];
    semester: number[];
  };
  blocks: {
    id: string;
    blockCode: string;
    code: string | null;
    title: string | null;
    totalCredit: number;
    semesters: Record<string, { hour: number; credit: number }>;
    sciences: {
      id: string;
      serialNumber: string | null;
      code: string | null;
      title: string | null;
      totalCredit: number;
      scienceId: string | null;
      kind: 'subject' | 'practice' | 'sectionHeader' | 'aggregate' | 'electiveSlot';
      particle: { slug: string; title: string; value: number }[];
      semesters: Record<string, { hour: number; credit: number; weeklyHours: number }>;
      alternatives: { title: string | null }[];
    }[];
  }[];
  file: string | null;
}

function refId(v?: string | { _id?: string } | null): string | null {
  if (!v) return null;
  return typeof v === 'string' ? v : (v._id ?? null);
}

function mapStudyPlanPlan(b: BackendStudyPlan): StudyPlanPlan {
  return {
    id: b._id,
    particleLabels: (b.meta?.particles?.items ?? []).map((p) => ({
      slug: p.slug ?? '',
      title: p.title ?? '',
    })),
    distribution: {
      audience: b.meta?.distribution?.audience ?? [],
      semester: b.meta?.distribution?.semester ?? [],
    },
    blocks: (b.blocks ?? []).map((blk) => ({
      id: blk._id,
      blockCode: blk.blockCode ?? '',
      code: blk.code ?? null,
      title: blk.title ?? null,
      totalCredit: blk.totalCredit ?? 0,
      semesters: Object.fromEntries(
        Object.entries(blk.semesters ?? {}).map(([k, v]) => [
          k,
          { hour: v?.hour ?? 0, credit: v?.credit ?? 0 },
        ]),
      ),
      sciences: (blk.sciences ?? []).map((sci) => ({
        id: sci._id,
        serialNumber: sci.serialNumber ?? null,
        code: sci.code ?? null,
        title: sci.title ?? null,
        totalCredit: sci.totalCredit ?? 0,
        scienceId: refId(sci.science),
        kind: sci.rowType ?? 'subject',
        particle: (sci.particle ?? []).map((p) => ({
          slug: p.slug ?? '',
          title: p.title ?? '',
          value: p.value ?? 0,
        })),
        semesters: Object.fromEntries(
          Object.entries(sci.semesters ?? {}).map(([k, v]) => [
            k,
            {
              hour: v?.hour ?? 0,
              credit: v?.credit ?? 0,
              weeklyHours: v?.weeklyHours ?? 0,
            },
          ]),
        ),
        alternatives: (sci.alternatives ?? []).map((a) => ({ title: a.title ?? null })),
      })),
    })),
    file: b.file ?? null,
  };
}

export function useStudyPlanPlan(learningProcessId: string | undefined) {
  return useQuery({
    queryKey: [STUDY_PLAN_DETAIL_KEY, 'plan', learningProcessId],
    queryFn: async () => {
      if (!learningProcessId) throw new Error('id kerak');
      const res = await apiClient.get<BackendStudyPlan>(`${LP_ROOT}/study-plan`, {
        params: { learningProcess: learningProcessId },
      });
      return mapStudyPlanPlan(res.data);
    },
    enabled: Boolean(learningProcessId),
  });
}

export interface UpdateLearningProcessCoursePayload {
  courseId?: string;
  total?: number;
  statistics?: { _id: string; value: number | string }[];
  weeks?: Record<string, number | string>;
  allValues?: {
    total?: number;
    statistics?: { title: string; _id: string; value: number | string }[];
  };
}

export function useUpdateLearningProcessCourse(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLearningProcessCoursePayload) => {
      if (!id) return Promise.reject(new Error('id kerak'));
      return apiClient
        .put<BackendDetail>(`${LP_ROOT}/${id}`, payload)
        .then((r) => mapDetail(r.data));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, id] });
    },
  });
}

export interface UpdateStudyPlanSciencePayload {
  _id: string;
  parentId?: string;
  title?: string;
  code?: string;
  serialNumber?: string;
  totalCredit?: number | string;
  particle?: { _id: string; [key: string]: string | number }[];
  smester?: Record<string, number | string>;
}

export function useUpdateStudyPlanScience(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateStudyPlanSciencePayload) => {
      if (!planId) return Promise.reject(new Error('planId kerak'));
      return apiClient
        .put<BackendStudyPlan>(`${LP_ROOT}/study-plan/${planId}`, payload)
        .then((r) => mapStudyPlanPlan(r.data));
    },
    onSuccess: (_data, _vars, _ctx) => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, 'plan'] });
    },
  });
}

export interface LinkStudyPlanSciencePayload {
  blockCode: string;
  scienceCode: string;
  scienceId: string;
}

export function useLinkStudyPlanScience(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LinkStudyPlanSciencePayload) => {
      if (!planId) return Promise.reject(new Error('planId kerak'));
      return apiClient.patch(`/study-plans/${planId}/link-science`, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, 'plan'] });
    },
  });
}

export interface AddElectiveRowPayload {
  blockCode: string;
  science: string;
  serialNumber?: string;
  semesters: {
    semester: string;
    hour: number;
    credit: number;
    particle?: { slug: string; title: string; value: number }[];
  }[];
  alternatives?: { scienceId: string }[];
}

interface ElectiveRowMutationResult {
  quota: Record<string, { hour: number; credit: number }>;
  derivedWorkingPlans: number;
  warning: string | null;
}

interface AddElectiveRowResponse {
  message?: string;
  data: ElectiveRowMutationResult & { row: unknown };
}

export function useAddElectiveRow(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddElectiveRowPayload) => {
      if (!planId) return Promise.reject(new Error('planId kerak'));
      return apiClient
        .post<AddElectiveRowResponse>(`/study-plans/${planId}/elective-row`, payload)
        .then((r) => r.data.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, 'plan'] });
    },
  });
}

interface RemoveElectiveRowResponse {
  message?: string;
  data: ElectiveRowMutationResult & { removed: boolean };
}

export function useRemoveElectiveRow(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) => {
      if (!planId) return Promise.reject(new Error('planId kerak'));
      return apiClient
        .delete<RemoveElectiveRowResponse>(`/study-plans/${planId}/elective-row/${rowId}`)
        .then((r) => r.data.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, 'plan'] });
    },
  });
}

export function useUpdateSpecialPartTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiClient
        .put<BackendDetail>(`${LP_ROOT}/special-part/title/${id}`, {
          learningProcess: { title },
        })
        .then((r) => mapDetail(r.data)),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, vars.id] });
    },
  });
}

export interface MonthWeeksPayload {
  counts: { month: string; count: number }[];
  applyToDraftSchedules: boolean;
}

interface BackendMonthWeeksResponse {
  message?: string;
  data?: {
    months?: { month?: string; count?: number }[];
    updatedCourses?: number;
    schedules?: { updated?: number; skippedLocked?: number; errors?: string[] };
  };
}

export interface MonthWeeksResult {
  updatedCourses: number;
  schedules: { updated: number; skippedLocked: number; errors: string[] };
}

export function mapMonthWeeksResult(b: BackendMonthWeeksResponse): MonthWeeksResult {
  const s = b.data?.schedules ?? {};
  return {
    updatedCourses: b.data?.updatedCourses ?? 0,
    schedules: {
      updated: s.updated ?? 0,
      skippedLocked: s.skippedLocked ?? 0,
      errors: Array.isArray(s.errors) ? s.errors : [],
    },
  };
}

export function useUpdateMonthWeeks(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MonthWeeksPayload) => {
      if (!id) return Promise.reject(new Error('id kerak'));
      return apiClient
        .put<BackendMonthWeeksResponse>(`${LP_ROOT}/${id}/month-weeks`, payload)
        .then((r) => mapMonthWeeksResult(r.data));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [STUDY_PLAN_DETAIL_KEY, id] });
    },
  });
}
