import { fetchOne, fetchPaginated, putJson, type Paginated } from '@/shared/api';
import type {
  BackendNotification,
  BackendPreferences,
  PreferencesInput,
} from '../model/types';

const BASE_URL = '/notifications';

export interface FeedParams {
  page: number;
  limit: number;
  read?: boolean;
  eventType?: string;
}

export function fetchFeed(params: FeedParams): Promise<Paginated<BackendNotification>> {
  const { page, limit, read, eventType } = params;
  return fetchPaginated<BackendNotification>(BASE_URL, {
    page,
    limit,
    ...(read !== undefined ? { read: String(read) } : {}),
    ...(eventType ? { eventType } : {}),
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetchOne<{ count: number }>(`${BASE_URL}/unread-count`);
  return res.count;
}

export function markNotificationRead(id: string): Promise<{ message: string }> {
  return putJson(`${BASE_URL}/${id}/read`, {});
}

export function markAllNotificationsRead(): Promise<{ message: string; modified: number }> {
  return putJson(`${BASE_URL}/read-all`, {});
}

export function fetchPreferences(): Promise<BackendPreferences> {
  return fetchOne<BackendPreferences>(`${BASE_URL}/preferences/me`);
}

export function updatePreferences(input: PreferencesInput): Promise<{ message: string }> {
  return putJson(`${BASE_URL}/preferences/me`, input);
}
