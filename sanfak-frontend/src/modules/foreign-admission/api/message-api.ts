import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, fetchPaginated, postJson, type Paginated } from '@/shared/api';
import type {
  AdmissionMessage,
  NamedRef,
  SeasonName,
  SendMessageInput,
} from '../model/admission-types';

const ROOT = '/admission-messages';
const KEY = ['foreign-admission', 'messages'];

interface BackendRef {
  _id: string;
  titleUz?: string;
  titleRu?: string;
  titleEn?: string;
}

interface BackendMessage {
  _id: string;
  text: string;
  direction?: BackendRef | null;
  educationLanguage?: BackendRef | null;
  academicYear: string;
  season: SeasonName;
  recipientCount?: number;
  deliveredCount?: number;
  sentBy?: { firstName?: string; lastName?: string } | null;
  sentAt: string;
}

const mapRef = (r: BackendRef | null | undefined): NamedRef | null =>
  r ? { id: r._id, titleUz: r.titleUz ?? '', titleRu: r.titleRu, titleEn: r.titleEn } : null;

export function mapMessage(b: BackendMessage): AdmissionMessage {
  const sender = b.sentBy;
  return {
    id: b._id,
    text: b.text,
    direction: mapRef(b.direction),
    educationLanguage: mapRef(b.educationLanguage),
    academicYear: b.academicYear,
    season: b.season,
    recipientCount: b.recipientCount ?? 0,
    deliveredCount: b.deliveredCount ?? 0,
    sentByName: sender
      ? [sender.lastName, sender.firstName].filter(Boolean).join(' ') || undefined
      : undefined,
    sentAt: b.sentAt,
  };
}

export interface MessageListParams {
  page: number;
  limit: number;
  search?: string;
  direction?: string;
  educationLanguage?: string;
  academicYear?: string;
  season?: SeasonName;
  [key: string]: unknown;
}

export function useMessagesPaginated(params: MessageListParams) {
  return useQuery({
    queryKey: [...KEY, 'paginate', params],
    queryFn: async () => {
      const res: Paginated<BackendMessage> = await fetchPaginated(`${ROOT}/paginate`, params);
      return {
        items: res.docs.map(mapMessage),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useRecipientCount(params: {
  direction?: string;
  educationLanguage?: string;
  academicYear?: string;
}, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'recipients', params],
    queryFn: async () => {
      const res = await fetchOne<{ recipientCount: number }>(`${ROOT}/recipients-count`, params);
      return res.recipientCount;
    },
    enabled,
  });
}

export interface SendResult {
  message: string;
  recipientCount: number;
  deliveredCount: number;
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) => postJson<SendResult>(ROOT, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
