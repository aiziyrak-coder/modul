"use strict";

const { COLUMNS, REJECTED, REQUIRED_KEYS, matchHeader, normalizeHeader } =
  require("./rosterColumns");

describe("normalizeHeader", () => {
  it("registr, bo'shliq va tinish belgilarini tashlaydi", () => {
    expect(normalizeHeader("  O'QUV  YILI ")).toBe(normalizeHeader("oquvyili"));
  });

  it("apostrofning uch xil ko'rinishi bir xil kalit beradi", () => {
    const a = normalizeHeader("Yo'nalish");
    expect(normalizeHeader("Yoʻnalish")).toBe(a);
    expect(normalizeHeader("Yo’nalish")).toBe(a);
  });
});

describe("majburiy ustunlar", () => {
  it("aynan uchtasi: familiya, ism, JSHSHIR", () => {
    expect(REQUIRED_KEYS.sort()).toEqual(["firstName", "jshshir", "lastName"]);
  });
});

describe("qabul qilinadigan sarlavhalar", () => {
  it.each([
    ["Familiya", "lastName"],
    ["FAMILIYASI", "lastName"],
    ["Ism", "firstName"],
    ["Otasining ismi", "middleName"],
    ["JSHSHIR", "jshshir"],
    ["PINFL", "jshshir"],
    ["Pasport seriya", "passportSeria"],
    ["Pasport raqami", "passportNumber"],
    ["Fakultet", "faculty"],
    ["Yo'nalish", "direction"],
    ["Kurs", "course"],
    ["Guruh", "group"],
    ["O'quv yili", "academicYear"],
    ["Email", "email"],
    ["Telefon", "phone"],
  ])("%s -> %s", (header, key) => {
    expect(matchHeader(header)).toEqual({ key });
  });

  it("shablondagi har bir sarlavha o'z kalitiga qaytadi (aylanma tekshiruv)", () => {
    for (const c of COLUMNS) {
      expect(matchHeader(c.header)).toEqual({ key: c.key });
    }
  });
});

describe("ataylab RAD ETILADIGAN sarlavhalar", () => {
  it.each([
    ["Jami ball", /reyting faqat TASDIQLANGAN/],
    ["totalScore", /reyting faqat TASDIQLANGAN/],
    ["Maslahatchi", /qo'lda tanlanadi/],
    ["advisorId", /qo'lda tanlanadi/],
    ["userId", /JSHSHIR bo'yicha/],
    ["Rol", /serverda belgilanadi/],
    ["facultyId", /serverda nom bo'yicha/],
    ["Faol", /Holat Excel'dan olinmaydi/],
  ])("%s -> rad etiladi", (header, re) => {
    const m = matchHeader(header);
    expect(m.key).toBeUndefined();
    expect(m.rejected).toMatch(re);
  });

  it("hech bir qabul qilinadigan ustun `id` bilan tugamaydi", () => {
    expect(COLUMNS.filter((c) => /Id$/.test(c.key))).toHaveLength(0);
    expect(COLUMNS.find((c) => c.key === "user")).toBeUndefined();
    expect(COLUMNS.find((c) => c.key === "advisorId")).toBeUndefined();
  });
});

describe("noma'lum va bo'sh sarlavhalar", () => {
  it.each(["", "   ", null, undefined, "Qandaydir ustun"])("%p -> null", (h) => {
    expect(matchHeader(h)).toBeNull();
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
