import { useCallback } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, fetchList, fetchOne, postJson, putJson, deleteData } from '@/shared/api';
import type {
  Announcement,
  Attachment,
  Audience,
  ReadStats,
} from './announcement-types';
import { nameOrSnapshot } from './ref-title';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface RawUser {
  firstName?: string;
  lastName?: string;
  middleName?: string;
}
interface BackendAttachment {
  _id: string;
  name?: string | null;
  size?: string | null;
  type?: string | null;
  bytes?: number | null;
  mimeType?: string | null;
  uploadedBy?: string | { _id: string; firstName?: string; lastName?: string; middleName?: string } | null;
  uploadedByName?: string | null;
  uploadedAt?: string | null;
}

interface BackendAnnouncement {
  _id: string;
  title: string;
  content: string;
  audience?: string | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  deadline?: string | null;
  createdBy?: string | RawUser | null;
  createdByName?: string | null;
  createdAt?: string | null;
  attachments?: BackendAttachment[] | null;
  targetCourses?: number[] | null;
  targetSpecialties?: string[] | null;
  isRead?: boolean | null;
}

const AUDIENCE_SET: Audience[] = [
  'umumiy',
  'magistratura',
  'ordinatura',
  'kafedra_mudirlari',
];

const userName = (u: string | RawUser | null | undefined): string | null => {
  if (!u || typeof u !== 'object') return null;
  const parts = [u.lastName, u.firstName, u.middleName].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};

export const mapAttachment = (b: BackendAttachment): Attachment => ({
  id: b._id,
  name: b.name ?? 'fayl',
  size: b.size ?? '',
  type: b.type ?? '',
  bytes: b.bytes ?? 0,
  mimeType: b.mimeType ?? 'application/octet-stream',
  uploadedByName: nameOrSnapshot(userName(b.uploadedBy), b.uploadedByName),
  uploadedAt: b.uploadedAt ?? null,
});

const mapAnnouncement = (b: BackendAnnouncement): Announcement => ({
  id: b._id,
  title: b.title,
  content: b.content,
  audience: AUDIENCE_SET.includes(b.audience as Audience)
    ? (b.audience as Audience)
    : 'umumiy',
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  deadline: b.deadline ?? null,
  createdByName: nameOrSnapshot(userName(b.createdBy), b.createdByName),
  createdAt: b.createdAt ?? null,
  attachments: (b.attachments ?? []).map(mapAttachment),
  targetCourses: b.targetCourses ?? [],
  targetSpecialties: (b.targetSpecialties ?? []).map(String),
  isRead: b.isRead ?? false,
});

const ROOT = '/residency-announcements';
const KEY = 'residency-announcements';

export interface AnnouncementInput {
  title: string;
  content: string;
  audience: Audience;
  academicYear?: string | null;
  academicYearRef?: string | null;
  deadline?: string | null;
  targetCourses?: number[];
  targetSpecialties?: string[];
}

export function useAnnouncements(params: Q = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Announcement[]> =>
      (await fetchList<BackendAnnouncement>(`${ROOT}${qs(params)}`)).map(mapAnnouncement),
  });
}

interface CreatedAnnouncement {
  message: string;
  _id: string;
}

export function useCreateAnnouncement() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) =>
      postJson<CreatedAnnouncement>(ROOT, input),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateAnnouncement() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AnnouncementInput> }) =>
      putJson(`${ROOT}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteAnnouncement() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useInvalidateAnnouncements() {
  const q = useQueryClient();
  return useCallback(() => {
    void q.invalidateQueries({ queryKey: [KEY] });
  }, [q]);
}

export interface UploadAttachmentParams {
  announcementId: string;
  file: File;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function uploadAttachment({
  announcementId,
  file,
  onProgress,
  signal,
}: UploadAttachmentParams): Promise<Attachment[]> {
  const form = new FormData();
  form.append('files', file);

  const res = await apiClient.post<{ attachments: BackendAttachment[] }>(
    `${ROOT}/${announcementId}/attachments`,
    form,
    {
      signal,
      onUploadProgress: (e) => {
        if (!onProgress) return;
        if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    },
  );
  return (res.data.attachments ?? []).map(mapAttachment);
}

export function useDeleteAttachment() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({
      announcementId,
      attachmentId,
    }: {
      announcementId: string;
      attachmentId: string;
    }) => deleteData(`${ROOT}/${announcementId}/attachments/${attachmentId}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export async function fetchAttachmentBlob(
  announcementId: string,
  attachmentId: string,
): Promise<Blob> {
  const res = await apiClient.get<Blob>(
    `${ROOT}/${announcementId}/attachments/${attachmentId}/download`,
    { responseType: 'blob' },
  );
  return res.data;
}

export async function downloadAttachment(
  announcementId: string,
  attachment: Attachment,
): Promise<void> {
  const blob = await fetchAttachmentBlob(announcementId, attachment.id);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function useMarkAnnouncementRead() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/read`, {}),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useAnnouncementReadStats(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'read-stats', id],
    enabled: !!id,
    queryFn: (): Promise<ReadStats> => fetchOne<ReadStats>(`${ROOT}/${id}/read-stats`),
  });
}
