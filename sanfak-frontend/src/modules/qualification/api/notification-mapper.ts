import type { Notification } from '../model/notification.types';

export interface BackendNotification {
  _id: string;
  title: string;
  createdAt?: string;
}

export function mapNotification(b: BackendNotification): Notification {
  return {
    id: b._id,
    text: b.title,
    createdAt: b.createdAt,
  };
}
