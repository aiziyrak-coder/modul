export type StudyLoadStatusKey =
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
  | 'pending'
  | 'superseded';

export interface StatusMeta {
  key: StudyLoadStatusKey;
  labelKey: string;
  label: string;
  color: string;
}

const STATUS_META_MAP: Record<StudyLoadStatusKey, StatusMeta> = {
  new: {
    key: 'new',
    labelKey: 'studyLoad.distribution.status.new',
    label: 'Yangi',
    color: 'blue',
  },
  created: {
    key: 'created',
    labelKey: 'studyLoad.status.created',
    label: 'Yaratilgan',
    color: 'orange',
  },
  draft: {
    key: 'draft',
    labelKey: 'studyLoad.distribution.status.draft',
    label: 'Yangi',
    color: 'blue',
  },
  in_review: {
    key: 'in_review',
    labelKey: 'studyLoad.distribution.status.inReview',
    label: 'Tekshirilmoqda',
    color: 'orange',
  },
  approved: {
    key: 'approved',
    labelKey: 'studyLoad.distribution.status.approved',
    label: 'Tasdiqlangan',
    color: 'success',
  },
  rejected: {
    key: 'rejected',
    labelKey: 'studyLoad.distribution.status.rejected',
    label: 'Rad etilgan',
    color: 'error',
  },
  submitted: {
    key: 'submitted',
    labelKey: 'studyLoad.status.submitted',
    label: 'Yuborilgan',
    color: 'processing',
  },
  pending: {
    key: 'pending',
    labelKey: 'studyLoad.approval.status.pending',
    label: 'Kutilmoqda',
    color: 'processing',
  },
  superseded: {
    key: 'superseded',
    labelKey: 'studyLoad.summary.status.superseded',
    label: 'Almashtirilgan',
    color: 'default',
  },
  yangi: {
    key: 'yangi',
    labelKey: 'studyLoad.distribution.status.draft',
    label: 'Yangi',
    color: 'default',
  },
  tekshirilmoqda: {
    key: 'tekshirilmoqda',
    labelKey: 'studyLoad.distribution.status.inReview',
    label: 'Tekshirilmoqda',
    color: 'processing',
  },
  jarayonda: {
    key: 'jarayonda',
    labelKey: 'studyLoad.status.inProgress',
    label: 'Jarayonda',
    color: 'blue',
  },
  yuborilgan: {
    key: 'yuborilgan',
    labelKey: 'studyLoad.status.submitted',
    label: 'Yuborilgan',
    color: 'cyan',
  },
  qabulQilindi: {
    key: 'qabulQilindi',
    labelKey: 'studyLoad.status.accepted',
    label: 'Qabul qilindi',
    color: 'orange',
  },
  yaratilgan: {
    key: 'yaratilgan',
    labelKey: 'studyLoad.status.created',
    label: 'Yaratilgan',
    color: 'geekblue',
  },
  tasdiqlangan: {
    key: 'tasdiqlangan',
    labelKey: 'studyLoad.distribution.status.approved',
    label: 'Tasdiqlangan',
    color: 'success',
  },
  radEtilgan: {
    key: 'radEtilgan',
    labelKey: 'studyLoad.distribution.status.rejected',
    label: "Rad etilgan",
    color: 'error',
  },
};

export function getStatusMeta(key: string): StatusMeta {
  return STATUS_META_MAP[key as StudyLoadStatusKey] ?? STATUS_META_MAP.yangi;
}

export const ALL_STATUS_KEYS: StudyLoadStatusKey[] = Object.keys(
  STATUS_META_MAP,
) as StudyLoadStatusKey[];

const APPROVAL_STEP_I18N_KEY: Record<string, string> = {
  teacher: 'studyLoad.approval.step.teacher',
  kafedra: 'studyLoad.approval.step.kafedra',
  arm: 'studyLoad.approval.step.arm',
  methodical: 'studyLoad.approval.step.methodical',
  financial: 'studyLoad.approval.step.financial',
  dean: 'studyLoad.approval.step.dean',
  prorektor: 'studyLoad.approval.step.prorektor',
  rektor: 'studyLoad.approval.step.rektor',
};

export function getApprovalStepLabel(step: string, t: (key: string) => string): string {
  const key = APPROVAL_STEP_I18N_KEY[step];
  return key ? t(key) : step;
}
