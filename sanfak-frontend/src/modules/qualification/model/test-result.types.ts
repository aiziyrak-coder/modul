import type { EduForm } from './course.types';

export interface TestOption {
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
}

export interface TestQuestion {
  question: string;
  isCorrect: boolean;
  options: TestOption[];
}

export interface TestResult {
  id: string;
  listenerName: string;
  courseTitle?: string;
  creditHours?: number;
  form?: EduForm;
  score: number;
  correctCount: number;
  totalCount: number;
  passed?: boolean;
  document?: TestResultDocument;
}

export interface TestResultDocument {
  kind: 1 | 2;
  status: 1 | 2 | 3;
  fileUrl: string;
  rejectReason: string;
}

export interface TestResultDetail extends TestResult {
  questions: TestQuestion[];
}
