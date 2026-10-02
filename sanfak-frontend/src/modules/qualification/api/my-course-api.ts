import { useQuery } from '@tanstack/react-query';
import { fetchList } from '@/shared/api';
import type { EduForm } from '../model/course.types';
import type { MyCourse } from '../model/my-course.types';

const KEY = 'qual-my-course';
const ROOT = '/qualification-course-subscriptions';

interface BackendMyCourse {
  _id: string;
  subscriptionId: string;
  title: string;
  creditHours: number;
  price: number;
  form?: number;
  startDate?: string;
  endDate?: string;
  status?: number;
  educationType?: number;
  entranceTestDone?: boolean;
  paid?: boolean;
}

const toForm = (f?: number): EduForm => (f === 2 ? 2 : 1);

export function useMyCourses() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'my'],
    queryFn: async (): Promise<MyCourse[]> => {
      const docs = await fetchList<BackendMyCourse>(`${ROOT}/my`);
      return docs.map((d) => ({
        id: d._id,
        subscriptionId: d.subscriptionId,
        title: d.title,
        creditHours: d.creditHours,
        price: d.price,
        form: toForm(d.form),
        startDate: d.startDate,
        endDate: d.endDate,
        status: d.status ?? 1,
        educationType: d.educationType ?? 2,
        entranceTestDone: d.entranceTestDone ?? false,
        paid: d.paid ?? false,
      }));
    },
  });
}
