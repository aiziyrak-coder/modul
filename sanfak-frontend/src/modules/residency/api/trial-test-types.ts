export interface TrialTest {
  id: string;
  title: string;
  scienceId: string | null;
  scienceTitle: string | null;
  specialtyId: string | null;
  specialtyTitle: string | null;
  program: 'magistratura' | 'ordinatura' | null;
  courseNumber: number | null;
  groupId: string | null;
  groupTitle: string | null;
  academicYear: string | null;
  academicYearRef: string | null;
  date: string;
  maxScore: number;
  questionCount: number | null;
  desc: string | null;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  format: string | null;
  createdAt: string | null;
}

export interface TrialTestResult {
  residentId: string;
  fullName: string;
  program: 'magistratura' | 'ordinatura' | null;
  specialtyTitle: string | null;
  courseNumber: number | null;
  groupTitle: string | null;
  assessmentId: string | null;
  score: number | null;
  maxScore: number | null;
  gradedAt: string | null;
}

export interface TrialTestSummary {
  total: number;
  scored: number;
  notScored: number;
  avgScore: number | null;
}

export interface TrialTestResultsPage {
  maxScore: number;
  results: TrialTestResult[];
  summary: TrialTestSummary;
}

export interface TrialTestDetail {
  test: TrialTest;
  summary: TrialTestSummary;
}

export function trialScoreVariant(score: number | null, maxScore: number): string {
  if (score === null) return 'umumiy';
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 86) return 'success';
  if (pct >= 71) return 'info';
  if (pct >= 56) return 'warning';
  return 'danger';
}
