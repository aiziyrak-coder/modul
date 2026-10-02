import { lazy, Suspense, useMemo } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/widgets/app-layout';
import { useSessionStore, usePermission } from '@/app/session';
import { buildAppMenu } from '@/app/modules/build-menu';
import { ProtectedRoute } from './protected-route';
import { buildModuleRoutes } from './build-routes';
import { firstReachablePath } from './first-reachable-path';
import { PageLoader } from './page-loader';

const { publicRoutes, protectedRoutes } = buildModuleRoutes();

const LoginPage = lazy(() => import('@/app/auth/login-page'));
const ForbiddenPage = lazy(() =>
  import('@/app/errors').then((m) => ({ default: m.ForbiddenPage })),
);
const NotFoundPage = lazy(() => import('@/app/errors').then((m) => ({ default: m.NotFoundPage })));

const PRACTICE_ROLES = ['amaliyot_bolimi', 'rektor', 'tibbiyot_birlashmasi_rahbari', 'admin'];
const COUNCIL_ROLES = ['ilmiy_kengash_kotibi', 'ilmiy_kengash_azosi', 'rektor'];

function DefaultLanding() {
  const can = usePermission();
  const role = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const permissions = useSessionStore((s) => s.permissions);
  const { t } = useTranslation();

  const menuFallback = useMemo(
    () => firstReachablePath(buildAppMenu(permissions, t), ['admin']),
    [permissions, t],
  );

  if (can('dashboard:read')) return <Navigate to="/bosh-sahifa" replace />;

  if (can('user:create')) return <Navigate to="/admin/users" replace />;
  if (role && PRACTICE_ROLES.includes(role)) return <Navigate to="/amaliyot" replace />;
  if (role && COUNCIL_ROLES.includes(role)) return <Navigate to="/kengash" replace />;
  if (menuFallback) return <Navigate to={menuFallback} replace />;
  return <Navigate to="/403" replace />;
}

export function AppRouter() {
  return useRoutes([
    ...publicRoutes,
    {
      path: '/login',
      element: (
        <Suspense fallback={<PageLoader full />}>
          <LoginPage />
        </Suspense>
      ),
    },
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <DefaultLanding /> },
        ...protectedRoutes,
        {
          path: '403',
          element: (
            <Suspense fallback={<PageLoader />}>
              <ForbiddenPage />
            </Suspense>
          ),
        },
        {
          path: '*',
          element: (
            <Suspense fallback={<PageLoader />}>
              <NotFoundPage />
            </Suspense>
          ),
        },
      ],
    },
  ]);
}
