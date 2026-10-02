import { describe, expect, it } from 'vitest';
import { getSafeLink } from './link-guard';

describe('getSafeLink — stage 1: protocol/host rejection', () => {
  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>1</script>'],
    ['https://evil.example/phish'],
    ['//evil.example/phish'],
    ['\\\\evil.example'],
    ['/\\evil.example'],
  ])('%s → null', (raw) => {
    expect(getSafeLink(raw, null)).toBeNull();
  });

  it('bo\'sh yoki null → null', () => {
    expect(getSafeLink(null, null)).toBeNull();
    expect(getSafeLink('', null)).toBeNull();
    expect(getSafeLink('   ', null)).toBeNull();
  });

  it('nisbiy yo\'l (/ bilan boshlanmagan) — global feedda ma\'nosiz → null', () => {
    expect(getSafeLink('elonlar/5', null)).toBeNull();
  });
});

describe('getSafeLink — stage 2: idempotent basePath repair', () => {
  it('/tasks/:id → /task-management/tasks/:id', () => {
    expect(getSafeLink('/tasks/123', null)).toBe('/task-management/tasks/123');
  });

  it('/shartnomalar/:id → /amaliyot/shartnomalar/:id', () => {
    expect(getSafeLink('/shartnomalar/45', null)).toBe('/amaliyot/shartnomalar/45');
  });

  it('/distributions/:id → /study-load/distributions/:id', () => {
    expect(getSafeLink('/distributions/9', null)).toBe('/study-load/distributions/9');
  });

  it('/distributions?query — query string saqlanadi', () => {
    expect(getSafeLink('/distributions?needsRecalculation=true', null)).toBe(
      '/study-load/distributions?needsRecalculation=true',
    );
  });

  it('/profile/eri — FE route yo\'q, taxminiy yo\'naltirish QILINMAYDI → null', () => {
    expect(getSafeLink('/profile/eri', null)).toBeNull();
  });

  it('idempotent: ikki marta chaqirilganda natija o\'zgarmaydi', () => {
    const once = getSafeLink('/tasks/123', null);
    expect(once).not.toBeNull();
    const twice = getSafeLink(once, null);
    expect(twice).toBe(once);

    const onceQ = getSafeLink('/distributions?needsRecalculation=true', null);
    const twiceQ = getSafeLink(onceQ, null);
    expect(twiceQ).toBe(onceQ);
  });
});

describe('getSafeLink — stage 3: namespace validation', () => {
  it('ro\'yxatdan o\'tgan namespace (/kengash) — o\'zgarishsiz qaytadi', () => {
    expect(getSafeLink('/kengash/elonlar', null)).toBe('/kengash/elonlar');
  });

  it('ro\'yxatdan o\'tmagan namespace — HAR QANDAY kelajakdagi noto\'g\'ri link ham null bo\'ladi', () => {
    expect(getSafeLink('/comments/5', null)).toBeNull();
    expect(getSafeLink('/this-module-does-not-exist', null)).toBeNull();
  });
});

describe('getSafeLink — metadata.link fallback', () => {
  it('rawLink yo\'q bo\'lsa metadata.link ishlatiladi', () => {
    expect(getSafeLink(null, { link: '/kengash/topshiriqlar' })).toBe('/kengash/topshiriqlar');
  });

  it('rawLink BOR bo\'lsa metadata.link e\'tiborga olinmaydi (rawLink ustuvor)', () => {
    expect(getSafeLink('/kengash/elonlar', { link: 'javascript:alert(1)' })).toBe(
      '/kengash/elonlar',
    );
  });
});
