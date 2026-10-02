export type EduForm = 1 | 2;
export type CourseStatus = 1 | 2 | 3;

export const EDU_FORM = { ONLINE: 1, OFFLINE: 2 } as const;
export const COURSE_STATUS = { PLANNED: 1, ACTIVE: 2, FINISHED: 3 } as const;

export interface Option {
  value: string;
  label: string;
}

export interface Course {
  id: string;
  title: string;
  courseTypeTitle: string;
  creditHours: number;
  price: number;
  form: EduForm;
  listenersLimit: number;
  startDate?: string;
  endDate?: string;
  status: CourseStatus;
  totalSubscribers: number;
}

export interface CourseInput {
  courseType: string;
  title: string;
  creditHours: number;
  price: number;
  form: EduForm;
  listenersLimit: number;
  startDate: string;
  endDate: string;
  address?: string;
  location?: { lat: string; lng: string };
  teachers: string[];
}

export interface CourseFormDefaults {
  courseType: string;
  form: EduForm;
  title: string;
  creditHours: number;
  price: number;
  listenersLimit: number;
  startDate: string;
  endDate: string;
  address?: string;
  lat?: string;
  lng?: string;
  teachers: string[];
}
