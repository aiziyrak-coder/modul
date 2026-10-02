import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { fetchList, fetchOne, fetchPaginated, putJson, uploadMultipart } from '@/shared/api';
import type { AcademicYearRef, ArticleStatus, Plan, PlanFilters } from '../model/types';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendPlan {
  _id: string;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  academicYear?: BackendRef | null;
  createdBy?: BackendRef | null;
  fileUrl?: string | null;
  status: ArticleStatus;
  rejectionReason?: string | null;
  rejectedBy?: BackendRef | null;
  rejectedByRole?: string | null;
  dekanApprovedAt?: string | null;
  prorektorApprovedAt?: string | null;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

function mapPlan(doc: BackendPlan): Plan {
  return {
    id: doc._id,
    departmentName: doc.department?.title ?? null,
    facultyName: doc.faculty?.title ?? null,
    academicYearId: doc.academicYear?._id ?? null,
    academicYearTitle: doc.academicYear?.title ?? null,
    fileUrl: doc.fileUrl ?? null,
    status: doc.status,
    rejectionReason: doc.rejectionReason ?? null,
    rejectedByName: personName(doc.rejectedBy) || null,
    rejectedByRole: doc.rejectedByRole ?? null,
    dekanApprovedAt: doc.dekanApprovedAt ? doc.dekanApprovedAt.slice(0, 10) : null,
    prorektorApprovedAt: doc.prorektorApprovedAt
      ? doc.prorektorApprovedAt.slice(0, 10)
      : null,
    createdByName: personName(doc.createdBy) || null,
    date: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export interface PlanPayload {
  academicYear: string;
  file?: File | null;
}

export interface PlanApi {
  usePaginate: (
    page: number,
    limit: number,
    filters: PlanFilters,
  ) => ReturnType<typeof useQuery<{ docs: Plan[]; totalDocs: number }>>;
  useOne: (id: string | undefined) => ReturnType<typeof useQuery<Plan>>;
  useCreate: () => ReturnType<typeof useMutation<unknown, unknown, PlanPayload>>;
  useUpdate: () => ReturnType<
    typeof useMutation<unknown, unknown, { id: string } & PlanPayload>
  >;
  useApprove: () => ReturnType<typeof useMutation<unknown, unknown, string>>;
  useReject: () => ReturnType<
    typeof useMutation<unknown, unknown, { id: string; reason: string }>
  >;
  fetchAll: (filters: PlanFilters) => Promise<Plan[]>;
}

function createPlanApi(root: string, key: string): PlanApi {
  return {
    usePaginate: (page, limit, filters) =>
      useQuery({
        queryKey: [key, { page, limit, ...filters }],
        queryFn: async () => {
          const res = await fetchPaginated<BackendPlan>(`${root}/paginate`, {
            page,
            limit,
            status: filters.status || undefined,
            academicYear: filters.academicYear || undefined,
            faculty: filters.faculty || undefined,
            department: filters.department || undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          });
          return { ...res, docs: res.docs.map(mapPlan) };
        },
        placeholderData: keepPreviousData,
        staleTime: 0,
        refetchOnWindowFocus: false,
      }),

    useOne: (id) =>
      useQuery({
        queryKey: [key, 'one', id],
        enabled: !!id,
        queryFn: async (): Promise<Plan> => {
          const doc = await fetchOne<BackendPlan>(`${root}/${id}`);
          return mapPlan(doc);
        },
        refetchOnWindowFocus: false,
      }),

    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (v: PlanPayload) =>
          uploadMultipart(root, 'POST', {
            academicYear: v.academicYear,
            files: v.file ?? undefined,
          }),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },

    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (v: { id: string } & PlanPayload) =>
          uploadMultipart(`${root}/${v.id}`, 'PUT', {
            academicYear: v.academicYear,
            files: v.file ?? undefined,
          }),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },

    useApprove: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => putJson(`${root}/${id}/approve`, {}),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },

    useReject: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (v: { id: string; reason: string }) =>
          putJson(`${root}/${v.id}/reject`, { reason: v.reason }),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },

    fetchAll: async (filters) => {
      const docs = await fetchList<BackendPlan>(root, {
        status: filters.status || undefined,
        academicYear: filters.academicYear || undefined,
        faculty: filters.faculty || undefined,
        department: filters.department || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return docs.map(mapPlan);
    },
  };
}

export const workPlanApi = createPlanApi('/work-plans', 'sci-work-plans');
export const annualReportApi = createPlanApi('/annual-reports', 'sci-annual-reports');

export function useAcademicYears() {
  return useQuery({
    queryKey: ['sci-academic-years'],
    queryFn: async (): Promise<AcademicYearRef[]> => {
      const docs = await fetchList<{ _id: string; title: string }>('/academic-years');
      return docs.map((d) => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
