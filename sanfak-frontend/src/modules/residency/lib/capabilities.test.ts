import { describe, expect, test } from 'vitest';
import { deriveCapabilities } from './capabilities';

const GRANTS: Record<string, string[]> = {
  xodim: [
    'resident:read', 'resident:readAll', 'resident:create', 'resident:update',
    'residencyReport:readAll',
    'residentAttendance:create', 'residentDailyLog:approve',
    'residentApplication:create', 'residentApplication:approve',
    'residencyNotice:approve',
  ],
  rahbar: ['resident:read', 'resident:readAll', 'residencyReport:readAll'],
  ilmiy_rahbar: [
    'resident:read', 'resident:readAll', 'resident:update',
    'residencyNotice:create', 'residentDailyLog:approve',
  ],
  klinik_ustoz: [
    'resident:read', 'resident:readAll', 'resident:create', 'resident:update',
    'residencyNotice:create', 'residentAttendance:create', 'residentDailyLog:approve',
  ],
  kafedra_mudiri: [
    'resident:read', 'resident:readAll', 'resident:create', 'resident:update',
    'residentDailyLog:approve',
  ],
  magistrant: ['resident:read', 'residentApplication:create'],
  rezident: [
    'resident:read',
    'residentAttendance:read', 'residentAttendance:readAll',
    'residentDailyLog:create', 'residentDailyLog:read', 'residentDailyLog:readAll',
    'residentApplication:create', 'residentApplication:read', 'residentApplication:readAll',
  ],
};

const capsFor = (role: string) => {
  const g = new Set(GRANTS[role]);
  return deriveCapabilities((p) => g.has(p));
};

const EXPECTED: Record<
  string,
  { isStudent: boolean; isOffice: boolean; isMentor: boolean; isClinicalMentor: boolean }
> = {
  xodim:          { isStudent: false, isOffice: true,  isMentor: false, isClinicalMentor: false },
  rahbar:         { isStudent: false, isOffice: false, isMentor: false, isClinicalMentor: false },
  ilmiy_rahbar:   { isStudent: false, isOffice: false, isMentor: true,  isClinicalMentor: false },
  klinik_ustoz:   { isStudent: false, isOffice: false, isMentor: true,  isClinicalMentor: true },
  kafedra_mudiri: { isStudent: false, isOffice: false, isMentor: false, isClinicalMentor: false },
  magistrant:     { isStudent: true,  isOffice: false, isMentor: false, isClinicalMentor: false },
  rezident:       { isStudent: true,  isOffice: false, isMentor: false, isClinicalMentor: false },
};

describe('residency capabilities — HAQIQIY prod grantlarida 7 rol', () => {
  for (const [role, want] of Object.entries(EXPECTED)) {
    test(`${role}`, () => {
      const c = capsFor(role);
      expect({
        isStudent: c.isStudent,
        isOffice: c.isOffice,
        isMentor: c.isMentor,
        isClinicalMentor: c.isClinicalMentor,
      }).toEqual(want);
    });
  }

  test('MAXFIYLIK: JSHSHIR/pasport (isOffice) FAQAT bo‘lim xodimida', () => {
    expect(capsFor('xodim').isOffice).toBe(true);
    expect(capsFor('klinik_ustoz').isOffice).toBe(false);
    expect(capsFor('kafedra_mudiri').isOffice).toBe(false);
    expect(capsFor('rahbar').isOffice).toBe(false);
  });

  test('isOffice `resident:create` YOLG‘IZ o‘ziga tayanmaydi', () => {
    expect(deriveCapabilities((p) => p === 'resident:create').isOffice).toBe(false);
  });

  test('BOSH SAHIFA hech qachon bo‘sh qolmaydi — har rol bitta toifaga tushadi', () => {
    for (const role of Object.keys(GRANTS)) {
      const g = new Set(GRANTS[role]);
      const can = (p: string) => g.has(p);
      const seesInstituteWide = can('residencyReport:readAll');
      const seesOthers = !seesInstituteWide && can('resident:readAll');
      const isStudent = capsFor(role).isStudent;
      expect(seesInstituteWide || seesOthers || isStudent).toBe(true);
    }
  });

  test('kafedra mudiri ustoz EMAS — bildirgi yubormaydi', () => {
    expect(capsFor('kafedra_mudiri').isMentor).toBe(false);
    expect(capsFor('ilmiy_rahbar').isMentor).toBe(true);
  });

  test('ilmiy rahbar KLINIK ustoz emas — davomat granti yo‘q', () => {
    expect(capsFor('ilmiy_rahbar').isClinicalMentor).toBe(false);
    expect(capsFor('klinik_ustoz').isClinicalMentor).toBe(true);
  });

  test('bildirgi: ustoz YUBORADI, xodim QAROR yozadi', () => {
    expect(capsFor('ilmiy_rahbar').canSendNotice).toBe(true);
    expect(capsFor('ilmiy_rahbar').canDecideNotice).toBe(false);
    expect(capsFor('xodim').canSendNotice).toBe(false);
    expect(capsFor('xodim').canDecideNotice).toBe(true);
  });

  test('ariza: talaba yaratadi, faqat xodim qaror qiladi', () => {
    expect(capsFor('rezident').canCreateApplication).toBe(true);
    expect(capsFor('rezident').canDecideApplication).toBe(false);
    expect(capsFor('xodim').canDecideApplication).toBe(true);
  });

  test('canAnnounceSession — faqat bo‘lim va klinik ustoz', () => {
    const announcers = Object.keys(GRANTS).filter((r) => capsFor(r).canAnnounceSession);
    expect(announcers.sort()).toEqual(['klinik_ustoz', 'xodim']);
  });

  test('canGradeSession — aynan `residentAttendance:update`', () => {
    const only = (key: string) => deriveCapabilities((p) => p === key);
    expect(only('residentAttendance:update').canGradeSession).toBe(true);
    expect(only('residentAttendance:create').canGradeSession).toBe(false);
    expect(only('residentAttendance:update').canAnnounceSession).toBe(false);
    expect(deriveCapabilities(() => false).canGradeSession).toBe(false);
  });

  describe('canExcuseAttendance (EXC)', () => {
    const withApprove = (role: string) => {
      const g = new Set([...GRANTS[role]!, 'residentAttendance:approve']);
      return deriveCapabilities((p) => g.has(p));
    };

    test('faqat `approve` (bo‘lim xodimi emas) — false', () => {
      expect(
        deriveCapabilities((p) => p === 'residentAttendance:approve').canExcuseAttendance,
      ).toBe(false);
    });

    test('prod o‘lchovidagi xodim + `approve` — true; `approve` siz — false', () => {
      expect(withApprove('xodim').canExcuseAttendance).toBe(true);
      expect(capsFor('xodim').canExcuseAttendance).toBe(false);
    });

    test('klinik ustoz A1 gacha `approve` bilan — false (D-18: isOffice emas)', () => {
      expect(withApprove('klinik_ustoz').canExcuseAttendance).toBe(false);
    });

    test.each(['rahbar', 'rezident', 'magistrant', 'ilmiy_rahbar', 'kafedra_mudiri'])(
      '%s (`approve` bilan ham) — false',
      (role) => {
        expect(withApprove(role).canExcuseAttendance).toBe(false);
      },
    );

    test('wildcard (super_admin) — true', () => {
      expect(deriveCapabilities(() => true).canExcuseAttendance).toBe(true);
    });
  });

  test('tozalangandan keyin rezidentda kontingent/davomat yozish granti YO‘Q', () => {
    const g = new Set(GRANTS.rezident);
    expect(g.has('resident:create')).toBe(false);
    expect(g.has('resident:update')).toBe(false);
    expect(g.has('residentAttendance:create')).toBe(false);
  });
});

const SEED_GRANTS: Record<string, string[]> = {
  xodim: [
    'resident:read', 'resident:readAll', 'resident:create', 'resident:update', 'resident:delete',
    'residencyReport:readAll',
    'residentAttendance:create', 'residentDailyLog:approve',
    'residentAttendance:approve',
    'residentApplication:create', 'residentApplication:approve',
    'residencyNotice:approve',
  ],
  rahbar: ['resident:read', 'resident:readAll', 'residencyReport:readAll'],
  ilmiy_rahbar: [
    'resident:read', 'resident:readAll',
    'residencyNotice:create', 'residentDailyLog:approve',
  ],
  klinik_ustoz: [
    'resident:read', 'resident:readAll',
    'residencyNotice:create', 'residentAttendance:create', 'residentDailyLog:approve',
  ],
  kafedra_mudiri: ['resident:read', 'resident:readAll', 'resident:update'],
  magistrant: ['resident:read', 'residentApplication:create'],
  rezident: [
    'resident:read',
    'residentAttendance:read', 'residentAttendance:readAll',
    'residentDailyLog:create', 'residentApplication:create',
  ],
};

describe('residency capabilities — SEED grantlarida ham AYNAN o‘sha natija', () => {
  for (const [role, want] of Object.entries(EXPECTED)) {
    test(`${role} — seed va baza bir xil xulq beradi`, () => {
      const g = new Set(SEED_GRANTS[role]);
      const c = deriveCapabilities((p) => g.has(p));
      expect({
        isStudent: c.isStudent,
        isOffice: c.isOffice,
        isMentor: c.isMentor,
        isClinicalMentor: c.isClinicalMentor,
      }).toEqual(want);
    });
  }

  test('grantlar tozalansa ham maxfiylik qoidasi saqlanadi', () => {
    const seedCaps = (r: string) => {
      const g = new Set(SEED_GRANTS[r]);
      return deriveCapabilities((p) => g.has(p));
    };
    expect(seedCaps('xodim').isOffice).toBe(true);
    expect(seedCaps('klinik_ustoz').isOffice).toBe(false);
    expect(seedCaps('kafedra_mudiri').isOffice).toBe(false);
  });

  test('EXC — seed grantlarida «Sababli qilish» FAQAT bo‘lim xodimida', () => {
    const excusers = Object.keys(SEED_GRANTS).filter((r) => {
      const g = new Set(SEED_GRANTS[r]);
      return deriveCapabilities((p) => g.has(p)).canExcuseAttendance;
    });
    expect(excusers).toEqual(['xodim']);
  });
});
