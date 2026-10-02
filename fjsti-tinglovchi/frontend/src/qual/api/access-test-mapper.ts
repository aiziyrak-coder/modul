import type { AccessTestQuestion, TestType } from '../model/access-test.types';

export interface BackendAccessTest {
  _id: string;
  testType?: number;
  question: string;
  options?: Array<{ text?: string; isCorrect?: boolean }>;
  order?: number;
}

export function mapAccessTest(b: BackendAccessTest): AccessTestQuestion {
  return {
    id: b._id,
    testType: (b.testType === 2 ? 2 : 1) as TestType,
    question: b.question,
    options: (b.options ?? []).map((o) => ({ text: o.text ?? '', isCorrect: !!o.isCorrect })),
    order: b.order ?? 0,
  };
}
