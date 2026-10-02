import { describe, it, expect } from 'vitest';
import { safeExternalLink } from './safe-link';

describe('ruxsat etiladi', () => {
  it.each([
    'https://example.com/a',
    'http://fjsti.uz/maqola?id=1',
    'https://doi.org/10.1000/182#bo‘lim',
    'HTTPS://EXAMPLE.COM',
  ])('%s', (link) => {
    expect(safeExternalLink(link)).toBe(link);
  });

  it('atrofdagi bo‘shliq tozalanadi', () => {
    expect(safeExternalLink('  https://e.uz  ')).toBe('https://e.uz');
  });
});

describe('rad etiladi', () => {
  it('🔴 `javascript:` — jonli o‘lchangan holat', () => {
    expect(safeExternalLink('javascript:alert(1)')).toBeNull();
  });

  it('🔴 harf registri bilan yashiringan `javascript:`', () => {
    expect(safeExternalLink('JaVaScRiPt:alert(1)')).toBeNull();
  });

  it('🔴 bo‘shliq bilan yashiringan `javascript:`', () => {
    expect(safeExternalLink('  javascript:alert(1)')).toBeNull();
  });

  it.each([
    ['data:', 'data:text/html,<script>1</script>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['file:', 'file:///C:/Windows/win.ini'],
    ['mailto:', 'mailto:a@b.uz'],
    ['tel:', 'tel:+998901234567'],
  ])('%s rad etiladi', (_nom, link) => {
    expect(safeExternalLink(link)).toBeNull();
  });

  it('sxemasiz matn rad etiladi (nisbiy havola kutilmaydi)', () => {
    expect(safeExternalLink('abc')).toBeNull();
    expect(safeExternalLink('/gifted-students/student/activities')).toBeNull();
    expect(safeExternalLink('example.com')).toBeNull();
  });
});

describe('bo‘sh qiymatlar', () => {
  it.each([null, undefined, '', '   '])('%s → null', (v) => {
    expect(safeExternalLink(v as string | null | undefined)).toBeNull();
  });
});
