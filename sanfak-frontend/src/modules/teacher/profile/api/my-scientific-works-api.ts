import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchList } from '@/shared/api';
import { useSessionStore } from '@/app/session';
import type { ScientificWorkItem, ScientificWorkStatus } from '../model/types';

const KEY = 'teacherMyScientificWorks';

type BackendOwner = string | { _id?: string | null } | null;

const ownerId = (owner: BackendOwner | undefined): string =>
  typeof owner === 'string' ? owner : (owner?._id ?? '');

interface BackendArticle {
  _id: string;
  title?: string | null;
  journalName: string;
  status: ScientificWorkStatus;
  fileUrl?: string | null;
  author?: BackendOwner;
}

interface BackendThesis {
  _id: string;
  title: string;
  status: ScientificWorkStatus;
  fileUrl?: string | null;
  author?: BackendOwner;
}

interface BackendMonograph {
  _id: string;
  title?: string | null;
  status: ScientificWorkStatus;
  author?: BackendOwner;
}

interface BackendMethodical {
  _id: string;
  title: string;
  status: ScientificWorkStatus;
  author?: BackendOwner;
}

export function mapArticle(doc: BackendArticle): ScientificWorkItem {
  return {
    id: doc._id,
    title: doc.title || doc.journalName || '',
    status: doc.status,
    fileUrl: doc.fileUrl ?? null,
  };
}

export function mapThesis(doc: BackendThesis): ScientificWorkItem {
  return {
    id: doc._id,
    title: doc.title ?? '',
    status: doc.status,
    fileUrl: doc.fileUrl ?? null,
  };
}

export function mapMonograph(doc: BackendMonograph): ScientificWorkItem {
  return {
    id: doc._id,
    title: doc.title ?? '',
    status: doc.status,
    fileUrl: null,
  };
}

export function mapMethodical(doc: BackendMethodical): ScientificWorkItem {
  return {
    id: doc._id,
    title: doc.title ?? '',
    status: doc.status,
    fileUrl: null,
  };
}

interface HttpErrorLike {
  response?: { status?: number };
}

function isForbidden(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as HttpErrorLike).response?.status === 403
  );
}

async function fetchMine<T extends { author?: BackendOwner }>(
  url: string,
  map: (doc: T) => ScientificWorkItem,
  userId: string,
  sendAuthorParam: boolean,
): Promise<ScientificWorkItem[]> {
  try {
    const docs = await fetchList<T>(url, sendAuthorParam ? { author: userId } : undefined);
    return docs.filter((doc) => ownerId(doc.author) === userId).map(map);
  } catch (err) {
    if (isForbidden(err)) return [];
    throw err;
  }
}

export function useMyArticles(enabled: boolean): UseQueryResult<ScientificWorkItem[]> {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery({
    queryKey: [KEY, 'articles', userId],
    queryFn: () => fetchMine<BackendArticle>('/articles', mapArticle, userId ?? '', true),
    enabled: enabled && Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useMyTheses(enabled: boolean): UseQueryResult<ScientificWorkItem[]> {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery({
    queryKey: [KEY, 'theses', userId],
    queryFn: () => fetchMine<BackendThesis>('/theses', mapThesis, userId ?? '', true),
    enabled: enabled && Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useMyMonographs(enabled: boolean): UseQueryResult<ScientificWorkItem[]> {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery({
    queryKey: [KEY, 'monographs', userId],
    queryFn: () => fetchMine<BackendMonograph>('/monographs', mapMonograph, userId ?? '', false),
    enabled: enabled && Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useMyMethodicalRecommendations(
  enabled: boolean,
): UseQueryResult<ScientificWorkItem[]> {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery({
    queryKey: [KEY, 'methodical', userId],
    queryFn: () =>
      fetchMine<BackendMethodical>(
        '/methodical-recommendations',
        mapMethodical,
        userId ?? '',
        false,
      ),
    enabled: enabled && Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
