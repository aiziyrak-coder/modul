import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@/shared/api';
import {
  backendAnnouncements,
  backendDocSettings,
  backendMembers,
  backendNotifications,
  backendRankApps,
  backendReferences,
  backendTasks,
  backendVotes,
  backendVoting,
  type AnnouncementInput,
  type CouncilReference,
  type MemberInput,
  type RankAppInput,
  type TaskInput,
  type VotingInput,
} from './backend';
import type {
  Announcement,
  CouncilMember,
  DocSetting,
  RankApplication,
  RankCategory,
  RankTab,
  TaskStatus,
} from '../model/types';

const K = {
  refs: (name: string) => ['council', 'ref', name] as const,
  members: (f: unknown) => ['council', 'members', f] as const,
  tasks: (f: unknown) => ['council', 'tasks', f] as const,
  task: (id?: string) => ['council', 'task', id] as const,
  taskTabs: ['council', 'tasks', 'tabs'] as const,
  rankApps: (f: unknown) => ['council', 'rankApps', f] as const,
  rankApp: (id?: string) => ['council', 'rankApp', id] as const,
  rankTabs: ['council', 'rankApps', 'tabs'] as const,
  voting: (f: unknown) => ['council', 'voting', f] as const,
  votingOne: (id?: string) => ['council', 'voting', id] as const,
  votingTabs: ['council', 'voting', 'tabs'] as const,
  announcements: (f: unknown) => ['council', 'announcements', f] as const,
  notifications: ['council', 'notifications'] as const,
  docSetting: ['council', 'docSetting'] as const,
  myVote: (sessionId?: string) => ['council', 'myVote', sessionId] as const,
  sessionVotes: (sessionId?: string) => ['council', 'sessionVotes', sessionId] as const,
};

const invalidate = (qc: ReturnType<typeof useQueryClient>, ...prefixes: string[]) =>
  prefixes.forEach((p) => qc.invalidateQueries({ queryKey: ['council', p] }));

export const useReferenceList = (name: CouncilReference, search?: string) =>
  useQuery({ queryKey: K.refs(name + (search ?? '')), queryFn: () => backendReferences.list(name, search) });

export const useMembers = (filters: { search?: string; departmentId?: string } = {}, enabled = true) =>
  useQuery({ queryKey: K.members(filters), queryFn: () => backendMembers.list(filters), enabled });

export const useUserOptions = (departmentId?: string, enabled = true) =>
  useQuery({
    queryKey: ['council', 'userOptions', departmentId ?? ''] as const,
    queryFn: () => backendMembers.userOptions(departmentId),
    enabled,
  });

export const useMemberCreate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: MemberInput) => backendMembers.create(input), onSuccess: () => invalidate(qc, 'members') });
};
export const useMemberUpdate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; input: MemberInput }) => backendMembers.update(v.id, v.input), onSuccess: () => invalidate(qc, 'members') });
};
export const useMemberRemove = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendMembers.remove(id), onSuccess: () => invalidate(qc, 'members') });
};
export const useMemberToggleVote = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; canVote: boolean }) => backendMembers.toggleVote(v.id, v.canVote), onSuccess: () => invalidate(qc, 'members') });
};

export function fetchMembersPage(
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<CouncilMember>> {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 12);
  return backendMembers.paginate(
    {
      search: typeof params.search === 'string' ? params.search : undefined,
      departmentId: typeof params.departmentId === 'string' ? params.departmentId : undefined,
      academicTitle: typeof params.academicTitle === 'string' ? params.academicTitle : undefined,
      position: typeof params.position === 'string' ? params.position : undefined,
    },
    page,
    limit,
  );
}

export const useTasks = (
  filters: { search?: string; status?: TaskStatus; deadlineFrom?: string; deadlineTo?: string } = {},
) => useQuery({ queryKey: K.tasks(filters), queryFn: () => backendTasks.list(filters) });
export const useTask = (id?: string) =>
  useQuery({ queryKey: K.task(id), queryFn: () => backendTasks.getOne(id as string), enabled: !!id });
export const useTaskTabsCount = () =>
  useQuery({ queryKey: K.taskTabs, queryFn: () => backendTasks.tabsCount() });

export const useTaskCreate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: TaskInput) => backendTasks.create(input), onSuccess: () => invalidate(qc, 'tasks') });
};
export const useTaskUpdate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; input: Partial<TaskInput> }) => backendTasks.update(v.id, v.input), onSuccess: () => invalidate(qc, 'tasks', 'task') });
};
export const useTaskRemove = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendTasks.remove(id), onSuccess: () => invalidate(qc, 'tasks') });
};
export const useTaskSubmit = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; files: File[] | string[] }) => backendTasks.submitResult(v.id, v.files), onSuccess: () => invalidate(qc, 'tasks', 'task') });
};
export const useTaskDeleteResult = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendTasks.deleteResult(id), onSuccess: () => invalidate(qc, 'tasks', 'task') });
};
export const useTaskApprove = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendTasks.approve(id), onSuccess: () => invalidate(qc, 'tasks', 'task') });
};
export const useTaskReject = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; reason: string }) => backendTasks.reject(v.id, v.reason), onSuccess: () => invalidate(qc, 'tasks', 'task') });
};

export const useRankApps = (
  filters: {
    search?: string;
    status?: string;
    rankType?: string;
    category?: RankCategory;
  } = {},
) => useQuery({ queryKey: K.rankApps(filters), queryFn: () => backendRankApps.list(filters) });
export const useRankApp = (id?: string) =>
  useQuery({ queryKey: K.rankApp(id), queryFn: () => backendRankApps.getOne(id as string), enabled: !!id });
export const useRankTabsCount = (category?: RankCategory) =>
  useQuery({
    queryKey: [...K.rankTabs, category ?? 'all'],
    queryFn: () => backendRankApps.tabsCount(category),
  });

export const useRankCreate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { input: RankAppInput; files?: { name: string; file: File }[] }) =>
      backendRankApps.create(v.input, v.files),
    onSuccess: () => invalidate(qc, 'rankApps'),
  });
};
export const useRankUpdate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<RankAppInput>; files?: { name: string; file: File }[] }) =>
      backendRankApps.update(v.id, v.input, v.files),
    onSuccess: () => invalidate(qc, 'rankApps', 'rankApp'),
  });
};
export const useRankSetDiploma = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; file?: File; fileUrl?: string; date?: string }) =>
      backendRankApps.setDiploma(v.id, { file: v.file, fileUrl: v.fileUrl, date: v.date }),
    onSuccess: () => invalidate(qc, 'rankApps'),
  });
};
export const useRankArchive = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendRankApps.archive(id), onSuccess: () => invalidate(qc, 'rankApps', 'rankApp') });
};
export const useRankRemove = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendRankApps.remove(id), onSuccess: () => invalidate(qc, 'rankApps') });
};
export const useRankAccept = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backendRankApps.accept(id),
    onSuccess: () => invalidate(qc, 'rankApps', 'rankApp'),
  });
};
export const useRankReturn = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; reason: string }) => backendRankApps.returnApp(v.id, v.reason), onSuccess: () => invalidate(qc, 'rankApps', 'rankApp') });
};

export function fetchRankAppsPage(
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<RankApplication>> {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 12);
  const statusRaw = typeof params.status === 'string' ? params.status : undefined;
  const status = statusRaw ? statusRaw.split(',') : undefined;
  const tabRaw = typeof params.tab === 'string' ? params.tab : undefined;
  const tab: RankTab | undefined =
    tabRaw === 'documents' || tabRaw === 'accepted' || tabRaw === 'archive' ? tabRaw : undefined;
  return backendRankApps.paginate(
    {
      search: typeof params.search === 'string' ? params.search : undefined,
      rankType: typeof params.rankType === 'string' ? params.rankType : undefined,
      category:
        params.category === 'rank' || params.category === 'position' ? params.category : undefined,
      hasDiploma:
        params.hasDiploma === 'true' ? true : params.hasDiploma === 'false' ? false : undefined,
      status,
      tab,
    },
    page,
    limit,
  );
}

export const useVotingSessions = (filters: { search?: string; status?: string } = {}) =>
  useQuery({ queryKey: K.voting(filters), queryFn: () => backendVoting.list(filters) });
export const useVotingSession = (id?: string) =>
  useQuery({ queryKey: K.votingOne(id), queryFn: () => backendVoting.getOne(id as string), enabled: !!id });
export const useVotingTabsCount = () =>
  useQuery({ queryKey: K.votingTabs, queryFn: () => backendVoting.tabsCount() });

export const useVotingReport = () =>
  useQuery({
    queryKey: ['council', 'votingReport'] as const,
    queryFn: () => backendVoting.reportList(),
  });

export const useVotingCreate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: VotingInput) => backendVoting.create(input), onSuccess: () => invalidate(qc, 'voting') });
};
export const useVotingRemove = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendVoting.remove(id), onSuccess: () => invalidate(qc, 'voting') });
};
export const useVotingReportPdf = () =>
  useMutation({
    mutationFn: async (filters: { status?: string; rankType?: string; department?: string }) => {
      const blob = await backendVoting.reportPdf(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tanlov-royxati.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });

export const useVotingSetDiploma = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      sessionId: string;
      userId: string;
      input: { file?: File; fileUrl?: string; diplomaDate: string };
    }) => backendVoting.setDiploma(v.sessionId, v.userId, v.input),
    onSuccess: () => invalidate(qc, 'voting'),
  });
};
export const useVotingFinalize = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendVoting.finalize(id), onSuccess: () => invalidate(qc, 'voting') });
};
export const useCastVote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { session: string; choice: 'for' | 'against'; candidate?: string }) =>
      backendVotes.cast(v.session, v.choice, v.candidate),
    onSuccess: () => invalidate(qc, 'voting', 'myVote', 'sessionVotes'),
  });
};

export const useMyVote = (sessionId?: string, enabled = true) =>
  useQuery({
    queryKey: K.myVote(sessionId),
    queryFn: () => backendVotes.myVote(sessionId as string),
    enabled: enabled && !!sessionId,
  });

export const useSessionParticipation = (sessionId?: string, enabled = true) =>
  useQuery({
    queryKey: ['council', 'participation', sessionId] as const,
    queryFn: () => backendVotes.participation(sessionId as string),
    enabled: enabled && !!sessionId,
  });

export const useSessionVotes = (sessionId?: string, enabled = true) =>
  useQuery({
    queryKey: K.sessionVotes(sessionId),
    queryFn: () => backendVotes.bySession(sessionId as string),
    enabled: enabled && !!sessionId,
  });

export const useAnnouncements = (filters: { search?: string; recipientGroup?: string } = {}) =>
  useQuery({ queryKey: K.announcements(filters), queryFn: () => backendAnnouncements.list(filters) });
export const useAnnouncementCreate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { input: AnnouncementInput; file?: File }) =>
      backendAnnouncements.create(v.input, v.file),
    onSuccess: () => invalidate(qc, 'announcements'),
  });
};
export const useAnnouncementRemove = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendAnnouncements.remove(id), onSuccess: () => invalidate(qc, 'announcements') });
};

export function fetchAnnouncementsPage(
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<Announcement>> {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 12);
  return backendAnnouncements.paginate(
    {
      search: typeof params.search === 'string' ? params.search : undefined,
      recipientGroup: typeof params.recipientGroup === 'string' ? params.recipientGroup : undefined,
      from: typeof params.from === 'string' ? params.from : undefined,
      to: typeof params.to === 'string' ? params.to : undefined,
    },
    page,
    limit,
  );
}

export const useNotifications = () =>
  useQuery({ queryKey: K.notifications, queryFn: () => backendNotifications.list() });
export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => backendNotifications.markRead(id), onSuccess: () => invalidate(qc, 'notifications') });
};
export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => backendNotifications.markAllRead(), onSuccess: () => invalidate(qc, 'notifications') });
};

export const useDocSetting = () =>
  useQuery({ queryKey: K.docSetting, queryFn: () => backendDocSettings.get() });
export const useDocSettingUpdate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (setting: DocSetting) => backendDocSettings.update(setting), onSuccess: () => invalidate(qc, 'docSetting') });
};
