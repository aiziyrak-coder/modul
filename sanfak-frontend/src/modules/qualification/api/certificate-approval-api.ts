import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, fetchPaginated, postJson, type Paginated } from '@/shared/api';
import type { CertKind, CertStatus, CertificateRow } from '../model/certificate-approval.types';
import { CERT_STATUS } from '../model/certificate-approval.types';

const KEY = 'qual-certificate-approval';
const ROOT = '/qualification-certificates';

interface BackendRef {
  _id?: string;
  fullName?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  creditHours?: number;
  startDate?: string;
  endDate?: string;
}

interface BackendCertificate {
  _id: string;
  listener?: BackendRef | null;
  course?: BackendRef | null;
  approvedBy?: BackendRef | null;
  kind?: number;
  code?: string;
  regNumber?: string;
  status?: number;
  approvedAt?: string;
  rejectReason?: string;
  createdAt?: string;
  file?: string;
}

function mapCertificate(d: BackendCertificate): CertificateRow {
  const by = d.approvedBy;
  return {
    id: d._id,
    listenerName: d.listener?.fullName ?? '',
    courseName: d.course?.title ?? '',
    creditHours: d.course?.creditHours ?? null,
    startDate: d.course?.startDate ?? null,
    endDate: d.course?.endDate ?? null,
    kind: (d.kind ?? 1) as CertKind,
    code: d.code ?? '',
    regNumber: d.regNumber ?? '',
    status: (d.status ?? CERT_STATUS.PENDING) as CertStatus,
    approvedBy: by ? [by.firstName, by.lastName].filter(Boolean).join(' ') : '',
    approvedAt: d.approvedAt ?? null,
    rejectReason: d.rejectReason ?? '',
    createdAt: d.createdAt ?? null,
    file: d.file ?? '',
  };
}

export function useCertificatesForApproval(
  status: CertStatus | undefined,
  page: number,
  limit: number,
) {
  return useQuery({
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryKey: [KEY, 'paginate', status ?? 'all', page, limit],
    queryFn: async () => {
      const res: Paginated<BackendCertificate> = await fetchPaginated(`${ROOT}/paginate`, {
        ...(status ? { status } : {}),
        page,
        limit,
      });
      return {
        items: res.docs.map(mapCertificate),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function usePendingCertificateCount() {
  return useQuery({
    queryKey: [KEY, 'pending-count'],
    queryFn: () => fetchOne<{ count: number }>(`${ROOT}/pending-count`),
  });
}

export function useCertificateApproval() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const approve = useMutation({
    mutationFn: (ids: string[]) =>
      postJson<{ approved: number; failed: { id: string; message: string }[] }>(
        `${ROOT}/approve`,
        { ids },
      ),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: (v: { ids: string[]; reason: string }) =>
      postJson<{ rejected: number }>(`${ROOT}/reject`, v),
    onSuccess: invalidate,
  });

  return { approve, reject };
}
