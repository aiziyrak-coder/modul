import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, postJson } from '@/shared/api';
import type { MySurvey, SurveyAnswer } from '../model/survey.types';

const KEY = 'qual-survey';
const ROOT = '/qualification-surveys';

export function useMySurvey(course?: string) {
  return useQuery({
    enabled: Boolean(course),
    staleTime: 0,
    queryKey: [KEY, 'my', course],
    queryFn: (): Promise<MySurvey> =>
      fetchOne<MySurvey>(`${ROOT}/my`, { course }),
  });
}

export function useSubmitSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { course: string; answers: SurveyAnswer[] }) =>
      postJson(`${ROOT}/my/submit`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, 'my', vars.course] });
      qc.invalidateQueries({ queryKey: ['qual-certificate'] });
    },
  });
}
