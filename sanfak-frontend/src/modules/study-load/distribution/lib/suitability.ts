import { AxiosError } from 'axios';

export type SuitabilityFlag = 'match' | 'crossDepartment' | 'unknown';

export interface SuitabilityInput {
  teacherDepartmentId: string | null;
  scienceDepartmentId: string | null;
}

export function evaluateSuitability({
  teacherDepartmentId,
  scienceDepartmentId,
}: SuitabilityInput): SuitabilityFlag {
  if (!teacherDepartmentId || !scienceDepartmentId) return 'unknown';
  return teacherDepartmentId === scienceDepartmentId ? 'match' : 'crossDepartment';
}

export function requiresJustificationForEntry(
  blocks: Array<{ workloadBlockId: string | null }>,
  teacherDepartmentId: string | null,
  scienceDeptByWorkloadBlockId: Map<string, string | null>,
): boolean {
  return blocks.some((b) => {
    if (!b.workloadBlockId) return false;
    const scienceDepartmentId = scienceDeptByWorkloadBlockId.get(b.workloadBlockId) ?? null;
    return evaluateSuitability({ teacherDepartmentId, scienceDepartmentId }) === 'crossDepartment';
  });
}

export const ASSIGNMENT_BASES = [
  'kafedrada_mutaxassis_yoq',
  'ish_tajribasi',
  'oqigan_fani_yaqin',
  'sertifikat_malaka',
  'ilmiy_ishlar',
  'boshqa',
] as const;

export type AssignmentBasis = (typeof ASSIGNMENT_BASES)[number];

export const ASSIGNMENT_BASIS_LABEL_KEYS: Record<AssignmentBasis, string> = {
  kafedrada_mutaxassis_yoq: 'studyLoad.distribution.suitability.basis.kafedradaMutaxassisYoq',
  ish_tajribasi: 'studyLoad.distribution.suitability.basis.ishTajribasi',
  oqigan_fani_yaqin: 'studyLoad.distribution.suitability.basis.oqiganFaniYaqin',
  sertifikat_malaka: 'studyLoad.distribution.suitability.basis.sertifikatMalaka',
  ilmiy_ishlar: 'studyLoad.distribution.suitability.basis.ilmiyIshlar',
  boshqa: 'studyLoad.distribution.suitability.basis.boshqa',
};

export function justificationNoteMinLength(basis: AssignmentBasis | '' | null): number {
  return basis === 'boshqa' ? 30 : 10;
}

export interface BlockJustification {
  basis: AssignmentBasis | null;
  note: string | null;
  declaredBy: string | null;
  declaredAt: string | null;
}

export interface JustificationFields {
  suitabilityBasis: AssignmentBasis;
  suitabilityNote: string;
}

export function buildJustificationPayload(
  basis: AssignmentBasis | '' | null | undefined,
  note: string,
): Partial<JustificationFields> {
  if (!basis) return {};
  return { suitabilityBasis: basis, suitabilityNote: note.trim() };
}

export interface SuitabilityBasisRequiredError {
  blockIds: string[];
}

export function parseSuitabilityBasisError(error: unknown): SuitabilityBasisRequiredError | null {
  if (!(error instanceof AxiosError)) return null;
  const data = error.response?.data as { code?: string; blockIds?: unknown } | undefined;
  if (data?.code !== 'SUITABILITY_BASIS_REQUIRED') return null;
  const blockIds = Array.isArray(data.blockIds)
    ? data.blockIds.filter((x): x is string => typeof x === 'string')
    : [];
  return { blockIds };
}

export function formatJustificationTooltip(
  t: (key: string, options?: Record<string, unknown>) => string,
  justification: BlockJustification | null | undefined,
): string {
  if (!justification?.basis) {
    return t('studyLoad.distribution.suitability.undeclaredHint');
  }
  const basisLabel = t(ASSIGNMENT_BASIS_LABEL_KEYS[justification.basis]);
  const declaredDate = formatDeclaredAt(justification.declaredAt);
  const who = [justification.declaredBy, declaredDate].filter(Boolean).join(', ');
  return [basisLabel, justification.note, who || null].filter(Boolean).join(' · ');
}

function formatDeclaredAt(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('uz-UZ');
}

export interface SuitabilityWarningEntry {
  type: string;
  severity: 'warning';
  teacherEntryId: string;
  blockId: string;
  flag: string;
  declared: boolean;
  basis: string | null;
}

export function buildSuitabilityWarningMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  warnings: SuitabilityWarningEntry[] | undefined,
): string | null {
  if (!warnings?.length) return null;
  const undeclaredCount = warnings.filter((w) => !w.declared).length;
  return t('studyLoad.distribution.suitabilityWarning', {
    count: warnings.length,
    undeclaredCount,
  });
}
