import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(join(__dirname, 'science-program-form-page.tsx'), 'utf8');

describe('science-program-form-page — formVersion create/update seam', () => {
  it('`createMutation.mutateAsync` chaqiruvlarida `formVersionParam` 3-argument sifatida uzatiladi', () => {
    const matches = SRC.match(
      /createMutation\.mutateAsync\(\s*toPayload\(values, findScience\(values\.science\), formVersionParam\),?\s*\)/g,
    );
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);
  });

  it('`updateMutation.mutateAsync` chaqiruvlarida `formVersion` UZATILMAYDI (regressiya qulfi — backend PUT rad etadi)', () => {
    const matches = SRC.match(
      /updateMutation\.mutateAsync\(toPayload\(values, findScience\(values\.science\)\)\)/g,
    );
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);

    const updateCallsWithFormVersion = SRC.match(
      /updateMutation\.mutateAsync\([^;]*formVersionParam[^;]*\)/g,
    );
    expect(updateCallsWithFormVersion).toBeNull();
  });

  it('`formVersionParam` faqat `?form=v142` bo’lganda `\'v142\'`, aks holda `undefined` (v259 default, legacy-xavfsiz)', () => {
    expect(SRC).toMatch(
      /formVersionParam = searchParams\.get\('form'\) === 'v142' \? 'v142' : undefined/,
    );
  });

  it('`toPayload` faqat `formVersion` berilganda uni payload’ga qo’shadi (spread, undefined bo’lsa yo’q)', () => {
    expect(SRC).toMatch(/\.\.\.\(formVersion \? \{ formVersion \} : \{\}\)/);
  });

  it('skaner haqiqatan ishlaydi (o`z-o`zini tekshirish)', () => {
    const buzilgan = SRC.replace(/formVersionParam/g, 'NOOP');
    expect(buzilgan).not.toMatch(
      /createMutation\.mutateAsync\(\s*toPayload\(values, findScience\(values\.science\), formVersionParam\),?\s*\)/,
    );
  });
});
