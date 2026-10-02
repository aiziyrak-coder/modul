import type { Course, CourseStatus, EduForm } from '../model/course.types';

export interface BackendCourse {
  _id: string;
  title: string;
  creditHours: number;
  price: number;
  form: number;
  listenersLimit: number;
  startDate?: string;
  endDate?: string;
  status?: number;
  totalSubscribers?: number;
  courseType?: { _id: string; title: string } | null;
}

export function mapCourse(b: BackendCourse): Course {
  return {
    id: b._id,
    title: b.title,
    courseTypeTitle: b.courseType?.title ?? '',
    creditHours: b.creditHours,
    price: b.price,
    form: (b.form === 2 ? 2 : 1) as EduForm,
    listenersLimit: b.listenersLimit,
    startDate: b.startDate,
    endDate: b.endDate,
    status: ([1, 2, 3].includes(Number(b.status)) ? Number(b.status) : 1) as CourseStatus,
    totalSubscribers: b.totalSubscribers ?? 0,
  };
}
