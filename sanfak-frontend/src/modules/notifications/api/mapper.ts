import { getSafeLink } from './link-guard';
import type { BackendNotification, NotificationVM } from '../model/types';

export function mapNotification(n: BackendNotification): NotificationVM {
  const body = n.body ?? null;
  const metadata = n.metadata ?? null;
  const rawLink = n.link ?? null;

  return {
    id: n._id,
    eventType: n.eventType,
    title: n.title,
    body,
    bodyLines: (body ?? '').split('\n'),
    metadata,
    rawLink,
    safeLink: getSafeLink(rawLink, metadata),
    read: n.read,
    readAt: n.readAt ? new Date(n.readAt) : null,
    createdAt: new Date(n.createdAt),
  };
}
