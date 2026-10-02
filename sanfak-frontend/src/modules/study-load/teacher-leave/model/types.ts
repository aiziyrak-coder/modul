export type TeacherLeaveStatus = 'pending' | 'approved' | 'rejected';

export type TeacherLeaveType = 'leave' | 'resignation' | 'transfer';

export const TEACHER_LEAVE_TYPE_LABELS: Record<TeacherLeaveType, string> = {
  leave: "Ta'til",
  resignation: 'Ishdan ketish',
  transfer: "Ko'chirish",
};

export interface TeacherLeave {
  id: string;
  teacherName: string | null;
  type: TeacherLeaveType | null;
  reason: string | null;
  fromDate: string | null;
  toDate: string | null;
  status: TeacherLeaveStatus;
  approvalComment: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  distributionId: string | null;
  teacherEntryId: string | null;
  active: boolean;
  createdAt: string | null;
}
