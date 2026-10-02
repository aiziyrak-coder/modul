"use strict";

const {
  buildAuditoriumColumns,
  AUD_LABEL,
  AUD_FALLBACK,
  serialNumberText,
} = require("./scienceProgramV142.pdf");
const {
  AUDITORIUM_SLUG_ORDER,
} = require("#modules/4.02-studyLoad/_services/scienceProgramMeta");

const item = (slug, value, title = `xom ${slug}`) => ({ slug, title, value });
const slugs = (r) => r.cols.map((c) => c.slug);
const labels = (r) => r.cols.map((c) => c.label);

describe("buildAuditoriumColumns — tartib va allowlist", () => {
  test("aralash tartibdagi hourItems KANONIK tartibga tushadi (maruza → amaliy → laboratoriya)", () => {
    const r = buildAuditoriumColumns({
      hourItems: [item("laboratoriya", 14), item("maruza", 30), item("amaliy", 16)],
    });
    expect(slugs(r)).toEqual(["maruza", "amaliy", "laboratoriya"]);
    expect(r.cols.map((c) => c.value)).toEqual([30, 16, 14]);
    expect(r.total).toBe(60);
    expect(r.fallback).toBe(false);
  });

  test("besh tur ham bo'lsa — tartib AUDITORIUM_SLUG_ORDER bilan AYNAN bir xil", () => {
    const r = buildAuditoriumColumns({
      hourItems: [
        item("klinik_amaliyot", 24),
        item("seminar", 8),
        item("laboratoriya", 6),
        item("amaliy", 20),
        item("maruza", 10),
      ],
    });
    expect(slugs(r)).toEqual([...AUDITORIUM_SLUG_ORDER]);
    expect(r.total).toBe(68);
  });

  test("`mustaqil` auditoriya guruhiga HECH QACHON kirmaydi va jamiga qo'shilmaydi", () => {
    const r = buildAuditoriumColumns({
      hourItems: [item("maruza", 30), item("mustaqil", 60), item("amaliy", 30)],
    });
    expect(slugs(r)).toEqual(["maruza", "amaliy", "laboratoriya"]);
    expect(r.total).toBe(60);
  });

  test("begona slug'lar (soat/jami/kurs_ishi/foiz) ustun bo'lmaydi — R-4.02-27 yopilish mezoni", () => {
    const r = buildAuditoriumColumns({
      hourItems: [
        item("soat", 120),
        item("jami", 60),
        item("kurs_ishi", 10),
        item("foiz", 50),
        item("maruza", 30),
      ],
    });
    expect(slugs(r)).toEqual(["maruza", "laboratoriya"]);
    expect(r.total).toBe(30);
  });

  test("qiymati 0 bo'lgan tur ustun bo'lmaydi — FAQAT «laboratoriya» istisno (egasi 2026-09-16: doim, 0 bilan)", () => {
    const r = buildAuditoriumColumns({
      hourItems: [item("maruza", 30), item("seminar", 0), item("laboratoriya", 0)],
    });
    expect(slugs(r)).toEqual(["maruza", "laboratoriya"]);
    expect(r.cols[1].value).toBe(0);
    expect(r.total).toBe(30);
  });
});

describe("buildAuditoriumColumns — yorliqlar (Kengash #6)", () => {
  test("yorliq `hourItems[].title`dan XOM olinmaydi — qat'iy AUD_LABEL", () => {
    const r = buildAuditoriumColumns({
      hourItems: [item("maruza", 30, "NOTO'G'RI yorliq"), item("laboratoriya", 14, "Laboratoriya mashg'uloti")],
    });
    expect(labels(r)).toEqual(["Ma'ruza", "Lab-ya"]);
  });

  test("klinik ustun yorlig'i — «Klinik o'quv amaliyoti» (institut .docx), eng oxirida", () => {
    const r = buildAuditoriumColumns({
      hourItems: [item("klinik_amaliyot", 24), item("maruza", 10), item("amaliy", 20)],
    });
    expect(slugs(r)).toEqual(["maruza", "amaliy", "laboratoriya", "klinik_amaliyot"]);
    expect(r.cols[3].label).toBe("Klinik o'quv amaliyoti");
    expect(r.total).toBe(54);
  });

  test("AUD_LABEL allowlist'dagi har slug uchun yorliq beradi", () => {
    for (const slug of AUDITORIUM_SLUG_ORDER) expect(typeof AUD_LABEL[slug]).toBe("string");
  });
});

describe("buildAuditoriumColumns — bo'sh holat (shablon 19-bet zaxirasi)", () => {
  test.each([
    ["hourItems bo'sh", { hourItems: [] }],
    ["hourItems yo'q", {}],
    ["sp null", null],
    ["faqat mustaqil", { hourItems: [item("mustaqil", 60)] }],
    ["hamma qiymat 0", { hourItems: [item("maruza", 0), item("amaliy", 0)] }],
  ])("%s → Ma'ruza | Amaliy | Lab-ya, qiymatlar null, total 0, fallback:true", (_n, sp) => {
    const r = buildAuditoriumColumns(sp);
    expect(slugs(r)).toEqual([...AUD_FALLBACK]);
    expect(labels(r)).toEqual(["Ma'ruza", "Amaliy", "Lab-ya"]);
    expect(r.cols.every((c) => c.value === null)).toBe(true);
    expect(r.total).toBe(0);
    expect(r.fallback).toBe(true);
  });
});

describe("buildAuditoriumColumns — klinik ajratish (ADR-018 qayta ishlatiladi)", () => {
  test("default (reja konteksti yo'q) — hourItems SAQLANGANIDEK, klinik ustun hosil qilinmaydi", () => {
    const r = buildAuditoriumColumns({ hourItems: [item("maruza", 10), item("amaliy", 44)] });
    expect(slugs(r)).toEqual(["maruza", "amaliy", "laboratoriya"]);
    expect(r.cols[1].value).toBe(44);
    expect(r.cols[2].value).toBe(0);
  });

  test("isClinical:true — klinik soat amaliydan ajratiladi, auditoriya JAMI o'zgarmaydi", () => {
    const r = buildAuditoriumColumns(
      { hourItems: [item("maruza", 10), item("amaliy", 44)] },
      { isClinical: true },
    );
    expect(slugs(r)).toEqual(["maruza", "amaliy", "laboratoriya", "klinik_amaliyot"]);
    const byslug = Object.fromEntries(r.cols.map((c) => [c.slug, c.value]));
    expect(byslug.amaliy + byslug.klinik_amaliyot).toBe(44);
    expect(byslug.klinik_amaliyot).toBeGreaterThan(0);
    expect(r.total).toBe(54);
  });
});

describe("serialNumberText — yo'nalish kodi bilan", () => {
  const dir = { directionCode: "60910200", name: "Davolash ishi" };
  test("kod + tartib raqami, uzun tire bilan", () => {
    expect(serialNumberText({ serialNumber: "1.10", directions: [dir] })).toBe("60910200 — 1.10");
  });
  test("tartib raqami allaqachon kod bilan boshlansa — takrorlanmaydi", () => {
    expect(serialNumberText({ serialNumber: "60910200 — 3.07", directions: [dir] })).toBe("60910200 — 3.07");
  });
  test("yo'nalish kodi yo'q → faqat tartib raqami; tartib yo'q → null", () => {
    expect(serialNumberText({ serialNumber: "1.10", directions: [{ name: "X" }] })).toBe("1.10");
    expect(serialNumberText({ serialNumber: "1.10", directions: [] })).toBe("1.10");
    expect(serialNumberText({ serialNumber: null, directions: [dir] })).toBeNull();
  });
});
