"use strict";

const {
  COLUMNS,
  REJECTED,
  REQUIRED_KEYS,
  matchHeader,
  normalizeHeader,
} = require("./rosterColumns");

describe("majburiy ustunlar", () => {
  it("aynan to'rttasi: familiya, ism, dastur, JSHSHIR", () => {
    expect(REQUIRED_KEYS.sort()).toEqual(["firstName", "jshshir", "lastName", "program"]);
  });
});

describe("qabul qilinadigan sarlavhalar", () => {
  it.each([
    ["Familiya", "lastName"],
    ["Ism", "firstName"],
    ["Otasining ismi", "middleName"],
    ["Ta'lim yo'nalishi", "program"],
    ["Dastur", "program"],
    ["JSHSHIR", "jshshir"],
    ["PINFL", "jshshir"],
    ["Mutaxassislik", "specialty"],
    ["Kafedra", "department"],
    ["Guruh", "group"],
    ["Kurs", "courseNumber"],
    ["O'quv yili", "academicYear"],
    ["Ta'lim turi", "fundingType"],
    ["O'qish muddati", "studyPeriod"],
    ["Qabul buyrug'i", "admissionOrder"],
    ["Qabul sanasi", "admissionDate"],
    ["Yashash manzili", "address"],
    ["Ish joyi", "workplace"],
    ["Xorijiy fuqaro", "foreign"],
    ["Diplom seriya", "diplomaSeria"],
  ])("%s -> %s", (header, key) => {
    expect(matchHeader(header)).toEqual({ key });
  });

  it("shablondagi har bir sarlavha o'z kalitiga qaytadi (aylanma tekshiruv)", () => {
    for (const c of COLUMNS) expect(matchHeader(c.header)).toEqual({ key: c.key });
  });

  it("apostrofning uch xil ko'rinishi bir xil", () => {
    const a = normalizeHeader("Ta'lim yo'nalishi");
    expect(normalizeHeader("Taʻlim yoʻnalishi")).toBe(a);
    expect(normalizeHeader("Ta’lim yo’nalishi")).toBe(a);
  });
});

describe("ataylab RAD ETILADIGAN sarlavhalar", () => {
  it.each([
    ["Rahbar", /qo'lda biriktiradi/],
    ["Klinik ustoz", /qo'lda biriktiradi/],
    ["supervisor", /qo'lda biriktiradi/],
    ["userId", /JSHSHIR bo'yicha/],
    ["Rol", /serverda belgilanadi/],
    ["Sababsiz soat", /tizim tomonidan hisoblanadi/],
    ["Chetlatish", /tizim tomonidan hisoblanadi/],
    ["Diplom fayli", /Fayl Excel'dan olinmaydi/],
    ["Faol", /Holat Excel'dan olinmaydi/],
  ])("%s -> rad etiladi", (header, re) => {
    const m = matchHeader(header);
    expect(m.key).toBeUndefined();
    expect(m.rejected).toMatch(re);
  });

  it("hech bir qabul qilinadigan ustun xom id emas", () => {
    expect(COLUMNS.find((c) => c.key === "user")).toBeUndefined();
    expect(COLUMNS.find((c) => c.key === "supervisor")).toBeUndefined();
  });
});

describe("shartnoma yaxlitligi", () => {
  it("bitta alias ikki xil ustunga tegishli EMAS", () => {
    const seen = new Map();
    for (const c of COLUMNS) {
      for (const a of [c.header, ...c.aliases]) {
        const k = normalizeHeader(a);
        if (seen.has(k)) expect(seen.get(k)).toBe(c.key);
        seen.set(k, c.key);
      }
    }
  });

  it("qabul qilinadigan va rad etiladigan ro'yxatlar KESISHMAYDI", () => {
    const accepted = new Set();
    for (const c of COLUMNS) {
      accepted.add(normalizeHeader(c.header));
      c.aliases.forEach((a) => accepted.add(normalizeHeader(a)));
    }
    const clash = [];
    for (const r of REJECTED) {
      for (const a of r.aliases) {
        if (accepted.has(normalizeHeader(a))) clash.push(a);
      }
    }
    expect(clash).toEqual([]);
  });
});
