import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@/shared/api';
import type {
  Contract,
  ContractStatus,
  DistrictRef,
  PracticeBase,
  PracticeRole,
  PracticeStudent,
  RefItem,
} from '../model/types';
import type { BaseInput, ContractInput, ReferenceName, StudentInput } from './mock-store';
import {
  backendBases,
  backendContracts,
  backendNotifications,
  backendReferences,
  backendStudents,
  backendTemplate,
  backendUsers,
} from './backend';

export const USE_MOCK = false;

const references = backendReferences;
const bases = backendBases;
const students = backendStudents;
const contracts = backendContracts;
const notifications = backendNotifications;
const template = backendTemplate;
const users = backendUsers;

const KEY = 'practice';

export function useReferenceList(name: ReferenceName, search?: string) {
  return useQuery({
    queryKey: [KEY, 'ref', name, search ?? ''],
    queryFn: () => references.list(name, search),
  });
}

export function useDistrictsByRegion(regionId?: string) {
  return useQuery({
    queryKey: [KEY, 'ref', 'districts', 'byRegion', regionId ?? ''],
    queryFn: () => references.districtsByRegion(regionId),
  });
}

export function useReferenceCreate(name: ReferenceName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { title: string; regionId?: string }) =>
      references.create(name, v.title, v.regionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'ref'] }),
  });
}

export function useReferenceUpdate(name: ReferenceName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; title: string; regionId?: string }) =>
      references.update(name, v.id, v.title, v.regionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'ref'] }),
  });
}

export function useReferenceRemove(name: ReferenceName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => references.remove(name, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'ref'] }),
  });
}

export function fetchReferencePage(name: ReferenceName) {
  return (
    params: Record<string, string | number | undefined> = {},
  ): Promise<Paginated<RefItem | DistrictRef>> => {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 10);
    return references.paginate(
      name,
      {
        search: typeof params.search === 'string' ? params.search : undefined,
        regionId: typeof params.region === 'string' ? params.region : undefined,
      },
      page,
      limit,
    );
  };
}

export function useBases(filters: { search?: string; orgTypeId?: string; regionId?: string } = {}) {
  return useQuery({
    queryKey: [KEY, 'bases', filters],
    queryFn: () => bases.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useBaseCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BaseInput) => bases.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'bases'] }),
  });
}

export function useBaseUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: BaseInput }) => bases.update(v.id, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'bases'] }),
  });
}

export function useRepresentativeUsers(search?: string) {
  return useQuery({
    queryKey: [KEY, 'users', search ?? ''],
    queryFn: () => users.list(search),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useBaseRemove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bases.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'bases'] }),
  });
}

export function fetchBasesPage(
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<PracticeBase>> {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 12);
  return bases.paginate(
    {
      search: typeof params.search === 'string' ? params.search : undefined,
      orgTypeId: typeof params.orgTypeId === 'string' ? params.orgTypeId : undefined,
      regionId: typeof params.regionId === 'string' ? params.regionId : undefined,
    },
    page,
    limit,
  );
}

export function useStudents(
  filters: {
    search?: string;
    regionId?: string;
    directionId?: string;
    academicYearId?: string;
    course?: number;
  } = {},
) {
  return useQuery({
    queryKey: [KEY, 'students', filters],
    queryFn: () => students.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useStudentCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentInput) => students.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function useStudentUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: StudentInput }) => students.update(v.id, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function useStudentRemove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => students.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function useBulkCourseTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { ids: string[]; toCourse: number }) =>
      students.bulkCourseTransfer(v.ids, v.toCourse),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function fetchStudentsPage(
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<PracticeStudent>> {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 12);
  return students.paginate(
    {
      search: typeof params.search === 'string' ? params.search : undefined,
      regionId: typeof params.regionId === 'string' ? params.regionId : undefined,
      directionId: typeof params.directionId === 'string' ? params.directionId : undefined,
      academicYearId: typeof params.academicYearId === 'string' ? params.academicYearId : undefined,
      course: typeof params.course === 'number' ? params.course : undefined,
    },
    page,
    limit,
  );
}

export function useContracts(filters: {
  search?: string;
  status?: ContractStatus;
  academicYearId?: string;
  directionId?: string;
  course?: number;
  group?: string;
  visibleStatuses?: ContractStatus[] | null;
}) {
  return useQuery({
    queryKey: [KEY, 'contracts', filters],
    queryFn: () => contracts.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'contract', id],
    queryFn: () => contracts.getOne(id as string),
    enabled: !!id,
  });
}

export function useTabsCount(visibleStatuses?: ContractStatus[] | null) {
  return useQuery({
    queryKey: [KEY, 'contracts', 'tabs', visibleStatuses ?? 'all'],
    queryFn: () => contracts.tabsCount(visibleStatuses),
  });
}

export function fetchContractsPage(
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<Contract>> {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 12);
  const statusRaw = typeof params.status === 'string' ? params.status : undefined;
  const status = statusRaw ? (statusRaw.split(',') as ContractStatus[]) : undefined;
  return contracts.paginate(
    {
      search: typeof params.search === 'string' ? params.search : undefined,
      status,
      academicYearId: typeof params.academicYearId === 'string' ? params.academicYearId : undefined,
      directionId: typeof params.directionId === 'string' ? params.directionId : undefined,
      course: typeof params.course === 'number' ? params.course : undefined,
      group: typeof params.group === 'string' ? params.group : undefined,
    },
    page,
    limit,
  );
}

const invalidateContracts = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: [KEY] });

export function useContractCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ContractInput) => contracts.create(input),
    onSuccess: () => invalidateContracts(qc),
  });
}

export function useContractUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: ContractInput }) => contracts.update(v.id, v.input),
    onSuccess: () => invalidateContracts(qc),
  });
}

export function useContractRemove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contracts.remove(id),
    onSuccess: () => invalidateContracts(qc),
  });
}

export function useSendToRector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contracts.sendToRector(id),
    onSuccess: () => invalidateContracts(qc),
  });
}

export function useRectorSign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; cert: { serialNumber: string; subject: string } }) =>
      contracts.rectorSign(v.id, v.cert),
    onSuccess: () => invalidateContracts(qc),
  });
}

export function useOrgSign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; cert: { serialNumber: string; subject: string } }) =>
      contracts.orgSign(v.id, v.cert),
    onSuccess: () => invalidateContracts(qc),
  });
}

export function useReject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string; rejectedBy: 'rektor' | 'org_head' }) =>
      contracts.reject(v.id, v.reason, v.rejectedBy),
    onSuccess: () => invalidateContracts(qc),
  });
}

export function useNotifications(role: PracticeRole) {
  return useQuery({
    queryKey: [KEY, 'notifications', role],
    queryFn: () => notifications.list(role),
  });
}

export function useUnreadCount(role: PracticeRole) {
  return useQuery({
    queryKey: [KEY, 'notifications', role, 'unread'],
    queryFn: () => notifications.unreadCount(role),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: PracticeRole) => notifications.markAllRead(role),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'notifications'] }),
  });
}

export function useTemplate() {
  return useQuery({ queryKey: [KEY, 'template'], queryFn: () => template.get() });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => template.save(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'template'] }),
  });
}
