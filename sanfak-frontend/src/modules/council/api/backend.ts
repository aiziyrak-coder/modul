import {
  apiClient,
  fetchList,
  fetchOne,
  fetchPaginated,
  postJson,
  putJson,
  patchJson,
  deleteData,
  type Paginated,
} from '@/shared/api';

async function multipartRequest<T>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH',
  fields: Record<string, string | number | boolean | File | File[] | null | undefined>,
): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((file) => form.append(key, file));
    else if (value instanceof File) form.append(key, value);
    else form.append(key, String(value));
  }
  const res = await apiClient.request<T>({
    url,
    method,
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
import type {
  Announcement,
  CouncilMember,
  CouncilNotification,
  CouncilTask,
  DocSetting,
  MyVote,
  RankApplication,
  RankTab,
  RankCategory,
  RecipientGroup,
  RefItem,
  TaskStatus,
  UserOption,
  VoteParticipation,
  VotingSession,
} from '../model/types';
import {
  mapAnnouncement,
  mapDocSetting,
  mapMember,
  mapMyVote,
  mapNotification,
  mapRankApp,
  mapTask,
  mapParticipation,
  mapUserOption,
  mapVoting,
} from './mapper';

export interface MemberInput {
  userId: string;
  departmentId?: string;
  canVote?: boolean;
}
export interface TaskInput {
  title: string;
  desc?: string;
  assigneeId: string;
  deadline?: string;
}
export interface RankAppInput {
  rankType: 'dotsent' | 'professor';
  category?: 'rank' | 'position';
  departmentId?: string;
  submittedDocs?: { name: string; fileUrl?: string }[];
}
export interface VotingInput {
  departmentId?: string;
  rankType?: string;
  candidates: { userId: string; diplomaFile?: string; diplomaDate?: string }[];
  startDate: string;
  endDate: string;
  passingPercent?: number;
}
export interface AnnouncementInput {
  title: string;
  content: string;
  recipientGroup: RecipientGroup;
}

export type CouncilReference = 'departments' | 'directions' | 'academicYears';
const REF_ROOT: Record<CouncilReference, string> = {
  departments: '/departments',
  directions: '/directions',
  academicYears: '/academic-years',
};
export const backendReferences = {
  list: async (name: CouncilReference, search?: string): Promise<RefItem[]> => {
    const docs = await fetchList<{ _id: string; title: string }>(
      REF_ROOT[name],
      search ? { search } : {},
    );
    return docs.map((d) => ({ id: d._id, title: d.title }));
  },
};

const MEMBER_ROOT = '/members';
const memberBody = (i: MemberInput) => ({
  user: i.userId,
  department: i.departmentId || undefined,
  canVote: i.canVote,
});
export const backendMembers = {
  list: async (filters: { search?: string; departmentId?: string } = {}): Promise<CouncilMember[]> => {
    const docs = await fetchList<Parameters<typeof mapMember>[0]>(MEMBER_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.departmentId ? { department: filters.departmentId } : {}),
    });
    return docs.map(mapMember);
  },
  userOptions: async (departmentId?: string): Promise<UserOption[]> => {
    const docs = await fetchList<Parameters<typeof mapUserOption>[0]>(
      `${MEMBER_ROOT}/user-options`,
      departmentId ? { department: departmentId } : {},
    );
    return docs.map(mapUserOption);
  },
  create: (input: MemberInput) => postJson<{ _id: string }>(MEMBER_ROOT, memberBody(input)),
  update: (id: string, input: MemberInput) => putJson(`${MEMBER_ROOT}/${id}`, memberBody(input)),
  remove: (id: string) => deleteData(`${MEMBER_ROOT}/${id}`),
  toggleVote: (id: string, canVote: boolean) => patchJson(`${MEMBER_ROOT}/${id}/toggle-vote`, { canVote }),
  paginate: async (
    filters: { search?: string; departmentId?: string; academicTitle?: string; position?: string } = {},
    page: number,
    limit: number,
  ): Promise<Paginated<CouncilMember>> => {
    const res = await fetchPaginated<Parameters<typeof mapMember>[0]>(`${MEMBER_ROOT}/paginate`, {
      page,
      limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.departmentId ? { department: filters.departmentId } : {}),
      ...(filters.academicTitle ? { academicTitle: filters.academicTitle } : {}),
      ...(filters.position ? { position: filters.position } : {}),
    });
    return { ...res, docs: res.docs.map(mapMember) };
  },
};

const TASK_ROOT = '/council-tasks';
export const backendTasks = {
  list: async (
    filters: { search?: string; status?: TaskStatus; deadlineFrom?: string; deadlineTo?: string } = {},
  ): Promise<CouncilTask[]> => {
    const docs = await fetchList<Parameters<typeof mapTask>[0]>(TASK_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.deadlineFrom ? { deadlineFrom: filters.deadlineFrom } : {}),
      ...(filters.deadlineTo ? { deadlineTo: filters.deadlineTo } : {}),
    });
    return docs.map(mapTask);
  },
  getOne: async (id: string): Promise<CouncilTask> =>
    mapTask(await fetchOne<Parameters<typeof mapTask>[0]>(`${TASK_ROOT}/${id}`)),
  tabsCount: () => fetchOne<Record<string, number>>(`${TASK_ROOT}/tabs-count`),
  create: (input: TaskInput) =>
    postJson<{ _id: string }>(TASK_ROOT, {
      title: input.title,
      desc: input.desc || undefined,
      assignee: input.assigneeId,
      deadline: input.deadline || undefined,
    }),
  update: (id: string, input: Partial<TaskInput>) =>
    putJson(`${TASK_ROOT}/${id}`, {
      title: input.title,
      desc: input.desc,
      assignee: input.assigneeId,
      deadline: input.deadline,
    }),
  remove: (id: string) => deleteData(`${TASK_ROOT}/${id}`),
  submitResult: (id: string, files: File[] | string[]) => {
    const realFiles = files.filter((f): f is File => f instanceof File);
    if (realFiles.length) {
      return multipartRequest(`${TASK_ROOT}/${id}/submit-result`, 'PATCH', { files: realFiles });
    }
    return patchJson(`${TASK_ROOT}/${id}/submit-result`, { resultFiles: files });
  },
  deleteResult: (id: string) => patchJson(`${TASK_ROOT}/${id}/delete-result`, {}),
  approve: (id: string) => patchJson(`${TASK_ROOT}/${id}/approve`, {}),
  reject: (id: string, reason: string) =>
    patchJson(`${TASK_ROOT}/${id}/reject`, { rejectReason: reason }),
};

const RANK_ROOT = '/rank-applications';
export const backendRankApps = {
  list: async (
    filters: {
      search?: string;
      status?: string;
      rankType?: string;
      category?: RankCategory;
      hasDiploma?: boolean;
    } = {},
  ): Promise<RankApplication[]> => {
    const docs = await fetchList<Parameters<typeof mapRankApp>[0]>(RANK_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.rankType ? { rankType: filters.rankType } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.hasDiploma === undefined ? {} : { hasDiploma: String(filters.hasDiploma) }),
    });
    return docs.map(mapRankApp);
  },
  getOne: async (id: string): Promise<RankApplication> =>
    mapRankApp(await fetchOne<Parameters<typeof mapRankApp>[0]>(`${RANK_ROOT}/${id}`)),
  tabsCount: (category?: RankCategory) =>
    fetchOne<Record<string, number>>(
      `${RANK_ROOT}/tabs-count${category ? `?category=${category}` : ''}`,
    ),
  create: (input: RankAppInput, files?: { name: string; file: File }[]) => {
    if (files?.length) {
      return multipartRequest<{ _id: string }>(RANK_ROOT, 'POST', {
        rankType: input.rankType,
        category: input.category || 'rank',
        department: input.departmentId || undefined,
        docNames: JSON.stringify(files.map((f) => f.name)),
        files: files.map((f) => f.file),
      });
    }
    return postJson<{ _id: string }>(RANK_ROOT, {
      rankType: input.rankType,
      category: input.category || 'rank',
      department: input.departmentId || undefined,
      submittedDocs: input.submittedDocs || [],
    });
  },
  update: (id: string, input: Partial<RankAppInput>, files?: { name: string; file: File }[]) => {
    const { departmentId, ...rest } = input;
    if (files?.length) {
      return multipartRequest(`${RANK_ROOT}/${id}`, 'PUT', {
        rankType: rest.rankType,
        category: rest.category,
        ...(departmentId ? { department: departmentId } : {}),
        docNames: JSON.stringify(files.map((f) => f.name)),
        files: files.map((f) => f.file),
      });
    }
    return putJson(`${RANK_ROOT}/${id}`, {
      ...rest,
      ...(departmentId ? { department: departmentId } : {}),
    });
  },
  remove: (id: string) => deleteData(`${RANK_ROOT}/${id}`),
  archive: (id: string) => patchJson(`${RANK_ROOT}/${id}/archive`, {}),
  accept: (
    id: string,
    officialDocs?: {
      organizationLetter?: File | string;
      guaranteeLetter?: File | string;
      councilApproval?: File | string;
    },
  ) => {
    if (!officialDocs) return patchJson(`${RANK_ROOT}/${id}/accept`, {});
    const entries = Object.entries(officialDocs).filter(([, v]) => v) as [string, File | string][];
    const fileEntries = entries.filter(([, v]) => v instanceof File) as [string, File][];
    if (fileEntries.length) {
      return multipartRequest(`${RANK_ROOT}/${id}/accept`, 'PATCH', {
        docKeys: JSON.stringify(fileEntries.map(([k]) => k)),
        files: fileEntries.map(([, f]) => f),
      });
    }
    return patchJson(`${RANK_ROOT}/${id}/accept`, { officialDocs });
  },
  returnApp: (id: string, reason: string) => patchJson(`${RANK_ROOT}/${id}/return`, { reason }),
  setDiploma: (id: string, input: { file?: File; fileUrl?: string; date?: string }) => {
    if (input.file) {
      return multipartRequest(`${RANK_ROOT}/${id}/diploma`, 'PATCH', {
        files: [input.file],
        ...(input.date ? { date: input.date } : {}),
      });
    }
    return patchJson(`${RANK_ROOT}/${id}/diploma`, {
      fileUrl: input.fileUrl ?? '',
      ...(input.date ? { date: input.date } : {}),
    });
  },
  paginate: async (
    filters: {
      search?: string;
      rankType?: string;
      status?: string | string[];
      tab?: RankTab;
      category?: RankCategory;
      hasDiploma?: boolean;
    } = {},
    page: number,
    limit: number,
  ): Promise<Paginated<RankApplication>> => {
    const statuses = Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : [];
    const res = await fetchPaginated<Parameters<typeof mapRankApp>[0]>(`${RANK_ROOT}/paginate`, {
      page,
      limit,
      ...(filters.tab ? { tab: filters.tab } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(statuses.length ? { status: statuses.join(',') } : {}),
      ...(filters.rankType ? { rankType: filters.rankType } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.hasDiploma === undefined ? {} : { hasDiploma: String(filters.hasDiploma) }),
    });
    return { ...res, docs: res.docs.map(mapRankApp) };
  },
};

const VOTING_ROOT = '/voting-sessions';
export const backendVoting = {
  list: async (filters: { search?: string; status?: string } = {}): Promise<VotingSession[]> => {
    const docs = await fetchList<Parameters<typeof mapVoting>[0]>(VOTING_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    });
    return docs.map(mapVoting);
  },
  getOne: async (id: string): Promise<VotingSession> =>
    mapVoting(await fetchOne<Parameters<typeof mapVoting>[0]>(`${VOTING_ROOT}/${id}`)),
  tabsCount: () => fetchOne<Record<string, number>>(`${VOTING_ROOT}/tabs-count`),
  reportList: async (): Promise<VotingSession[]> => {
    const docs = await fetchList<Parameters<typeof mapVoting>[0]>(`${VOTING_ROOT}/report`);
    return docs.map(mapVoting);
  },
  create: (input: VotingInput) =>
    postJson<{ _id: string }>(VOTING_ROOT, {
      department: input.departmentId || undefined,
      rankType: input.rankType || undefined,
      candidates: input.candidates.map((c) => ({
        user: c.userId,
        diplomaFile: c.diplomaFile || undefined,
        diplomaDate: c.diplomaDate || undefined,
      })),
      startDate: input.startDate,
      endDate: input.endDate,
      passingPercent: input.passingPercent,
    }),
  remove: (id: string) => deleteData(`${VOTING_ROOT}/${id}`),
  finalize: (id: string) => putJson(`${VOTING_ROOT}/${id}/finalize`, {}),
  reportPdf: async (
    filters: { status?: string; rankType?: string; department?: string; intro?: string } = {},
  ): Promise<Blob> => {
    const res = await apiClient.get<Blob>(`${VOTING_ROOT}/report/pdf`, {
      params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      responseType: 'blob',
    });
    return res.data;
  },
  setDiploma: (
    sessionId: string,
    userId: string,
    input: { file?: File; fileUrl?: string; diplomaDate: string },
  ) => {
    const url = `${VOTING_ROOT}/${sessionId}/candidates/${userId}/diploma`;
    if (input.file) {
      return multipartRequest(url, 'PATCH', { files: input.file, diplomaDate: input.diplomaDate });
    }
    return patchJson(url, { diplomaFile: input.fileUrl, diplomaDate: input.diplomaDate });
  },
};

export const backendVotes = {
  cast: (session: string, choice: 'for' | 'against', candidate?: string) =>
    postJson('/votes', { session, choice, candidate }),
  bySession: (sessionId: string) => fetchList(`/votes/session/${sessionId}`),
  participation: async (sessionId: string): Promise<VoteParticipation[]> =>
    (
      await fetchList<Parameters<typeof mapParticipation>[0]>(
        `/votes/session/${sessionId}/participation`,
      )
    ).map(mapParticipation),
  myVote: async (sessionId: string): Promise<MyVote> =>
    mapMyVote(await fetchOne<Parameters<typeof mapMyVote>[0]>(`/votes/my/${sessionId}`)),
};

const ANNOUNCE_ROOT = '/council-announcements';
export const backendAnnouncements = {
  list: async (
    filters: { search?: string; recipientGroup?: string } = {},
  ): Promise<Announcement[]> => {
    const docs = await fetchList<Parameters<typeof mapAnnouncement>[0]>(ANNOUNCE_ROOT, {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.recipientGroup ? { recipientGroup: filters.recipientGroup } : {}),
    });
    return docs.map(mapAnnouncement);
  },
  create: (input: AnnouncementInput, file?: File) => {
    if (file) {
      return multipartRequest<{ _id: string }>(ANNOUNCE_ROOT, 'POST', {
        title: input.title,
        content: input.content,
        recipientGroup: input.recipientGroup,
        files: [file],
      });
    }
    return postJson<{ _id: string }>(ANNOUNCE_ROOT, input);
  },
  remove: (id: string) => deleteData(`${ANNOUNCE_ROOT}/${id}`),
  paginate: async (
    filters: { search?: string; recipientGroup?: string; from?: string; to?: string } = {},
    page: number,
    limit: number,
  ): Promise<Paginated<Announcement>> => {
    const res = await fetchPaginated<Parameters<typeof mapAnnouncement>[0]>(`${ANNOUNCE_ROOT}/paginate`, {
      page,
      limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.recipientGroup ? { recipientGroup: filters.recipientGroup } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    });
    return { ...res, docs: res.docs.map(mapAnnouncement) };
  },
};

export const backendNotifications = {
  list: async (): Promise<CouncilNotification[]> => {
    const res = await fetchPaginated<Parameters<typeof mapNotification>[0]>('/notifications', {
      page: 1,
      limit: 50,
    });
    return res.docs.map(mapNotification);
  },
  markRead: (id: string) => putJson(`/notifications/${id}/read`, {}),
  markAllRead: () => putJson('/notifications/read-all', {}),
};

export const backendDocSettings = {
  get: async (): Promise<DocSetting> => mapDocSetting(await fetchOne<Parameters<typeof mapDocSetting>[0]>('/doc-settings')),
  update: (setting: DocSetting) => putJson('/doc-settings', setting),
};
