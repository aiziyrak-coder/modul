export interface MyWorkloadBlock {
  blockId: string | null;
  scienceName: string | null;
  classTypeSlugs: string[];
  course: number;
  semester: number;
  totalHour: number;
  type: string | null;
  acceptanceStatus: 'pending' | 'accepted' | 'rejected';
  rejectionReason: string | null;
  respondedAt: string | null;
}

export interface MyWorkloadEntry {
  teacherEntryId: string;
  acceptanceStatus: 'pending' | 'accepted' | 'rejected';
  stavka: number;
  totalHour: number;
  blocks: MyWorkloadBlock[];
  rejectionReason: string | null;
  respondedAt: string | null;
}

export interface MyWorkload {
  id: string;
  academicYearTitle: string | null;
  course: number;
  totalHour: number;
  status: string;
  date: string | null;
  myEntries: MyWorkloadEntry[];
  superseded?: boolean;
}

export interface MyWorkloadRow {
  rowKey: string;
  distributionId: string;
  teacherEntryId: string;
  blockId: string | null;
  acceptanceStatus: 'pending' | 'accepted' | 'rejected';
  entryAcceptanceStatus: 'pending' | 'accepted' | 'rejected';
  scienceName: string | null;
  classTypeSlugs: string[];
  course: number;
  semester: number;
  blockTotalHour: number;
  type: string | null;
  entryTotalHour: number;
  academicYearTitle: string | null;
  date: string | null;
  distributionStatus: string;
  superseded: boolean;
  rejectionReason: string | null;
}

export interface RespondWorkloadPayload {
  action: 'accepted' | 'rejected';
  reason?: string;
  blockIds?: string[];
}
