import type { HrNotification } from '../model/notification-types';

export interface BackendNotification {
  _id: string;
  title?: string | null;
  body?: string | null;
  link?: string | null;
  eventType?: string | null;
  read?: boolean | null;
  readAt?: string | null;
  createdAt?: string | null;
}

export function mapNotification(n: BackendNotification): HrNotification {
  return {
    id: n._id,
    title: n.title ?? '',
    body: n.body ?? null,
    link: n.link ?? null,
    eventType: n.eventType ?? '',
    read: Boolean(n.read),
    readAt: n.readAt ?? null,
    createdAt: n.createdAt ?? null,
  };
}
