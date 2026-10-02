import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, postJson, uploadMultipart } from '@/shared/api';
import type { MyProgress, TopicProgress, TopicStage } from '../model/learning.types';

const KEY = 'qual-learning';
const ROOT = '/qualification-topic-completions';

interface BackendTopicProgress {
  id: string;
  title: string;
  orderNumber: number;
  duration: number;
  status: number;
  isLocked: boolean;
  isCompleted: boolean;
  progressPercent: number;
  startedAt: string | null;
  finalTestAvailableAt: string | null;
  passPercentage: number;
}
interface BackendMyProgress {
  entranceDone: boolean;
  topics: BackendTopicProgress[];
}

const clampStage = (n: number): TopicStage =>
  ([0, 1, 2, 3, 4, 5].includes(n) ? n : 0) as TopicStage;

function mapTopicProgress(b: BackendTopicProgress): TopicProgress {
  return {
    id: b.id,
    title: b.title,
    orderNumber: b.orderNumber,
    duration: b.duration ?? 0,
    status: clampStage(Number(b.status)),
    isLocked: !!b.isLocked,
    isCompleted: !!b.isCompleted,
    progressPercent: b.progressPercent ?? 0,
    startedAt: b.startedAt ?? null,
    finalTestAvailableAt: b.finalTestAvailableAt ?? null,
    passPercentage: b.passPercentage ?? 50,
  };
}

export function useMyProgress(courseId: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'my', courseId],
    queryFn: async (): Promise<MyProgress> => {
      const res = await fetchOne<BackendMyProgress>(`${ROOT}/my`, { course: courseId });
      return {
        entranceDone: !!res.entranceDone,
        topics: (res.topics ?? []).map(mapTopicProgress),
      };
    },
    enabled: !!courseId,
  });
}

export function useStartTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; topic: string }) => postJson(`${ROOT}/start`, v),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [KEY, 'my', v.course] }),
  });
}

export function useAdvanceTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; topic: string }) => postJson(`${ROOT}/advance`, v),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [KEY, 'my', v.course] }),
  });
}

export function useSubmitScenario() {
  return useMutation({
    mutationFn: (v: { course: string; topic: string; answer: string; file?: File | null }) =>
      uploadMultipart(`${ROOT}/scenario`, 'POST', {
        course: v.course,
        topic: v.topic,
        answer: v.answer,
        file: v.file ?? undefined,
      }),
  });
}
