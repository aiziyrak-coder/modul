export interface HrNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  eventType: string;
  read: boolean;
  readAt: string | null;
  createdAt: string | null;
}
