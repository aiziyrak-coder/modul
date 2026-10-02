import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchList,
  fetchOne,
  postJson,
  putJson,
  uploadMultipart,
} from '@/shared/api';
import type {
  IndicatorInput,
  SubmissionInput,
  SubmissionStatus,
  ReviewInput,
  Announcement,
  AnnouncementInput,
  Semester,
  TeacherAccess,
  TeacherProfile,
  TeacherScoreDetail,
} from '../model/types';
import {
  toCreatePayload,
  toIndicator,
  toUpdatePayload,
  type BackendIndicator,
} from './indicator-mapper';
import {
  toDepartmentReport,
  toFacultyReport,
  toReportParams,
  toTeacherReport,
  type BackendDepartmentReport,
  type BackendFacultyReport,
  type BackendTeacherReport,
  type ReportQuery,
} from './report-mapper';
import {
  hasFiles,
  toReviewPayload,
  toSubmission,
  toSubmissionCreatePayload,
  toSubmissionMultipart,
  type BackendSubmission,
} from './submission-mapper';

const INDICATORS = '/indicators';
const REPORTS = '/submissions/_system/report';
const FILES_ZIP = '/submissions/_system/files.zip';
const ANNOUNCEMENTS = '/eq-announcements';
const TEACHER_ACCESS = '/eq-teacher-access';
const FACULTIES = '/faculties';
const DEPARTMENTS = '/departments';
const SUBMISSIONS = '/submissions';

const K = {
  indicators: 'eq:indicators',
  indicator: 'eq:indicator',
  activeIndicators: 'eq:activeIndicators',
  submissions: 'eq:submissions',
  submission: 'eq:submission',
  announcements: 'eq:announcements',
  reportFaculty: 'eq:report:faculty',
  reportDepartment: 'eq:report:department',
  reportTeachers: 'eq:report:teachers',
  teacherScore: 'eq:teacherScore',
  teacherTotalScore: 'eq:teacherTotalScore',
  faculties: 'eq:faculties',
  departments: 'eq:departments',
  academicYears: 'eq:academicYears',
  teacherAccess: 'eq:teacherAccess',
  teacherProfile: 'eq:teacherProfile',
} as const;

export interface IndicatorListParams {
  search?: string;
  active?: boolean;
}

export function useIndicatorList(params: IndicatorListParams = {}) {
  return useQuery({
    queryKey: [K.indicators, params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await fetchList<BackendIndicator>(INDICATORS, {
        ...(params.search ? { search: params.search } : {}),
        ...(params.active !== undefined ? { active: params.active } : {}),
      });
      const docs = raw.map(toIndicator);
      return {
        docs,
        totalDocs: docs.length,
        page: 1,
        limit: docs.length,
        totalPages: 1,
      };
    },
  });
}

export function useIndicator(id: string | undefined) {
  return useQuery({
    queryKey: [K.indicator, id],
    queryFn: async () => toIndicator(await fetchOne<BackendIndicator>(`${INDICATORS}/${id}`)),
    enabled: !!id,
  });
}

export function useActiveIndicators() {
  return useQuery({
    queryKey: [K.activeIndicators],
    queryFn: async () =>
      (await fetchList<BackendIndicator>(INDICATORS, { active: true })).map(toIndicator),
  });
}

export function useCreateIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IndicatorInput) => postJson(INDICATORS, toCreatePayload(body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [K.indicators] }),
  });
}

export function useUpdateIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<IndicatorInput> }) =>
      putJson(`${INDICATORS}/${id}`, toUpdatePayload(body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [K.indicators] });
      qc.invalidateQueries({ queryKey: [K.indicator] });
    },
  });
}

export function useToggleIndicatorStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      putJson(`${INDICATORS}/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [K.indicators] }),
  });
}

export function useDeleteIndicator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${INDICATORS}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [K.indicators] }),
  });
}

export interface SubmissionListParams {
  status?: SubmissionStatus;
  search?: string;
  indicatorSearch?: string;
  indicator?: string;
  teacherId?: string;
  faculty?: string;
  department?: string;
  academicYear?: string;
  semester?: number | null;
}

export function useSubmissionList(params: SubmissionListParams = {}) {
  return useQuery({
    queryKey: [K.submissions, params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = await fetchList<BackendSubmission>(SUBMISSIONS, {
        ...(params.status ? { status: params.status } : {}),
        ...(params.academicYear ? { academicYear: params.academicYear } : {}),
        ...(params.indicator ? { indicator: params.indicator } : {}),
        ...(params.teacherId ? { teacher: params.teacherId } : {}),
      });
      let docs = raw.map(toSubmission);

      const q = params.search?.trim().toLowerCase();
      if (q) {
        docs = docs.filter((d) =>
          `${d.teacher.lastName} ${d.teacher.firstName} ${d.teacher.middleName ?? ''}`
            .toLowerCase()
            .includes(q),
        );
      }
      const iq = params.indicatorSearch?.trim().toLowerCase();
      if (iq) {
        docs = docs.filter((d) => d.indicator.title.toLowerCase().includes(iq));
      }
      if (params.faculty) {
        docs = docs.filter((d) => d.teacher.faculty?._id === params.faculty);
      }
      if (params.department) {
        docs = docs.filter((d) => d.teacher.department?._id === params.department);
      }
      if (params.semester) {
        docs = docs.filter((d) => d.semester === params.semester);
      }

      return { docs, totalDocs: docs.length, page: 1, limit: docs.length, totalPages: 1 };
    },
  });
}

export function useSubmission(id: string | undefined) {
  return useQuery({
    queryKey: [K.submission, id],
    queryFn: async () => toSubmission(await fetchOne<BackendSubmission>(`${SUBMISSIONS}/${id}`)),
    enabled: !!id,
  });
}

export function useCreateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmissionInput) =>
      hasFiles(body)
        ? uploadMultipart(SUBMISSIONS, 'POST', toSubmissionMultipart(body))
        : postJson(SUBMISSIONS, toSubmissionCreatePayload(body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [K.submissions] }),
  });
}

export function useReviewSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, review }: { id: string; review: ReviewInput }) =>
      putJson(`${SUBMISSIONS}/${id}/review`, toReviewPayload(review)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [K.submissions] });
      qc.invalidateQueries({ queryKey: [K.submission] });
      qc.invalidateQueries({ queryKey: [K.reportFaculty] });
      qc.invalidateQueries({ queryKey: [K.reportDepartment] });
      qc.invalidateQueries({ queryKey: [K.reportTeachers] });
    },
  });
}

export function useAnnouncementList(search?: string) {
  return useQuery({
    queryKey: [K.announcements, search],
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchList<Announcement>(ANNOUNCEMENTS, search ? { search } : undefined),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AnnouncementInput) => postJson<Announcement>(ANNOUNCEMENTS, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [K.announcements] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ANNOUNCEMENTS}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [K.announcements] }),
  });
}

export async function downloadSubmissionFilesZip(params: ReportQuery = {}): Promise<void> {
  const res = await apiClient.get(FILES_ZIP, {
    params: toReportParams(params),
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'yuborilgan-fayllar.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useReportByFaculty(params: ReportQuery = {}) {
  return useQuery({
    queryKey: [K.reportFaculty, params],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await fetchList<BackendFacultyReport>(`${REPORTS}/faculty`, toReportParams(params)))
        .map(toFacultyReport),
  });
}

export function useReportByDepartment(params: ReportQuery = {}) {
  return useQuery({
    queryKey: [K.reportDepartment, params],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await fetchList<BackendDepartmentReport>(`${REPORTS}/department`, toReportParams(params)))
        .map(toDepartmentReport),
  });
}

export function useReportByTeachers(params: ReportQuery = {}) {
  return useQuery({
    queryKey: [K.reportTeachers, params],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await fetchList<BackendTeacherReport>(`${REPORTS}/teachers`, toReportParams(params)))
        .map(toTeacherReport),
  });
}

export function useTeacherScore(
  teacherId: string | undefined,
  params: { academicYear?: string; semester?: Semester } = {},
) {
  const query = useSubmissionList({
    teacherId,
    status: 'approved',
    academicYear: params.academicYear,
    semester: params.semester,
  });

  const data = useMemo<TeacherScoreDetail[]>(
    () =>
      (query.data?.docs ?? []).map((s) => ({
        indicator: s.indicator.title,
        authorCount: s.authorShare > 0 ? Math.round(100 / s.authorShare) : 1,
        score: s.score ?? 0,
      })),
    [query.data],
  );

  return { ...query, data };
}

export function useTeacherTotalScore(params: {
  teacherId?: string;
  academicYear?: string;
  semester?: Semester;
}) {
  const query = useSubmissionList({
    teacherId: params.teacherId,
    status: 'approved',
    academicYear: params.academicYear,
    semester: params.semester,
  });

  const total = useMemo(() => {
    const sum = (query.data?.docs ?? []).reduce((acc, s) => acc + (s.score ?? 0), 0);
    return Math.round(sum * 100) / 100;
  }, [query.data]);

  return { ...query, data: total };
}

export function useTeacherProfile(teacherId: string | undefined) {
  const query = useSubmissionList({ teacherId });
  const { data: access } = useTeacherAccess(teacherId);

  const data = useMemo<TeacherProfile | null>(() => {
    const first = query.data?.docs?.[0];
    if (!first) return null;
    const teacher = first.teacher;
    return {
      _id: teacher._id,
      fullName: [teacher.lastName, teacher.firstName, teacher.middleName]
        .filter(Boolean)
        .join(' '),
      department: teacher.department?.title ?? '',
      faculty: teacher.faculty?.title ?? '',
      position: teacher.position?.title ?? '',
      active: access?.active ?? true,
      activeFrom: access?.activeFrom ?? null,
    };
  }, [query.data, access]);

  return { ...query, data };
}

export function useTeacherAccess(teacherId: string | undefined) {
  return useQuery({
    queryKey: [K.teacherAccess, teacherId],
    queryFn: () => fetchOne<TeacherAccess>(`${TEACHER_ACCESS}/${teacherId}`),
    enabled: !!teacherId,
  });
}

export function useTeacherAccessMap() {
  return useQuery({
    queryKey: [K.teacherAccess, 'all'],
    queryFn: async () => {
      const rows = await fetchList<TeacherAccess & { teacher: string }>(TEACHER_ACCESS);
      return new Map(rows.map((r) => [String(r.teacher), r]));
    },
  });
}

export function useSetTeacherAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teacherId,
      active = true,
      activeFrom = null,
    }: { teacherId: string; active?: boolean; activeFrom?: string | null }) =>
      putJson<TeacherAccess>(`${TEACHER_ACCESS}/${teacherId}`, { active, activeFrom }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [K.reportTeachers] });
      qc.invalidateQueries({ queryKey: [K.teacherAccess] });
      qc.invalidateQueries({ queryKey: [K.teacherProfile] });
    },
  });
}

export function useAcademicYears() {
  return useQuery({
    queryKey: [K.academicYears],
    queryFn: () => fetchList<{ _id: string; title: string }>('/academic-years'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useFaculties() {
  return useQuery({
    queryKey: [K.faculties],
    queryFn: () => fetchList<{ _id: string; title: string }>(FACULTIES),
  });
}

export function useDepartments(facultyId?: string) {
  return useQuery({
    queryKey: [K.departments, facultyId],
    queryFn: () =>
      fetchList<{ _id: string; title: string }>(
        DEPARTMENTS,
        facultyId ? { faculty: facultyId } : undefined,
      ),
  });
}
