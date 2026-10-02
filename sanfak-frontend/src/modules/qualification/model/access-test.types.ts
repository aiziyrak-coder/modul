export const TEST_TYPE = { SINGLE: 1, MULTI: 2 } as const;
export type TestType = (typeof TEST_TYPE)[keyof typeof TEST_TYPE];

export interface TestOption {
  text: string;
  isCorrect: boolean;
}

export interface AccessTestQuestion {
  id: string;
  testType: TestType;
  question: string;
  options: TestOption[];
  order: number;
}

export interface ReorderItem {
  id: string;
  order: number;
}

export interface AccessTestInput {
  course: string;
  testType: TestType;
  question: string;
  options: TestOption[];
}

export interface TestConfig {
  timeLimit: number;
  randomCount: number;
  passPercentage: number;
}
