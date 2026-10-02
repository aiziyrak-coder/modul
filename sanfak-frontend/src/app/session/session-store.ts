import { useMemo } from 'react';
import { create } from 'zustand';
import { hasAccessToken, queryClient } from '@/shared/api';
import { hasAllPermissions, hasAnyPermission, hasPermission } from '@/shared/lib/rbac';
import { disconnectAppSocket } from '@/shared/lib/socket';
import type { SessionState, SessionStatus, SessionUser } from './types';

const MOCK_USER: SessionUser = {
  id: 'dev-user',
  email: 'dev@platform.local',
  fullName: 'Developer',
  roles: [{ id: 'dev', name: 'Developer' }],
};

interface SessionActions {
  setStatus: (status: SessionStatus) => void;
  setSession: (data: { user: SessionUser; permissions: string[] }) => void;
  clear: () => void;
}

const hasToken = typeof window !== 'undefined' ? hasAccessToken() : false;

const DEV_MOCK = import.meta.env.DEV && !hasToken;

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  status: hasToken ? 'loading' : DEV_MOCK ? 'authenticated' : 'unauthenticated',
  user: DEV_MOCK ? MOCK_USER : null,
  permissions: DEV_MOCK ? ['*'] : [],
  setStatus: (status) => set({ status }),
  setSession: ({ user, permissions }) => set({ user, permissions, status: 'authenticated' }),
  clear: () => {
    disconnectAppSocket();

    void queryClient.cancelQueries();
    queryClient.clear();

    set({
      status: 'unauthenticated',
      user: null,
      permissions: [],
    });
  },
}));

export type PermissionChecker = ((permission: string) => boolean) & {
  any: (permissions: string[]) => boolean;
  all: (permissions: string[]) => boolean;
};

export function usePermission(): PermissionChecker {
  const permissions = useSessionStore((s) => s.permissions);
  return useMemo(() => {
    const can = (permission: string) => hasPermission(permissions, permission);
    return Object.assign(can, {
      any: (perms: string[]) => hasAnyPermission(permissions, perms),
      all: (perms: string[]) => hasAllPermissions(permissions, perms),
    });
  }, [permissions]);
}
