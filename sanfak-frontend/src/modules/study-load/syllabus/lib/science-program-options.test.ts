import { describe, expect, it } from 'vitest';
import { buildScienceProgramOptions } from './science-program-options';
import {
  mapScienceProgram,
  type BackendScienceProgramListItem,
} from '../../science-program/api/mapper';

describe('buildScienceProgramOptions — ADR-011 v142 darvozasi', () => {
  it("v142 dasturi RO'YXATDA qoladi, lekin disabled + 142-son belgisi bilan", () => {
    const backend: BackendScienceProgramListItem[] = [
      { _id: 'sp-142', science: { _id: 's1', title: 'Anatomiya' }, formVersion: 'v142' },
    ];

    const [option] = buildScienceProgramOptions(backend.map(mapScienceProgram));

    expect(option).toBeDefined();
    expect(option?.value).toBe('sp-142');
    expect(option?.label).toBe('Anatomiya');
    expect(option?.disabled).toBe(true);
    expect(option?.isV142).toBe(true);
  });

  it('v259 dasturi tanlanadi (disabled emas, teg yo`q)', () => {
    const backend: BackendScienceProgramListItem[] = [
      { _id: 'sp-259', science: { _id: 's2', title: 'Fiziologiya' }, formVersion: 'v259' },
    ];

    const [option] = buildScienceProgramOptions(backend.map(mapScienceProgram));

    expect(option?.disabled).toBe(false);
    expect(option?.isV142).toBe(false);
  });

  it("`formVersion` UMUMAN yo`q (legacy javob) → v259 deb qabul qilinadi, tanlanadi", () => {
    const backend: BackendScienceProgramListItem[] = [
      { _id: 'sp-legacy', science: { _id: 's3', title: 'Gistologiya' } },
    ];

    const [option] = buildScienceProgramOptions(backend.map(mapScienceProgram));

    expect(option?.disabled).toBe(false);
    expect(option?.isV142).toBe(false);
  });

  it("aralash ro`yxat — v142 ham, v259 ham qaytadi (filtrlanmaydi)", () => {
    const backend: BackendScienceProgramListItem[] = [
      { _id: 'a', formVersion: 'v142' },
      { _id: 'b', formVersion: 'v259' },
      { _id: 'c', formVersion: null },
    ];

    const options = buildScienceProgramOptions(backend.map(mapScienceProgram));

    expect(options.map((o) => o.value)).toEqual(['a', 'b', 'c']);
    expect(options.map((o) => o.disabled)).toEqual([true, false, false]);
    expect(options.map((o) => o.label)).toEqual(['a', 'b', 'c']);
  });
});
