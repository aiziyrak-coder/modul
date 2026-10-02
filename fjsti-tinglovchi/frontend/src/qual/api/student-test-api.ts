import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchOne, postJson } from '@/shared/api';
import type {
  ActiveTest,
  EntranceResult,
  FinalResult,
  TestType,
} from '../model/learning.types';
import type { ExitResult } from '../model/exit-test.types';

const ACCESS = '/qualification-access-test-results';
const FINAL = '/qualification-final-test-results';

interface BackendOption {
  _id: string;
  text: string;
  isSelected?: boolean;
}
interface BackendQuestion {
  _id: string;
  testType?: number;
  question: string;
  options: BackendOption[];
}
interface BackendTestDoc {
  _id: string;
  questions: BackendQuestion[];
  endDate?: string;
}

function mapTestDoc(doc: BackendTestDoc, remainingTime?: number): ActiveTest {
  const remaining =
    typeof remainingTime === 'number'
      ? remainingTime
      : doc.endDate
        ? Math.max(0, Math.floor((new Date(doc.endDate).getTime() - Date.now()) / 1000))
        : 0;
  return {
    resultId: doc._id,
    remainingTime: remaining,
    questions: (doc.questions ?? []).map((q) => ({
      id: q._id,
      testType: (q.testType === 2 ? 2 : 1) as TestType,
      question: q.question,
      options: (q.options ?? []).map((o) => ({
        id: o._id,
        text: o.text,
        isSelected: !!o.isSelected,
      })),
    })),
  };
}

export function useStartEntrance() {
  return useMutation({
    mutationFn: async (course: string): Promise<ActiveTest> => {
      const res = await postJson<{ data: BackendTestDoc }>(`${ACCESS}/start`, { course });
      return mapTestDoc(res.data);
    },
  });
}

export function useResumeEntrance() {
  return useMutation({
    mutationFn: async (course: string): Promise<ActiveTest | null> => {
      const res = await fetchOne<{ data: BackendTestDoc | null; remainingTime: number }>(
        `${ACCESS}/${course}`,
      );
      return res.data ? mapTestDoc(res.data, res.remainingTime) : null;
    },
  });
}

export function useSelectEntranceOption() {
  return useMutation({
    mutationFn: (v: { resultId: string; questionId: string; optionId: string }) =>
      postJson(`${ACCESS}/select-option`, v),
  });
}

export function useFinishEntrance() {
  return useMutation({
    mutationFn: async (course: string): Promise<EntranceResult> => {
      const res = await postJson<{ data: EntranceResult }>(`${ACCESS}/finish`, { course });
      return res.data;
    },
  });
}

export function useStartFinal() {
  return useMutation({
    mutationFn: async (v: { course: string; topic: string }): Promise<ActiveTest> => {
      const res = await postJson<{ data: BackendTestDoc }>(`${FINAL}/start`, v);
      return mapTestDoc(res.data);
    },
  });
}

export function useResumeFinal() {
  return useMutation({
    mutationFn: async (v: { course: string; topic: string }): Promise<ActiveTest | null> => {
      const res = await fetchOne<{ data: BackendTestDoc | null; remainingTime: number }>(
        `${FINAL}/${v.course}/${v.topic}`,
      );
      return res.data ? mapTestDoc(res.data, res.remainingTime) : null;
    },
  });
}

export function useSelectFinalOption() {
  return useMutation({
    mutationFn: (v: { resultId: string; questionId: string; optionId: string }) =>
      postJson(`${FINAL}/select-option`, v),
  });
}

export function useFinishFinal() {
  return useMutation({
    mutationFn: async (v: { course: string; topic: string }): Promise<FinalResult> => {
      const res = await postJson<{ data: FinalResult }>(`${FINAL}/finish`, v);
      return res.data;
    },
  });
}

const EXIT = '/qualification-exit-test-results';

export function useStartExit() {
  return useMutation({
    mutationFn: async (course: string): Promise<ActiveTest> => {
      const res = await postJson<{ data: BackendTestDoc }>(`${EXIT}/start`, { course });
      return mapTestDoc(res.data);
    },
  });
}

export function useResumeExit() {
  return useMutation({
    mutationFn: async (course: string): Promise<ActiveTest | null> => {
      const res = await fetchOne<{ data: BackendTestDoc | null; remainingTime: number }>(
        `${EXIT}/${course}`,
      );
      return res.data ? mapTestDoc(res.data, res.remainingTime) : null;
    },
  });
}

export function useSelectExitOption() {
  return useMutation({
    mutationFn: (v: { resultId: string; questionId: string; optionId: string }) =>
      postJson(`${EXIT}/select-option`, v),
  });
}

export function useFinishExit() {
  return useMutation({
    mutationFn: async (course: string): Promise<ExitResult> => {
      const res = await postJson<{ data: ExitResult }>(`${EXIT}/finish`, { course });
      return res.data;
    },
  });
}

export function useActiveExit() {
  return useQuery({
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryKey: ['qual-exit-active'],
    queryFn: async (): Promise<{
      active: ActiveTest;
      course: string;
      courseName: string;
    } | null> => {
      const res = await fetchOne<{
        data: BackendTestDoc | null;
        remainingTime: number;
        course: string | null;
        courseName: string | null;
      }>(`${EXIT}/active`);
      if (!res.data || !res.course) return null;
      return {
        active: mapTestDoc(res.data, res.remainingTime),
        course: res.course,
        courseName: res.courseName ?? '',
      };
    },
  });
}
