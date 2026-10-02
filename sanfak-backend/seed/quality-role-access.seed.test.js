const {
  QA_EXACT,
  TEACHER_ADD,
  EQ_CATALOG,
  QA_ROLE,
} = require("./quality-role-access.seed");
const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const SECTIONS_4_12 = [
  MODULES.INDICATOR,
  MODULES.INDICATOR_SUBMISSION,
  MODULES.EQ_INDICATOR,
  MODULES.EQ_SUBMISSION,
  MODULES.EQ_ANNOUNCEMENT,
  MODULES.EQ_REPORT,
];

const REFERENCE_SECTIONS = [
  MODULES.ACADEMIC_YEAR,
  MODULES.FACULTY,
  MODULES.DEPARTMENT,
];

describe("QA roli (talim_sifati_nazorati) — avtoritar to'plam", () => {
  test("grantlar 4.12 dan tashqariga faqat O'QISH ma'lumotnomalari bilan chiqadi", () => {
    const allowed = [...SECTIONS_4_12, ...REFERENCE_SECTIONS];
    for (const section of Object.keys(QA_EXACT)) {
      expect(allowed).toContain(section);
    }
  });

  test("ma'lumotnomalarda YOZISH huquqi yo'q (create/update/delete)", () => {
    for (const section of REFERENCE_SECTIONS) {
      expect(QA_EXACT[section]).toEqual([ACTIONS.READ, ACTIONS.READ_ALL]);
    }
  });

  test("tasdiqlash/rad etish huquqi bor (PUT /:id/review → approve)", () => {
    expect(QA_EXACT[MODULES.INDICATOR_SUBMISSION]).toContain(ACTIONS.APPROVE);
    expect(QA_EXACT[MODULES.INDICATOR_SUBMISSION]).toContain(ACTIONS.REJECT);
  });

  test("fayl arxivi huquqi bor (GET /_system/files.zip → [export, readAll])", () => {
    const grants = QA_EXACT[MODULES.INDICATOR_SUBMISSION];
    expect(grants).toContain(ACTIONS.EXPORT);
    expect(grants).toContain(ACTIONS.READ_ALL);
  });

  test("indikator katalogi to'liq CRUD (indicator.routes.js:20-24)", () => {
    expect(QA_EXACT[MODULES.INDICATOR].sort()).toEqual(
      [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE].sort(),
    );
  });

  test("4 ta menyu gate'i ham ochiq: Indikatorlar · Tekshirish · E'lonlar · Hisobotlar", () => {
    expect(QA_EXACT[MODULES.EQ_INDICATOR]).toContain("read");
    expect(QA_EXACT[MODULES.EQ_SUBMISSION]).toContain("read");
    expect(QA_EXACT[MODULES.EQ_ANNOUNCEMENT]).toContain("read");
    expect(QA_EXACT[MODULES.EQ_REPORT]).toContain("read");
  });

  test("e'londa `update` YO'Q — sahifada tahrirlash tugmasi yo'q", () => {
    expect(QA_EXACT[MODULES.EQ_ANNOUNCEMENT]).not.toContain(ACTIONS.UPDATE);
  });

  test("o'qituvchi sahifalarining gate'lari QA ga berilmaydi (readOwn)", () => {
    expect(QA_EXACT[MODULES.EQ_SUBMISSION]).not.toContain("readOwn");
    expect(QA_EXACT[MODULES.EQ_ANNOUNCEMENT]).not.toContain("readOwn");
  });

  test("scopeLevel global — QA butun institut kesimini ko'radi", () => {
    expect(QA_ROLE.scopeLevel).toBe("global");
    expect(QA_ROLE.title).toBe(ROLES.TALIM_SIFATI_NAZORATI);
  });
});

describe("O'qituvchi (oqituvchi) — faqat qo'shiladigan 3 sahifa", () => {
  test("grantlar 4.12 dan TASHQARIGA chiqmaydi", () => {
    for (const section of Object.keys(TEACHER_ADD)) {
      expect(SECTIONS_4_12).toContain(section);
    }
  });

  test("uchala menyu gate'i: Ma'lumot yuborish · Mening ma'lumotlarim · E'lonlar", () => {
    expect(TEACHER_ADD[MODULES.EQ_SUBMISSION]).toContain("create");
    expect(TEACHER_ADD[MODULES.EQ_SUBMISSION]).toContain("readOwn");
    expect(TEACHER_ADD[MODULES.EQ_ANNOUNCEMENT]).toContain("readOwn");
  });

  test("indicatorSubmission da `readAll` YO'Q — scope izolyatsiyasi saqlanadi", () => {
    expect(TEACHER_ADD[MODULES.INDICATOR_SUBMISSION]).not.toContain(ACTIONS.READ_ALL);
    expect(TEACHER_ADD[MODULES.INDICATOR_SUBMISSION]).toContain(ACTIONS.READ);
    expect(TEACHER_ADD[MODULES.INDICATOR_SUBMISSION]).toContain(ACTIONS.CREATE);
  });

  test("tasdiqlash/tahrir/arxiv huquqlari BERILMAYDI (SoD)", () => {
    const grants = TEACHER_ADD[MODULES.INDICATOR_SUBMISSION];
    for (const forbidden of [ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.UPDATE, ACTIONS.EXPORT]) {
      expect(grants).not.toContain(forbidden);
    }
  });

  test("indikator faqat o'qish (forma ro'yxatni oladi, katalogni yuritmaydi)", () => {
    expect(TEACHER_ADD[MODULES.INDICATOR].sort()).toEqual([ACTIONS.READ, ACTIONS.READ_ALL].sort());
  });

  test("hisobot menyusi ochilmaydi (eqReport yo'q)", () => {
    expect(TEACHER_ADD[MODULES.EQ_REPORT]).toBeUndefined();
  });
});

describe("Katalog ↔ grant mosligi (D-081: katalogda yo'q action reconcile'da tushadi)", () => {
  const catalog = new Map(EQ_CATALOG.map((p) => [p.section, p.actionKeys]));

  test("eq* katalogi 4 ta section — frontend manifestidagi kalitlar", () => {
    expect([...catalog.keys()].sort()).toEqual(
      [
        MODULES.EQ_ANNOUNCEMENT,
        MODULES.EQ_INDICATOR,
        MODULES.EQ_REPORT,
        MODULES.EQ_SUBMISSION,
      ].sort(),
    );
  });

  test("QA ga berilgan har bir eq* action katalogda mavjud", () => {
    for (const [section, actions] of Object.entries(QA_EXACT)) {
      if (!catalog.has(section)) continue;
      for (const a of actions) expect(catalog.get(section)).toContain(a);
    }
  });

  test("o'qituvchiga berilgan har bir eq* action katalogda mavjud", () => {
    for (const [section, actions] of Object.entries(TEACHER_ADD)) {
      if (!catalog.has(section)) continue;
      for (const a of actions) expect(catalog.get(section)).toContain(a);
    }
  });
});
