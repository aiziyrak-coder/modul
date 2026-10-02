import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'ScholarshipDetail.tsx'), 'utf8');

describe('D-70 — yakunlangan baholash TUZATILADI', () => {
  it('jadval tanlovi `showFinal` ga bog\'langan, `allJudgesScored` ga EMAS', () => {
    expect(src).toContain('const showFinal = allJudgesScored && !correcting;');
    expect(src).toContain('{showFinal ? (');
  });

  it('«Ballarimni tuzatish» yo\'li BOR va u `allJudgesScored` da ko\'rinadi', () => {
    expect(src).toContain("{correcting ? 'Yakuniy natijalarga qaytish' : 'Ballarimni tuzatish'}");
    expect(src).toContain('{allJudgesScored && (');
  });

  it('tuzatish rejimida IZ qolishi aytiladi', () => {
    expect(src).toContain('<CorrectionNote>');
    expect(src).toContain('tarixga yoziladi');
  });

  it('🔴 hook erta `return` lardan OLDIN e\'lon qilingan (Rules of Hooks)', () => {
    const hookAt = src.indexOf('const [correcting, setCorrecting] = useState(false);');
    const firstReturn = src.indexOf('if (isLoading) return');
    expect(hookAt).toBeGreaterThan(-1);
    expect(firstReturn).toBeGreaterThan(-1);
    expect(hookAt).toBeLessThan(firstReturn);
  });
});
