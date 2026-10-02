import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Review.tsx'),
  'utf8',
);

describe('D-73 — shaxsiy hujjatda ball sukuti', () => {
  it('"shaxsiy turdami" savoli yutuqning `documentType` si bo\'yicha hal qilinadi', () => {
    expect(src).toContain(
      "docTypes.find((d) => d.id === approveModal.criteriaId)?.personal === true",
    );
  });

  it('kategoriya tanlansa katalog bali EMAS, 0 to\'ladi', () => {
    expect(src).toContain("if (cat) setApproveScore(approvingPersonal ? '0' : String(cat.points));");
  });

  it('mezon tanlansa ham 0 to\'ladi (kategoriyasiz mezon yo\'li)', () => {
    expect(src).toContain("setApproveScore(approvingPersonal ? '0' : prefill);");
  });

  it('🔴 QULF QO\'YILMAGAN — maydon tahrirlanadi', () => {
    const field = src.slice(src.indexOf('<NumberField'), src.indexOf('placeholder="Ball kiriting"'));
    expect(field).not.toContain('disabled');
    expect(field).not.toContain('readOnly');
  });

  it('sababi EKRANDA aytiladi', () => {
    expect(src).toContain('{approvingPersonal && (');
    expect(src).toContain('<HintPersonal>');
    expect(src).toContain('const HintPersonal = styled(Hint)');
    expect(src).toContain('theme.colors.warning');
  });
});
