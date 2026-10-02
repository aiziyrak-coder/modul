export type TeacherStatusKey =
  | 'yangi'
  | 'tekshirilmoqda'
  | 'jarayonda'
  | 'yuborilgan'
  | 'qabulQilindi'
  | 'yaratilgan'
  | 'tasdiqlangan'
  | 'radEtilgan'
  | 'new'
  | 'created'
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'completed'
  | 'pending';

export interface StatusMeta {
  key: TeacherStatusKey;
  labelKey: string;
  color: string;
}

const STATUS_META_MAP: Record<TeacherStatusKey, StatusMeta> = {
  new: {
    key: 'new',
    labelKey: 'teacher.status.new',
    color: 'blue',
  },
  created: {
    key: 'created',
    labelKey: 'teacher.status.created',
    color: 'orange',
  },
  draft: {
    key: 'draft',
    labelKey: 'teacher.personalPlan.status.draft',
    color: 'blue',
  },
  in_review: {
    key: 'in_review',
    labelKey: 'teacher.status.inReview',
    color: 'orange',
  },
  approved: {
    key: 'approved',
    labelKey: 'teacher.personalPlan.status.approved',
    color: 'success',
  },
  rejected: {
    key: 'rejected',
    labelKey: 'teacher.personalPlan.status.rejected',
    color: 'error',
  },
  submitted: {
    key: 'submitted',
    labelKey: 'teacher.personalPlan.status.submitted',
    color: 'processing',
  },
  completed: {
    key: 'completed',
    labelKey: 'teacher.personalPlan.status.completed',
    color: 'purple',
  },
  pending: {
    key: 'pending',
    labelKey: 'teacher.hr.status.pending',
    color: 'blue',
  },
  yangi: {
    key: 'yangi',
    labelKey: 'teacher.status.new',
    color: 'default',
  },
  tekshirilmoqda: {
    key: 'tekshirilmoqda',
    labelKey: 'teacher.status.inReview',
    color: 'processing',
  },
  jarayonda: {
    key: 'jarayonda',
    labelKey: 'teacher.status.jarayonda',
    color: 'blue',
  },
  yuborilgan: {
    key: 'yuborilgan',
    labelKey: 'teacher.personalPlan.status.submitted',
    color: 'cyan',
  },
  qabulQilindi: {
    key: 'qabulQilindi',
    labelKey: 'teacher.status.qabulQilindi',
    color: 'orange',
  },
  yaratilgan: {
    key: 'yaratilgan',
    labelKey: 'teacher.status.created',
    color: 'geekblue',
  },
  tasdiqlangan: {
    key: 'tasdiqlangan',
    labelKey: 'teacher.personalPlan.status.approved',
    color: 'success',
  },
  radEtilgan: {
    key: 'radEtilgan',
    labelKey: 'teacher.personalPlan.status.rejected',
    color: 'error',
  },
};

export function getStatusMeta(key: string): StatusMeta {
  return STATUS_META_MAP[key as TeacherStatusKey] ?? STATUS_META_MAP.yangi;
}

export const ALL_STATUS_KEYS: TeacherStatusKey[] = Object.keys(
  STATUS_META_MAP,
) as TeacherStatusKey[];
