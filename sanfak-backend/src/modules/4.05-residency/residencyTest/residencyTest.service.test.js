"use strict";

const S = require("./residencyTest.service");

const R1 = "6a5a0acbd34b3c21a575d5f1";
const R2 = "6a5a0acbd34b3c21a575d5f2";
const R3 = "6a5a0acbd34b3c21a575d5f3";

const residents = [
  { _id: R1, fullName: "Aliyev A.", program: "ordinatura", courseNumber: 1 },
  { _id: R2, fullName: "Bobur B.", program: "ordinatura", courseNumber: 1 },
];

describe("residentFilter", () => {
  it("bo'sh kesim = barchasi (o'quvda + chetlatish loyihasi yo'q)", () => {
    expect(S.residentFilter({})).toEqual({
      active: true,
      status: "oquvda",
      expulsionOrderCreated: { $ne: true },
    });
  });

  it("IKKI darvoza HAR DOIM bor (kesim to'ldirilganda ham)", () => {
    const f = S.residentFilter({ specialty: "s1", courseNumber: 2 });
    expect(f.status).toBe("oquvda");
    expect(f.expulsionOrderCreated).toEqual({ $ne: true });
  });

  it("darvoza QORA ro'yxat EMAS — `$ne`/`$nin` ishlatilmaydi", () => {
    const f = S.residentFilter({});
    expect(typeof f.status).toBe("string");
  });

  it("to'ldirilgan kesim maydonlarini uzatadi", () => {
    const f = S.residentFilter({ specialty: "s1", program: "magistratura", group: "g1" });
    expect(f).toMatchObject({ active: true, specialty: "s1", program: "magistratura", group: "g1" });
  });
});

describe("joinResults", () => {
  it("baholanmagan rezident ham ro'yxatda qoladi", () => {
    const rows = S.joinResults(residents, []);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.score === null)).toBe(true);
  });

  it("0 ball — HAQIQIY qiymat, null EMAS", () => {
    const rows = S.joinResults(residents, [
      { _id: "a1", resident: R1, score: 0, maxScore: 100 },
    ]);
    expect(rows.find((r) => r.resident._id === R1).score).toBe(0);
    expect(rows.find((r) => r.resident._id === R2).score).toBeNull();
  });

  it("ro'yxatdan tashqaridagi baho ro'yxatga qo'shilmaydi", () => {
    const rows = S.joinResults(residents, [
      { _id: "a9", resident: R3, score: 90, maxScore: 100 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.score === null)).toBe(true);
  });

  it("JSHSHIR/passport kabi maydonlarni chiqarmaydi", () => {
    const rows = S.joinResults(
      [{ _id: R1, fullName: "Aliyev A.", jshshir: "123", passportNumber: "AA1" }],
      [],
    );
    expect(Object.keys(rows[0].resident)).toEqual([
      "_id",
      "fullName",
      "program",
      "specialtyTitle",
      "courseNumber",
      "groupTitle",
    ]);
  });
});

describe("summarize", () => {
  it("faqat baholanganlar o'rtachaga kiradi", () => {
    const rows = [{ score: 80 }, { score: 60 }, { score: null }];
    expect(S.summarize(rows)).toEqual({
      total: 3,
      scored: 2,
      notScored: 1,
      avgScore: 70,
    });
  });

  it("0 ball o'rtachaga kiradi", () => {
    expect(S.summarize([{ score: 0 }, { score: 100 }]).avgScore).toBe(50);
  });

  it("hech kim baholanmagan -> avgScore null (0 EMAS)", () => {
    expect(S.summarize([{ score: null }]).avgScore).toBeNull();
  });
});

describe("validateResults", () => {
  const cut = new Set([R1, R2]);

  it("kesimdagi va doiradagi natijalarni qabul qiladi", () => {
    const r = S.validateResults([{ resident: R1, score: 90 }], cut, null, 100);
    expect(r.ok).toBe(true);
  });

  it("kesimga kirmagan rezident -> 400", () => {
    const r = S.validateResults([{ resident: R3, score: 90 }], cut, null, 100);
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("doiradan tashqaridagi rezident -> 403", () => {
    const r = S.validateResults([{ resident: R2, score: 90 }], cut, new Set([R1]), 100);
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("doira cheklovsiz bo'lsa (null) hammasi o'tadi", () => {
    const r = S.validateResults(
      [{ resident: R1, score: 10 }, { resident: R2, score: 20 }],
      cut,
      null,
      100,
    );
    expect(r.ok).toBe(true);
  });

  it("chegaradan oshgan ball -> 400, xabarda chegara ko'rsatiladi", () => {
    const r = S.validateResults([{ resident: R1, score: 60 }], cut, null, 50);
    expect(r.status).toBe(400);
    expect(r.message).toContain("50");
  });

  it("aynan chegara qiymati qabul qilinadi", () => {
    expect(S.validateResults([{ resident: R1, score: 50 }], cut, null, 50).ok).toBe(true);
  });

  it("null ball — ballni olib tashlash, chegara tekshirilmaydi", () => {
    expect(S.validateResults([{ resident: R1, score: null }], cut, null, 50).ok).toBe(
      true,
    );
  });

  it("bir rezident ikki marta -> 400", () => {
    const r = S.validateResults(
      [{ resident: R1, score: 10 }, { resident: R1, score: 90 }],
      cut,
      null,
      100,
    );
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("oxirgi qator yaroqsiz bo'lsa ham butun so'rov rad etiladi", () => {
    const r = S.validateResults(
      [{ resident: R1, score: 10 }, { resident: R3, score: 90 }],
      cut,
      null,
      100,
    );
    expect(r.ok).toBe(false);
  });
});

describe("canManageTests — sinovni kim yuklaydi (TZ 4.5.6)", () => {
  const withRole = (role) => ({ role });

  it("bo'lim xodimi — ha", () => {
    expect(S.canManageTests(withRole({ title: "magistratura_bolim" }))).toBe(true);
  });

  it("global doiradagi rol (rektor/admin) — ha", () => {
    expect(S.canManageTests(withRole({ title: "rektor", scopeLevel: "global" }))).toBe(
      true,
    );
  });

  it("klinik ustoz — yo'q", () => {
    expect(S.canManageTests(withRole({ title: "klinik_ustoz" }))).toBe(false);
  });

  it("ilmiy rahbar — yo'q", () => {
    expect(S.canManageTests(withRole({ title: "ilmiy_rahbar" }))).toBe(false);
  });

  it("rol yo'q / foydalanuvchi yo'q — yo'q (fail-closed)", () => {
    expect(S.canManageTests(undefined)).toBe(false);
    expect(S.canManageTests({})).toBe(false);
  });
});

describe("buildListFilter — qidiruv", () => {
  const or = (q) => S.buildListFilter({ search: q }).$or;

  it("qism-satr bo'yicha, registrga sezgir emas — uchala maydonda", () => {
    expect(or("sin")).toEqual([
      { title: { $regex: "sin", $options: "i" } },
      { scienceTitle: { $regex: "sin", $options: "i" } },
      { specialtyTitle: { $regex: "sin", $options: "i" } },
    ]);
  });

  it("na boshida `^`, na oxirida `$` — prefiks emas, qism-satr", () => {
    const rx = or("sin")[0].title.$regex;
    expect(rx.startsWith("^")).toBe(false);
    expect(rx.endsWith("$")).toBe(false);
  });

  it("metakarakterlar escape qilinadi (`Sinov #1 (yakuniy)` 400 bermaydi)", () => {
    const rx = or("Sinov #1 (yakuniy)")[0].title.$regex;
    expect(() => new RegExp(rx)).not.toThrow();
    expect(new RegExp(rx, "i").test("sinov #1 (yakuniy) — ordinatura")).toBe(true);
    expect(new RegExp(rx, "i").test("Sinov 1 yakuniy")).toBe(false);
  });

  it("yolg'iz teskari chiziq (\) ham yiqitmaydi", () => {
    expect(() => new RegExp(or("\\")[0].title.$regex)).not.toThrow();
  });

  it("kirill uchun ham registr farqsiz", () => {
    const rx = new RegExp(or("ҳисоб")[0].title.$regex, "i");
    expect(rx.test("Якуний ҲИСОБ иши")).toBe(true);
  });

  it("chetki bo'shliqlar olib tashlanadi, ichkaridagilari siqiladi", () => {
    expect(or("  sinov   testi ")[0].title.$regex).toBe("sinov testi");
  });

  it("bo'sh / faqat bo'shliqli so'rov = filtr QO'YILMAYDI (to'liq sahifa)", () => {
    expect(S.buildListFilter({ search: "" }).$or).toBeUndefined();
    expect(S.buildListFilter({ search: "   " }).$or).toBeUndefined();
    expect(S.buildListFilter({}).$or).toBeUndefined();
  });

  it("boshqa filtrlarni bosib ketmaydi", () => {
    const f = S.buildListFilter({ search: "sin", group: "g1", program: "ordinatura" });
    expect(f).toMatchObject({ group: "g1", program: "ordinatura" });
    expect(f.$or).toHaveLength(3);
  });
});
