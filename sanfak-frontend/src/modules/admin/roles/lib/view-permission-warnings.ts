import type { PermissionSection } from '../model/types';
import type { SelectedMap } from './permission-counts';

export type ViewWarningKind = 'missingReadAll' | 'missingRead';

export type ViewWarningSeverity = 'blocking' | 'info';

export interface SectionViewWarning {
  section: string;
  sectionTitle: string;
  kind: ViewWarningKind;
  severity: ViewWarningSeverity;
}

export const VIEW_WARNING_MESSAGE_KEYS: Record<ViewWarningKind, string> = {
  missingReadAll: 'admin.role.warning.missingReadAll',
  missingRead: 'admin.role.warning.missingRead',
};

export const VIEW_WARNING_ACTION_KEYS: Record<ViewWarningKind, string> = {
  missingReadAll: 'readAll',
  missingRead: 'read',
};

export function sectionViewWarning(
  section: PermissionSection,
  selectedMap: SelectedMap,
): SectionViewWarning | null {
  const selected = selectedMap[section.section];
  if (!selected || selected.size === 0) return null;

  const hasRead = selected.has('read');
  const hasReadAll = selected.has('readAll');
  const sectionTitle = section.title ?? section.section;

  if (hasRead && !hasReadAll && section.actionKeys.includes('readAll')) {
    return {
      section: section.section,
      sectionTitle,
      kind: 'missingReadAll',
      severity: 'blocking',
    };
  }
  if (hasReadAll && !hasRead && section.actionKeys.includes('read')) {
    return {
      section: section.section,
      sectionTitle,
      kind: 'missingRead',
      severity: 'info',
    };
  }
  return null;
}

export function findViewPermissionWarnings(
  sections: PermissionSection[],
  selectedMap: SelectedMap,
): SectionViewWarning[] {
  const warnings: SectionViewWarning[] = [];
  for (const sec of sections) {
    const w = sectionViewWarning(sec, selectedMap);
    if (w) warnings.push(w);
  }
  return warnings;
}
