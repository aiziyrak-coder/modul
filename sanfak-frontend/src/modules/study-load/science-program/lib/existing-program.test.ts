import { describe, expect, it } from 'vitest';
import type { ScienceOption } from '../model/types';
import { findExistingProgram } from './existing-program';

const option = (overrides: Partial<ScienceOption> = {}): ScienceOption => ({
  id: 'sci-1',
  name: 'Mikrobiologiya, virusologiya, immunologiya 1,2',
  code: 'MVI11104',
  academicYear: 'ay-1',
  semester: '1',
  programExists: true,
  programId: 'sp-1',
  programStatus: 'approved',
  programCode: 'FA120',
  assignedHours: null,
  ...overrides,
});

describe('findExistingProgram', () => {
  it('fan tanlanmagan yoki option topilmasa → null', () => {
    expect(findExistingProgram([option()], null)).toBeNull();
    expect(findExistingProgram([option()], '')).toBeNull();
    expect(findExistingProgram([option()], 'sci-999')).toBeNull();
  });

  it('dastur yo\'q (programExists=false yoki programId=null) → null', () => {
    expect(findExistingProgram([option({ programExists: false })], 'sci-1')).toBeNull();
    expect(findExistingProgram([option({ programId: null })], 'sci-1')).toBeNull();
  });

  it('dastur bor → id/status/kod/fan nomi qaytadi', () => {
    expect(findExistingProgram([option()], 'sci-1')).toEqual({
      programId: 'sp-1',
      programStatus: 'approved',
      programCode: 'FA120',
      scienceName: 'Mikrobiologiya, virusologiya, immunologiya 1,2',
    });
  });

  it('tahrir rejimida O\'Z hujjati (programId === currentProgramId) → null', () => {
    expect(findExistingProgram([option()], 'sci-1', 'sp-1')).toBeNull();
    expect(findExistingProgram([option()], 'sci-1', 'sp-2')).not.toBeNull();
  });

  it('status/kod yo\'q bo\'lsa null bilan qaytadi (UI «—» ko\'rsatadi)', () => {
    expect(
      findExistingProgram([option({ programStatus: null, programCode: null })], 'sci-1'),
    ).toEqual({
      programId: 'sp-1',
      programStatus: null,
      programCode: null,
      scienceName: 'Mikrobiologiya, virusologiya, immunologiya 1,2',
    });
  });
});
