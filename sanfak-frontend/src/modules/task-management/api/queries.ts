import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './task-management-api';
import { normalizeSearch } from '../lib/use-debounced';
import type { ListParams } from './task-management-api';
import type {
  AddResponseInput,
  CreateTaskInput,
  RoleOption,
  TaskStatsScope,
  UpdateTaskInput,
} from '../model/types';
import type { FinalizeStatus } from './task-management-api';

const EMPTY_SCOPE: TaskStatsScope = {
  total: 0,
  yangi: 0,
  jarayonda: 0,
  tekshiruvda: 0,
  bajarildi: 0,
  'rad etildi': 0,
  bajarilmadi: 0,
  kechikdi: 0,
};

const KEYS = {
  stats: ['tm', 'stats'] as const,
  categories: ['tm', 'categories'] as const,
  users: ['tm', 'users'] as const,
  notifications: ['tm', 'notifications'] as const,
  grants: ['tm', 'grants'] as const,
  grantCandidates: ['tm', 'grant-candidates'] as const,
  grantRoles: ['tm', 'grant-roles'] as const,
  board: ['tm', 'board'] as const,
};

export const TASK_BOARD_KEY = KEYS.board;

export function useTaskStats(filters: ListParams = {}) {
  const { data } = useQuery({
    queryKey: [...KEYS.stats, filters] as const,
    queryFn: () => api.fetchTaskStats(filters),
    placeholderData: (prev) => prev,
  });
  return {
    statsCreated: data?.created ?? EMPTY_SCOPE,
    statsAssigned: data?.assigned ?? EMPTY_SCOPE,
  };
}

export function useCategoriesData() {
  const { data } = useQuery({ queryKey: KEYS.categories, queryFn: api.fetchCategories });
  return useMemo(() => {
    const list = data ?? [];
    const idByName = Object.fromEntries(list.map((c) => [c.name, c._id]));
    return {
      categories: list.map((c) => c.name),
      categoryId: (name?: string | null): string | undefined =>
        name ? idByName[name] : undefined,
    };
  }, [data]);
}

export function useAssignableUsers(search = '') {
  const term = normalizeSearch(search);
  const { data, isFetching } = useQuery({
    queryKey: [...KEYS.users, term] as const,
    queryFn: () => api.fetchAssignableUsers(term ? { search: term } : {}),
    placeholderData: (prev) => prev,
  });
  return {
    users: data?.docs ?? [],
    total: data?.totalDocs ?? 0,
    loading: isFetching,
  };
}

export function useGrantRoles(): RoleOption[] {
  const { data } = useQuery({ queryKey: KEYS.grantRoles, queryFn: api.fetchGrantRoles });
  return data ?? [];
}

export function useGrants(assignerId: string | null) {
  const { data, isFetching } = useQuery({
    queryKey: [...KEYS.grants, assignerId] as const,
    queryFn: () => api.fetchGrants(assignerId as string),
    enabled: !!assignerId,
  });
  return { grants: data ?? [], loading: isFetching };
}

export function useGrantCandidates(search: string, enabled: boolean) {
  const term = normalizeSearch(search);
  const { data, isFetching } = useQuery({
    queryKey: [...KEYS.grantCandidates, term] as const,
    queryFn: () => api.fetchGrantCandidates(term ? { search: term } : {}),
    enabled,
    placeholderData: (prev) => prev,
  });
  return {
    candidates: data?.docs ?? [],
    total: data?.totalDocs ?? 0,
    loading: isFetching,
  };
}

export function useGrantActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: KEYS.grants });
    void qc.invalidateQueries({ queryKey: KEYS.users });
  };

  const saveGrants = useMutation({
    mutationFn: ({ assignerId, assigneeIds }: { assignerId: string; assigneeIds: string[] }) =>
      api.replaceGrants(assignerId, assigneeIds),
    onSuccess: invalidate,
  });
  const removeGrant = useMutation({
    mutationFn: ({ assignerId, assigneeId }: { assignerId: string; assigneeId: string }) =>
      api.removeGrant(assignerId, assigneeId),
    onSuccess: invalidate,
  });

  return { saveGrants, removeGrant };
}

export function useNotifications() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: KEYS.notifications,
    queryFn: async () => {
      const [notifications, unreadCount] = await Promise.all([
        api.fetchNotifications().catch(() => []),
        api.fetchUnreadCount().catch(() => 0),
      ]);
      return { notifications, unreadCount };
    },
  });

  const markRead = useCallback(
    async (id: string) => {
      await api.markNotificationRead(id).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: KEYS.notifications });
    },
    [qc],
  );

  const markAll = useCallback(async () => {
    await api.markAllNotificationsRead().catch(() => undefined);
    void qc.invalidateQueries({ queryKey: KEYS.notifications });
  }, [qc]);

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    markRead,
    markAll,
  };
}

export function useTaskActions() {
  const qc = useQueryClient();
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: KEYS.stats });
    void qc.invalidateQueries({ queryKey: KEYS.notifications });
    void qc.invalidateQueries({ queryKey: KEYS.board });
  }, [qc]);

  return {
    addTask: useCallback(async (input: CreateTaskInput) => { await api.createTask(input); refresh(); }, [refresh]),
    updateTask: useCallback(async (id: string, updates: UpdateTaskInput) => { await api.updateTask(id, updates); refresh(); }, [refresh]),
    deleteTask: useCallback(async (id: string) => { await api.deleteTask(id); refresh(); }, [refresh]),
    completeTask: useCallback(async (id: string, status: FinalizeStatus = 'bajarildi') => { await api.finalizeTask(id, status); refresh(); }, [refresh]),
    reassignTask: useCallback(async (id: string, reason: string) => { await api.reassignTask(id, reason); refresh(); }, [refresh]),
    resumeTask: useCallback(async (id: string) => { await api.resumeTask(id); refresh(); }, [refresh]),
    extendDeadline: useCallback(async (id: string, newDeadline: string) => { await api.extendDeadline(id, newDeadline); refresh(); }, [refresh]),
    addResponse: useCallback(async (id: string, response: AddResponseInput) => { await api.addResponse(id, response); refresh(); }, [refresh]),
  };
}

export function useCategoryActions() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: KEYS.categories });

  const addCategory = useMutation({
    mutationFn: (name: string) => api.createCategory(name.trim()),
    onSuccess: invalidate,
  });
  const editCategory = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateCategory(id, name.trim()),
    onSuccess: invalidate,
  });
  const removeCategory = useMutation({
    mutationFn: (id: string) => api.removeCategory(id),
    onSuccess: invalidate,
  });

  return { addCategory, editCategory, removeCategory };
}
