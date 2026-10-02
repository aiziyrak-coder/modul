import { describe, expect, it } from 'vitest';
import {
  mapScienceProgram,
  mapScienceProgramDetail,
  type BackendScienceProgramListItem,
  type BackendScienceProgramDetail,
} from './mapper';

describe('mapScienceProgram — formVersion normalizatsiyasi', () => {
  it("formVersion 'v142' bo'lsa o'shani qaytaradi", () => {
    const backend: BackendScienceProgramListItem = { _id: 'sp1', formVersion: 'v142' };

    expect(mapScienceProgram(backend).formVersion).toBe('v142');
  });

  it("formVersion 'v259' bo'lsa o'shani qaytaradi", () => {
    const backend: BackendScienceProgramListItem = { _id: 'sp2', formVersion: 'v259' };

    expect(mapScienceProgram(backend).formVersion).toBe('v259');
  });

  it("formVersion undefined (legacy hujjat) — 'v259' fallback", () => {
    const backend: BackendScienceProgramListItem = { _id: 'sp3' };

    expect(mapScienceProgram(backend).formVersion).toBe('v259');
  });

  it("formVersion null bo'lsa ham 'v259' fallback", () => {
    const backend: BackendScienceProgramListItem = { _id: 'sp4', formVersion: null };

    expect(mapScienceProgram(backend).formVersion).toBe('v259');
  });

  it("noma'lum qiymat (buzuq/eski) kelsa ham 'v259' fallback — 'v142' EMAS", () => {
    const backend: BackendScienceProgramListItem = { _id: 'sp5', formVersion: 'v1' };

    expect(mapScienceProgram(backend).formVersion).toBe('v259');
  });
});

describe('mapScienceProgramDetail — formVersion normalizatsiyasi (GET /:id)', () => {
  it("formVersion 'v142' bo'lsa o'shani qaytaradi", () => {
    const backend: BackendScienceProgramDetail = { _id: 'sp1', formVersion: 'v142' };

    expect(mapScienceProgramDetail(backend).formVersion).toBe('v142');
  });

  it("formVersion yo'q (legacy) — 'v259' fallback", () => {
    const backend: BackendScienceProgramDetail = { _id: 'sp2' };

    expect(mapScienceProgramDetail(backend).formVersion).toBe('v259');
  });
});

describe('mapScienceProgramDetail — Bilim/Ta\'lim sohasi tahrirda kamida bitta qator (D-35)', () => {
  it.each([
    ["bo'sh massiv", [] as string[]],
    ["maydon yo'q (legacy)", undefined],
  ])('%s → bitta bo\'sh qator', (_n, areas) => {
    const v = mapScienceProgramDetail({ _id: 'sp1', knowledgeArea: areas, educationArea: areas });

    expect(v.knowledgeArea).toEqual(['']);
    expect(v.educationArea).toEqual(['']);
  });

  it("to'lgan qiymatlar o'zgarishsiz qoladi", () => {
    const v = mapScienceProgramDetail({ _id: 'sp2', knowledgeArea: ['Tibbiyot'], educationArea: ['A', 'B'] });

    expect(v.knowledgeArea).toEqual(['Tibbiyot']);
    expect(v.educationArea).toEqual(['A', 'B']);
  });
});
