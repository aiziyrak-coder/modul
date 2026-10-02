import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchPaginated, postJson } from '@/shared/api';
import type { PostRecipient, ScientificPost } from '../model/types';

const ROOT = '/scientific-posts';
const KEY = 'sci-post';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
}

interface BackendPost {
  _id: string;
  title: string;
  text: string;
  recipients?: PostRecipient[];
  telegram?: boolean;
  specialtyCode?: string;
  author?: BackendRef | null;
  createdAt?: string;
}

const dateTime = (d?: string): string =>
  d ? d.slice(0, 10) + ' ' + d.slice(11, 16) : '';

const mapPost = (d: BackendPost): ScientificPost => ({
  id: d._id,
  title: d.title,
  text: d.text,
  recipients: d.recipients ?? [],
  telegram: !!d.telegram,
  specialtyCode: d.specialtyCode ?? '',
  authorName:
    d.author && (d.author.firstName || d.author.lastName)
      ? [d.author.lastName, d.author.firstName].filter(Boolean).join(' ')
      : "Ilmiy bo'lim",
  date: dateTime(d.createdAt),
});

export interface PostPayload {
  title: string;
  text: string;
  recipients: PostRecipient[];
  telegram: boolean;
  specialtyCode?: string;
}

export function usePosts(page: number, limit: number) {
  return useQuery({
    queryKey: [KEY, { page, limit }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendPost>(`${ROOT}/paginate`, { page, limit });
      return { ...res, docs: res.docs.map(mapPost) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: PostPayload) => postJson(ROOT, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
