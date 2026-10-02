export interface ExitCourse {
  courseId: string;
  courseName: string;
  form: number | null;
  creditHours: number;
  startDate: string;
  endDate: string;
  openDate: string | null;
  closeDate: string | null;
  eligible: boolean;
  alreadySubmitted: boolean;
  reason: string | null;
  result: { percentage: number; isPassed: boolean } | null;
}

export interface ExitResult {
  totalQuestions: number;
  totalCorrects: number;
  percentage: number;
  passPercentage: number;
  isPassed: boolean;
  file?: string | null;
}
