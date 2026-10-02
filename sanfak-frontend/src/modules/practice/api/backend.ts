import {
  fetchList,
  fetchOne,
  fetchPaginated,
  postJson,
  putJson,
  patchJson,
  deleteData,
  type Paginated,
} from '@/shared/api';
import type {
  Contract,
  ContractStatus,
  DistrictRef,
  NotificationItem,
  PracticeBase,
  PracticeRole,
  PracticeStudent,
  RefItem,
  RepresentativeRef,
} from '../model/types';
import { mapBase, mapContract, mapDistrict, mapNotification, mapStudent } from './mapper';
import type { BaseInput, ContractInput, ReferenceName, StudentInput } from './mock-store';

const REF_ROOT: Record<ReferenceName, string> = {
  orgTypes: '/org-types',
  regions: '/provinces',
  districts: '/regions',
  directions: '/directions',
  academicYears: '/academic-years',
  courses: '/courses',
};

const cert = (c: { serialNumber: string; subject: string }) => ({
  certSerial: c.serialNumber,
  certSubject: c.subject,
});

const baseBody = (i: BaseInput) => ({
  title: i.title,
  orgType: i.orgTypeId,
  stir: i.stir,
  region: i.regionId,
  district: i.districtId,
  address: i.address,
  headName: i.headName,
  headJshshir: i.headJshshir,
  headPhone: i.headPhone,
  email: i.email ?? null,
  capacity: i.capacity ?? null,
  responsibleUsers: i.responsibleUserIds ?? [],
});

const studentBody = (i: StudentInput) => ({
  fish: i.fish,
  academicYear: i.academicYearId,
  direction: i.directionId,
  course: i.course,
  group: i.group,
  region: i.regionId,
  district: i.districtId,
});

const contractBody = (i: ContractInput) => ({
  organization: i.organizationId,
  direction: i.directionId,
  academicYear: i.academicYearId,
  course: i.course,
  group: i.group || undefined,
  students: i.studentIds,
  startDate: i.startDate,
  endDate: i.endDate,
  note: i.note ?? undefined,
});

export const backendReferences = {
  list: async (name: ReferenceName, search?: string): Promise<RefItem[]> => {
    const docs = await fetchList<{ _id: string; title: string; province?: { _id: string; title: string } }>(
      REF_ROOT[name],
      search ? { search } : {},
    );
    if (name === 'districts') return docs.map(mapDistrict);
    return docs.map((d) => ({ id: d._id, title: d.title }));
  },
  districtsByRegion: async (regionId?: string): Promise<DistrictRef[]> => {
    const docs = await fetchList<{ _id: string; title: string; province?: { _id: string; title: string } }>(
      '/regions',
      regionId ? { province: regionId } : {},
    );
    return docs.map(mapDistrict);
  },
  paginate: async (
    name: ReferenceName,
    filters: { search?: string; regionId?: string } = {},
    page: number,
    limit: number,
  ): Promise<Paginated<RefItem | DistrictRef>> => {
    const res = await fetchPaginated<{ _id: string; title: string; province?: { _id: string; title: string } }>(
      `${REF_ROOT[name]}/paginate`,
      {
        page,
        limit,
        ...(filters.search ? { search: filters.search } : {}),
        ...(name === 'districts' && filters.regionId ? { province: filters.regionId } : {}),
      },
    );
    return {
      ...res,
      docs: name === 'districts' ? res.docs.map(mapDistrict) : res.docs.map((d) => ({ id: d._id, title: d.title })),
    };
  },
  create: async (name: ReferenceName, title: string, regionId?: string): Promise<RefItem> => {
    const body = name === 'districts' ? { title, province: regionId } : { title };
    const res = await postJson<{ _id: string }>(REF_ROOT[name], body);
    return { id: res._id, title };
  },
  update: async (name: ReferenceName, id: string, title: string, regionId?: string): Promise<RefItem> => {
    const body = name === 'districts' ? { title, province: regionId } : { title };
    await putJson(`${REF_ROOT[name]}/${id}`, body);
    return { id, title };
  },
  remove: async (name: ReferenceName, id: string): Promise<{ id: string }> => {
    await deleteData(`${REF_ROOT[name]}/${id}`);
    return { id };
  },
};

const USERS_ROOT = '/users/lookup';
export const backendUsers = {
  list: async (search?: string): Promise<RepresentativeRef[]> => {
    const docs = await fetchList<{
      _id: string;
      firstName?: string;
      lastName?: string;
      position?: { _id: string; title: string } | null;
    }>(USERS_ROOT, { limit: 100, ...(search ? { search } : {}) });
    return docs.map((u) => ({
      id: u._id,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      position: u.position?.title ?? null,
    }));
  },
};

const BASE_ROOT = '/medical-organizations/organizations';
export const backendBases = {
  list: async (
    filters: { search?: string; orgTypeId?: string; regionId?: string } = {},
  ): Promise<PracticeBase[]> => {
    const docs = await fetchList<Parameters<typeof mapBase>[0]>(BASE_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.orgTypeId ? { orgType: filters.orgTypeId } : {}),
      ...(filters.regionId ? { region: filters.regionId } : {}),
    });
    return docs.map(mapBase);
  },
  getOne: async (id: string): Promise<PracticeBase> =>
    mapBase(await fetchOne<Parameters<typeof mapBase>[0]>(`${BASE_ROOT}/${id}`)),
  paginate: async (
    filters: { search?: string; orgTypeId?: string; regionId?: string } = {},
    page: number,
    limit: number,
  ): Promise<Paginated<PracticeBase>> => {
    const res = await fetchPaginated<Parameters<typeof mapBase>[0]>(`${BASE_ROOT}/paginate`, {
      page,
      limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.orgTypeId ? { orgType: filters.orgTypeId } : {}),
      ...(filters.regionId ? { region: filters.regionId } : {}),
    });
    return { ...res, docs: res.docs.map(mapBase) };
  },
  create: (input: BaseInput) => postJson<{ _id: string }>(BASE_ROOT, baseBody(input)),
  update: (id: string, input: BaseInput) =>
    putJson<{ message: string }>(`${BASE_ROOT}/${id}`, baseBody(input)),
  remove: (id: string) => deleteData<{ message: string }>(`${BASE_ROOT}/${id}`),
};

const STUDENT_ROOT = '/practice-students';
export const backendStudents = {
  list: async (
    filters: {
      search?: string;
      regionId?: string;
      directionId?: string;
      academicYearId?: string;
      course?: number;
    } = {},
  ): Promise<PracticeStudent[]> => {
    const docs = await fetchList<Parameters<typeof mapStudent>[0]>(STUDENT_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.regionId ? { region: filters.regionId } : {}),
      ...(filters.directionId ? { direction: filters.directionId } : {}),
      ...(filters.academicYearId ? { academicYear: filters.academicYearId } : {}),
      ...(filters.course ? { course: filters.course } : {}),
    });
    return docs.map(mapStudent);
  },
  paginate: async (
    filters: {
      search?: string;
      regionId?: string;
      directionId?: string;
      academicYearId?: string;
      course?: number;
    } = {},
    page: number,
    limit: number,
  ): Promise<Paginated<PracticeStudent>> => {
    const res = await fetchPaginated<Parameters<typeof mapStudent>[0]>(`${STUDENT_ROOT}/paginate`, {
      page,
      limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.regionId ? { region: filters.regionId } : {}),
      ...(filters.directionId ? { direction: filters.directionId } : {}),
      ...(filters.academicYearId ? { academicYear: filters.academicYearId } : {}),
      ...(filters.course ? { course: filters.course } : {}),
    });
    return { ...res, docs: res.docs.map(mapStudent) };
  },
  create: (input: StudentInput) => postJson<{ _id: string }>(STUDENT_ROOT, studentBody(input)),
  update: (id: string, input: StudentInput) =>
    putJson<{ message: string }>(`${STUDENT_ROOT}/${id}`, studentBody(input)),
  remove: (id: string) => deleteData<{ message: string }>(`${STUDENT_ROOT}/${id}`),
  bulkCourseTransfer: (ids: string[], toCourse: number) =>
    patchJson<{ modifiedCount: number }>(`${STUDENT_ROOT}/bulk-course-transfer`, {
      studentIds: ids,
      toCourse,
    }),
};

const C_ROOT = '/practices/contracts';
export const backendContracts = {
  list: async (
    filters: {
      search?: string;
      status?: ContractStatus;
      academicYearId?: string;
      directionId?: string;
      course?: number;
      group?: string;
      visibleStatuses?: ContractStatus[] | null;
    } = {},
  ): Promise<Contract[]> => {
    const docs = await fetchList<Parameters<typeof mapContract>[0]>(C_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.academicYearId ? { academicYear: filters.academicYearId } : {}),
      ...(filters.directionId ? { direction: filters.directionId } : {}),
      ...(filters.course ? { course: filters.course } : {}),
      ...(filters.group ? { group: filters.group } : {}),
    });
    return docs.map(mapContract);
  },
  getOne: async (id: string): Promise<Contract> =>
    mapContract(await fetchOne<Parameters<typeof mapContract>[0]>(`${C_ROOT}/${id}`)),
  create: (input: ContractInput) => postJson<{ _id: string; number: string }>(C_ROOT, contractBody(input)),
  update: (id: string, input: ContractInput) =>
    putJson<{ message: string }>(`${C_ROOT}/${id}`, contractBody(input)),
  remove: (id: string) => deleteData<{ message: string }>(`${C_ROOT}/${id}`),
  sendToRector: (id: string) => patchJson<{ message: string }>(`${C_ROOT}/${id}/send-to-rector`, {}),
  rectorSign: (id: string, c: { serialNumber: string; subject: string }) =>
    putJson<{ message: string }>(`${C_ROOT}/${id}/rector-sign`, cert(c)),
  orgSign: (id: string, c: { serialNumber: string; subject: string }) =>
    putJson<{ message: string }>(`${C_ROOT}/${id}/org-sign`, cert(c)),
  reject: (id: string, reason: string, rejectedBy: 'rektor' | 'org_head') =>
    patchJson<{ message: string }>(`${C_ROOT}/${id}/reject`, { reason, rejectedBy }),
  tabsCount: (_visibleStatuses?: ContractStatus[] | null): Promise<Record<string, number>> =>
    fetchOne(`${C_ROOT}/tabs-count`),
  paginate: async (
    filters: {
      search?: string;
      status?: ContractStatus | ContractStatus[] | null;
      academicYearId?: string;
      directionId?: string;
      course?: number;
      group?: string;
    } = {},
    page: number,
    limit: number,
  ): Promise<Paginated<Contract>> => {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : filters.status
        ? [filters.status]
        : [];
    if (statuses.length > 1) {
      const all = await backendContracts.list({ ...filters, status: undefined });
      const filtered = all.filter((c) => statuses.includes(c.status));
      const start = (page - 1) * limit;
      const docs = filtered.slice(start, start + limit);
      const totalDocs = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
      return {
        docs,
        totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      };
    }
    const res = await fetchPaginated<Parameters<typeof mapContract>[0]>(`${C_ROOT}/paginate`, {
      page,
      limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(statuses[0] ? { status: statuses[0] } : {}),
      ...(filters.academicYearId ? { academicYear: filters.academicYearId } : {}),
      ...(filters.directionId ? { direction: filters.directionId } : {}),
      ...(filters.course ? { course: filters.course } : {}),
      ...(filters.group ? { group: filters.group } : {}),
    });
    return { ...res, docs: res.docs.map(mapContract) };
  },
};

export const backendTemplate = {
  get: () => fetchOne<{ _id: string; body: string }>('/contract-templates').then((d) => ({ id: d._id, body: d.body })),
  save: (body: string) =>
    putJson<{ _id: string }>('/contract-templates', { body }).then((d) => ({ id: d._id, body })),
};

export const backendNotifications = {
  list: async (role: PracticeRole): Promise<NotificationItem[]> => {
    const res = await fetchPaginated<Parameters<typeof mapNotification>[0]>('/notifications', {
      page: 1,
      limit: 50,
    });
    return res.docs.map((n) => mapNotification(n, role));
  },
  unreadCount: async (_role?: PracticeRole): Promise<number> => {
    const res = await fetchOne<{ count: number }>('/notifications/unread-count');
    return res.count;
  },
  markRead: async (id: string): Promise<{ id: string }> => {
    await putJson(`/notifications/${id}/read`, {});
    return { id };
  },
  markAllRead: async (_role?: PracticeRole): Promise<{ ok: true }> => {
    await putJson('/notifications/read-all', {});
    return { ok: true } as const;
  },
};
