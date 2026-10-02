import type { EduForm } from '../model/course.types';
import type { Source } from '../model/source.types';

interface BackendCourseRef {
  _id: string;
  title?: string;
  form?: number;
}

export interface BackendSource {
  _id: string;
  title: string;
  course?: BackendCourseRef | string | null;
  link?: string | null;
  file: string;
  fileDetails?: { name?: string } | null;
  createdAt?: string;
}

const toForm = (f?: number): EduForm | undefined => (f === 1 ? 1 : f === 2 ? 2 : undefined);

export function mapSource(b: BackendSource): Source {
  const c = typeof b.course === 'object' && b.course ? b.course : null;
  return {
    id: b._id,
    title: b.title,
    courseTitle: c?.title,
    form: toForm(c?.form),
    link: b.link ?? null,
    fileUrl: b.file ? b.file : '#',
    fileName: b.fileDetails?.name,
    createdAt: b.createdAt,
  };
}
