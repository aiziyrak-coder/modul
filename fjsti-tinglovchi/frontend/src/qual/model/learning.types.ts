export type TopicStage = 0 | 1 | 2 | 3 | 4 | 5;

export type MaterialTab = 'lecture' | 'practice' | 'video' | 'scenario' | 'final';

export interface TopicProgress {
  id: string;
  title: string;
  orderNumber: number;
  duration: number;
  status: TopicStage;
  isLocked: boolean;
  isCompleted: boolean;
  progressPercent: number;
  startedAt: string | null;
  finalTestAvailableAt: string | null;
  passPercentage: number;
}

export interface PaymentLock {
  locked: boolean;
  dueAt: string | null;
  requiredAmount: number;
  paidAmount: number;
  totalPrice: number;
}

export interface MyProgress {
  entranceDone: boolean;
  topics: TopicProgress[];
  payment: PaymentLock | null;
}

export type TestType = 1 | 2;

export interface TestOption {
  id: string;
  text: string;
  isSelected: boolean;
}

export interface TestQuestion {
  id: string;
  testType: TestType;
  question: string;
  options: TestOption[];
}

export interface ActiveTest {
  resultId: string;
  questions: TestQuestion[];
  remainingTime: number;
}

export interface EntranceResult {
  totalQuestions: number;
  totalCorrects: number;
}

export interface FinalResult {
  totalQuestions: number;
  totalCorrects: number;
  isPassed: boolean;
  passPercentage: number;
  nextTopicUnlocked: boolean;
}
