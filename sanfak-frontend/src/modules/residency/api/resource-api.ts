import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, fetchOne, deleteData, uploadMultipart, putJson } from '@/shared/api';
import type { Resource, ResourceStats, ResourceType } from './resource-types';
import { titleOrSnapshot } from './ref-title';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface RawRef {
  _id: string;
  title?: string;
}
interface RawUser {
  firstName?: string;
  lastName?: string;
  middleName?: string;
}
interface BackendResource {
  _id: string;
  title: string;
  resourceType?: string | null;
  specialty?: string | RawRef | null;
  specialtyTitle?: string | null;
  department?: string | RawRef | null;
  author?: string | null;
  publishYear?: number | null;
  desc?: string | null;
  fileUrl: string;
  fileName?: string | null;
  fileSize?: number | null;
  format?: string | null;
  downloadCount?: number | null;
  uploadedBy?: string | RawUser | null;
  createdAt?: string | null;
}

const TYPES: ResourceType[] = [
  'kitob',
  'atlas',
  'video',
  'metodik',
  'protokol',
  'qollanma',
];

const userName = (u: string | RawUser | null | undefined): string | null => {
  if (!u || typeof u !== 'object') return null;
  const parts = [u.lastName, u.firstName, u.middleName].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};

const mapResource = (b: BackendResource): Resource => ({
  id: b._id,
  title: b.title,
  resourceType: TYPES.includes(b.resourceType as ResourceType)
    ? (b.resourceType as ResourceType)
    : 'kitob',
  specialtyId:
    b.specialty && typeof b.specialty === 'object' ? b.specialty._id : (b.specialty ?? null),
  specialtyTitle: titleOrSnapshot(b.specialty, b.specialtyTitle),
  departmentId:
    b.department && typeof b.department === 'object' ? b.department._id : (b.department ?? null),
  departmentTitle:
    b.department && typeof b.department === 'object' ? (b.department.title ?? null) : null,
  author: b.author ?? null,
  publishYear: b.publishYear ?? null,
  desc: b.desc ?? null,
  fileUrl: b.fileUrl,
  fileName: b.fileName ?? null,
  fileSize: b.fileSize ?? null,
  format: b.format ?? null,
  downloadCount: b.downloadCount ?? 0,
  uploadedByName: userName(b.uploadedBy),
  createdAt: b.createdAt ?? null,
});

const ROOT = '/resources';
const KEY = 'residency-resources';

export interface ResourceInput {
  title: string;
  resourceType?: ResourceType;
  specialty?: string | null;
  specialtyTitle?: string | null;
  department?: string | null;
  author?: string | null;
  publishYear?: number | null;
  desc?: string | null;
  file?: File | null;
}

function toFields(
  input: Partial<ResourceInput>,
): Record<string, string | number | boolean | File | null | undefined> {
  const { file, specialty, department, ...rest } = input;
  return {
    ...rest,
    specialty: specialty === undefined ? undefined : (specialty ?? ''),
    department: department === undefined ? undefined : (department ?? ''),
    file: file ?? undefined,
  };
}

export function useResources(params: Q = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Resource[]> =>
      (await fetchList<BackendResource>(`${ROOT}${qs(params)}`)).map(mapResource),
  });
}

export function useResourceStats(params: Q = {}) {
  return useQuery({
    queryKey: [KEY, 'stats', params],
    placeholderData: keepPreviousData,
    queryFn: (): Promise<ResourceStats> => fetchOne<ResourceStats>(`${ROOT}/stats${qs(params)}`),
  });
}

export function useCreateResource() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: ResourceInput) => uploadMultipart(ROOT, 'POST', toFields(input)),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateResource() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ResourceInput> }) =>
      uploadMultipart(`${ROOT}/${id}`, 'PUT', toFields(data)),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteResource() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDownloadResource() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      putJson<{ fileUrl: string; downloadCount: number }>(`${ROOT}/${id}/download`, {}),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
