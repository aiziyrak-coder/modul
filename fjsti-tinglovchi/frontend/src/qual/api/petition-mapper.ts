import type { EduForm } from '../model/course.types';
import type { Petition, PetitionDetail, PetitionStatus } from '../model/petition.types';

interface BackendCourseRef {
  _id: string;
  title?: string;
  form?: number;
}

export interface BackendPetition {
  _id: string;
  fullName: string;
  passport: string;
  status: number;
  course?: BackendCourseRef | string | null;
  createdAt?: string;
  courseFull?: boolean;
}

export interface BackendPetitionDetail extends BackendPetition {
  bachelorDiploma?: string;
  mastersDiploma?: string | null;
  moCertificate?: string;
  province?: { _id: string; title?: string } | string | null;
  region?: { _id: string; title?: string } | string | null;
  institution?: string | null;
  phone?: string | null;
  educationType?: number | null;
  listenersLimit?: number;
  totalSubscribers?: number;
  courseFull?: boolean;
}

const toStatus = (s: number): PetitionStatus => (s === 2 ? 2 : s === 3 ? 3 : 1);
const toForm = (f?: number): EduForm | undefined => (f === 1 ? 1 : f === 2 ? 2 : undefined);
const asObj = <T,>(v: T | string | null | undefined): T | null =>
  typeof v === 'object' && v ? v : null;

export function mapPetition(b: BackendPetition): Petition {
  const c = asObj(b.course);
  return {
    id: b._id,
    fullName: b.fullName,
    passport: b.passport,
    courseTitle: c?.title,
    form: toForm(c?.form),
    status: toStatus(b.status),
    createdAt: b.createdAt,
    courseFull: !!b.courseFull,
  };
}

export function mapPetitionDetail(b: BackendPetitionDetail): PetitionDetail {
  const prov = asObj(b.province);
  const reg = asObj(b.region);
  return {
    ...mapPetition(b),
    provinceTitle: prov?.title,
    regionTitle: reg?.title,
    institution: b.institution ?? undefined,
    phone: b.phone ?? undefined,
    educationType: b.educationType ?? undefined,
    bachelorDiploma: b.bachelorDiploma,
    mastersDiploma: b.mastersDiploma ?? null,
    moCertificate: b.moCertificate,
    listenersLimit: b.listenersLimit,
    totalSubscribers: b.totalSubscribers,
    courseFull: !!b.courseFull,
  };
}
