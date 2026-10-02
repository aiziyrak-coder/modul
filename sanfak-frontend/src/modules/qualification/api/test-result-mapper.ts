import type { EduForm } from '../model/course.types';
import type {
  TestResult,
  TestResultDetail,
  TestResultDocument,
} from '../model/test-result.types';

export interface BackendTestResult {
  _id: string;
  listener?: { fullName?: string } | null;
  course?: { title?: string; form?: number; creditHours?: number } | null;
  totalQuestions?: number;
  totalCorrects?: number;
  percentage?: number;
  isPassed?: boolean;
  earnedDocument?: {
    kind?: number;
    status?: number;
    file?: string | null;
    rejectReason?: string | null;
  } | null;
  questions?: Array<{
    question?: string;
    isSelectedCorrect?: boolean;
    options?: Array<{ text?: string; isCorrect?: boolean; isSelected?: boolean }>;
  }>;
}

const toForm = (f?: number): EduForm | undefined => (f === 1 ? 1 : f === 2 ? 2 : undefined);
const pct = (correct: number, total: number): number =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

export function mapTestResult(b: BackendTestResult): TestResult {
  const total = b.totalQuestions ?? 0;
  const correct = b.totalCorrects ?? 0;
  return {
    id: b._id,
    listenerName: b.listener?.fullName ?? '—',
    courseTitle: b.course?.title,
    creditHours: b.course?.creditHours,
    form: toForm(b.course?.form),
    score: typeof b.percentage === 'number' ? b.percentage : pct(correct, total),
    correctCount: correct,
    totalCount: total,
    passed: typeof b.isPassed === 'boolean' ? b.isPassed : undefined,
    document: mapDocument(b.earnedDocument),
  };
}

function mapDocument(
  d: BackendTestResult['earnedDocument'],
): TestResultDocument | undefined {
  if (!d) return undefined;
  return {
    kind: d.kind === 2 ? 2 : 1,
    status: (d.status ?? 2) as 1 | 2 | 3,
    fileUrl: d.file ?? '',
    rejectReason: d.rejectReason ?? '',
  };
}

export function mapTestResultDetail(b: BackendTestResult): TestResultDetail {
  return {
    ...mapTestResult(b),
    questions: (b.questions ?? []).map((q) => ({
      question: q.question ?? '',
      isCorrect: !!q.isSelectedCorrect,
      options: (q.options ?? []).map((o) => ({
        text: o.text ?? '',
        isCorrect: !!o.isCorrect,
        isSelected: !!o.isSelected,
      })),
    })),
  };
}
