import { useQuery } from '@tanstack/react-query';
import { fetchOne } from '@/shared/api';
import type { EarnedDocument } from '../model/certificate.types';

const KEY = 'qual-certificate';
const ROOT = '/qualification-exit-test-results';

interface BackendEarned {
  id: string;
  courseId: string;
  courseName: string;
  courseType: string;
  form: number | null;
  creditHours: number;
  startDate: string;
  endDate: string;
  kind: number;
  percentage: number;
  file: string | null;
  issuedDate: string;
}

export function useMyCertificates() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'my'],
    queryFn: async (): Promise<EarnedDocument[]> => {
      const res = await fetchOne<{ data: BackendEarned[] }>(`${ROOT}/my-certificates`);
      return (res.data ?? []).map((d) => ({
        id: d.id,
        courseId: d.courseId,
        courseName: d.courseName,
        courseType: d.courseType,
        form: d.form ?? null,
        creditHours: d.creditHours ?? 0,
        startDate: d.startDate,
        endDate: d.endDate,
        kind: d.kind === 1 ? 1 : 2,
        percentage: d.percentage ?? 0,
        fileUrl: d.file ?? null,
        issuedDate: d.issuedDate,
      }));
    },
  });
}
