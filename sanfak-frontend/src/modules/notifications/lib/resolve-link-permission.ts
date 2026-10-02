import { registeredModules } from '@/app/modules/registry';
import type { ModuleRouteNode } from '@/shared/lib/module';

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function matchSpecificity(routeSegments: string[], pathSegments: string[]): number | null {
  if (routeSegments.length !== pathSegments.length) return null;
  let literalCount = 0;
  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSeg = routeSegments[i] ?? '';
    if (routeSeg.startsWith(':')) continue;
    if (routeSeg !== pathSegments[i]) return null;
    literalCount += 1;
  }
  return literalCount;
}

function bestMatch(routes: readonly ModuleRouteNode[], remaining: string[]): ModuleRouteNode | null {
  let best: ModuleRouteNode | null = null;
  let bestScore = -1;
  for (const route of routes) {
    if (!route.path && !route.index) continue;
    const routeSegments = route.path ? segmentsOf(route.path) : [];
    const score = matchSpecificity(routeSegments, remaining);
    if (score !== null && score > bestScore) {
      best = route;
      bestScore = score;
    }
  }
  return best;
}

export function resolveLinkPermission(link: string | null): string | null {
  if (!link) return null;
  const pathOnly = link.split('?')[0] ?? link;
  const segments = segmentsOf(pathOnly);
  if (segments.length === 0) return null;

  for (const mod of registeredModules) {
    const basePath = mod.manifest.basePath ?? `/${mod.folder}`;
    const baseSegments = segmentsOf(basePath);
    if (baseSegments.length > segments.length) continue;
    const isPrefix = baseSegments.every((seg, i) => seg === segments[i]);
    if (!isPrefix) continue;

    const remaining = segments.slice(baseSegments.length);
    const route = bestMatch(mod.manifest.routes, remaining);
    if (!route) return null;
    return route.public ? null : (route.permission ?? null);
  }

  return null;
}
