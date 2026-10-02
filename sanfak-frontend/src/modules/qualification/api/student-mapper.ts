import type { CourseStudent, EduType } from '../model/student.types';

export interface BackendListener {
  _id?: string;
  fullName?: string;
  passport?: string;
  province?: string;
  region?: string;
  institution?: string;
  phone?: string;
}

export interface BackendSubscription {
  _id: string;
  educationType?: number;
  listener?: BackendListener | null;
}

export function mapStudent(b: BackendSubscription): CourseStudent {
  const l = b.listener ?? {};
  return {
    id: b._id,
    fullName: l.fullName ?? '—',
    passport: l.passport,
    province: l.province,
    region: l.region,
    institution: l.institution,
    phone: l.phone,
    educationType: (b.educationType === 1 ? 1 : 2) as EduType,
  };
}
