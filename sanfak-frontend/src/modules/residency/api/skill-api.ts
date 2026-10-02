import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, postJson, putJson, deleteData } from '@/shared/api';
import type { Skill, SkillProgressRow, TheoryTopic } from './skill-types';
import { titleOrSnapshot } from './ref-title';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface RawRef {
  _id: string;
  title?: string;
}
interface BackendTheoryTopic {
  _id: string;
  title: string;
  active?: boolean;
}
interface BackendSkill {
  _id: string;
  specialty?: string | RawRef | null;
  specialtyTitle?: string | null;
  semester: string;
  theoryTopic?: string | RawRef | null;
  theoryTopicTitle?: string | null;
  practicalSkill: string;
  patientCount?: number;
  active?: boolean;
}
const idOf = (r: string | RawRef | null | undefined): string | null =>
  r && typeof r === 'object' ? r._id : (r ?? null);
const mapTopic = (b: BackendTheoryTopic): TheoryTopic => ({
  id: b._id,
  title: b.title,
  active: b.active !== false,
});
const mapSkill = (b: BackendSkill): Skill => ({
  id: b._id,
  specialtyId: idOf(b.specialty),
  specialtyTitle: titleOrSnapshot(b.specialty, b.specialtyTitle),
  semester: b.semester,
  theoryTopicId: idOf(b.theoryTopic),
  theoryTopicTitle: titleOrSnapshot(b.theoryTopic, b.theoryTopicTitle),
  practicalSkill: b.practicalSkill,
  patientCount: b.patientCount ?? 1,
  active: b.active !== false,
});

const TOPIC = '/theory-topics';
const TOPIC_KEY = 'residency-theory-topics';

export function useTheoryTopics(params: Q = {}) {
  return useQuery({
    queryKey: [TOPIC_KEY, params],
    staleTime: 60_000,
    queryFn: async (): Promise<TheoryTopic[]> =>
      (await fetchList<BackendTheoryTopic>(`${TOPIC}${qs(params)}`)).map(mapTopic),
  });
}
export function useCreateTheoryTopic() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (t: { title: string; active?: boolean }) => postJson(TOPIC, t),
    onSuccess: () => q.invalidateQueries({ queryKey: [TOPIC_KEY] }),
  });
}
export function useUpdateTheoryTopic() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; active?: boolean } }) =>
      putJson(`${TOPIC}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [TOPIC_KEY] }),
  });
}
export function useDeleteTheoryTopic() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${TOPIC}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [TOPIC_KEY] }),
  });
}

const SKILL = '/skills';
const SKILL_KEY = 'residency-skills';

export interface SkillInput {
  specialty: string;
  specialtyTitle?: string | null;
  semester: string;
  theoryTopic: string;
  theoryTopicTitle?: string | null;
  practicalSkill: string;
  patientCount?: number;
  active?: boolean;
}

export function useSkills(params: Q = {}) {
  return useQuery({
    queryKey: [SKILL_KEY, params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Skill[]> =>
      (await fetchList<BackendSkill>(`${SKILL}${qs(params)}`)).map(mapSkill),
  });
}
export function useCreateSkill() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (s: SkillInput) => postJson(SKILL, s),
    onSuccess: () => q.invalidateQueries({ queryKey: [SKILL_KEY] }),
  });
}
export function useUpdateSkill() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SkillInput> }) =>
      putJson(`${SKILL}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [SKILL_KEY] }),
  });
}
export function useDeleteSkill() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${SKILL}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [SKILL_KEY] }),
  });
}

export function useSkillProgress(params: Q = {}) {
  return useQuery({
    queryKey: [SKILL_KEY, 'progress', params],
    placeholderData: keepPreviousData,
    queryFn: (): Promise<SkillProgressRow[]> =>
      fetchList<SkillProgressRow>(`${SKILL}/progress${qs(params)}`),
  });
}
