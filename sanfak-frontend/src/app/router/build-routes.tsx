import { Suspense, type ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { ModuleRouteNode } from '@/shared/lib/module';
import { registeredModules } from '@/app/modules/registry';
import { ProtectedRoute } from './protected-route';
import { RouteErrorBoundary } from './route-error-boundary';
import { PageLoader } from './page-loader';

function wrapProtected(Element: ComponentType, permission?: string) {
  return (
    <ProtectedRoute permission={permission}>
      <RouteErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Element />
        </Suspense>
      </RouteErrorBoundary>
    </ProtectedRoute>
  );
}

function wrapPublic(Element: ComponentType) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageLoader full />}>
        <Element />
      </Suspense>
    </RouteErrorBoundary>
  );
}

function toProtectedChild(node: ModuleRouteNode): RouteObject {
  const element = wrapProtected(node.element, node.permission);
  return node.index ? { index: true, element } : { path: node.path, element };
}

function joinPath(basePath: string, node: ModuleRouteNode): string {
  const left = basePath.replace(/^\/+|\/+$/g, '');
  const right = node.index ? '' : (node.path ?? '').replace(/^\/+/, '');
  return '/' + [left, right].filter(Boolean).join('/');
}

interface RouteBundle {
  publicRoutes: RouteObject[];
  protectedRoutes: RouteObject[];
}

export function buildModuleRoutes(): RouteBundle {
  const publicRoutes: RouteObject[] = [];
  const protectedRoutes: RouteObject[] = [];

  for (const { folder, manifest } of registeredModules) {
    const namespace = (manifest.basePath ?? `/${folder}`).replace(/^\/+/, '');

    const publicChildren = manifest.routes.filter((r) => r.public);
    const protectedChildren = manifest.routes.filter((r) => !r.public);

    for (const node of publicChildren) {
      publicRoutes.push({
        path: joinPath(namespace, node),
        element: wrapPublic(node.element),
      });
    }

    if (protectedChildren.length > 0) {
      protectedRoutes.push({
        path: namespace,
        children: protectedChildren.map(toProtectedChild),
      });
    }
  }

  return { publicRoutes, protectedRoutes };
}
