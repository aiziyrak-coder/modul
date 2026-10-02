import type { Contract } from '../model/contract.types';

export interface BackendContract {
  _id: string;
  listener?: { fullName?: string; passport?: string } | null;
  course?: { title?: string; form?: number } | string | null;
  totalPrice: number;
  debitPrice: number;
  file: string;
  fileDetails?: { name?: string; [key: string]: unknown } | null;
  createdAt?: string;
}

export function mapContract(b: BackendContract): Contract {
  const course = typeof b.course === 'object' && b.course ? b.course : null;
  return {
    id: b._id,
    listenerName: b.listener?.fullName ?? '—',
    passport: b.listener?.passport,
    courseTitle: course?.title,
    totalPrice: b.totalPrice,
    debitPrice: b.debitPrice,
    fileName: b.fileDetails?.name,
    fileUrl: b.file ? b.file : '#',
    createdAt: b.createdAt,
  };
}
