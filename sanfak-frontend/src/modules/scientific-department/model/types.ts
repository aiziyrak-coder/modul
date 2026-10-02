export type JournalType = 'scopus' | 'wos' | 'nationalOak' | 'foreignOak';

export type ArticleStatus = 'new' | 'pending' | 'approved' | 'rejected';

export interface Journal {
  id: string;
  name: string;
  type: JournalType;
  addedDate: string;
}

export interface Article {
  id: string;
  authorName: string;
  title: string | null;
  journalId: string | null;
  journalName: string;
  type: JournalType;
  academicYear: string | null;
  publishYear: number | null;
  publishedDate: string;
  pages: string | null;
  url: string | null;
  authorCount: number | null;
  facultyName: string | null;
  departmentName: string | null;
  status: ArticleStatus;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedByRole: string | null;
  fileUrl: string | null;
  date: string;
}

export interface ArticleFilters {
  status?: ArticleStatus;
  type?: JournalType;
  academicYear?: string;
  faculty?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const JOURNAL_TYPES: JournalType[] = [
  'scopus',
  'wos',
  'nationalOak',
  'foreignOak',
];

export const JOURNAL_TYPE_COLORS: Record<JournalType, string> = {
  scopus: 'blue',
  wos: 'purple',
  nationalOak: 'green',
  foreignOak: 'orange',
};

export type ThesisType = 'national' | 'international';

export interface ThesisCategory {
  id: string;
  name: string;
  type: ThesisType;
  addedDate: string;
}

export interface Thesis {
  id: string;
  authorName: string;
  title: string;
  conferenceName: string;
  type: ThesisType;
  academicYear: string | null;
  publishYear: number | null;
  publishedDate: string;
  pages: string | null;
  url: string | null;
  authorCount: number | null;
  facultyName: string | null;
  departmentName: string | null;
  status: ArticleStatus;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedByRole: string | null;
  fileUrl: string | null;
  date: string;
}

export interface ThesisFilters {
  status?: ArticleStatus;
  type?: ThesisType;
  academicYear?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const THESIS_TYPES: ThesisType[] = ['national', 'international'];

export const THESIS_TYPE_COLORS: Record<ThesisType, string> = {
  national: 'green',
  international: 'blue',
};

export interface Plan {
  id: string;
  departmentName: string | null;
  facultyName: string | null;
  academicYearId: string | null;
  academicYearTitle: string | null;
  fileUrl: string | null;
  status: ArticleStatus;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedByRole: string | null;
  dekanApprovedAt: string | null;
  prorektorApprovedAt: string | null;
  createdByName: string | null;
  date: string;
}

export interface PlanFilters {
  status?: ArticleStatus;
  academicYear?: string;
  faculty?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AcademicYearRef {
  id: string;
  title: string;
}

export type BadgeStatus =
  | ArticleStatus
  | 'finalReview'
  | 'kotibApproved'
  | 'prorektorApproved'
  | 'ssvSendPending'
  | 'ssvSent'
  | 'ssvReceived';

export type MethodicalSlot =
  | 'methodical'
  | 'protocol'
  | 'titul'
  | 'external'
  | 'internal'
  | 'antiplagiat';

export type MonographSlot =
  | 'referral'
  | 'council'
  | 'file'
  | 'passport'
  | 'titul'
  | 'external'
  | 'internal'
  | 'antiplagiat'
  | 'ziyonet';

export interface FileSlotConfig {
  slot: string;
  labelKey: string;
  label?: string;
  format: string;
  accept: string;
  group: 'main' | 'review';
}

export const METHODICAL_FILE_SLOTS: FileSlotConfig[] = [
  { slot: 'methodical', labelKey: 'files.methodical', format: '.docx', accept: '.docx,.doc', group: 'main' },
  { slot: 'protocol', labelKey: 'files.protocol', format: '.pdf', accept: '.pdf', group: 'main' },
  { slot: 'titul', labelKey: 'files.titul', format: '.docx', accept: '.docx,.doc', group: 'main' },
  { slot: 'external', labelKey: 'files.external', format: '.pdf', accept: '.pdf', group: 'review' },
  { slot: 'internal', labelKey: 'files.internal', format: '.pdf', accept: '.pdf', group: 'review' },
  { slot: 'antiplagiat', labelKey: 'files.antiplagiat', format: '.pdf', accept: '.pdf', group: 'review' },
];

export const MONOGRAPH_FILE_SLOTS: FileSlotConfig[] = [
  { slot: 'referral', labelKey: 'files.referral', format: '.docx', accept: '.docx,.doc', group: 'main' },
  { slot: 'council', labelKey: 'files.council', format: '.docx', accept: '.docx,.doc', group: 'main' },
  { slot: 'file', labelKey: 'files.file', format: '.pdf', accept: '.pdf,.docx,.doc', group: 'main' },
  { slot: 'passport', labelKey: 'files.passport', format: '.docx', accept: '.docx,.doc', group: 'main' },
  { slot: 'titul', labelKey: 'files.titul', format: '.docx', accept: '.docx,.doc', group: 'main' },
  { slot: 'external', labelKey: 'files.external', format: '.pdf', accept: '.pdf', group: 'review' },
  { slot: 'internal', labelKey: 'files.internal', format: '.pdf', accept: '.pdf', group: 'review' },
  { slot: 'antiplagiat', labelKey: 'files.antiplagiat', format: '.pdf', accept: '.pdf', group: 'review' },
  { slot: 'ziyonet', labelKey: 'files.ziyonet', format: '.pdf', accept: '.pdf', group: 'review' },
];

export interface MethodicalSpecialty {
  id: string;
  code: string;
  name: string;
  active: boolean;
  label: string;
}

export interface Methodical {
  id: string;
  authorName: string;
  source: 'internal' | 'public';
  submitterPhone: string | null;
  submitterEmail: string | null;
  submitterOrganization: string | null;
  submitterDepartment: string | null;
  title: string;
  specialtyId: string | null;
  specialtyLabel: string | null;
  direction: string;
  academicYear: string | null;
  facultyName: string | null;
  departmentName: string | null;
  files: Partial<Record<MethodicalSlot, string>>;
  status: ArticleStatus;
  ilmiyApproved: boolean;
  ilmiyApprovedAt: string | null;
  kotibSigned: boolean;
  kotibSignedAt: string | null;
  kotibEriSerial: string | null;
  kotibSignedByName: string | null;
  rektorSigned: boolean;
  rektorSignedAt: string | null;
  rektorEriSerial: string | null;
  rektorSignedByName: string | null;
  registrationNumber: string | null;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedByRole: string | null;
  date: string;
}

export interface MethodicalFilters {
  status?: ArticleStatus;
  academicYear?: string;
  search?: string;
  faculty?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface Monograph {
  id: string;
  authorName: string;
  title: string | null;
  isbn: string | null;
  publisher: string | null;
  ssvNumber: string | null;
  ssvDate: string | null;
  isbnFileUrl: string | null;
  facultyName: string | null;
  departmentName: string | null;
  files: Partial<Record<MonographSlot, string>>;
  status: ArticleStatus;
  ilmiyApproved: boolean;
  ilmiyApprovedAt: string | null;
  kotibSigned: boolean;
  kotibSignedAt: string | null;
  kotibEriSerial: string | null;
  kotibSignedByName: string | null;
  prorektorSigned: boolean;
  prorektorSignedAt: string | null;
  prorektorEriSerial: string | null;
  prorektorSignedByName: string | null;
  ssvSent: boolean;
  ssvSentAt: string | null;
  ssvReceived: boolean;
  ssvReceivedAt: string | null;
  ssvResponseFileUrl: string | null;
  teacherConfirmed: boolean;
  dataApproved: boolean;
  dataRejectionReason: string | null;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedByRole: string | null;
  date: string;
}

export interface MonographFilters {
  status?: BadgeStatus;
  search?: string;
  faculty?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type TemplateCategory = 'methodical' | 'monograph';

export interface ScientificTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  updatedDate: string;
}

export type ConferenceType = 'national' | 'international';
export type ConferenceStatus = 'active' | 'closed';
export type KafedraAcceptStatus = 'pending' | 'accepted';

export type ConfDocSlot = 'thesis' | 'certificate' | 'participant' | 'program';

export const CONF_DOC_SLOTS: FileSlotConfig[] = [
  { slot: 'thesis', labelKey: 'conf.docs.thesis', format: '.pdf', accept: '.pdf', group: 'main' },
  { slot: 'certificate', labelKey: 'conf.docs.certificate', format: '.pdf', accept: '.pdf', group: 'main' },
  { slot: 'participant', labelKey: 'conf.docs.participant', format: '.docx', accept: '.pdf,.docx,.doc', group: 'main' },
  { slot: 'program', labelKey: 'conf.docs.program', format: '.pdf', accept: '.pdf,.docx,.doc', group: 'main' },
];

export type ConfFileType = 'pdf' | 'word' | 'excel' | 'image';

export const CONF_FILE_TYPE_OPTIONS: {
  value: ConfFileType;
  labelKey: string;
  accept: string;
}[] = [
  { value: 'pdf', labelKey: 'conferences.fileTypePdf', accept: '.pdf' },
  { value: 'word', labelKey: 'conferences.fileTypeWord', accept: '.doc,.docx' },
  { value: 'excel', labelKey: 'conferences.fileTypeExcel', accept: '.xls,.xlsx' },
  { value: 'image', labelKey: 'conferences.fileTypeImage', accept: '.jpg,.jpeg,.png' },
];

export const confAccept = (t: ConfFileType): string =>
  CONF_FILE_TYPE_OPTIONS.find((o) => o.value === t)?.accept ?? '.pdf';

export interface ConfRequiredDoc {
  label: string;
  fileType: ConfFileType;
}

export interface ConfUploadedDoc {
  label: string;
  fileType: ConfFileType;
  fileUrl: string;
}

export const CONFERENCE_TYPES: ConferenceType[] = ['national', 'international'];

export interface KafedraStatus {
  departmentId: string | null;
  departmentName: string | null;
  status: KafedraAcceptStatus;
  acceptedByName: string | null;
  acceptedAt: string | null;
  docs: ConfUploadedDoc[];
  documents: Partial<Record<ConfDocSlot, string>>;
}

export interface Conference {
  id: string;
  title: string;
  type: ConferenceType;
  description: string;
  deadline: string | null;
  beforeDeadline: string | null;
  afterDeadline: string | null;
  requiredDocs: ConfRequiredDoc[];
  requiredInfo: string[];
  status: ConferenceStatus;
  kafedras: KafedraStatus[];
  myKafedra: KafedraStatus | null;
  createdByName: string | null;
  date: string;
  acceptedByMe: boolean;
}

export interface ConferenceFilters {
  type?: ConferenceType;
  status?: ConferenceStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RefOption {
  id: string;
  name: string;
  facultyId?: string | null;
}

export type ContractSlot = 'order' | 'contract' | 'receipt';

export const CONTRACT_FILE_SLOTS: FileSlotConfig[] = [
  { slot: 'order', labelKey: 'contract.files.order', format: '.pdf', accept: '.pdf,.docx,.doc', group: 'main' },
  { slot: 'contract', labelKey: 'contract.files.contract', format: '.pdf', accept: '.pdf,.docx,.doc', group: 'main' },
  { slot: 'receipt', labelKey: 'contract.files.receipt', format: '.pdf', accept: '.pdf,.jpg,.jpeg,.png', group: 'main' },
];

export interface EconomicContract {
  id: string;
  teacherName: string | null;
  teacherId: string | null;
  departmentName: string | null;
  facultyName: string | null;
  title: string;
  partnerOrganization: string;
  contractDate: string | null;
  amount: number;
  currentYearAmount: number;
  files: Partial<Record<ContractSlot, string>>;
  status: ArticleStatus;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedByRole: string | null;
  academicYearId: string | null;
  academicYearTitle: string | null;
  createdByName: string | null;
  date: string;
}

export interface ContractFilters {
  status?: ArticleStatus;
  department?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface HIndexProfile {
  id: string;
  teacherName: string | null;
  departmentName: string | null;
  facultyName: string | null;
  scopusUrl: string;
  scopusHIndex: number;
  scopusCitations: number;
  scopusDocuments: number;
  scopusSyncedDate: string;
  scopusSyncError: string;
  scholarUrl: string;
  scholarHIndex: number;
  scholarCitations: number;
  scholarI10Index: number;
  scholarSyncedDate: string;
  scholarSyncError: string;
  updatedDate: string;
}

export interface HIndexFilters {
  faculty?: string;
  search?: string;
}

export type AchievementCategoryKey =
  | 'degrees'
  | 'titles'
  | 'defense'
  | 'patents'
  | 'certificates';

export interface Achievement {
  id: string;
  authorName: string | null;
  facultyName: string | null;
  departmentName: string | null;
  academicYear: string | null;
  fileUrl: string | null;
  status: ArticleStatus;
  rejectionReason: string | null;
  rejectedByName: string | null;
  rejectedByRole: string | null;
  approvedByName: string | null;
  submittedDate: string;
  [field: string]: unknown;
}

export interface AchievementFilters {
  status?: ArticleStatus;
  academicYear?: string;
  faculty?: string;
  department?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type AchievementFieldKind = 'text' | 'select' | 'year' | 'date' | 'ref';

export type AchievementRefSource =
  | 'academicLevels'
  | 'academicTitles'
  | 'scienceBranches'
  | 'specialties';

export interface AchievementFieldOption {
  value: string;
  labelKey: string;
  tagColor?: string;
}

export interface AchievementField {
  name: string;
  labelKey: string;
  kind: AchievementFieldKind;
  options?: AchievementFieldOption[];
  refSource?: AchievementRefSource;
  tag?: boolean;
  placeholder?: string;
  colKey?: string;
}

export interface AchievementCategory {
  key: AchievementCategoryKey;
  root: string;
  section: string;
  labelKey: string;
  tabKey: string;
  icon: 'trophy' | 'book' | 'safety' | 'file';
  color: string;
  fields: AchievementField[];
}

export const EXAM_SPECIALTY_STATUSES = ['open', 'closed'] as const;
export type ExamSpecialtyStatus = (typeof EXAM_SPECIALTY_STATUSES)[number];

export const EFFECTIVE_SPECIALTY_STATUSES = ['open', 'closed', 'upcoming', 'expired'] as const;
export type EffectiveSpecialtyStatus = (typeof EFFECTIVE_SPECIALTY_STATUSES)[number];

export interface ExamSpecialty {
  id: string;
  code: string;
  name: string;
  regStart: string | null;
  regEnd: string | null;
  status: ExamSpecialtyStatus;
  effectiveStatus: EffectiveSpecialtyStatus;
  isOpen: boolean;
}

export interface ExamSpecialtyFilters {
  status?: ExamSpecialtyStatus;
  search?: string;
}

export const RESEARCHER_TYPES = ['mustaqil', 'tayanch'] as const;
export type ResearcherType = (typeof RESEARCHER_TYPES)[number];

export const APPLICANT_STATUSES = ['new', 'approved', 'rejected', 'passed', 'failed'] as const;
export type ApplicantStatus = (typeof APPLICANT_STATUSES)[number];

export const APPLICANT_DOC_SLOTS = [
  'referral',
  'application',
  'passport',
  'diploma',
  'objektivka',
  'topic',
  'order',
] as const;
export type ApplicantDocSlot = (typeof APPLICANT_DOC_SLOTS)[number];

export const LEGACY_APPLICANT_DOC_SLOTS = ['personal'] as const;
export type LegacyApplicantDocSlot = (typeof LEGACY_APPLICANT_DOC_SLOTS)[number];

export interface QualifyingApplicant {
  id: string;
  name: string;
  source: 'internal' | 'public';
  researcherType: ResearcherType;
  course: number | null;
  specialization: string;
  university: string;
  phone: string;
  documents: Partial<Record<ApplicantDocSlot | LegacyApplicantDocSlot, string>>;
  status: ApplicantStatus;
  examDate: string | null;
  certificateFileUrl: string;
  rejectionReason: string;
  addedById: string | null;
  addedByName: string;
  departmentName: string | null;
  facultyName: string | null;
  reviewedByName: string;
  resultByName: string;
  date: string;
}

export interface ApplicantFilters {
  status?: ApplicantStatus;
  specialization?: string;
  course?: number;
  examDate?: 'assigned' | 'unassigned';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const POST_RECIPIENTS = ['all', 'teachers', 'heads', 'deans'] as const;
export type PostRecipient = (typeof POST_RECIPIENTS)[number];

export interface ScientificPost {
  id: string;
  title: string;
  text: string;
  recipients: PostRecipient[];
  telegram: boolean;
  specialtyCode: string;
  authorName: string;
  date: string;
}

export interface AppNotification {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  date: string;
}

export interface StartupType {
  id: string;
  name: string;
  active: boolean;
}

export type StartupFileSlot = 'passport' | 'application' | 'presentation' | 'certificate';

export interface Startup {
  id: string;
  authorName: string;
  typeId: string | null;
  typeName: string;
  title: string;
  facultyName: string | null;
  departmentName: string | null;
  files: Partial<Record<StartupFileSlot, string>>;
  date: string;
}

export interface StartupFilters {
  search?: string;
  type?: string;
  faculty?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const STARTUP_FILE_SLOTS: FileSlotConfig[] = [
  { slot: 'passport', labelKey: 'files.startupPassport', format: '.pdf', accept: '.pdf', group: 'main' },
  { slot: 'application', labelKey: 'files.startupApplication', format: '.pdf', accept: '.pdf', group: 'main' },
  {
    slot: 'presentation',
    labelKey: 'files.startupPresentation',
    format: '.ppt',
    accept: '.ppt,.pptx',
    group: 'main',
  },
  {
    slot: 'certificate',
    labelKey: 'files.startupCertificate',
    format: '.pdf',
    accept: '.pdf,.jpg,.jpeg,.png',
    group: 'main',
  },
];
