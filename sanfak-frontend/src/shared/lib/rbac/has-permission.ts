export function permissionMatches(granted: string, required: string): boolean {
  if (granted === required) return true;
  if (granted === '*') return true;
  if (granted.endsWith(':*')) {
    const prefix = granted.slice(0, -1);
    return required.startsWith(prefix);
  }
  return false;
}

export function hasPermission(granted: Iterable<string>, required: string): boolean {
  for (const token of granted) {
    if (permissionMatches(token, required)) return true;
  }
  return false;
}

export function hasAnyPermission(granted: Iterable<string>, required: readonly string[]): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  return required.some((r) => hasPermission(set, r));
}

export function hasAllPermissions(granted: Iterable<string>, required: readonly string[]): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  return required.every((r) => hasPermission(set, r));
}
