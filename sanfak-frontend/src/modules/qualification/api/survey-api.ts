import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchPaginated,
  patchJson,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import type {
  SurveyQuestion,
  SurveyQuestionInput,
  SurveySubmission,
  SurveySubmissionAnswer,
  SurveyType,
} from '../model/survey.types';

const KEY = 'qual-survey';
const ROOT = '/qualification-surveys';

export function useSurveyQuestions(page: number, limit: number) {
  return useQuery({
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryKey: [KEY, 'questions', page, limit],
    queryFn: async () => {
      const res: Paginated<SurveyQuestion> = await fetchPaginated(`${ROOT}/paginate`, {
        page,
        limit,
      });
      return {
        items: res.docs,
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

interface BackendSubmission {
  _id: string;
  listener?: { fullName?: string } | null;
  course?: { title?: string } | null;
  createdAt?: string;
  answers?: {
    question?: {
      _id?: string;
      question?: string;
      type?: number;
      options?: { text: string }[];
    } | null;
    optionIndex?: number | null;
    rating?: number | null;
    text?: string | null;
  }[];
}

function mapSubmission(d: BackendSubmission): SurveySubmission {
  const answers: SurveySubmissionAnswer[] = (d.answers ?? [])
    .filter((a) => a.question)
    .map((a) => {
      const q = a.question as NonNullable<BackendSubmission['answers']>[number]['question'];
      const idx = a.optionIndex;
      const opt = typeof idx === 'number' ? q?.options?.[idx] : undefined;
      return {
        question: q?.question ?? '',
        type: (q?.type ?? 1) as SurveyType,
        optionText: opt?.text ?? '',
        rating: a.rating ?? null,
        text: a.text ?? '',
      };
    });

  return {
    id: d._id,
    listenerName: d.listener?.fullName ?? '',
    courseName: d.course?.title ?? '',
    submittedAt: d.createdAt ?? null,
    answers,
  };
}

export function useSurveySubmissions(page: number, limit: number, course?: string) {
  return useQuery({
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryKey: [KEY, 'submissions', page, limit, course ?? 'all'],
    queryFn: async () => {
      const res: Paginated<BackendSubmission> = await fetchPaginated(`${ROOT}/answers/paginate`, {
        page,
        limit,
        ...(course ? { course } : {}),
      });
      return {
        items: res.docs.map(mapSubmission),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

export function useSurveyMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (input: SurveyQuestionInput) => postJson(ROOT, input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SurveyQuestionInput> }) =>
      putJson(`${ROOT}/${id}`, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: (items: { _id: string; order: number }[]) => patchJson(`${ROOT}/reorder`, items),
    onSuccess: invalidate,
  });

  const bulkCreate = useMutation({
    mutationFn: (items: SurveyQuestionInput[]) => postJson(`${ROOT}/bulk`, { items }),
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder, bulkCreate };
}
