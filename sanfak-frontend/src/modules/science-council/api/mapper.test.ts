import { describe, expect, it } from 'vitest';
import { workInputToBackend, reviewInputToBackend, decisionInputToBackend, mapWork } from './mapper';
import type { BackendWork } from './mapper';
import type { WorkInput, ReviewInput, DecisionInput } from '../model/types';

const baseBackendWork: BackendWork = {
  _id: 'w1',
  title: 'Test ish',
  authorType: 'internal',
  status: 'pending',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('science-council mapper — mapWork (nested-populate department/position, reviewCount)', () => {
  it('researcher.department/position — nested-populate obyekt {_id,title} bo\'lsa nomini oladi', () => {
    const out = mapWork({
      ...baseBackendWork,
      researcher: {
        _id: 'u1',
        firstName: 'Ism',
        lastName: 'Familiya',
        department: { _id: 'd1', title: 'Urologiya kafedrasi' },
        position: { _id: 'p1', title: 'Assistent' },
      },
    });

    expect(out.researcher?.department).toBe('Urologiya kafedrasi');
    expect(out.researcher?.position).toBe('Assistent');
  });

  it('researcher.department — populate qilinmagan (xom ID string) bo\'lsa o\'sha stringni qaytaradi', () => {
    const out = mapWork({
      ...baseBackendWork,
      researcher: { _id: 'u1', department: 'd1-xom-id' },
    });

    expect(out.researcher?.department).toBe('d1-xom-id');
  });

  it('reviewCount — backendda bor bo\'lsa o\'tadi, bo\'lmasa 0', () => {
    expect(mapWork({ ...baseBackendWork, reviewCount: 7 }).reviewCount).toBe(7);
    expect(mapWork(baseBackendWork).reviewCount).toBe(0);
  });

  it('supervisor ICHKI, o\'z position/workplace/academicTitle bo\'sh — user (populate qilingan)dan to\'ldiriladi', () => {
    const out = mapWork({
      ...baseBackendWork,
      supervisor: {
        type: 'internal',
        user: {
          _id: 'u2',
          firstName: 'Rahbar',
          lastName: 'Ism',
          department: { _id: 'd2', title: 'Kardiologiya kafedrasi' },
          position: { _id: 'p2', title: 'Professor' },
          academicTitle: { _id: 'at2', title: 'Dotsent' },
        },
      },
    });

    expect(out.supervisor?.user?.name).toBe('Ism Rahbar');
    expect(out.supervisor?.position).toBe('Professor');
    expect(out.supervisor?.workplace).toBe('Kardiologiya kafedrasi');
    expect(out.supervisor?.academicTitle).toBe('Dotsent');
    expect(out.supervisor?.degree).toBeUndefined();
  });

  it('supervisor TASHQI — sxemaning o\'z workplace/position/academicTitle/degree maydonlari ustun turadi', () => {
    const out = mapWork({
      ...baseBackendWork,
      supervisor: {
        type: 'external',
        name: 'Tashqi Rahbar',
        workplace: 'Boshqa universitet',
        position: 'Dotsent',
        academicTitle: 'Professor',
        degree: 'DSc',
      },
    });

    expect(out.supervisor?.workplace).toBe('Boshqa universitet');
    expect(out.supervisor?.position).toBe('Dotsent');
    expect(out.supervisor?.academicTitle).toBe('Professor');
    expect(out.supervisor?.degree).toBe('DSc');
  });
});

describe('science-council mapper — workInputToBackend (D-066)', () => {
  it('ichki muallif: authorId → researcher, externalAuthor yuborilmaydi', () => {
    const input: WorkInput = {
      title: 'Test ilmiy ish',
      year: '2025-2026',
      authorType: 'internal',
      authorId: 'user-1',
      divisionId: 'div-1',
      facultyId: 'fac-1',
      departmentId: 'dep-1',
      councilMembers: ['m1', 'm2'],
    };
    const out = workInputToBackend(input);

    expect(out.researcher).toBe('user-1');
    expect(out.externalAuthor).toBeUndefined();
    expect(out.divisionId).toBeUndefined();
    expect(out.facultyId).toBeUndefined();
    expect(out.departmentId).toBeUndefined();
    expect(out.authorId).toBeUndefined();
    expect(out.councilMembers).toEqual(['m1', 'm2']);
  });

  it('tashqi muallif: tekis maydonlar → externalAuthor uyali obyekt, researcher yuborilmaydi', () => {
    const input: WorkInput = {
      title: 'Test ilmiy ish 2',
      year: '2025-2026',
      authorType: 'external',
      fullName: 'Aliyev Vali',
      workplace: 'ToshTTU',
      position: 'dotsent',
      passportSeries: 'AB',
      passportNumber: '1234567',
      pinfl: '12345678901234',
    };
    const out = workInputToBackend(input);

    expect(out.researcher).toBeUndefined();
    expect(out.externalAuthor).toEqual({
      name: 'Aliyev Vali',
      workplace: 'ToshTTU',
      position: 'dotsent',
      passportSeries: 'AB',
      passportNumber: '1234567',
      pinfl: '12345678901234',
    });
  });

  it('authorId hech qachon xom holda chiqmaydi', () => {
    const out = workInputToBackend({
      title: 'T',
      year: '2025-2026',
      authorType: 'internal',
      authorId: 'user-77',
    });
    expect('authorId' in out).toBe(false);
  });

  it('partial update (faqat title): boshqa maydonlar chiqmaydi', () => {
    const out = workInputToBackend({ title: 'Yangi sarlavha' });
    expect(out).toEqual({ title: 'Yangi sarlavha' });
  });
});

describe('science-council mapper — reviewInputToBackend', () => {
  it('workId → work, qolgan maydonlar o\'zgarishsiz', () => {
    const input: ReviewInput = {
      workId: 'work-1',
      docKey: 'thesis',
      type: 'positive',
      text: 'Yaxshi ish',
    };
    const out = reviewInputToBackend(input);
    expect(out).toEqual({ work: 'work-1', docKey: 'thesis', type: 'positive', text: 'Yaxshi ish' });
    expect('workId' in out).toBe(false);
  });
});

describe('science-council mapper — decisionInputToBackend', () => {
  it('workId OLIB TASHLANADI (rename emas) — makeDecisionSchema uni qabul qilmaydi', () => {
    const input: DecisionInput = {
      workId: 'work-1',
      type: 'seminar',
      comment: 'Seminarga yuborildi',
      seminarDate: '2026-09-01',
    };
    const out = decisionInputToBackend(input);
    expect('workId' in out).toBe(false);
    expect('work' in out).toBe(false);
    expect(out).toEqual({ type: 'seminar', comment: 'Seminarga yuborildi', seminarDate: '2026-09-01' });
  });

  it('rejected qaror: rejectionReason o\'tadi', () => {
    const out = decisionInputToBackend({
      workId: 'work-2',
      type: 'rejected',
      comment: 'Rad etildi',
      rejectionReason: 'Talablarga javob bermaydi',
    });
    expect(out).toEqual({ type: 'rejected', comment: 'Rad etildi', rejectionReason: 'Talablarga javob bermaydi' });
  });
});
