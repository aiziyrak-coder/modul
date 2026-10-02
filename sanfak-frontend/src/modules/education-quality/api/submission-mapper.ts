import type {
  ReviewInput,
  Semester,
  Submission,
  SubmissionInput,
  SubmissionStatus,
  SubmissionTeacher,
} from '../model/types';

interface BackendRef {
  _id?: string;
  title?: string;
}

interface BackendDivision extends BackendRef {
  faculty?: BackendRef | string | null;
}

interface BackendUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  department?: BackendDivision | string | null;
  faculty?: BackendRef | string | null;
  division?: BackendDivision | string | null;
  position?: BackendRef | string | null;
}

export interface BackendSubmission {
  _id: string;
  teacher?: BackendUser | string | null;
  indicator?: { _id?: string; title?: string; coefficient?: number } | string | null;
  academicYear?: BackendRef | string | null;
  semester?: number | null;
  data?: Record<string, unknown>;
  files?: string[];
  status?: string;
  score?: number;
  authorShare?: number;
  reviewedBy?: BackendUser | string | null;
  comment?: string | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const STATUSES: readonly string[] = ['pending', 'approved', 'rejected'];

const toStatus = (v: unknown): SubmissionStatus =>
  typeof v === 'string' && STATUSES.includes(v) ? (v as SubmissionStatus) : 'pending';

const toSemester = (v: unknown): Semester | null => (v === 1 || v === 2 ? v : null);

const asObject = <T extends object>(v: T | string | null | undefined): T | undefined =>
  v && typeof v === 'object' ? v : undefined;

function toRef(v: BackendRef | string | null | undefined): { _id: string; title: string } | undefined {
  const o = asObject(v);
  return o?._id ? { _id: String(o._id), title: o.title ?? '' } : undefined;
}

function toTeacher(raw: BackendUser | string | null | undefined): SubmissionTeacher {
  const t = asObject(raw);
  const dept =
    asObject(t?.department as BackendDivision | string | null | undefined) ??
    asObject(t?.division as BackendDivision | string | null | undefined);
  const faculty = toRef(t?.faculty) ?? toRef(dept?.faculty);
  return {
    _id: String(t?._id ?? ''),
    firstName: t?.firstName ?? '',
    lastName: t?.lastName ?? '',
    ...(t?.middleName ? { middleName: t.middleName } : {}),
    ...(dept?._id
      ? { department: { _id: String(dept._id), title: dept.title ?? '' } }
      : {}),
    ...(faculty ? { faculty } : {}),
    ...(toRef(t?.position) ? { position: toRef(t?.position) } : {}),
  };
}

export function toSubmission(raw: BackendSubmission): Submission {
  const ind = asObject(raw.indicator);
  const reviewer = asObject(raw.reviewedBy);
  return {
    _id: String(raw._id),
    teacher: toTeacher(raw.teacher),
    indicator: {
      _id: String(ind?._id ?? ''),
      title: ind?.title ?? '',
      coefficient: ind?.coefficient ?? 0,
    },
    academicYear: toRef(raw.academicYear) ?? null,
    semester: toSemester(raw.semester),
    data: raw.data ?? {},
    files: raw.files ?? [],
    status: toStatus(raw.status),
    score: raw.score ?? 0,
    authorShare: raw.authorShare ?? 100,
    reviewedBy: reviewer?._id
      ? {
          _id: String(reviewer._id),
          firstName: reviewer.firstName ?? '',
          lastName: reviewer.lastName ?? '',
        }
      : null,
    comment: raw.comment ?? null,
    active: raw.active ?? true,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

export interface ReviewBody {
  status: 'approved' | 'rejected';
  comment?: string;
  authorShare?: number;
}

export function toReviewPayload(review: ReviewInput): ReviewBody {
  return {
    status: review.status,
    ...(review.comment !== undefined ? { comment: review.comment } : {}),
  };
}

export interface SubmissionCreateBody {
  indicator: string;
  academicYear?: string;
  semester?: Semester;
  data: Record<string, unknown>;
  authorShare: number;
}

export function hasFiles(input: SubmissionInput): boolean {
  return Object.values(input.data).some((v) => v instanceof File);
}

export type SubmissionMultipartFields = Record<
  string,
  string | number | boolean | File | File[] | null | undefined
>;

export function toSubmissionMultipart(input: SubmissionInput): SubmissionMultipartFields {
  const plain: Record<string, unknown> = {};
  const files: Record<string, File> = {};
  for (const [key, value] of Object.entries(input.data)) {
    if (value instanceof File) files[key] = value;
    else plain[key] = value;
  }
  return {
    indicator: input.indicator,
    ...(input.academicYear ? { academicYear: input.academicYear } : {}),
    ...(input.semester ? { semester: input.semester } : {}),
    authorShare: input.authorShare,
    data: JSON.stringify(plain),
    ...files,
  };
}

export function toSubmissionCreatePayload(input: SubmissionInput): SubmissionCreateBody {
  return {
    indicator: input.indicator,
    ...(input.academicYear ? { academicYear: input.academicYear } : {}),
    ...(input.semester ? { semester: input.semester } : {}),
    data: input.data,
    authorShare: input.authorShare,
  };
}
