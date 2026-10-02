import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, uploadMultipart } from '@/shared/api';
import type {
  PaymentMethod,
  PaymentStatus,
  PaymentSummary,
  PaymentTransaction,
} from '../model/payment.types';

const KEY = 'qual-payment';
const ROOT = '/qualification-payments';

interface BackendTransaction {
  id: string;
  date: string;
  createdAt?: string | null;
  amount: number;
  method: number;
  status: number;
  file: string | null;
}
interface BackendPayment {
  contractId: string;
  courseName: string;
  form: number | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  transactions: BackendTransaction[];
}

const toMethod = (n: number): PaymentMethod => ([1, 2, 3].includes(n) ? n : 3) as PaymentMethod;
const toStatus = (n: number): PaymentStatus => ([1, 2, 3].includes(n) ? n : 1) as PaymentStatus;

const mapTx = (b: BackendTransaction): PaymentTransaction => ({
  id: b.id,
  date: b.date,
  createdAt: b.createdAt ?? null,
  amount: b.amount ?? 0,
  method: toMethod(Number(b.method)),
  status: toStatus(Number(b.status)),
  file: b.file ?? null,
});

const mapPayment = (b: BackendPayment): PaymentSummary => ({
  contractId: b.contractId,
  courseName: b.courseName,
  form: b.form ?? null,
  totalAmount: b.totalAmount ?? 0,
  paidAmount: b.paidAmount ?? 0,
  remainingAmount: b.remainingAmount ?? 0,
  transactions: (b.transactions ?? []).map(mapTx),
});

export function useMyPayment(courseId: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'my', courseId],
    queryFn: async (): Promise<PaymentSummary | null> => {
      const res = await fetchOne<{ data: BackendPayment | null }>(`${ROOT}/my`, {
        course: courseId,
      });
      return res.data ? mapPayment(res.data) : null;
    },
    enabled: !!courseId,
  });
}

export function useSubmitBankPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; amount: number; file: File }) =>
      uploadMultipart(`${ROOT}/bank`, 'POST', {
        course: v.course,
        amount: String(v.amount),
        file: v.file,
      }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [KEY, 'my', v.course] }),
  });
}
