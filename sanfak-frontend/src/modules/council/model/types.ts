export type CouncilRole =
  | 'ilmiy_kengash_kotibi'
  | 'ilmiy_kengash_azosi'
  | 'oqituvchi'
  | 'rektor';

export type TaskStatus =
  | 'new'
  | 'in_progress'
  | 'done'
  | 'approved'
  | 'rejected'
  | 'overdue';

export type RankStatus = 'new' | 'accepted' | 'returned';

export type VotingStatus = 'active' | 'approved' | 'rejected';

export interface RefItem {
  id: string;
  title: string;
}

export interface UserRef {
  id: string;
  fullName: string;
}

export interface UserOption {
  id: string;
  fullName: string;
  position?: string | null;
  academicTitle?: string | null;
}

export interface HistoryEntry {
  at: string;
  actor?: string;
  action?: string;
  reason?: string;
}

export interface CouncilMember {
  id: string;
  user: UserRef;
  department?: RefItem | null;
  position?: RefItem | null;
  academicTitle?: RefItem | null;
  canVote: boolean;
  active: boolean;
}

export interface CouncilTask {
  id: string;
  title: string;
  desc?: string | null;
  assignee: UserRef;
  deadline?: string | null;
  resultFiles: string[];
  status: TaskStatus;
  rejectReason?: string | null;
  approvedBy?: UserRef | null;
  rejectedBy?: UserRef | null;
  completedAt?: string | null;
  createdBy?: UserRef | null;
  history: HistoryEntry[];
  active: boolean;
  createdAt?: string;
}

export interface SubmittedDoc {
  name: string;
  fileUrl?: string | null;
}

export interface OfficialDocs {
  organizationLetter?: string | null;
  guaranteeLetter?: string | null;
  councilApproval?: string | null;
}

export interface RankApplication {
  id: string;
  applicant: UserRef;
  applicantPosition?: string | null;
  applicantAcademicTitle?: string | null;
  applicantPhone?: string | null;
  applicantEmail?: string | null;
  rankType: 'dotsent' | 'professor';
  category: 'rank' | 'position';
  department?: RefItem | null;
  submittedDocs: SubmittedDoc[];
  officialDocs?: OfficialDocs | null;
  diploma?: { fileUrl: string | null; date: string | null } | null;
  status: RankStatus;
  archived: boolean;
  returnReason?: string | null;
  submittedAt?: string | null;
  history: HistoryEntry[];
  active: boolean;
}

export type RankTab = 'documents' | 'accepted' | 'archive';

export type RankCategory = 'rank' | 'position';

export interface VotingCandidate {
  user: UserRef;
  diplomaFile?: string | null;
  diplomaDate?: string | null;
}

export interface VoteParticipation {
  user: UserRef;
  department?: RefItem | null;
  voted: boolean;
}

export interface VotingResults {
  for?: number;
  against?: number;
  abstain?: number;
  winner?: UserRef | null;
  passed?: boolean;
}

export interface VotingSession {
  id: string;
  title: string;
  desc?: string | null;
  department?: RefItem | null;
  rankType?: string | null;
  mode: 'single' | 'choice';
  candidates: VotingCandidate[];
  startDate: string;
  endDate: string;
  passingPercent: number;
  status: VotingStatus;
  results?: VotingResults | null;
  createdBy?: UserRef | null;
  active: boolean;
  createdAt?: string;
}

export type RecipientGroup = 'all' | 'professors' | 'dotsents' | 'deptHeads';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  recipientGroup: RecipientGroup;
  recipientCount?: number | null;
  fileUrl?: string | null;
  createdBy?: UserRef | null;
  createdAt?: string;
  active: boolean;
}

export interface CouncilNotification {
  id: string;
  title: string;
  body?: string;
  type?: string;
  read: boolean;
  createdAt: string;
}

export interface DocItem {
  name: string;
  required: boolean;
  order: number;
  maxFiles?: number;
}

export interface DocSetting {
  categories: {
    rank: DocItem[];
    position: DocItem[];
  };
  passingPercent: number;
  rankTypes: string[];
  positionTypes: string[];
}

export interface MyVote {
  hasVoted: boolean;
  choice: 'for' | 'against' | null;
  candidate: string | null;
}
