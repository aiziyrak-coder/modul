import type { EduForm } from './course.types';

export interface Source {
  id: string;
  title: string;
  courseTitle?: string;
  form?: EduForm;
  link?: string | null;
  fileUrl: string;
  fileName?: string;
  createdAt?: string;
}

export interface SourceInput {
  title: string;
  course: string;
  link?: string;
  file: File;
}
