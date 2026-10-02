import type { CalendarPlan } from '../model/calendar-plan.types';

export interface BackendCalendarPlan {
  _id: string;
  title: string;
  file: string;
  createdAt?: string;
  updatedAt?: string;
}

export function mapCalendarPlan(b: BackendCalendarPlan): CalendarPlan {
  return {
    id: b._id,
    title: b.title,
    fileUrl: b.file ? b.file : '#',
    uploadedAt: b.createdAt,
  };
}
