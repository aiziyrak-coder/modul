export type OpenLessonType = 'ochiq_dars' | 'dars_kuzatish';

export type OpenLessonPlanKind = 'activity' | 'dissertation';

export const OPEN_LESSON_TYPE_LABEL: Record<OpenLessonType, string> = {
  ochiq_dars: 'Ochiq dars o‘tish',
  dars_kuzatish: 'Dars kuzatish',
};

export interface OpenLessonAttendee {
  userId: string;
  name: string | null;
}

export interface OpenLesson {
  id: string;
  residentId: string;
  residentName: string | null;
  type: OpenLessonType;
  date: string;
  roomId: string | null;
  roomTitle: string | null;
  topic: string | null;
  attendees: OpenLessonAttendee[];
  planId: string | null;
  planKind: OpenLessonPlanKind | null;
  planTitle: string | null;
  taskTitle: string | null;
  note: string | null;
  academicYear: string | null;
  createdAt: string | null;
}

export interface OpenLessonInput {
  resident: string;
  type: OpenLessonType;
  date: string;
  room?: string | null;
  topic?: string | null;
  attendees?: { user: string }[];
  plan?: string | null;
  planKind?: OpenLessonPlanKind | null;
  taskTitle?: string | null;
  note?: string | null;
}
