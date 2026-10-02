import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, fetchPaginated, putJson, type Paginated } from '@/shared/api';
import type {
  StudentMonitorRow,
  PaymentMonitorRow,
  StudentDetail,
  PaymentHistory,
  ProgressReportRow,
} from '../model/monitoring.types';

const SUB = '/qualification-course-subscriptions';
const PAY = '/qualification-payments';

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

export interface StudentsFilter {
  page: number;
  limit: number;
  search?: string;
  course?: string;
  performance?: string;
  [key: string]: unknown;
}
export interface PaymentsFilter {
  page: number;
  limit: number;
  search?: string;
  course?: string;
  status?: string;
  [key: string]: unknown;
}

export function useStudentsMonitoring(filter: StudentsFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: ['qual-mon-students', filter],
    queryFn: async () => {
      const { page, limit, ...rest } = filter;
      const res: Paginated<StudentMonitorRow> = await fetchPaginated(
        `${SUB}/students-monitoring`,
        { page, limit, ...clean(rest) },
      );
      return { items: res.docs, total: res.totalDocs };
    },
  });
}

export interface ProgressReportFilter {
  page?: number;
  limit?: number;
  course?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: unknown;
}

export function useProgressReport(filter: ProgressReportFilter, enabled: boolean) {
  return useQuery({
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryKey: ['qual-progress-report', filter],
    queryFn: async () => {
      const res = await fetchOne<{ docs: ProgressReportRow[]; totalDocs: number }>(
        `${SUB}/progress-report`,
        clean(filter),
      );
      return { items: res.docs, total: res.totalDocs };
    },
    enabled,
  });
}

export async function fetchProgressReportExport(
  filter: Omit<ProgressReportFilter, 'page' | 'limit'>,
): Promise<ProgressReportRow[]> {
  const res = await fetchOne<{ docs: ProgressReportRow[] }>(`${SUB}/progress-report`, {
    ...clean(filter),
    page: 1,
    limit: 100000,
  });
  return res.docs;
}

export function useStudentDetail(id: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: ['qual-mon-student-detail', id],
    queryFn: () => fetchOne<StudentDetail>(`${SUB}/students-monitoring/${id}`),
    enabled: !!id,
  });
}

export function usePaymentsMonitoring(filter: PaymentsFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: ['qual-mon-payments', filter],
    queryFn: async () => {
      const { page, limit, ...rest } = filter;
      const res: Paginated<PaymentMonitorRow> = await fetchPaginated(
        `${PAY}/payments-monitoring`,
        { page, limit, ...clean(rest) },
      );
      return { items: res.docs, total: res.totalDocs };
    },
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      id: string;
      date?: string;
      amount?: number;
      transactionId?: string;
      status?: number;
    }) => {
      const { id, ...body } = v;
      return putJson(`${PAY}/payment/${id}`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qual-mon-payment-history'] });
      void qc.invalidateQueries({ queryKey: ['qual-mon-payments'] });
    },
  });
}

export function useContractPaymentHistory(contractId: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: ['qual-mon-payment-history', contractId],
    queryFn: () => fetchOne<PaymentHistory>(`${PAY}/payments-monitoring/${contractId}`),
    enabled: !!contractId,
  });
}

export async function fetchPaymentsExport(
  filter: Omit<PaymentsFilter, 'page' | 'limit'>,
): Promise<PaymentMonitorRow[]> {
  const res: Paginated<PaymentMonitorRow> = await fetchPaginated(`${PAY}/payments-monitoring`, {
    page: 1,
    limit: 100000,
    ...clean(filter),
  });
  return res.docs;
}
