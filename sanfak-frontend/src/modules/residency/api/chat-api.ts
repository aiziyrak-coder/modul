import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, fetchOne, postJson } from '@/shared/api';
import type { ChatConversation, ChatMessage, ChatUser } from './chat-types';
import { nameOf } from './user-name';

const ROOT = '/chat';
const KEY = 'residency-chat';

interface RawUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  photo?: string | null;
}
interface BackendConversation {
  _id: string;
  user?: RawUser;
  lastMessage?: { message?: string; createdAt?: string; fileType?: string | null };
  unreadCount?: number;
}
export interface BackendMessage {
  _id: string;
  sender?: string | RawUser | null;
  receiver?: string | RawUser | null;
  message: string;
  fileUrl?: string | null;
  fileType?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
}

const refId = (v: string | RawUser | null | undefined): string | null =>
  v && typeof v === 'object' ? v._id : (v ?? null);

const mapUser = (u: RawUser | undefined): ChatUser => ({
  id: u?._id ?? '',
  name: nameOf(u) ?? '',
  photo: u?.photo ?? null,
});

const mapConversation = (b: BackendConversation): ChatConversation => ({
  userId: b._id,
  user: mapUser(b.user),
  lastMessage: b.lastMessage?.message ?? null,
  lastMessageAt: b.lastMessage?.createdAt ?? null,
  unreadCount: b.unreadCount ?? 0,
});

export const mapMessage = (b: BackendMessage, myId: string): ChatMessage => {
  const senderId = refId(b.sender);
  return {
    id: b._id,
    senderId,
    senderName: typeof b.sender === 'object' ? nameOf(b.sender) : null,
    receiverId: refId(b.receiver),
    message: b.message,
    fileUrl: b.fileUrl ?? null,
    fileType: b.fileType ?? null,
    readAt: b.readAt ?? null,
    createdAt: b.createdAt ?? null,
    mine: !!senderId && senderId === myId,
  };
};

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: [KEY, 'conversations'],
    enabled,
    refetchInterval: 60000,
    queryFn: async (): Promise<ChatConversation[]> =>
      (await fetchList<BackendConversation>(`${ROOT}/conversations`)).map(mapConversation),
  });
}

export async function fetchChatPage(
  userId: string,
  myId: string,
  page: number,
  limit: number,
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const res = await fetchOne<{ docs?: BackendMessage[] }>(
    `${ROOT}/${userId}?page=${page}&limit=${limit}`,
  );
  const docs = res?.docs ?? [];
  return { messages: docs.map((d) => mapMessage(d, myId)).reverse(), hasMore: docs.length >= limit };
}

export async function sendChatMessageRest(
  receiver: string,
  message: string,
  myId: string,
): Promise<ChatMessage | null> {
  const res = await postJson<{ data?: BackendMessage }>(`${ROOT}/send`, { receiver, message });
  const doc = res?.data;
  return doc?._id ? mapMessage(doc, myId) : null;
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: [KEY, 'unread'],
    enabled,
    refetchInterval: 30000,
    queryFn: (): Promise<{ count: number }> => fetchOne(`${ROOT}/unread-count`),
  });
}

export function useSendMessage() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ receiver, message }: { receiver: string; message: string }) =>
      postJson(`${ROOT}/send`, { receiver, message }),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
