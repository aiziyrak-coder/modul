export interface StudentMonitorRow {
  id: string;
  listenerId: string | null;
  fullName: string;
  passport: string;
  courseId: string;
  courseName: string;
  form: number | null;
  educationType: number;
  progressPercent: number;
}

export interface ProgressReportRow {
  id: string | null;
  subId: string;
  listenerId: string | null;
  fullName: string;
  courseName: string;
  progressPercent: number;
  testScore: number | null;
  hasCertificate: boolean;
}

export interface TopicTestOption {
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
}

export interface TopicTestAnswer {
  question: string;
  isCorrect: boolean;
  options: TopicTestOption[];
}

export interface StudentDetailTopic {
  topicId: string;
  orderNumber: number;
  title: string;
  scenarioQuestion: string | null;
  scenarioAnswer: string | null;
  scenarioImage: string | null;
  correct: number | null;
  total: number | null;
  percent: number | null;
  submittedAt: string | null;
  testAnswers: TopicTestAnswer[];
  isPassed: boolean;
  status: 'completed' | 'in_progress' | 'not_started';
}

export interface StudentTestCard {
  correct: number;
  total: number;
  percent: number;
  date?: string | null;
  isPassed?: boolean;
}

export interface StudentDetail {
  listenerName: string;
  passport: string;
  courseName: string;
  educationType: number;
  totalTopics: number;
  passedTopics: number;
  percent: number;
  entranceTest: StudentTestCard | null;
  exitTest: StudentTestCard | null;
  topics: StudentDetailTopic[];
}

export interface PaymentMonitorRow {
  contractId: string;
  listenerId: string | null;
  studentName: string;
  courseName: string;
  form: number | null;
  creditHours: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  hasPending: boolean;
  paymentDueAt: string | null;
  paymentLocked: boolean;
  requiredAmount: number;
}

export interface PaymentHistoryItem {
  id: string;
  date: string | null;
  createdAt: string | null;
  amount: number;
  method: number;
  status: number;
  transactionId: string | null;
  file: string | null;
}

export interface PaymentHistory {
  studentName: string;
  courseName: string;
  creditHours: number;
  form: number | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  items: PaymentHistoryItem[];
}
