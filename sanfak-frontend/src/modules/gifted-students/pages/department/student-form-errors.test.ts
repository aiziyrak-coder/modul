import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'StudentForm.tsx'),
  'utf8',
);

describe("D-52 — saqlash xatosi server matnini ko'rsatadi", () => {
  it('`onError` xato obyektini QABUL QILADI', () => {
    expect(src).toContain('const onError = (err: unknown) =>');
  });

  it('matn `getApiErrorMessage` dan olinadi', () => {
    expect(src).toContain("import { getApiErrorMessage } from '@/shared/api';");
    expect(src).toContain("getApiErrorMessage(err, 'Saqlashda xatolik')");
  });

  it("🔴 qotirilgan «ehtimol …» taxmini QAYTIB KELMAGAN", () => {
    expect(src).not.toContain('ehtimol bu talaba akkaunti');
  });

  it('xato toast QIZIL kanalda qoladi', () => {
    expect(src).toContain("'error')");
  });
});
