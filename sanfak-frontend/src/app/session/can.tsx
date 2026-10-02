import type { ReactNode } from 'react';
import { usePermission } from './session-store';

interface CanProps {
  perform: string | string[];
  mode?: 'any' | 'all';
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ perform, mode = 'any', fallback = null, children }: CanProps) {
  const can = usePermission();
  const allowed = Array.isArray(perform)
    ? mode === 'all'
      ? can.all(perform)
      : can.any(perform)
    : can(perform);
  return <>{allowed ? children : fallback}</>;
}
