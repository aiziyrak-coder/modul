export interface Contract {
  id: string;
  listenerName: string;
  passport?: string;
  courseTitle?: string;
  totalPrice: number;
  debitPrice: number;
  fileName?: string;
  fileUrl: string;
  createdAt?: string;
}

export interface MyContract {
  id: string;
  courseTitle: string;
  courseType: string;
  form: number | null;
  creditHours: number;
  startDate: string;
  endDate: string;
  totalPrice: number;
  fileUrl: string | null;
  createdAt: string;
}
