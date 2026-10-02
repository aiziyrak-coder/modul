export type PaymentMethod = 1 | 2 | 3;
export type PaymentStatus = 1 | 2 | 3;

export interface PaymentTransaction {
  id: string;
  date: string;
  createdAt: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  file: string | null;
}

export interface PaymentSummary {
  contractId: string;
  courseName: string;
  form: number | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  transactions: PaymentTransaction[];
}
