import type { ScientificWork, WorkReview, CouncilMember, MemberType, MemberFormInput, WorkStatus, ReviewType, AuthorType, SupervisorType, SeminarResult, WorkDocument, AuditEntry, DecisionHistoryEntry, DecisionType, WorkInput, ReviewInput, DecisionInput, CouncilSpecialty, CouncilNumber, ApplicationTemplate, WorkSpecialty, WorkDocumentType } from '../model/types';

export interface BackendUserRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  photo?: string;
  department?: string | { _id: string; title?: string };
  position?: string | { _id: string; title?: string };
  academicTitle?: string | { _id: string; title?: string };
}

type UserLike = BackendUserRef | string | null | undefined;

const refId = (v: UserLike): string => (!v ? '' : typeof v === 'string' ? v : v._id);

const refTitle = (v: string | { _id: string; title?: string } | undefined): string | undefined =>
  typeof v === 'object' ? v?.title : v;

const refName = (v: UserLike): string => {
  if (!v || typeof v === 'string') return '';
  return [v.lastName, v.firstName, v.middleName].filter(Boolean).join(' ');
};

export interface BackendWorkDocument {
  uploaded: boolean;
  fileName?: string;
  filePath?: string;
  uploadedAt?: string;
  version: number;
}

export interface BackendAuditEntry {
  action: string;
  user?: UserLike;
  role?: string;
  date: string;
  detail?: string;
}

export interface BackendDecisionHistoryEntry {
  decision: string;
  date: string;
  by?: UserLike;
  comment?: string;
  revisionDocs?: string[];
  seminarDate?: string;
}

export interface BackendReview {
  _id: string;
  work?: string | { _id: string; title?: string; status?: string };
  member?: UserLike;
  docKey: string;
  type: string;
  text?: string;
  reviewedAt: string;
  edited: boolean;
}

export interface BackendProtocol {
  generatedAt: string;
  signedAt?: string;
  signedBy?: string;
  eImzoSigned: boolean;
  eImzoCert?: string;
  immutable: boolean;
  intro?: string;
  finalConclusion: string;
}

export interface BackendWork {
  _id: string;
  title: string;
  titleRu?: string;
  year?: string;
  authorType: string;
  reviewCount?: number;
  researcher?: UserLike;
  externalAuthor?: {
    name: string;
    workplace: string;
    position: string;
    passportSeries?: string;
    passportNumber?: string;
    pinfl?: string;
  };
  specialty?: BackendSpecialty | string | null;
  supervisor?: {
    type?: string;
    user?: UserLike;
    name?: string;
    workplace?: string;
    position?: string;
    academicTitle?: string;
    degree?: string;
    email?: string;
    phone?: string;
  };
  type?: string;
  workFile?: BackendWorkDocument;
  status: string;
  councilMembers?: UserLike[];
  docAssignments?: Record<string, string[]>;
  documents?: Record<string, BackendWorkDocument>;
  protocol?: BackendProtocol;
  finalDecision?: string | null;
  seminarDate?: string;
  seminarResult?: string | null;
  defenseDate?: string;
  defenseResult?: string | null;
  rejectionReason?: string;
  revisionComment?: string;
  revisionDocs?: string[];
  revisionDocsFixed?: string[];
  decisionHistory?: BackendDecisionHistoryEntry[];
  auditLog?: BackendAuditEntry[];
  secretary?: UserLike;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BackendSpecialtyRef =
  | { _id: string; title: string; code: string; branch?: string | null }
  | string;

export function mapSpecialtyRef(v: BackendSpecialtyRef | null | undefined): WorkSpecialty | null {
  return v && typeof v === 'object'
    ? { id: v._id, title: v.title, code: v.code, branch: v.branch ?? null }
    : null;
}

export function mapSpecialtyRefs(
  v: (BackendSpecialtyRef | null | undefined)[] | undefined,
): WorkSpecialty[] {
  return (v ?? []).map(mapSpecialtyRef).filter((x): x is WorkSpecialty => x !== null);
}

export interface BackendMemberUser extends BackendUserRef {
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string | { _id: string; title?: string };
  academicTitle?: string | { _id: string; title?: string };
}

export interface BackendExternalMember {
  name?: string;
  workplace?: string;
  position?: string;
  passportSeries?: string;
  passportNumber?: string;
  email?: string;
  phone?: string;
}

export interface BackendMember {
  _id: string;
  type?: string;
  user?: BackendMemberUser;
  external?: BackendExternalMember;
  degree?: string;
  academicTitle?: string;
  specialties?: BackendSpecialtyRef[];
  organization?: string;
  active: boolean;
  assignedCount: number;
}

export function mapWork(b: BackendWork): ScientificWork {
  const researcherObj = b.researcher && typeof b.researcher === 'object' ? b.researcher : undefined;
  const supervisorUserObj =
    b.supervisor?.user && typeof b.supervisor.user === 'object' ? b.supervisor.user : undefined;

  return {
    id: b._id,
    title: b.title,
    titleRu: b.titleRu,
    year: b.year ?? '',
    authorType: b.authorType as AuthorType,
    researcher: b.researcher
      ? {
          id: refId(b.researcher),
          name: refName(b.researcher),
          position: refTitle(researcherObj?.position),
          department: refTitle(researcherObj?.department),
        }
      : undefined,
    externalAuthor: b.externalAuthor,
    supervisor: b.supervisor
      ? {
          type: (b.supervisor.type ?? 'internal') as SupervisorType,
          user: b.supervisor.user
            ? { id: refId(b.supervisor.user), name: refName(b.supervisor.user) }
            : undefined,
          name: b.supervisor.name,
          position: b.supervisor.position ?? refTitle(supervisorUserObj?.position),
          workplace: b.supervisor.workplace ?? refTitle(supervisorUserObj?.department),
          academicTitle: b.supervisor.academicTitle ?? refTitle(supervisorUserObj?.academicTitle),
          degree: b.supervisor.degree,
          email: b.supervisor.email,
          phone: b.supervisor.phone,
        }
      : undefined,
    specialty: mapSpecialtyRef(b.specialty),
    type: b.type,
    workFile: b.workFile
      ? {
          uploaded: b.workFile.uploaded,
          fileName: b.workFile.fileName,
          fileUrl: b.workFile.filePath,
          uploadedAt: b.workFile.uploadedAt,
          version: b.workFile.version,
        }
      : undefined,
    status: b.status as WorkStatus,
    councilMembers: (b.councilMembers ?? []).map((m) => ({ id: refId(m), name: refName(m) })),
    docAssignments: b.docAssignments ?? {},
    documents: Object.fromEntries(
      Object.entries(b.documents ?? {}).map(([k, v]) => [
        k,
        { uploaded: v.uploaded, fileName: v.fileName, uploadedAt: v.uploadedAt, version: v.version } as WorkDocument,
      ]),
    ),
    reviews: [],
    reviewCount: b.reviewCount ?? 0,
    protocol: b.protocol
      ? {
          generatedAt: b.protocol.generatedAt,
          signedAt: b.protocol.signedAt,
          signedBy: b.protocol.signedBy,
          eImzoSigned: b.protocol.eImzoSigned,
          eImzoCert: b.protocol.eImzoCert,
          immutable: b.protocol.immutable,
          intro: b.protocol.intro,
          finalConclusion: b.protocol.finalConclusion,
        }
      : undefined,
    finalDecision: (b.finalDecision ?? undefined) as DecisionType | undefined,
    seminarDate: b.seminarDate,
    seminarResult: (b.seminarResult ?? null) as SeminarResult | null,
    defenseDate: b.defenseDate,
    defenseResult: (b.defenseResult ?? null) as SeminarResult | null,
    rejectionReason: b.rejectionReason,
    revisionComment: b.revisionComment,
    revisionDocs: b.revisionDocs,
    revisionDocsFixed: b.revisionDocsFixed,
    decisionHistory: (b.decisionHistory ?? []).map<DecisionHistoryEntry>((d, i) => ({
      id: `${b._id}-dh-${i}`,
      decision: d.decision as DecisionType,
      date: d.date,
      by: refName(d.by) || refId(d.by),
      comment: d.comment ?? '',
      revisionDocs: d.revisionDocs,
      seminarDate: d.seminarDate,
    })),
    auditLog: (b.auditLog ?? []).map<AuditEntry>((a, i) => ({
      id: `${b._id}-al-${i}`,
      action: a.action,
      user: refName(a.user) || refId(a.user),
      role: a.role ?? '',
      date: a.date,
      detail: a.detail ?? '',
    })),
    secretary: b.secretary ? { id: refId(b.secretary), name: refName(b.secretary) } : undefined,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

export function mapReview(b: BackendReview): WorkReview {
  return {
    id: b._id,
    workId: typeof b.work === 'object' && b.work ? b.work._id : (b.work ?? ''),
    memberId: refId(b.member),
    memberName: refName(b.member),
    docKey: b.docKey,
    type: b.type as ReviewType,
    text: b.text ?? '',
    reviewedAt: b.reviewedAt,
    edited: b.edited,
  };
}

export function workInputToBackend(input: Partial<WorkInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.titleRu !== undefined) out.titleRu = input.titleRu;
  if (input.year !== undefined) out.year = input.year;
  if (input.authorType !== undefined) out.authorType = input.authorType;
  if (input.type !== undefined) out.type = input.type;
  if (input.councilMembers !== undefined) out.councilMembers = input.councilMembers;
  if (input.specialtyId) out.specialty = input.specialtyId;

  const authorType = input.authorType ?? 'internal';
  if (authorType === 'internal') {
    if (input.authorId !== undefined) out.researcher = input.authorId;
  } else {
    const externalAuthor: Record<string, unknown> = {};
    if (input.fullName !== undefined) externalAuthor.name = input.fullName;
    if (input.workplace !== undefined) externalAuthor.workplace = input.workplace;
    if (input.position !== undefined) externalAuthor.position = input.position;
    if (input.passportSeries) externalAuthor.passportSeries = input.passportSeries;
    if (input.passportNumber) externalAuthor.passportNumber = input.passportNumber;
    if (input.pinfl) externalAuthor.pinfl = input.pinfl;
    if (input.email) externalAuthor.email = input.email;
    if (input.phone) externalAuthor.phone = input.phone;
    if (Object.keys(externalAuthor).length > 0) out.externalAuthor = externalAuthor;
  }

  if (input.supervisorType !== undefined) {
    const supervisor: Record<string, unknown> = { type: input.supervisorType };
    if (input.supervisorType === 'internal') {
      if (input.supervisorUserId) supervisor.user = input.supervisorUserId;
    } else {
      if (input.supervisorName) supervisor.name = input.supervisorName;
      if (input.supervisorWorkplace) supervisor.workplace = input.supervisorWorkplace;
      if (input.supervisorPosition) supervisor.position = input.supervisorPosition;
      if (input.supervisorEmail) supervisor.email = input.supervisorEmail;
      if (input.supervisorPhone) supervisor.phone = input.supervisorPhone;
      if (input.supervisorAcademicTitle) supervisor.academicTitle = input.supervisorAcademicTitle;
      if (input.supervisorDegree) supervisor.degree = input.supervisorDegree;
    }
    if (Object.keys(supervisor).length > 1) out.supervisor = supervisor;
  }

  return out;
}

export function reviewInputToBackend(input: ReviewInput): Record<string, unknown> {
  return { work: input.workId, docKey: input.docKey, type: input.type, text: input.text };
}

export function decisionInputToBackend(input: DecisionInput): Record<string, unknown> {
  const out: Record<string, unknown> = { type: input.type, comment: input.comment };
  if (input.revisionDocs !== undefined) out.revisionDocs = input.revisionDocs;
  if (input.seminarDate !== undefined) out.seminarDate = input.seminarDate;
  if (input.rejectionReason !== undefined) out.rejectionReason = input.rejectionReason;
  return out;
}

export function mapMember(b: BackendMember): CouncilMember {
  const type = (b.type ?? 'internal') as MemberType;
  const u = b.user;
  const pos = u?.position;
  const ext = b.external;

  if (type === 'external') {
    return {
      id: b._id,
      type,
      userId: '',
      name: ext?.name ?? '',
      position: ext?.position ?? '',
      degree: b.degree ?? '',
      academicTitle: b.academicTitle ?? '',
      specialties: mapSpecialtyRefs(b.specialties),
      organization: ext?.workplace ?? '',
      email: ext?.email ?? '',
      phone: ext?.phone ?? '',
      passportSeries: ext?.passportSeries,
      passportNumber: ext?.passportNumber,
      active: b.active,
      assignedCount: b.assignedCount,
    };
  }

  return {
    id: b._id,
    type,
    userId: u?._id ?? '',
    name: u?.fullName ?? refName(u),
    position: typeof pos === 'object' && pos ? (pos.title ?? '') : (pos ?? ''),
    degree: b.degree ?? '',
    academicTitle: refTitle(u?.academicTitle) || (b.academicTitle ?? ''),
    specialties: mapSpecialtyRefs(b.specialties),
    organization: '',
    email: u?.email ?? '',
    phone: u?.phone ?? '',
    active: b.active,
    assignedCount: b.assignedCount,
  };
}

export function memberInputToBackend(
  input: MemberFormInput,
  opts: { isCreate?: boolean } = {},
): Record<string, unknown> {
  const isCreate = opts.isCreate ?? true;
  const out: Record<string, unknown> = {};
  if (isCreate) out.type = input.type;
  if (input.degree !== undefined) out.degree = input.degree;
  if (input.academicTitle !== undefined) out.academicTitle = input.academicTitle;
  if (input.specialtyIds !== undefined) out.specialties = input.specialtyIds ?? [];
  if (input.active !== undefined) out.active = input.active;

  if (input.type === 'internal') {
    if (isCreate && input.userId !== undefined) out.user = input.userId;
    return out;
  }

  const external: Record<string, unknown> = {};
  if (input.name !== undefined) external.name = input.name;
  if (input.workplace !== undefined) external.workplace = input.workplace;
  if (input.position !== undefined) external.position = input.position;
  if (input.passportSeries) external.passportSeries = input.passportSeries;
  if (input.passportNumber) external.passportNumber = input.passportNumber;
  if (input.email) external.email = input.email;
  if (input.phone) external.phone = input.phone;
  out.external = external;
  return out;
}

export interface BackendSpecialty {
  _id: string;
  title: string;
  code: string;
  branch?: string | null;
  active?: boolean;
}

export interface BackendWorkDocumentType {
  _id: string;
  key: string;
  labelUz: string;
  labelRu?: string | null;
  format?: string;
  required?: boolean;
  active?: boolean;
  order?: number;
}

export function mapWorkDocumentType(b: BackendWorkDocumentType): WorkDocumentType {
  return {
    id: b._id,
    key: b.key,
    labelUz: b.labelUz,
    labelRu: b.labelRu ?? null,
    format: b.format ?? '',
    required: b.required === true,
    active: b.active !== false,
    order: b.order ?? 0,
  };
}

export function mapSpecialty(b: BackendSpecialty): CouncilSpecialty {
  return {
    id: b._id,
    title: b.title,
    code: b.code,
    branch: b.branch ?? null,
    active: b.active !== false,
  };
}

export interface BackendCouncilNumber {
  _id: string;
  number: string;
  specialties?: (BackendSpecialty | string)[];
  active?: boolean;
}

export function mapCouncilNumber(b: BackendCouncilNumber): CouncilNumber {
  return {
    id: b._id,
    number: b.number,
    specialties: (b.specialties ?? [])
      .filter((s): s is BackendSpecialty => typeof s === 'object' && s !== null)
      .map(mapSpecialty),
    active: b.active !== false,
  };
}

export interface BackendApplicationTemplate {
  _id: string;
  fileName: string;
  filePath: string;
  size?: number | null;
  unit?: string | null;
  updatedAt?: string;
}

export function mapApplicationTemplate(
  b: BackendApplicationTemplate | null,
): ApplicationTemplate | null {
  if (!b) return null;
  return {
    id: b._id,
    fileName: b.fileName,
    fileUrl: b.filePath,
    size: b.size ?? null,
    unit: b.unit ?? null,
    updatedAt: b.updatedAt ?? null,
  };
}
