const { blockQuotaAt, usedInBlockAt, freeQuotaAt } = require("./electiveQuota");

const block = () => ({
  blockCode: "TF2",
  title: "Tanlov fanlar",
  semesters: {
    3: { hour: 6, credit: 4 },
  },
  sciences: [
    {
      _id: "row1",
      code: "TN1104",
      title: "Bioetika",
      semesters: { 3: { hour: 2, credit: 2 } },
    },
    { code: "", title: "Jami" },
  ],
});

describe("blockQuotaAt", () => {
  test("block.semesters dagi kvotani o'qiydi", () => {
    expect(blockQuotaAt(block(), "3")).toEqual({ hour: 6, credit: 4 });
  });

  test("kvota bo'lmagan semestrda 0/0", () => {
    expect(blockQuotaAt(block(), "9")).toEqual({ hour: 0, credit: 0 });
  });
});

describe("usedInBlockAt", () => {
  test("haqiqiy fan qatorlari sanaladi, YIG'INDI qatori SANALMAYDI", () => {
    expect(usedInBlockAt(block(), "3")).toEqual({ hour: 2, credit: 2 });
  });

  test("AMALIYOT qatori kvotani BAND QILMAYDI (2026-09-08 regressiya qulfi)", () => {
    const b = block();
    b.sciences.push({
      code: "ICHM206",
      title: "Ishlab chiqarish amaliyoti",
      semesters: { 3: { hour: 0, credit: 3 } },
    });
    expect(usedInBlockAt(b, "3")).toEqual({ hour: 2, credit: 2 });
    expect(freeQuotaAt(b, "3")).toEqual({ hour: 4, credit: 2 });
  });

  test("excludeRowId — tahrirlashda o'zini hisobdan chiqaradi", () => {
    expect(usedInBlockAt(block(), "3", { excludeRowId: "row1" })).toEqual({
      hour: 0,
      credit: 0,
    });
  });
});

describe("freeQuotaAt", () => {
  test("qoldiq = kvota - band qilingan", () => {
    expect(freeQuotaAt(block(), "3")).toEqual({ hour: 4, credit: 2 });
  });

  test("band qilingan kvotadan oshsa — MANFIY qoldiq (chaqiruvchi tekshiradi)", () => {
    const b = block();
    b.sciences[0].semesters["3"] = { hour: 10, credit: 10 };
    expect(freeQuotaAt(b, "3")).toEqual({ hour: -4, credit: -6 });
  });
});
