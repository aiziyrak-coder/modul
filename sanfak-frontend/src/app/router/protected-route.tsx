import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermission, useSessionStore } from '@/app/session';
import { PageLoader } from './page-loader';

interface ProtectedRouteProps {
  permission?: string;
  children: ReactNode;
}

export function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const status = useSessionStore((s) => s.status);
  const can = usePermission();

  if (status === 'loading') return <PageLoader full />;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  if (permission && !can(permission)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}
