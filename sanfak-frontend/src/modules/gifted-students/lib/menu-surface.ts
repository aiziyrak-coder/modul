import { useSessionStore } from '@/app/session';
import type { Role } from '../data/types';
import { surfaceFromPermissions } from './role-surface';

export const MENU_SURFACES: Record<string, readonly Role[]> = {
  '/gifted-students/student/activities': ['student'],
  '/gifted-students/student/scholarships': ['student'],
  '/gifted-students/student/scholarships/nomdor': ['student'],
  '/gifted-students/student/scholarships/rektor': ['student'],
  '/gifted-students/student/advisor': ['student'],
  '/gifted-students/student/profile': ['student'],

  '/gifted-students/department/students': ['department'],
  '/gifted-students/department/scholarships': ['department'],
  '/gifted-students/department/scholarships/nomdor': ['department'],
  '/gifted-students/department/scholarships/rektor': ['department'],
  '/gifted-students/department/review': ['department'],
  '/gifted-students/department/criteria': ['department'],

  '/gifted-students/management/reports': ['department', 'management'],

  '/gifted-students/judge/scholarships': ['judge'],
  '/gifted-students/advisor/student': ['advisor'],
};

export const SURFACE_HOME: Record<Role, string> = {
  student: '/gifted-students/student/activities',
  department: '/gifted-students/department/students',
  management: '/gifted-students/management/reports',
  judge: '/gifted-students/judge/scholarships',
  advisor: '/gifted-students/advisor/student',
};

interface PathItem {
  path: string;
}

export function menuForSurface<T extends PathItem>(items: readonly T[], surface: Role | null): T[] {
  if (!surface) return [...items];
  return items.filter((item) => {
    const allowed = MENU_SURFACES[item.path];
    return !allowed || allowed.includes(surface);
  });
}

export function currentSurface(): Role | null {
  return surfaceFromPermissions(useSessionStore.getState().permissions);
}
