import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api';
import type {
  WorkingScheduleProcess,
  ProcessCourse,
  LegendKey,
} from '../model/process-types';

export const PROCESS_KEY = 'working-schedule-process';
export const SCIENCES_KEY = 'working-schedule-sciences';

interface BackendProcessWeek {
  week: number;
  key: string;
}

interface BackendProcessMonth {
  _id?: string;
  month: string;
  weeks: BackendProcessWeek[];
}

interface BackendStatItem {
  _id?: string;
  key?: string | null;
  slug?: string;
  title?: string;
  value?: number;
}

interface BackendProcessCourse {
  _id: string;
  course?: string;
  courseNum?: number;
  months?: BackendProcessMonth[];
  weeks?: Record<string, string>;
  total?: number;
  statistics?: BackendStatItem[];
}

interface BackendLegendKey {
  _id?: string;
  key?: string;
  title?: string;
}

interface BackendProcessResponse {
  _id: string;
  keys?: BackendLegendKey[];
  courses?: BackendProcessCourse[];
}

function mapProcessCourse(b: BackendProcessCourse): ProcessCourse {
  return {
    _id: b._id,
    course: b.course ?? '',
    courseNum: b.courseNum ?? 0,
    months: (b.months ?? []).map((m) => ({
      _id: m._id,
      month: m.month ?? '',
      weeks: (m.weeks ?? []).map((w) => ({
        week: w.week,
        key: w.key ?? ' ',
      })),
    })),
    weeks: b.weeks ?? {},
    total: b.total ?? 0,
    statistics: (b.statistics ?? []).map((s) => ({
      _id: s._id,
      key: s.key ?? null,
      slug: s.slug ?? '',
      title: s.title ?? '',
      value: s.value ?? 0,
    })),
  };
}

function mapLegendKey(b: BackendLegendKey): LegendKey {
  return {
    _id: b._id,
    key: b.key ?? ' ',
    title: b.title ?? '',
  };
}

function mapProcess(b: BackendProcessResponse): WorkingScheduleProcess {
  return {
    _id: b._id,
    keys: (b.keys ?? []).map(mapLegendKey),
    courses: (b.courses ?? []).map(mapProcessCourse),
  };
}

export interface BackendScienceItem {
  _id?: string;
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  totalCredit?: number | null;
  weeklyHours?: number | null;
  evaluationType?: string | null;
  department?: string | null;
}

export interface BackendScienceBlock {
  _id?: string;
  title?: string | null;
  blockCode?: string | null;
  jamiKreditlar?: number | null;
  sciences?: BackendScienceItem[];
  semKey?: string | null;
}

export interface BackendSciencesResponse {
  _id?: string;
  blocks?: BackendScienceBlock[];
  grandTotalCredit?: number | null;
}

export interface ScienceItem {
  id: string;
  serialNumber: string | null;
  code: string | null;
  title: string | null;
  totalCredit: number;
  weeklyHours: number;
  evaluationType: string | null;
  departmentId: string | null;
}

export interface ScienceBlock {
  id: string;
  title: string | null;
  blockCode: string | null;
  jamiKreditlar: number;
  sciences: ScienceItem[];
  semKey: string | null;
}

export interface SciencesData {
  workingPlanId: string | null;
  blocks: ScienceBlock[];
  grandTotalCredit: number;
}

function mapScienceItem(b: BackendScienceItem): ScienceItem {
  return {
    id: b._id ?? '',
    serialNumber: b.serialNumber ?? null,
    code: b.code ?? null,
    title: b.title ?? null,
    totalCredit: b.totalCredit ?? 0,
    weeklyHours: b.weeklyHours ?? 0,
    evaluationType: b.evaluationType ?? null,
    departmentId: b.department ?? null,
  };
}

function mapScienceBlock(b: BackendScienceBlock): ScienceBlock {
  return {
    id: b._id ?? '',
    title: b.title ?? null,
    blockCode: b.blockCode ?? null,
    jamiKreditlar: b.jamiKreditlar ?? 0,
    sciences: (b.sciences ?? []).map(mapScienceItem),
    semKey: b.semKey ?? null,
  };
}

function mapSciencesResponse(b: BackendSciencesResponse): SciencesData {
  return {
    workingPlanId: b._id ?? null,
    blocks: (b.blocks ?? []).map(mapScienceBlock),
    grandTotalCredit: b.grandTotalCredit ?? 0,
  };
}

export function useWorkingScheduleProcess(id: string | undefined) {
  return useQuery({
    queryKey: [PROCESS_KEY, id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const res = await apiClient.get<BackendProcessResponse>(
        `/working-schedules/process/${id}`,
      );
      return mapProcess(res.data);
    },
    enabled: Boolean(id),
  });
}

export function useWorkingScheduleSciences(id: string | undefined) {
  return useQuery({
    queryKey: [SCIENCES_KEY, id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const res = await apiClient.get<BackendSciencesResponse>(
        `/working-plans/science`,
        { params: { workingSchedule: id } },
      );
      return mapSciencesResponse(res.data);
    },
    enabled: Boolean(id),
  });
}

export const COMPOSITION_KEY = 'working-schedule-composition';

export interface BackendCompositionKey {
  _id?: string;
  key?: string;
  title?: string;
  week?: number | string;
  semester?: string | null;
}

export interface BackendCompositionResponse {
  _id?: string;
  learningProcessData?: {
    keys?: BackendCompositionKey[];
    title?: string | null;
  };
}

export interface CompositionKey {
  _id: string;
  key: string;
  title: string;
  week: number | string;
  semester: string | null;
}

export interface CompositionData {
  docId: string;
  keys: CompositionKey[];
  title: string | null;
}

function mapCompositionKey(b: BackendCompositionKey): CompositionKey {
  return {
    _id: b._id ?? '',
    key: b.key ?? '',
    title: b.title ?? '',
    week: b.week ?? 0,
    semester: b.semester ?? null,
  };
}

function mapComposition(b: BackendCompositionResponse): CompositionData {
  return {
    docId: b._id ?? '',
    keys: (b.learningProcessData?.keys ?? []).map(mapCompositionKey),
    title: b.learningProcessData?.title ?? null,
  };
}

export function useWorkingScheduleComposition(id: string | undefined) {
  return useQuery({
    queryKey: [COMPOSITION_KEY, id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const res = await apiClient.get<BackendCompositionResponse>(
        `/working-schedules/composition/${id}`,
      );
      return mapComposition(res.data);
    },
    enabled: Boolean(id),
  });
}

export function useUpdateComposition() {
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
        .put<BackendCompositionResponse>(
          `/working-schedules/composition/${id}`,
          { learningProcess: { keys } },
        )
        .then((r) => mapComposition(r.data)),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [COMPOSITION_KEY, vars.id] }),
  });
}

export interface UpdateProcessPayload {
  courseId: string;
  total?: number;
  statistics?: { _id: string; value: number | string }[];
  weeks?: Record<string, number | string>;
  allValues?: {
    total?: number;
    statistics?: { title: string; _id: string; value: number | string }[];
  };
}

export function useUpdateWorkingProcess(scheduleId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProcessPayload) => {
      if (!scheduleId) return Promise.reject(new Error('id kerak'));
      return apiClient
        .put<BackendProcessResponse>(
          `/working-schedules/process/${scheduleId}`,
          payload,
        )
        .then((r) => mapProcess(r.data));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [PROCESS_KEY, scheduleId] });
      void qc.invalidateQueries({ queryKey: [COMPOSITION_KEY, scheduleId] });
    },
  });
}

export function useUpdateCompositionTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiClient
        .put<BackendCompositionResponse>(
          `/working-schedules/composition/title/${id}`,
          { learningProcess: { title } },
        )
        .then((r) => mapComposition(r.data)),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [COMPOSITION_KEY, vars.id] }),
  });
}

export interface AssignDepartmentPayload {
  planId: string;
  code: string;
  department: string | null;
}

export function useAssignScienceDepartment(scheduleId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, code, department }: AssignDepartmentPayload) =>
      apiClient
        .patch('/working-plans/science-department', { planId, code, department })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [SCIENCES_KEY, scheduleId] });
    },
  });
}

export function useUpdateScheduleMonthWeeks(scheduleId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (counts: { month: string; count: number }[]) => {
      if (!scheduleId) return Promise.reject(new Error('id kerak'));
      return apiClient
        .put<{ message?: string }>(`/working-schedules/process/${scheduleId}/month-weeks`, { counts })
        .then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [PROCESS_KEY, scheduleId] });
      void qc.invalidateQueries({ queryKey: [COMPOSITION_KEY, scheduleId] });
    },
  });
}
