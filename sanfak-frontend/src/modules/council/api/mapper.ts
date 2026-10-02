import type {
  Announcement,
  CouncilMember,
  CouncilNotification,
  CouncilTask,
  DocItem,
  DocSetting,
  HistoryEntry,
  MyVote,
  RankApplication,
  RefItem,
  UserOption,
  UserRef,
  VoteParticipation,
  VotingSession,
} from '../model/types';

interface BackendRef {
  _id: string;
  title: string;
}
const ref = (r?: BackendRef | null): RefItem | null =>
  r ? { id: r._id, title: r.title } : null;

interface BackendUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}
const user = (u?: BackendUser | string | null): UserRef => {
  if (!u || typeof u === 'string') return { id: typeof u === 'string' ? u : '', fullName: '' };
  const fullName = [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
  return { id: u._id, fullName };
};

const history = (h?: { at: string; actor?: string; action?: string; reason?: string }[]): HistoryEntry[] =>
  (h ?? []).map((x) => ({ at: x.at, actor: x.actor, action: x.action, reason: x.reason }));

const refTitle = (v?: { title?: string } | string | null): string | null => {
  if (!v) return null;
  return typeof v === 'string' ? v : (v.title ?? null);
};

interface BackendUserOption extends BackendUser {
  position?: { title?: string } | string | null;
  academicTitle?: { title?: string } | string | null;
}
export const mapUserOption = (u: BackendUserOption): UserOption => ({
  id: u._id,
  fullName: [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' '),
  position: refTitle(u.position),
  academicTitle: refTitle(u.academicTitle),
});

interface BackendParticipation {
  user?: BackendUser | null;
  department?: BackendRef | null;
  voted: boolean;
}
export const mapParticipation = (p: BackendParticipation): VoteParticipation => ({
  user: user(p.user),
  department: ref(p.department),
  voted: Boolean(p.voted),
});

interface BackendMemberUser extends BackendUser {
  position?: BackendRef | null;
  academicTitle?: BackendRef | null;
}
interface BackendMember {
  _id: string;
  user?: BackendMemberUser | string | null;
  department?: BackendRef | null;
  canVote?: boolean;
  active: boolean;
}
const memberUser = (u: BackendMember['user']): BackendMemberUser | null =>
  u && typeof u !== 'string' ? u : null;

export const mapMember = (m: BackendMember): CouncilMember => ({
  id: m._id,
  user: user(m.user),
  department: ref(m.department),
  position: ref(memberUser(m.user)?.position),
  academicTitle: ref(memberUser(m.user)?.academicTitle),
  canVote: m.canVote ?? true,
  active: m.active,
});

interface BackendTask {
  _id: string;
  title: string;
  desc?: string | null;
  assignee?: BackendUser | null;
  deadline?: string | null;
  resultFiles?: string[];
  status: CouncilTask['status'];
  rejectReason?: string | null;
  approvedBy?: BackendUser | null;
  rejectedBy?: BackendUser | null;
  completedAt?: string | null;
  createdBy?: BackendUser | null;
  history?: { at: string; actor?: string; action?: string; reason?: string }[];
  active: boolean;
  createdAt?: string;
}
export const mapTask = (t: BackendTask): CouncilTask => ({
  id: t._id,
  title: t.title,
  desc: t.desc ?? null,
  assignee: user(t.assignee),
  deadline: t.deadline ?? null,
  resultFiles: t.resultFiles ?? [],
  status: t.status,
  rejectReason: t.rejectReason ?? null,
  approvedBy: t.approvedBy ? user(t.approvedBy) : null,
  rejectedBy: t.rejectedBy ? user(t.rejectedBy) : null,
  completedAt: t.completedAt ?? null,
  createdBy: t.createdBy ? user(t.createdBy) : null,
  history: history(t.history),
  active: t.active,
  createdAt: t.createdAt,
});

interface BackendApplicant extends BackendUser {
  position?: BackendRef | null;
  academicTitle?: BackendRef | null;
  phone?: string | null;
  email?: string | null;
}
interface BackendRankApp {
  _id: string;
  applicant?: BackendApplicant | null;
  rankType: RankApplication['rankType'];
  category?: RankApplication['category'];
  department?: BackendRef | null;
  submittedDocs?: { name: string; fileUrl?: string | null }[];
  officialDocs?: RankApplication['officialDocs'];
  diploma?: { fileUrl?: string | null; date?: string | null } | null;
  status: RankApplication['status'];
  archived?: boolean;
  returnReason?: string | null;
  submittedAt?: string | null;
  history?: { at: string; actor?: string; action?: string; reason?: string }[];
  active: boolean;
}
export const mapRankApp = (a: BackendRankApp): RankApplication => ({
  id: a._id,
  applicant: user(a.applicant),
  applicantPosition: a.applicant?.position?.title ?? null,
  applicantAcademicTitle: a.applicant?.academicTitle?.title ?? null,
  applicantPhone: a.applicant?.phone ?? null,
  applicantEmail: a.applicant?.email ?? null,
  rankType: a.rankType,
  category: a.category ?? 'rank',
  department: ref(a.department),
  submittedDocs: (a.submittedDocs ?? []).map((d) => ({ name: d.name, fileUrl: d.fileUrl ?? null })),
  officialDocs: a.officialDocs ?? null,
  diploma: a.diploma?.fileUrl
    ? { fileUrl: a.diploma.fileUrl, date: a.diploma.date ?? null }
    : null,
  status: a.status,
  archived: a.archived ?? false,

  returnReason: a.returnReason ?? null,
  submittedAt: a.submittedAt ?? null,
  history: history(a.history),
  active: a.active,
});

interface BackendVoting {
  _id: string;
  title: string;
  desc?: string | null;
  department?: BackendRef | null;
  rankType?: string | null;
  mode: VotingSession['mode'];
  candidates?: { user?: BackendUser | null; diplomaFile?: string | null; diplomaDate?: string | null }[];
  startDate: string;
  endDate: string;
  passingPercent: number;
  status: VotingSession['status'];
  results?: {
    for?: number;
    against?: number;
    abstain?: number;
    winner?: BackendUser | null;
    passed?: boolean;
  } | null;
  createdBy?: BackendUser | null;
  active: boolean;
  createdAt?: string;
}
export const mapVoting = (v: BackendVoting): VotingSession => ({
  id: v._id,
  title: v.title,
  desc: v.desc ?? null,
  department: ref(v.department),
  rankType: v.rankType ?? null,
  mode: v.mode,
  candidates: (v.candidates ?? []).map((c) => ({
    user: user(c.user),
    diplomaFile: c.diplomaFile ?? null,
    diplomaDate: c.diplomaDate ?? null,
  })),
  startDate: v.startDate,
  endDate: v.endDate,
  passingPercent: v.passingPercent,
  status: v.status,
  results: v.results
    ? {
        for: v.results.for,
        against: v.results.against,
        abstain: v.results.abstain,
        winner: v.results.winner ? user(v.results.winner) : null,
        passed: v.results.passed,
      }
    : null,
  createdBy: v.createdBy ? user(v.createdBy) : null,
  active: v.active,
  createdAt: v.createdAt,
});

interface BackendAnnouncement {
  _id: string;
  title: string;
  content: string;
  recipientGroup: Announcement['recipientGroup'];
  recipientCount?: number | null;
  fileUrl?: string | null;
  createdBy?: BackendUser | null;
  createdAt?: string;
  active: boolean;
}
export const mapAnnouncement = (a: BackendAnnouncement): Announcement => ({
  id: a._id,
  title: a.title,
  content: a.content,
  recipientGroup: a.recipientGroup,
  recipientCount: a.recipientCount ?? null,
  fileUrl: a.fileUrl ?? null,
  createdBy: a.createdBy ? user(a.createdBy) : null,
  createdAt: a.createdAt,
  active: a.active,
});

interface BackendNotification {
  _id: string;
  title: string;
  body?: string | null;
  eventType?: string;
  link?: string | null;
  metadata?: { code?: string; link?: string } | null;
  read?: boolean;
  createdAt: string;
}

export interface NotificationExtra {
  link: string | null;
  metadata: { code?: string; link?: string } | null;
}
export type MappedNotification = CouncilNotification & NotificationExtra;

export const mapNotification = (n: BackendNotification): MappedNotification => ({
  id: n._id,
  title: n.title,
  body: n.body ?? undefined,
  type: n.eventType,
  read: !!n.read,
  createdAt: n.createdAt,
  link: n.link ?? null,
  metadata: n.metadata ?? null,
});

const COUNCIL_BASE = '/kengash';

const notifExtra = (n: CouncilNotification): NotificationExtra => n as MappedNotification;

export const notificationLink = (n: CouncilNotification): string | null => {
  const e = notifExtra(n);
  const raw = (e.link ?? e.metadata?.link ?? '').trim();
  if (!raw || raw.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(raw)) return null;
  return raw.startsWith('/') ? raw : `${COUNCIL_BASE}/${raw}`;
};

export const notificationCode = (n: CouncilNotification): string | null =>
  notifExtra(n).metadata?.code ?? null;

interface BackendDocItem {
  name: string;
  required: boolean;
  order: number;
  maxFiles?: number;
}
interface BackendDocSetting {
  categories?: {
    rank?: BackendDocItem[];
    position?: BackendDocItem[];
  };
  passingPercent?: number;
  rankTypes?: string[];
  positionTypes?: string[];
}
const mapDocItem = (d: BackendDocItem): DocItem => ({
  name: d.name,
  required: d.required,
  order: d.order,
  maxFiles: d.maxFiles && d.maxFiles > 0 ? d.maxFiles : 1,
});
export const mapDocSetting = (d: BackendDocSetting): DocSetting => ({
  categories: {
    rank: (d.categories?.rank ?? []).map(mapDocItem),
    position: (d.categories?.position ?? []).map(mapDocItem),
  },
  passingPercent: d.passingPercent ?? 60,
  rankTypes: d.rankTypes ?? ['Dotsent', 'Professor'],
  positionTypes: d.positionTypes ?? [
    'Stajor',
    "Assistent (o'qituvchi)",
    "Katta o'qituvchi",
    'V.B. Dotsent',
    'V.B. Professor',
  ],
});

interface BackendMyVote {
  hasVoted?: boolean;
  choice?: 'for' | 'against' | null;
  candidate?: string | null;
}
export const mapMyVote = (v: BackendMyVote): MyVote => ({
  hasVoted: !!v.hasVoted,
  choice: v.choice ?? null,
  candidate: v.candidate ?? null,
});
