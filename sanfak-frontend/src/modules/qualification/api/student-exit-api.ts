import { useQuery } from '@tanstack/react-query';
import { fetchOne } from '@/shared/api';
import type { ExitCourse } from '../model/exit-test.types';

const KEY = 'qual-exit-my';
const ROOT = '/qualification-exit-test-results';

export function useExitCourses() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'courses'],
    queryFn: async (): Promise<ExitCourse[]> => {
      const res = await fetchOne<{ data: ExitCourse[] }>(`${ROOT}/my-courses`);
      return res.data ?? [];
    },
  });
}
