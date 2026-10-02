export type WorkStatus = 'new' | 'accepted' | 'pending' | 'reviewed' | 'not_evaluated' | 'not_recommended' | 'rejected' | 'revision';
export type ReviewType = 'positive' | 'neutral' | 'negative';
export type DecisionType = 'seminar' | 'revision' | 'rejected';
export type AuthorType = 'internal' | 'external';
export type SupervisorType = 'internal' | 'external';

export type SeminarResult = 'defended' | 'not_defended';

export interface ExternalAuthor {
  name: string;
  workplace: string;
  position: string;
  passportSeries?: string;
  passportNumber?: string;
  pinfl?: string;
  email?: string;
  phone?: string;
}

export interface Supervisor {
  type: SupervisorType;
  user?: { id: string; name: string };
  name?: string;
  workplace?: string;
  position?: string;
  academicTitle?: string;
  degree?: string;
  email?: string;
  phone?: string;
}

export interface WorkSpecialty {
  id: string;
  title: string;
  code: string;
  branch: string | null;
}

export interface WorkDocument {
  uploaded: boolean;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
  version: number;
}

export interface Protocol {
  generatedAt: string;
  intro?: string;
  signedAt?: string;
  signedBy?: string;
  eImzoSigned: boolean;
  eImzoCert?: string;
  immutable: boolean;
  finalConclusion: string;
}

export interface DecisionHistoryEntry {
  id: string;
  decision: DecisionType;
  date: string;
  by: string;
  comment: string;
  revisionDocs?: string[];
  seminarDate?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  date: string;
  detail: string;
}

export interface ScientificWork {
  id: string;
  title: string;
  titleRu?: string;
  year: string;
  authorType: AuthorType;
  researcher?: { id: string; name: string; position?: string; department?: string };
  externalAuthor?: ExternalAuthor;
  supervisor?: Supervisor;
  specialty?: WorkSpecialty | null;
  type?: string;
  workFile?: WorkDocument;
  status: WorkStatus;
  councilMembers: { id: string; name: string }[];
  docAssignments: Record<string, string[]>;
  documents: Record<string, WorkDocument>;
  reviews: WorkReview[];
  reviewCount?: number;
  protocol?: Protocol;
  finalDecision?: DecisionType;
  seminarDate?: string;
  seminarResult?: SeminarResult | null;
  defenseDate?: string;
  defenseResult?: SeminarResult | null;
  rejectionReason?: string;
  revisionComment?: string;
  revisionDocs?: string[];
  revisionDocsFixed?: string[];
  decisionHistory: DecisionHistoryEntry[];
  auditLog: AuditEntry[];
  secretary?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface WorkReview {
  id: string;
  workId: string;
  memberId: string;
  memberName: string;
  docKey: string;
  type: ReviewType;
  text: string;
  reviewedAt: string;
  edited: boolean;
}

export type MemberType = 'internal' | 'external';

export interface CouncilMember {
  id: string;
  type: MemberType;
  userId: string;
  name: string;
  position: string;
  degree: string;
  organization: string;
  academicTitle: string;
  specialties: WorkSpecialty[];
  email: string;
  phone: string;
  passportSeries?: string;
  passportNumber?: string;
  active: boolean;
  assignedCount: number;
}

export interface MemberFormInput {
  type: MemberType;
  divisionId?: string;
  facultyId?: string;
  departmentId?: string;
  userId?: string;
  name?: string;
  workplace?: string;
  position?: string;
  passportSeries?: string;
  passportNumber?: string;
  email?: string;
  phone?: string;
  degree?: string;
  academicTitle?: string;
  specialtyIds?: string[];
  active: boolean;
}

export interface WorkInput {
  title: string;
  titleRu?: string;
  year: string;
  authorType: AuthorType;
  divisionId?: string;
  facultyId?: string;
  departmentId?: string;
  authorId?: string;
  fullName?: string;
  workplace?: string;
  position?: string;
  passportSeries?: string;
  passportNumber?: string;
  pinfl?: string;
  supervisorType?: SupervisorType;
  supervisorDivisionId?: string;
  supervisorFacultyId?: string;
  supervisorDepartmentId?: string;
  supervisorUserId?: string;
  supervisorName?: string;
  supervisorWorkplace?: string;
  supervisorPosition?: string;
  supervisorAcademicTitle?: string;
  supervisorDegree?: string;
  supervisorEmail?: string;
  supervisorPhone?: string;
  email?: string;
  phone?: string;
  specialtyId?: string;
  type?: string;
  councilMembers?: string[];
}

export interface ReviewInput {
  workId: string;
  docKey: string;
  type: ReviewType;
  text: string;
}

export interface DecisionInput {
  workId: string;
  type: DecisionType;
  comment: string;
  revisionDocs?: string[];
  seminarDate?: string;
  rejectionReason?: string;
}

export interface MemberDecisionInput {
  workId: string;
  type: Extract<DecisionType, 'revision' | 'rejected'>;
  comment: string;
  revisionDocs?: string[];
  rejectionReason?: string;
}

export interface CouncilSpecialty {
  id: string;
  title: string;
  code: string;
  branch: string | null;
  active: boolean;
}

export interface SpecialtyInput {
  title: string;
  code: string;
  branch?: string;
  active?: boolean;
}

export interface WorkDocumentType {
  id: string;
  key: string;
  labelUz: string;
  labelRu: string | null;
  format: string;
  required: boolean;
  active: boolean;
  order: number;
}

export interface WorkDocumentTypeInput {
  key?: string;
  labelUz: string;
  labelRu?: string;
  format: string;
  required?: boolean;
  active?: boolean;
  order?: number;
}

export interface CouncilNumber {
  id: string;
  number: string;
  specialties: CouncilSpecialty[];
  active: boolean;
}

export interface CouncilNumberInput {
  number: string;
  specialties?: string[];
  active?: boolean;
}

export interface ApplicationTemplate {
  id: string;
  fileName: string;
  fileUrl: string;
  size: number | null;
  unit: string | null;
  updatedAt: string | null;
}
