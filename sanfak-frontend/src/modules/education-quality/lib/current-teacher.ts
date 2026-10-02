import { useSessionStore } from '@/app/session';

const DEV_PLACEHOLDER_ID = 'dev-user';

export function getCurrentTeacherId(): string | undefined {
  const user = useSessionStore.getState().user;
  if (!user || user.id === DEV_PLACEHOLDER_ID) return undefined;
  return user.id;
}
