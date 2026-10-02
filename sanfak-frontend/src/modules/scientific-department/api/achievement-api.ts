import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  putJson,
  uploadMultipart,
} from '@/shared/api';
import type { Achievement, AchievementFilters } from '../model/types';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendAchievement {
  _id: string;
  author?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  approvedBy?: BackendRef | null;
  rejectedBy?: BackendRef | null;
  academicYear?: string;
  fileUrl?: string;
  status: Achievement['status'];
  rejectionReason?: string | null;
  rejectedByRole?: string | null;
  createdAt?: string;
  [k: string]: unknown;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

const ownerId = (owner?: BackendRef | string | null): string =>
  typeof owner === 'string' ? owner : (owner?._id ?? '');

function mapAchievement(doc: BackendAchievement): Achievement {
  const {
    _id,
    author,
    department,
    faculty,
    approvedBy,
    rejectedBy,
    approvedAt,
    updatedAt,
    createdAt,
    __v,
    active,
    rejectionReason,
    rejectedByRole,
    ...rest
  } = doc;
  void approvedAt;
  void updatedAt;
  void __v;
  void active;
  return {
    ...rest,
    id: _id,
    authorName: personName(author) || null,
    facultyName: faculty?.title ?? null,
    departmentName: department?.title ?? null,
    approvedByName: personName(approvedBy) || null,
    rejectedByName: personName(rejectedBy) || null,
    academicYear: doc.academicYear ?? null,
    fileUrl: doc.fileUrl ?? null,
    status: doc.status,
    rejectionReason: rejectionReason ?? null,
    rejectedByRole: rejectedByRole ?? null,
    submittedDate: createdAt ? createdAt.slice(0, 10) : '',
  };
}

export type AchievementPayload = Record<string, string | undefined> & {
  file?: File | null;
  autoAbstract?: File | null;
};

const toMultipart = (v: AchievementPayload) => {
  const { file, autoAbstract, ...fields } = v;
  if (!autoAbstract) return { ...fields, files: file ?? undefined };

  const slots: string[] = [];
  const files: File[] = [];
  if (file) {
    slots.push('document');
    files.push(file);
  }
  slots.push('autoAbstract');
  files.push(autoAbstract);
  return { ...fields, files, fileSlots: JSON.stringify(slots) };
};

export interface AchievementApi {
  usePaginate: (
    page: number,
    limit: number,
    filters: AchievementFilters,
    enabled?: boolean,
    mineOf?: string | null,
  ) => ReturnType<typeof useQuery<{ docs: Achievement[]; totalDocs: number }>>;
  useOne: (id: string | undefined) => ReturnType<typeof useQuery<Achievement>>;
  useCreate: () => ReturnType<typeof useMutation<unknown, unknown, AchievementPayload>>;
  useUpdate: () => ReturnType<
    typeof useMutation<unknown, unknown, { id: string } & AchievementPayload>
  >;
  useApprove: () => ReturnType<typeof useMutation<unknown, unknown, string>>;
  useReject: () => ReturnType<
    typeof useMutation<unknown, unknown, { id: string; reason: string }>
  >;
  useRemove: () => ReturnType<typeof useMutation<unknown, unknown, string>>;
  fetchAll: (filters: AchievementFilters) => Promise<Achievement[]>;
}

export function createAchievementApi(root: string, key: string): AchievementApi {
  return {
    usePaginate: (page, limit, filters, enabled = true, mineOf) =>
      useQuery({
        queryKey: [key, { page, limit, ...filters, mineOf: mineOf ?? null }],
        enabled: enabled && (mineOf === undefined || Boolean(mineOf)),
        queryFn: async () => {
          const res = await fetchPaginated<BackendAchievement>(`${root}/paginate`, {
            page,
            limit,
            status: filters.status || undefined,
            academicYear: filters.academicYear || undefined,
            faculty: filters.faculty || undefined,
            department: filters.department || undefined,
            search: filters.search || undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          });
          const docs = mineOf
            ? res.docs.filter((doc) => ownerId(doc.author) === mineOf)
            : res.docs;
          return { ...res, docs: docs.map(mapAchievement) };
        },
        placeholderData: keepPreviousData,
        staleTime: 0,
        refetchOnWindowFocus: false,
      }),

    useOne: (id) =>
      useQuery({
        queryKey: [key, 'one', id],
        enabled: !!id,
        queryFn: async (): Promise<Achievement> => {
          const doc = await fetchOne<BackendAchievement>(`${root}/${id}`);
          return mapAchievement(doc);
        },
        refetchOnWindowFocus: false,
      }),

    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (v: AchievementPayload) => uploadMultipart(root, 'POST', toMultipart(v)),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },

    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (v: { id: string } & AchievementPayload) => {
          const { id, ...rest } = v;
          return uploadMultipart(`${root}/${id}`, 'PUT', toMultipart(rest));
        },
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

    useRemove: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => deleteData(`${root}/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },

    fetchAll: async (filters) => {
      const docs = await fetchList<BackendAchievement>(root, {
        status: filters.status || undefined,
        academicYear: filters.academicYear || undefined,
        faculty: filters.faculty || undefined,
        department: filters.department || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return docs.map(mapAchievement);
    },
  };
}

export const degreeApi = createAchievementApi('/scientific-degrees', 'sci-degrees');
export const titleApi = createAchievementApi('/scientific-titles', 'sci-titles');
export const patentApi = createAchievementApi('/patents', 'sci-patents');
export const certificateApi = createAchievementApi('/copyrights', 'sci-copyrights');
export const defenseApi = createAchievementApi('/defenses', 'sci-defenses');

export const achievementApiByKey: Record<string, AchievementApi> = {
  degrees: degreeApi,
  titles: titleApi,
  defense: defenseApi,
  patents: patentApi,
  certificates: certificateApi,
};
