export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roles: Array<{ id: string; name: string }>;
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  permissions: string[];
}
