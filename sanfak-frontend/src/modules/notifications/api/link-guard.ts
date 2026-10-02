import { registeredModules } from '@/app/modules/registry';

type Repair = (path: string) => string | null | undefined;

const REPAIRS: readonly Repair[] = [
  (p) => (p === '/tasks' || p.startsWith('/tasks/') ? `/task-management${p}` : undefined),

  (p) => (p === '/shartnomalar' || p.startsWith('/shartnomalar/') ? `/amaliyot${p}` : undefined),

  (p) =>
    p === '/distributions' || p.startsWith('/distributions/') || p.startsWith('/distributions?')
      ? `/study-load${p}`
      : undefined,

  (p) => (p === '/profile/eri' ? null : undefined),
];

function applyRepairs(path: string): string | null {
  for (const repair of REPAIRS) {
    const result = repair(path);
    if (result !== undefined) return result;
  }
  return path;
}

let namespaceCache: Set<string> | null = null;

function getNamespaces(): Set<string> {
  if (!namespaceCache) {
    namespaceCache = new Set(registeredModules.map((m) => m.manifest.basePath ?? `/${m.folder}`));
  }
  return namespaceCache;
}

function isKnownNamespace(path: string): boolean {
  const first = `/${path.split('/')[1] ?? ''}`;
  return getNamespaces().has(first);
}

export function getSafeLink(
  rawLink: string | null,
  metadata: Record<string, unknown> | null,
): string | null {
  const metaLink = typeof metadata?.link === 'string' ? metadata.link : undefined;
  const raw = (rawLink ?? metaLink ?? '').trim();
  if (!raw) return null;

  if (raw.startsWith('//') || raw.startsWith('\\') || raw.startsWith('/\\')) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return null;
  if (!raw.startsWith('/')) return null;

  const repaired = applyRepairs(raw);
  if (repaired === null) return null;

  return isKnownNamespace(repaired) ? repaired : null;
}
