"use strict";

const { createDoc } = require("#shared/pdfGenerators/pdfHelpers");
const P = require("./autoAbsenceNotice.pdf");

const pageCount = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
const row = (i) => ({ day: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`, science: "Kardiologiya", lessonType: "amaliy", hours: 2 });
const SENTENCE =
  "Aliyev Sardor 2026/2027 o'quv yilida jami 6 soat mashg'ulotni sababsiz qoldirdi va 6 soatlik ostonaga yetdi (TZ 4.5.4).";
const INPUT = {
  resident: { fullName: "Aliyev Sardor", program: "ordinatura", specialty: "Kardiologiya", department: "Ichki kasalliklar", course: 2, group: "ORD-201" },
  countingYear: "2026/2027",
  hours: 6,
  rows: [row(0), row(1), row(2)],
  sentence: SENTENCE,
  generatedAt: new Date("2026-10-05T03:00:00Z"),
};

function drawnTexts(input) {
  const doc = createDoc();
  const texts = [];
  const original = doc.text.bind(doc);
  doc.text = (value, ...rest) => {
    texts.push(String(value));
    return original(value, ...rest);
  };
  P.render(doc, { rows: [], ...input });
  const pages = doc.bufferedPageRange().count;
  doc.end();
  return { texts, pages };
}

describe("buildAutoAbsenceNoticePdf — haqiqiy PDF", () => {
  test.each([
    ["0 qator", 0],
    ["3 qator", 3],
  ])("%s — bitta sahifa", async (_label, n) => {
    const buf = await P.buildAutoAbsenceNoticePdf({ ...INPUT, rows: Array.from({ length: n }, (_, i) => row(i)) });
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBe(1);
  });

  test("40 qator — ko'p sahifa, yiqilmaydi", async () => {
    const buf = await P.buildAutoAbsenceNoticePdf({ ...INPUT, hours: 80, rows: Array.from({ length: 40 }, (_, i) => row(i)) });
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBeGreaterThan(1);
  });

  test("bo'sh kirish bilan ham quriladi", async () => {
    const buf = await P.buildAutoAbsenceNoticePdf();
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
});

describe("asos va jadval — sof qismlar", () => {
  test("asos: o'quv yili, jami soat, ostona, ma'lumot holati (UZ sana)", () => {
    expect(P.basisFields(INPUT)).toEqual([
      ["O'quv yili", "2026/2027"],
      ["Jami sababsiz soat (joriy o'quv yili)", "6 soat"],
      ["Ostona (TZ 4.5.4)", "Sababsiz 6 soat — ogohlantirish va bildirgi · 72 soat — chetlatish buyrug'i loyihasi"],
      ["Ma'lumot holati", "05.10.2026"],
    ]);
  });

  test("jadval oxiri «Jami» = asosdagi soat; qatorlar ustoz bildirgisi kataklari bilan", () => {
    const rows = P.tableRows(INPUT.rows, 6);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ day: "01.09.2026", science: "Kardiologiya", lessonType: "Amaliy", hours: "2" });
    expect(rows.at(-1)).toEqual({ day: "Jami", science: "", lessonType: "", hours: "6" });
    expect(P.tableRows([], 0)).toEqual([{ day: "Jami", science: "", lessonType: "", hours: "0" }]);
  });

  test("soat ko'rinishi — suzuvchi nuqta qoldig'i qog'ozga tushmaydi", () => {
    expect(P.fmtHours(0.1 + 0.2)).toBe("0.3");
    expect(P.fmtHours(7.5)).toBe("7.5");
    expect(P.fmtHours(6)).toBe("6");
  });

  test("talaba kartasi — shaxsiy maydonsiz, kurs «N-kurs»", () => {
    const fields = P.residentFields({ ...INPUT.resident, jshshir: "31234567890123" });
    expect(fields.map(([label]) => label)).toEqual(["F.I.Sh", "Ta'lim yo'nalishi", "Mutaxassislik", "Kafedra", "Kurs", "Guruh"]);
    expect(fields[1][1]).toBe("Klinik ordinatura");
    expect(fields[4][1]).toBe("2-kurs");
    expect(JSON.stringify(fields)).not.toContain("31234567890123");
    expect(P.residentFields({})[4][1]).toBeNull();
  });

  test("shablon versiyasi va footer matni eksport qilingan", () => {
    expect(P.TEMPLATE_VERSION).toBe(1);
    expect(P.FOOTER_TEXT).toMatch(/avtomatik shakllantirildi/);
  });
});

describe("chizilgan matn — imzosiz, tizim hujjati", () => {
  test("manzil, «BILDIRGI», tizim jumlasi, «Jami» va footer bor", () => {
    const { texts } = drawnTexts(INPUT);
    expect(texts).toEqual(expect.arrayContaining([P.ADDRESSEE, "BILDIRGI", SENTENCE, "Jami", P.FOOTER_TEXT]));
  });

  test("imzo bloki va ustoz izohi YO'Q", () => {
    const joined = drawnTexts(INPUT).texts.join("\n");
    expect(joined).not.toMatch(/Klinik ustoz|Ustoz izohi|imzo/i);
  });

  test("footer HAR sahifada (40 qator)", () => {
    const { texts, pages } = drawnTexts({ ...INPUT, rows: Array.from({ length: 40 }, (_, i) => row(i)) });
    expect(pages).toBeGreaterThan(1);
    expect(texts.filter((t) => t === P.FOOTER_TEXT)).toHaveLength(pages);
  });

  test("qatorsiz — jadval bo'limi chizilmaydi", () => {
    const { texts } = drawnTexts({ ...INPUT, rows: [] });
    expect(texts).not.toContain("Jami");
  });
});
