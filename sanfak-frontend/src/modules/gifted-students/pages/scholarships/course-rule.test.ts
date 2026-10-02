import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const byCategory = readFileSync(join(here, 'ScholarshipsByCategory.tsx'), 'utf8');
const nomdorForm = readFileSync(join(here, 'NomdorForm.tsx'), 'utf8');

const HINT =
  "Tanlangan kurslardagi talabalargina bu stipendiyani ko'radi. Bo'sh qolsa — hamma kurs.";

describe('D-64 — kurs tanlash uchala yo\'lda IXTIYORIY', () => {
  it('🔴 qo\'shish modali kursni endi TALAB QILMAYDI', () => {
    expect(byCategory).not.toContain('form.allowedCourses.length > 0');
    expect(byCategory).toContain(
      "const isValid = !!(form.name.trim() && form.amount.trim() && form.deadline);",
    );
  });

  it('uch qoida bir xil shaklda yozilgan', () => {
    expect(byCategory).toContain(
      'const isEditValid = !!(editForm.name.trim() && editForm.amount.trim() && editForm.deadline);',
    );
    expect(nomdorForm).toContain(
      'const isValid = !!(form.name.trim() && form.amount.trim() && form.deadline);',
    );
  });

  it('yulduzcha (majburiylik belgisi) qolmagan', () => {
    expect(byCategory).not.toContain('Kim ariza topshira oladi (kurslar) *');
  });

  it('«bo\'sh = hamma kurs» semantikasi UCHALA ekranda AYTILGAN', () => {
    expect(byCategory.split(HINT).length - 1).toBe(2);
    expect(nomdorForm).toContain(HINT);
  });

  it('yorliq matni ikkala yo\'lda bir xil', () => {
    expect(byCategory).toContain('Kim ariza topshira oladi (kurslar)');
    expect(nomdorForm).toContain('Kim ariza topshira oladi (kurslar)');
  });
});
