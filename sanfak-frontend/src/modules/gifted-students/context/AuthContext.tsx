import { useLocation } from 'react-router-dom';
import type { MockUser, Role } from '../data/types';
import { useProfile, useMyGiftedProfile } from '../api/gifted-api';
import { nameOf } from '../api/user-name';
import { surfaceFromPermissions } from '../lib/role-surface';

const ROLES: readonly Role[] = ['student', 'department', 'management', 'judge', 'advisor'];

function roleFromPath(pathname: string): Role {
  const seg = pathname.split('/').filter(Boolean);
  const idx = seg.indexOf('gifted-students');
  const candidate = idx >= 0 ? seg[idx + 1] : seg[0];
  return (ROLES as readonly string[]).includes(candidate ?? '')
    ? (candidate as Role)
    : 'student';
}

export function useAuth(): { user: MockUser; login: (role: Role) => void; logout: () => void } {
  const { pathname } = useLocation();
  const { data: profile } = useProfile();
  const role: Role = surfaceFromPermissions(profile?.role?.permissions) ?? roleFromPath(pathname);
  const { data: myGifted } = useMyGiftedProfile(role === 'student');

  const fullName = nameOf(profile) ?? '';
  const user: MockUser = {
    id: profile?._id ?? '',
    role,
    name: fullName || (profile?.role?.title ?? ''),
    avatar: profile?.photo ?? null,
    position: profile?.position || profile?.role?.title || undefined,
    faculty: myGifted?.faculty,
    direction: myGifted?.direction,
    course: myGifted?.course,
    group: myGifted?.group,
    email: profile?.email ?? myGifted?.email,
    phone: profile?.phone ?? myGifted?.phone,
    advisorId: myGifted?.advisorId,
  };

  return { user, login: () => {}, logout: () => {} };
}
