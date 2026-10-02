export interface EarnedDocument {
  id: string;
  courseId: string;
  courseName: string;
  courseType: string;
  form: number | null;
  creditHours: number;
  startDate: string;
  endDate: string;
  kind: 1 | 2;
  percentage: number;
  fileUrl: string | null;
  issuedDate: string;
}
