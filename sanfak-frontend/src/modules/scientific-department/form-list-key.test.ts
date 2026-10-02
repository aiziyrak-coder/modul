import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const stripComments = (src: string) =>
  src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

describe('Form.List — `key` spread qilinmaydi', () => {
  it('`{...field}` ishlatgan fayl `key` ni AJRATIB oladi', () => {
    const offenders: string[] = [];
    let spreads = 0;

    for (const [path, raw] of Object.entries(sources)) {
      const src = stripComments(raw);
      if (!src.includes('{...field}')) continue;
      spreads += 1;
      const safe = /fields\.map\(\(\{\s*key\s*,[^}]*\.\.\.field\s*\}\)/.test(src);
      const unsafe = /fields\.map\(\(field\)/.test(src);
      if (!safe || unsafe) offenders.push(path);
    }

    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(spreads).toBeGreaterThanOrEqual(1);
    expect(offenders).toEqual([]);
  });
});
