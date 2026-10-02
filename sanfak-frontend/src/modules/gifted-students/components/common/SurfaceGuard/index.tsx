import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@/app/session';
import { surfaceFromPermissions } from '../../../lib/role-surface';
import { SURFACE_HOME } from '../../../lib/menu-surface';

export default function SurfaceGuard({ children }: { children: ReactNode }) {
  const permissions = useSessionStore((s) => s.permissions);
  const { pathname } = useLocation();
  const surface = surfaceFromPermissions(permissions);

  if (!surface) return <>{children}</>;

  const isStudentPath = pathname.startsWith('/gifted-students/student/');

  if (surface === 'student' && !isStudentPath) {
    return <Navigate to={SURFACE_HOME.student} replace />;
  }
  if (surface !== 'student' && isStudentPath) {
    return <Navigate to={SURFACE_HOME[surface]} replace />;
  }
  return <>{children}</>;
}
