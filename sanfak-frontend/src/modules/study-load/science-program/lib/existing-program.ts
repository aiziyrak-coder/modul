import type { ScienceOption, ScienceProgramStatus } from '../model/types';

export interface ExistingProgramInfo {
  programId: string;
  programStatus: ScienceProgramStatus | null;
  programCode: string | null;
  scienceName: string;
}

export function findExistingProgram(
  scienceOptions: ScienceOption[],
  scienceId: string | null | undefined,
  currentProgramId?: string | null,
): ExistingProgramInfo | null {
  if (!scienceId) return null;
  const option = scienceOptions.find((s) => s.id === scienceId);
  if (!option || !option.programExists || !option.programId) return null;
  if (currentProgramId && option.programId === currentProgramId) return null;
  return {
    programId: option.programId,
    programStatus: option.programStatus ?? null,
    programCode: option.programCode ?? null,
    scienceName: option.name,
  };
}
