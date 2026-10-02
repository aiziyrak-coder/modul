import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchOne, fetchPaginated, type Paginated } from '@/shared/api';
import { mapContract, type BackendContract } from './contract-mapper';
import type { MyContract } from '../model/contract.types';

const KEY = 'qual-contract';
const ROOT = '/qualification-contracts';

export interface ContractFilter {
  page: number;
  limit: number;
  search?: string;
  course?: string;
  [key: string]: unknown;
}

export function useContractsPaginated(filter: ContractFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendContract> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapContract),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

interface BackendMyContract {
  id: string;
  courseTitle: string;
  courseType: string;
  form: number | null;
  creditHours: number;
  startDate: string;
  endDate: string;
  totalPrice: number;
  file: string | null;
  createdAt: string;
}

export function useMyContracts() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'my'],
    queryFn: async (): Promise<MyContract[]> => {
      const res = await fetchOne<{ data: BackendMyContract[] }>(`${ROOT}/my`);
      return (res.data ?? []).map((c) => ({
        id: c.id,
        courseTitle: c.courseTitle,
        courseType: c.courseType,
        form: c.form ?? null,
        creditHours: c.creditHours ?? 0,
        startDate: c.startDate,
        endDate: c.endDate,
        totalPrice: c.totalPrice ?? 0,
        fileUrl: c.file ?? null,
        createdAt: c.createdAt,
      }));
    },
  });
}
