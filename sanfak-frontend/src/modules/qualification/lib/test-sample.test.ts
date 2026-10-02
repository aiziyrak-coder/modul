import { describe, expect, it } from 'vitest';
import { SAMPLE_TXT } from './test-sample';

const blocks = SAMPLE_TXT.replace(/\r\n?/g, '\n')
  .split(/\n[ \t]*\n/)
  .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
  .filter((b) => b.length);

describe('test namunasi', () => {
  it('uchta savol bloki bor', () => {
    expect(blocks).toHaveLength(3);
  });

  it.each(blocks.map((b, i) => [i + 1, b] as const))(
    '%i-blok: savol + kamida 2 variant + kamida 1 to\'g\'ri javob',
    (_i, lines) => {
      const question = lines.filter((l) => l[0] !== '+' && l[0] !== '-');
      const opts = lines.filter((l) => l[0] === '+' || l[0] === '-');
      const correct = lines.filter((l) => l[0] === '+');
      expect(question).toHaveLength(1);
      expect(question[0]!.length).toBeGreaterThan(5);
      expect(opts.length).toBeGreaterThanOrEqual(2);
      expect(correct.length).toBeGreaterThanOrEqual(1);
      opts.forEach((o) => expect(o.slice(1).trim().length).toBeGreaterThan(0));
    },
  );

  it("ko'p javobli savol ham bor (2 ta '+')", () => {
    const multi = blocks.filter((b) => b.filter((l) => l[0] === '+').length > 1);
    expect(multi).toHaveLength(1);
  });

  it('qatorlar CRLF bilan ajratilgan (Windows Notepad uchun)', () => {
    expect(SAMPLE_TXT).toContain('\r\n');
  });
});
