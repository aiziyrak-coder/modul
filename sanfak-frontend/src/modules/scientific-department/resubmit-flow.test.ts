import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const filesWith = (needle: string) =>
  Object.entries(sources)
    .filter(([, src]) => src.includes(needle))
    .map(([path]) => path)
    .sort();

describe('qayta yuborish oqimi (detal → ro`yxat)', () => {
  it('har bir yuboruvchi detal sahifaga bitta qabul qiluvchi ro`yxat sahifasi mos keladi', () => {
    const producers = filesWith('state: { resubmit:');
    const consumers = filesWith('resubmit?:');

    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(producers.length).toBeGreaterThanOrEqual(4);

    expect(
      consumers.length,
      `Yuboruvchilar (${producers.length}): ${producers.join(', ')}\n` +
        `Qabul qiluvchilar (${consumers.length}): ${consumers.join(', ')}`,
    ).toBe(producers.length);
  });

  it('qayta yuborish tugmalari rangni inline override qilmaydi', () => {
    const BARE_ICON = 'icon={<ReloadOutlined />}';
    const offenders: string[] = [];
    let found = 0;

    for (const [path, src] of Object.entries(sources)) {
      let at = src.indexOf(BARE_ICON);
      while (at !== -1) {
        found += 1;
        const start = src.lastIndexOf('<Button', at);
        const end = src.indexOf('\n', src.indexOf('style=', at));
        const props = src
          .slice(start, end === -1 ? at + 200 : end)
          .split('\n')
          .filter((line) => !line.trim().startsWith('//'))
          .join('\n');
        if (/(background|color):\s*'var\(/.test(props)) offenders.push(path);
        at = src.indexOf(BARE_ICON, at + 1);
      }
    }

    expect(found).toBeGreaterThanOrEqual(6);
    expect(offenders).toEqual([]);
  });

  it.each([
    {
      entity: 'tezis',
      detail: './pages/thesis-detail/index.tsx',
      list: './pages/theses/index.tsx',
      route: '/scientific-department/theses',
      stateVar: 'state: { resubmit: thesis }',
      permission: "can('thesis:update')",
      type: 'resubmit?: Thesis',
    },
    {
      entity: 'maqola',
      detail: './pages/article-detail/index.tsx',
      list: './pages/articles/index.tsx',
      route: '/scientific-department/articles',
      stateVar: 'state: { resubmit: article }',
      permission: "can('article:update')",
      type: 'resubmit?: Article',
    },
  ])('$entity oqimi ulangan (detal tugmasi + ro`yxat qabul qiluvchisi)', (c) => {
    const detail = sources[c.detail];
    const list = sources[c.list];

    expect(detail, `${c.detail} topilmadi`).toBeDefined();
    expect(list, `${c.list} topilmadi`).toBeDefined();

    expect(detail).toContain(`navigate('${c.route}'`);
    expect(detail).toContain(c.stateVar);
    expect(detail).toContain(c.permission);

    expect(list).toContain(c.type);
    expect(list).toContain('openEdit(resubmit)');
    expect(list).toContain('state: null');
  });
});
