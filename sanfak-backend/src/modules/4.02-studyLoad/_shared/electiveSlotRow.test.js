"use strict";

const {
  HOURS_PER_CREDIT,
  WEEKS_PER_SEMESTER,
  isEmptySlotRow,
  slotRatios,
  slotParticles,
  slotSerial,
  nextSlotSerial,
  slotRowFromValues,
  buildQuotaSlotRow,
} = require("./electiveSlotRow");
const { EMPTY_SLOT_TITLE } = require("./planRowType");

const tf2 = (extra = {}) => ({
  blockCode: "TF2",
  serialNumber: "2",
  code: "TF2",
  title: "Tanlov fanlar",
  totalCredit: 24,
  particle: [
    { slug: "soat", slugRef: "r1", title: "soat", value: 720, canonical: "hour", colNum: 4 },
    { slug: "foiz", slugRef: "r2", title: "%", value: 0, canonical: "percent", colNum: 5 },
    { slug: "jami", slugRef: "r3", title: "Jami", value: 360, canonical: "total", colNum: 6 },
    { slug: "maruza", slugRef: "r4", title: "Ma'ruza", value: 84, canonical: "lecture", colNum: 7 },
    { slug: "mustaqil_talim", slugRef: "r5", title: "Mustaqil ta'lim", value: 360, canonical: "independent", colNum: 12 },
  ],
  semesters: {
    3: { hour: 3, credit: 3 },
    4: { hour: 5, credit: 5 },
    5: { hour: 5, credit: 5 },
    6: { hour: 3, credit: 3 },
    7: { hour: 2, credit: 2 },
    8: { hour: 4, credit: 4 },
    12: { hour: 2, credit: 2 },
  },
  sciences: [],
  ...extra,
});

describe("isEmptySlotRow — uch shart birga (planRowType + cleanup skripti bilan bir xil)", () => {
  test("bo'sh slot", () => {
    expect(isEmptySlotRow({ title: EMPTY_SLOT_TITLE, science: null, code: null })).toBe(true);
  });
  test.each([
    ["fan bor", { title: EMPTY_SLOT_TITLE, science: "sci-1", code: null }],
    ["kod bor", { title: EMPTY_SLOT_TITLE, science: null, code: "X1" }],
    ["nomi boshqa", { title: "Falsafa", science: null, code: null }],
    ["null", null],
  ])("%s → false", (_, row) => {
    expect(isEmptySlotRow(row)).toBe(false);
  });
});

describe("slotRatios — nisbatlar blok sarlavhasidan, yaroqsiz bo'lsa zaxira", () => {
  test("TF2 namuna: 720/24 = 30 soat/kredit, 360/24 = 15 hafta", () => {
    expect(slotRatios(tf2())).toEqual({ hoursPerCredit: 30, weeksPerSemester: 15 });
  });
  test("sarlavha bo'sh → nomlangan zaxira", () => {
    expect(slotRatios({ particle: [], semesters: {}, totalCredit: 0 })).toEqual({
      hoursPerCredit: HOURS_PER_CREDIT,
      weeksPerSemester: WEEKS_PER_SEMESTER,
    });
  });
  test("ziddiyatli sarlavha (nisbat me'yordan tashqari) → zaxira", () => {
    const b = tf2({ semesters: { 3: { hour: 3, credit: 3 } } });
    expect(slotRatios(b).weeksPerSemester).toBe(WEEKS_PER_SEMESTER);
  });
});

describe("slotParticles — kvotadan soat taqsimoti", () => {
  test("5 kredit / 5 haftalik: umumiy 150, auditoriya 75, mustaqil 75; qolgani 0", () => {
    const p = slotParticles(tf2(), 5, 5);
    const bySlug = Object.fromEntries(p.map((x) => [x.slug, x.value]));
    expect(bySlug).toEqual({ soat: 150, foiz: 0, jami: 75, maruza: 0, mustaqil_talim: 75 });
    expect(p[0]).toMatchObject({ slug: "soat", slugRef: "r1", canonical: "hour", colNum: 4 });
  });
  test("sarlavha particle'siz blok → minimal 3 ustun (soat/jami/mustaqil)", () => {
    const p = slotParticles({ particle: [], semesters: {} }, 2, 2);
    expect(p.map((x) => `${x.slug}=${x.value}`)).toEqual(["soat=60", "jami=30", "mustaqil_talim=30"]);
  });
});

describe("slotSerial — leaf `2.0N`", () => {
  test.each([
    [{ serialNumber: "2" }, 1, "2.01"],
    [{ serialNumber: "2.00" }, 3, "2.03"],
    [{ serialNumber: null }, 1, "2.01"],
    [{ serialNumber: "2" }, 12, "2.12"],
  ])("blok %j, tartib %i → %s", (block, i, expected) => {
    expect(slotSerial(block, i)).toBe(expected);
  });
});

describe("nextSlotSerial — mavjud qatorlar maksimumi + 1 (Nigora S1)", () => {
  test.each([
    [[], "2.01"],
    [[{ serialNumber: "2.01" }], "2.02"],
    [[{ serialNumber: "2.02" }], "2.03"],
    [[{ serialNumber: "2.01" }, { serialNumber: "2.05" }, { serialNumber: "x" }], "2.06"],
    [[{ serialNumber: null }, { serialNumber: "1.3.1" }], "2.01"],
  ])("qatorlar %j → %s", (rows, expected) => {
    expect(nextSlotSerial({ serialNumber: "2" }, rows)).toBe(expected);
  });
});

describe("buildQuotaSlotRow — qoldiq kvotadan slot", () => {
  test("kvota-faqat TF2, 4-semestr → slot 5 kredit / 5 haftalik, particle bo'sh EMAS (ADR-025 #4)", () => {
    const row = buildQuotaSlotRow(tf2(), "4", { existingRows: [] });
    expect(row).toMatchObject({
      serialNumber: "2.01",
      code: null,
      title: EMPTY_SLOT_TITLE,
      science: null,
      department: null,
      totalCredit: 5,
      weeklyHours: 5,
      evaluationType: null,
      alternatives: [],
    });
    expect(row.particle.length).toBeGreaterThan(0);
    expect(isEmptySlotRow(row)).toBe(true);
  });

  test("kvota QISMAN band (o'quv rejada 2 kreditlik fan bor) → slot faqat qoldiq (3/3)", () => {
    const b = tf2({
      sciences: [
        { serialNumber: "2.01", code: "FA2001", title: "Tibbiy statistika", science: "sci-1", semesters: { 4: { hour: 2, credit: 2 } }, totalCredit: 2 },
      ],
    });
    const row = buildQuotaSlotRow(b, "4", { existingRows: [{ serialNumber: "2.01" }] });
    expect(row).toMatchObject({ serialNumber: "2.02", totalCredit: 3, weeklyHours: 3 });
  });

  test("kvota to'liq band → null (slot yo'q)", () => {
    const b = tf2({
      sciences: [
        { code: "FA2001", science: "sci-1", semesters: { 4: { hour: 5, credit: 5 } }, totalCredit: 5 },
      ],
    });
    expect(buildQuotaSlotRow(b, "4")).toBeNull();
  });

  test("shu semestrga kvota ajratilmagan → null", () => {
    expect(buildQuotaSlotRow(tf2(), "1")).toBeNull();
  });

  test("majburiy blok → hech qachon slot emas", () => {
    expect(buildQuotaSlotRow(tf2({ blockCode: "MF1", title: "Majburiy fanlar" }), "4")).toBeNull();
  });

  test("semestrlar Map bo'lsa ham ishlaydi (mongoose)", () => {
    const b = tf2({ semesters: new Map([["4", { hour: 5, credit: 5 }]]) });
    expect(buildQuotaSlotRow(b, "4")).toMatchObject({ totalCredit: 5 });
  });
});

describe("slotRowFromValues — qiymatlar berilgan slot (propagate/retract uchun)", () => {
  test("qoldiq 3/3 → slot 3/3, particle qayta hisoblangan", () => {
    const row = slotRowFromValues(tf2(), 3, 3, "2.02");
    expect(row).toMatchObject({ serialNumber: "2.02", totalCredit: 3, weeklyHours: 3 });
    expect(row.particle.find((p) => p.slug === "soat").value).toBe(90);
  });
});
