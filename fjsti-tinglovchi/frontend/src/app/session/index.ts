import { create } from 'zustand';
import { apiClient, getAccessToken, setAccessToken } from '@/shared/api';
import { disconnectChatSocket } from '@/qual/lib/chat-socket';

export interface ListenerUser {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  passport: string | null;
  passportSeria: string | null;
  passportNumber: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

interface SessionState {
  status: SessionStatus;
  user: ListenerUser | null;
  setUser: (user: ListenerUser | null) => void;
  setStatus: (status: SessionStatus) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: getAccessToken() ? 'loading' : 'anonymous',
  user: null,
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'anonymous' }),
  setStatus: (status) => set({ status }),
  reset: () => {
    disconnectChatSocket();
    set({ user: null, status: 'anonymous' });
  },
}));

export async function loadProfile(): Promise<ListenerUser | null> {
  if (!getAccessToken()) {
    useSessionStore.getState().reset();
    return null;
  }
  try {
    const { data } = await apiClient.get<ListenerUser>('/auth/profile');
    useSessionStore.getState().setUser(data);
    return data;
  } catch {
    setAccessToken(null);
    useSessionStore.getState().reset();
    return null;
  }
}

export async function login(oneIdPin: string): Promise<ListenerUser> {
  const { data } = await apiClient.post<{ accessToken: string; user: ListenerUser }>('/auth', {
    oneIdPin,
  });
  setAccessToken(data.accessToken);
  useSessionStore.getState().setUser(data.user);
  return data.user;
}

export function logout(): void {
  setAccessToken(null);
  useSessionStore.getState().reset();
}
