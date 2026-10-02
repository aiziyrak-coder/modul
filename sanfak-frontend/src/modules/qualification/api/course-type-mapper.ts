import type { CertTemplate, CourseType } from '../model/course-type.types';
import { KIND_TO_DOC } from '../model/course-type.types';

export interface BackendCourseType {
  _id: string;
  title: string;
  kind: number;
  template?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function mapCourseType(b: BackendCourseType): CourseType {
  const tmpl = b.template === 2 || b.template === 3 ? b.template : 1;
  return {
    id: b._id,
    title: b.title,
    docKind: KIND_TO_DOC[b.kind] ?? 'sertifikat',
    template: tmpl as CertTemplate,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
