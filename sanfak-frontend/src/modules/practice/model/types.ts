export type ContractStatus =
  | 'draft'
  | 'in_progress'
  | 'rektor_approved'
  | 'both_approved'
  | 'rejected';

export type PracticeRole =
  | 'amaliyot_bolimi'
  | 'rektor'
  | 'tibbiyot_birlashmasi_rahbari'
  | 'admin';

export interface RefItem {
  id: string;
  title: string;
}

export interface DistrictRef extends RefItem {
  region: RefItem;
}

export interface RepresentativeRef {
  id: string;
  firstName: string;
  lastName: string;
  position?: string | null;
}

export interface PracticeBase {
  id: string;
  title: string;
  orgType: RefItem;
  stir: string;
  region: RefItem;
  district: RefItem;
  address: string;
  headName: string;
  headJshshir: string;
  headPhone: string;
  email?: string | null;
  capacity?: number | null;
  responsibleUsers: RepresentativeRef[];
  active: boolean;
  createdAt?: string;
}

export interface PracticeStudent {
  id: string;
  fish: string;
  academicYear: RefItem;
  direction: RefItem;
  course: number;
  group: string;
  region: RefItem;
  district: RefItem;
  active: boolean;
}

export interface EriCertInfo {
  serialNumber?: string | null;
  subject?: string | null;
}

export interface EriSignature {
  signed: boolean;
  signer?: string | null;
  signedAt?: string | null;
  certInfo?: EriCertInfo | null;
}

export interface ContractHistoryEntry {
  at: string;
  actor?: string;
  action?: string;
  reason?: string;
}

export interface ContractStudentLite {
  id: string;
  fish: string;
  group?: string;
}

export interface ContractOrg {
  id: string;
  title: string;
  stir?: string;
  region: RefItem;
  district: RefItem;
}

export interface Contract {
  id: string;
  number: string;
  organization: ContractOrg;
  direction: RefItem;
  academicYear: RefItem;
  course?: number | null;
  group?: string | null;
  students: ContractStudentLite[];
  studentsCount: number;
  startDate: string;
  endDate: string;
  note?: string | null;
  status: ContractStatus;
  rector: EriSignature;
  orgHead: EriSignature;
  rejectReason?: string | null;
  rejectedBy?: 'rektor' | 'org_head' | null;
  history: ContractHistoryEntry[];
  createdAt?: string;
}

export interface NotificationItem {
  id: string;
  eventType: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
  forRole: PracticeRole;
}

export interface ContractTemplate {
  id: string;
  body: string;
}

export interface EriKey {
  serialNumber: string;
  subject: string;
}
