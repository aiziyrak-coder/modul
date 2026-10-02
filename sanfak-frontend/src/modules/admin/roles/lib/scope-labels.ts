import type { ScopeLevel } from '../model/types';

export const SCOPE_LEVEL_OPTION_DEFS: Array<{ value: ScopeLevel; labelKey: string; hintKey: string }> = [
  { value: 'self', labelKey: 'admin.role.scope.self.label', hintKey: 'admin.role.scope.self.hint' },
  { value: 'department', labelKey: 'admin.role.scope.department.label', hintKey: 'admin.role.scope.department.hint' },
  { value: 'faculty', labelKey: 'admin.role.scope.faculty.label', hintKey: 'admin.role.scope.faculty.hint' },
  { value: 'global', labelKey: 'admin.role.scope.global.label', hintKey: 'admin.role.scope.global.hint' },
];

const SCOPE_LEVEL_LABEL_KEYS: Record<ScopeLevel, string> = SCOPE_LEVEL_OPTION_DEFS.reduce(
  (acc, o) => {
    acc[o.value] = o.labelKey;
    return acc;
  },
  {} as Record<ScopeLevel, string>,
);

export function scopeLevelLabelKey(v: ScopeLevel | string): string {
  return SCOPE_LEVEL_LABEL_KEYS[v as ScopeLevel] ?? v;
}
