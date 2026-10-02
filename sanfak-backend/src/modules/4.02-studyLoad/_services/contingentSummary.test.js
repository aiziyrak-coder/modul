"use strict";

const {
  buildSummary,
  buildFacultyBlock,
  directionLabel,
  facultyShortName,
  NUM_FIELDS,
} = require("./contingentSummary");

const row = (over) => ({
  direction: "d1",
  directionCode: "60910200",
  directionTitle: "Davolash ishi",
  category: "milliy",
  course: 1,
  total: 10,
  boys: 4,
  girls: 6,
  grant: 3,
  contract: 7,
  grantBoys: 1,
  grantGirls: 2,
  contractBoys: 3,
  contractGirls: 4,
  groupCount: 1,
  streamCount: 1,
  mobilityOut: 0,
  mobilityIn: 0,
  ...over,
});

const davolash = {
  faculty: "f1",
  facultyTitle: "Davolash ishi fakulteti",
  rows: [
    row({ course: 2, total: 20, boys: 8, girls: 12, grant: 5, contract: 15, grantBoys: 2, grantGirls: 3, contractBoys: 6, contractGirls: 9, groupCount: 2 }),
    row({ course: 1 }),
    row({ direction: "d2", directionCode: "", directionTitle: "Farmatsiya ishi", course: 1, total: 5, boys: 5, girls: 0, grant: 0, contract: 5, grantBoys: 0, grantGirls: 0, contractBoys: 5, contractGirls: 0 }),
  ],
  foreignByCountry: [
    { country: "Hindiston", total: 3, boys: 2, girls: 1 },
    { country: "Pokiston", total: 1, boys: 1, girls: 0 },
  ],
};

const xalqaro = {
  faculty: "f3",
  facultyTitle: "Xalqaro fakultet",
  rows: [row({ direction: "d1", category: "xorijiy", course: 1, total: 100, boys: 60, girls: 40, grant: 0, contract: 100, grantBoys: 0, grantGirls: 0, contractBoys: 60, contractGirls: 40, groupCount: 7, streamCount: 2 })],
  foreignByCountry: [
    { country: " hindiston", total: 90, boys: 55, girls: 35 },
    { country: "Amerika Qo'shma Shtatlari", total: 2, boys: 2, girls: 0 },
  ],
};

const faculties = [
  { _id: "f3", title: "Xalqaro fakultet" },
  { _id: "f1", title: "Davolash ishi fakulteti" },
  { _id: "f2", title: "Pediatriya fakulteti" },
];

describe("directionLabel / facultyShortName — namuna matnlari", () => {
  test("«60910200-Davolash ishi (milliy)», kodsiz — faqat nom, toifa yorliqlari", () => {
    expect(directionLabel(row())).toBe("60910200-Davolash ishi (milliy)");
    expect(directionLabel(row({ directionCode: "", category: "mdh" }))).toBe("Davolash ishi (MDH)");
    expect(directionLabel(row({ category: "xorijiy_gibrid" }))).toBe("60910200-Davolash ishi (xorijiy gibrid)");
  });

  test("«Davolash ishi fakulteti» → «Davolash ishi»", () => {
    expect(facultyShortName("Davolash ishi fakulteti")).toBe("Davolash ishi");
    expect(facultyShortName("Xalqaro fakultet")).toBe("Xalqaro fakultet");
  });
});

describe("buildFacultyBlock — yo'nalish bloklari, kurs tartibi, JAMI", () => {
  test("bloklar birinchi uchrash tartibida, kurslar o'sib boradi, jami to'g'ri", () => {
    const fb = buildFacultyBlock(davolash);
    expect(fb.directions.map((d) => d.label)).toEqual(["60910200-Davolash ishi (milliy)", "Farmatsiya ishi (milliy)"]);
    expect(fb.directions[0].rows.map((r) => r.course)).toEqual([1, 2]);
    expect(fb.directions[0].total).toMatchObject({ total: 30, boys: 12, girls: 18, grant: 8, contract: 22, groupCount: 3 });
    expect(fb.total).toMatchObject({ total: 35, boys: 17, girls: 18, grant: 8, contract: 27 });
    expect(fb.facultyShort).toBe("Davolash ishi");
  });

  test("bir yo'nalish ikki toifa — ikki alohida blok", () => {
    const fb = buildFacultyBlock({
      facultyTitle: "X",
      rows: [row({ category: "milliy" }), row({ category: "mdh", total: 1, boys: 1, girls: 0, grant: 0, contract: 1, grantBoys: 0, grantGirls: 0, contractBoys: 1, contractGirls: 0 })],
    });
    expect(fb.directions).toHaveLength(2);
    expect(fb.total.total).toBe(11);
  });
});

describe("buildSummary — institut yig'masi", () => {
  const s = buildSummary({ reports: [davolash, xalqaro], faculties });

  test("fakultet bloklari `faculties` tartibida; hisoboti yo'q fakultet — pending", () => {
    expect(s.facultyBlocks.map((b) => b.facultyTitle)).toEqual(["Xalqaro fakultet", "Davolash ishi fakulteti"]);
    expect(s.pendingFaculties).toEqual(["Pediatriya fakulteti"]);
  });

  test("grandTotal = Σ fakultet jami", () => {
    expect(s.grandTotal.total).toBe(135);
    expect(s.grandTotal.groupCount).toBe(11);
    for (const f of NUM_FIELDS) expect(typeof s.grandTotal[f]).toBe("number");
  });

  test("Jadval 2 — kurs bo'yicha 1..6 (bo'sh kurs 0), JAMI", () => {
    expect(s.byCourse.rows.map((r) => r.course)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(s.byCourse.rows[0]).toMatchObject({ total: 115, boys: 69, girls: 46 });
    expect(s.byCourse.rows[1].total).toBe(20);
    expect(s.byCourse.rows[5]).toMatchObject({ total: 0, groupCount: 0 });
    expect(s.byCourse.total.total).toBe(135);
  });

  test("Jadval 3 — fakultet × kurs (faqat talabalar soni) + JAMI", () => {
    expect(s.facultyByCourse.rows).toEqual([
      { facultyTitle: "Xalqaro fakultet", facultyShort: "Xalqaro fakultet", courses: [100, 0, 0, 0, 0, 0], total: 100 },
      { facultyTitle: "Davolash ishi fakulteti", facultyShort: "Davolash ishi", courses: [15, 20, 0, 0, 0, 0], total: 35 },
    ]);
    expect(s.facultyByCourse.total).toEqual({ courses: [115, 20, 0, 0, 0, 0], total: 135 });
  });

  test("Jadval 4 — davlatlar harf/bo'shliq farqsiz BIRLASHADI, alfavit, JAMI", () => {
    expect(s.countries.rows).toEqual([
      { country: "Amerika Qo'shma Shtatlari", total: 2, boys: 2, girls: 0 },
      { country: "Hindiston", total: 93, boys: 57, girls: 36 },
      { country: "Pokiston", total: 1, boys: 1, girls: 0 },
    ]);
    expect(s.countries.total).toEqual({ total: 96, boys: 60, girls: 36 });
  });
});

describe("buildSummary — chekka holatlar", () => {
  test("faculties berilmasa — pending hisoblanmaydi, tartib hujjat tartibida", () => {
    const one = buildSummary({ reports: [xalqaro, davolash] });
    expect(one.pendingFaculties).toEqual([]);
    expect(one.facultyBlocks.map((b) => b.facultyTitle)).toEqual(["Xalqaro fakultet", "Davolash ishi fakulteti"]);
  });

  test("bo'sh — hamma jami 0, davlatlar bo'sh, hamma fakultet pending", () => {
    const empty = buildSummary({ reports: [], faculties });
    expect(empty.grandTotal.total).toBe(0);
    expect(empty.countries.rows).toEqual([]);
    expect(empty.pendingFaculties).toHaveLength(3);
    expect(empty.byCourse.rows).toHaveLength(6);
  });

  test("noto'g'ri (matn) qiymat — 0 deb olinadi, throw yo'q", () => {
    const r = buildSummary({ reports: [{ facultyTitle: "X", rows: [row({ total: "abc", course: "2" })] }] });
    expect(r.grandTotal.total).toBe(0);
    expect(r.byCourse.rows[1].boys).toBe(4);
  });
});
