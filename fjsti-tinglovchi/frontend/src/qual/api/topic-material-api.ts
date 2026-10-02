import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchPaginated,
  postJson,
  putJson,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import type { AccessTestQuestion, ReorderItem, TestType } from '../model/access-test.types';
import { mapAccessTest, type BackendAccessTest } from './access-test-mapper';
import type {
  TopicFileMaterial,
  TopicScenarioMaterial,
  TopicVideoMaterial,
} from '../model/topic-material.types';

const LECTURE = '/qualification-topic-lectures';
const PRACTICAL = '/qualification-topic-practicals';
const VIDEO = '/qualification-topic-videos';
const SCENARIO = '/qualification-topic-scenarios';
const FINAL = '/qualification-topic-final-tests';

interface BackendFile {
  _id: string;
  title: string;
  file?: string;
}
interface BackendVideo {
  _id: string;
  title: string;
  videoRaw?: string;
}
interface BackendScenario {
  _id: string;
  title: string;
  text: string;
}

const mapFile = (b: BackendFile): TopicFileMaterial => ({
  id: b._id,
  title: b.title,
  fileUrl: b.file ?? '',
});
const mapVideo = (b: BackendVideo): TopicVideoMaterial => ({
  id: b._id,
  title: b.title,
  videoUrl: b.videoRaw ?? '',
});
const mapScenario = (b: BackendScenario): TopicScenarioMaterial => ({
  id: b._id,
  title: b.title,
  text: b.text,
});

const LECTURE_KEY = 'qual-topic-lecture';
export function useLectures(course: string, topic: string) {
  return useQuery({
    staleTime: 0,
    queryKey: [LECTURE_KEY, course, topic],
    queryFn: async () => (await fetchList<BackendFile>(LECTURE, { course, topic })).map(mapFile),
    enabled: !!course && !!topic,
  });
}
export function useCreateLecture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; topic: string; title: string; file: File }) =>
      uploadMultipart(LECTURE, 'POST', {
        course: v.course,
        topic: v.topic,
        title: v.title,
        file: v.file,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LECTURE_KEY] }),
  });
}
export function useDeleteLecture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${LECTURE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [LECTURE_KEY] }),
  });
}

const PRACTICAL_KEY = 'qual-topic-practical';
export function usePracticals(course: string, topic: string) {
  return useQuery({
    staleTime: 0,
    queryKey: [PRACTICAL_KEY, course, topic],
    queryFn: async () => (await fetchList<BackendFile>(PRACTICAL, { course, topic })).map(mapFile),
    enabled: !!course && !!topic,
  });
}
export function useCreatePractical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; topic: string; title: string; file: File }) =>
      uploadMultipart(PRACTICAL, 'POST', {
        course: v.course,
        topic: v.topic,
        title: v.title,
        file: v.file,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRACTICAL_KEY] }),
  });
}
export function useDeletePractical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${PRACTICAL}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRACTICAL_KEY] }),
  });
}

const VIDEO_KEY = 'qual-topic-video';
export function useVideos(course: string, topic: string) {
  return useQuery({
    staleTime: 0,
    queryKey: [VIDEO_KEY, course, topic],
    queryFn: async () => (await fetchList<BackendVideo>(VIDEO, { course, topic })).map(mapVideo),
    enabled: !!course && !!topic,
  });
}
export function useCreateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; topic: string; title: string; videoRaw: File }) =>
      uploadMultipart(VIDEO, 'POST', {
        course: v.course,
        topic: v.topic,
        title: v.title,
        videoRaw: v.videoRaw,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [VIDEO_KEY] }),
  });
}
export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${VIDEO}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [VIDEO_KEY] }),
  });
}

const SCENARIO_KEY = 'qual-topic-scenario';
export function useScenarios(course: string, topic: string) {
  return useQuery({
    staleTime: 0,
    queryKey: [SCENARIO_KEY, course, topic],
    queryFn: async () =>
      (await fetchList<BackendScenario>(SCENARIO, { course, topic })).map(mapScenario),
    enabled: !!course && !!topic,
  });
}
export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; topic: string; title: string; text: string }) =>
      postJson(SCENARIO, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCENARIO_KEY] }),
  });
}
export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${SCENARIO}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCENARIO_KEY] }),
  });
}

export function useUpdateLecture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; title: string; file?: File }) => {
      const payload: Record<string, string | File> = { title: v.title };
      if (v.file) payload.file = v.file;
      return uploadMultipart(`${LECTURE}/${v.id}`, 'PUT', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LECTURE_KEY] }),
  });
}
export function useUpdatePractical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; title: string; file?: File }) => {
      const payload: Record<string, string | File> = { title: v.title };
      if (v.file) payload.file = v.file;
      return uploadMultipart(`${PRACTICAL}/${v.id}`, 'PUT', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRACTICAL_KEY] }),
  });
}
export function useUpdateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; title: string; videoRaw?: File }) => {
      const payload: Record<string, string | File> = { title: v.title };
      if (v.videoRaw) payload.videoRaw = v.videoRaw;
      return uploadMultipart(`${VIDEO}/${v.id}`, 'PUT', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [VIDEO_KEY] }),
  });
}
export function useUpdateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; title: string; text: string }) =>
      putJson(`${SCENARIO}/${v.id}`, { title: v.title, text: v.text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCENARIO_KEY] }),
  });
}

const FINAL_KEY = 'qual-topic-final-test';
export interface FinalTestInput {
  course: string;
  topic: string;
  testType: TestType;
  question: string;
  options: { text: string; isCorrect: boolean }[];
}
export function useFinalTests(course: string, topic: string, page: number, limit: number) {
  return useQuery({
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryKey: [FINAL_KEY, course, topic, page, limit],
    queryFn: async () => {
      const res: Paginated<BackendAccessTest> = await fetchPaginated(`${FINAL}/paginate`, {
        course,
        topic,
        page,
        limit,
      });
      return {
        items: res.docs.map(mapAccessTest),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
    enabled: !!course && !!topic,
  });
}
export function useCreateFinalTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinalTestInput) => postJson<BackendAccessTest>(FINAL, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINAL_KEY] }),
  });
}

export function useBulkCreateFinalTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; topic: string; items: Omit<FinalTestInput, 'course' | 'topic'>[] }) =>
      postJson(`${FINAL}/bulk`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINAL_KEY] }),
  });
}

export async function fetchAllFinalTests(
  courseId: string,
  topic: string,
): Promise<AccessTestQuestion[]> {
  const res: Paginated<BackendAccessTest> = await fetchPaginated(`${FINAL}/paginate`, {
    course: courseId,
    topic,
    page: 1,
    limit: 10000,
  });
  return res.docs.map(mapAccessTest);
}
export function useUpdateFinalTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: Omit<FinalTestInput, 'course' | 'topic'> }) =>
      putJson(`${FINAL}/${v.id}`, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINAL_KEY] }),
  });
}
export function useDeleteFinalTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${FINAL}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINAL_KEY] }),
  });
}
export function useReorderFinalTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => putJson(`${FINAL}/reorder`, { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FINAL_KEY] }),
  });
}
