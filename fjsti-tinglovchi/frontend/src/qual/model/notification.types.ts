export interface Notification {
  id: string;
  text: string;
  createdAt?: string;
}

export interface NotificationInput {
  text: string;
}
