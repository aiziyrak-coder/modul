import type { ResidentBrief } from './types';

export type PlanStatus =
  | 'yangi'
  | 'yuborilgan'
  | 'jarayonda'
  | 'rad_etilgan'
  | 'bajarilgan';

export type ProofStatus = 'pending' | 'approved' | 'rejected';

export interface WorkPlanProof {
  fileUrl: string | null;
  url: string | null;
  comment: string | null;
  createdAt: string | null;
  workDate: string | null;
  lateUpload: boolean;
  status: ProofStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
}

export interface WorkPlanTask {
  category: string;
  title: string;
  targetCount: number;
  dueDate: string | null;
  proofs: WorkPlanProof[];
}

export interface PlanApproval {
  role: string;
  userName: string | null;
  signedAt: string | null;
  eriKey: string | null;
  eriSerialNumber: string | null;
}

export interface WorkPlan {
  id: string;
  residentId: string;
  resident: ResidentBrief | null;
  supervisorName: string | null;
  title: string;
  academicYear: string | null;
  academicYearRef: string | null;
  tasks: WorkPlanTask[];
  status: PlanStatus;
  approvals: PlanApproval[];
  rejectionReason: string | null;
  createdAt: string | null;
}

export interface PlanStats {
  total: number;
  yangi: number;
  yuborilgan: number;
  jarayonda: number;
  rad_etilgan: number;
  bajarilgan: number;
}

export interface PlanKind {
  key: 'faoliyat' | 'dissertatsiya';
  label: string;
  routeBase: string;
  categories: { value: string; label: string }[];
  planKind: 'activity' | 'dissertation';
  section: 'residencyActivityPlan' | 'residencyDissertationPlan';
}

export const ACTIVITY_KIND: PlanKind = {
  key: 'faoliyat',
  label: 'Faoliyat rejasi',
  routeBase: '/residency/faoliyat-rejasi',
  planKind: 'activity',
  section: 'residencyActivityPlan',
  categories: [
    { value: 'oquv_metodik', label: 'O‘quv-metodik ishlar' },
    { value: 'ilmiy_tadqiqot', label: 'Ilmiy-tadqiqot ishlari' },
    { value: 'ilmiy_pedagogik', label: 'Ilmiy-pedagogik ishlar' },
    { value: 'pedagogik_amaliyot', label: 'Pedagogik amaliyot' },
  ],
};

export const DISSERTATION_KIND: PlanKind = {
  key: 'dissertatsiya',
  label: 'Dissertatsiya rejasi',
  routeBase: '/residency/dissertatsiya',
  planKind: 'dissertation',
  section: 'residencyDissertationPlan',
  categories: [
    { value: 'tayyorgarlik', label: 'Tadqiqotga tayyorgarlik' },
    { value: 'rejalashtirish', label: 'Ishlarni rejalashtirish' },
    { value: 'amalga_oshirish', label: 'Tadqiqotni amalga oshirish' },
    { value: 'rasmiylashtirish', label: 'Natijalarni rasmiylashtirish' },
    { value: 'himoya', label: 'Himoyaga taqdim etish' },
  ],
};

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | null;
  eventType: string;
}
