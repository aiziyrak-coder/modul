import { useQuery } from '@tanstack/react-query';
import { fetchOne } from '@/shared/api';
import type { CertStatus, EarnedDocument } from '../model/certificate.types';
import { CERT_STATUS } from '../model/certificate.types';

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
  surveyRequired?: boolean;
  surveyDone?: boolean;
  certStatus?: number;
  rejectReason?: string;
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
        surveyRequired: d.surveyRequired ?? false,
        surveyDone: d.surveyDone ?? true,
        certStatus: (d.certStatus ??
          (d.file ? CERT_STATUS.APPROVED : CERT_STATUS.PENDING)) as CertStatus,
        rejectReason: d.rejectReason ?? '',
        issuedDate: d.issuedDate,
      }));
    },
  });
}
