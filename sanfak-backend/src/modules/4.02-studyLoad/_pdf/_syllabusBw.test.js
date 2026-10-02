"use strict";

const PDFDocument = require("pdfkit");
const {
  bwSectionTitle,
  bwTable,
  bwInfoTable,
  bwList,
} = require("./_syllabusBw");

const FORBIDDEN_HEX = [
  "#1a3c5e",
  "#2e6da4",
  "#e8f0fa",
  "#b0c4de",
  "#f5f8fc",
  "#1a7a4a",
  "#b8860b",
];

const newDoc = () =>
  new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
  });

const hasEllipsisOption = (calls) =>
  calls.some((c) =>
    c.some((arg) => arg && typeof arg === "object" && arg.ellipsis === true),
  );

describe("_syllabusBw — palitra qulfi (qora-oq, ramkali)", () => {
  const render = () => {
    const doc = newDoc();
    const fillColorSpy = jest.spyOn(PDFDocument.prototype, "fillColor");
    const strokeColorSpy = jest.spyOn(PDFDocument.prototype, "strokeColor");
    const fillSpy = jest.spyOn(PDFDocument.prototype, "fill");
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwSectionTitle(doc, "Fan maqsadi (FM)");
    bwTable(
      doc,
      [
        { header: "№", key: "n", width: 0.4 },
        { header: "Mavzu nomi", key: "topic", width: 5 },
      ],
      [
        { n: 1, topic: "Kirish" },
        { n: 2 },
      ],
    );
    bwInfoTable(doc, [
      ["Fan kodi", "FA1003"],
      ["Fan turi", null],
      [
        "Hujjat holati",
        "Tasdiqlangan",
        { valueColor: "#1a7a4a" },
      ],
    ]);
    bwList(doc, ["Birinchi band", "Ikkinchi band"]);
    bwList(doc, []);

    doc.end();

    const flat = (spy) =>
      spy.mock.calls.map((c) => c[0]).filter((v) => typeof v === "string");
    const result = {
      fillColors: flat(fillColorSpy),
      strokeColors: flat(strokeColorSpy),
      fills: flat(fillSpy),
      textCalls: textSpy.mock.calls,
    };
    fillColorSpy.mockRestore();
    strokeColorSpy.mockRestore();
    fillSpy.mockRestore();
    textSpy.mockRestore();
    return result;
  };

  test("rang chaqiruvlari yozilgan (spy ishlayapti)", () => {
    const { fillColors, strokeColors } = render();
    expect(fillColors.length).toBeGreaterThan(0);
    expect(strokeColors.length).toBeGreaterThan(0);
  });

  test("hech qanday katakda FON chizilmaydi (`doc.fill()` chaqirilmaydi)", () => {
    const { fills } = render();
    expect(fills).toEqual([]);
  });

  test("fillColor — faqat qora (`#000`), strokeColor — faqat ramka (`#444`)", () => {
    const { fillColors, strokeColors } = render();
    for (const c of fillColors) expect(c.toLowerCase()).toBe("#000");
    for (const c of strokeColors) expect(c.toLowerCase()).toBe("#444");
  });

  test("taqiqlangan (ko'k/yashil/amber) palitra hech bir rang chaqiruvida yo'q", () => {
    const { fillColors, strokeColors, fills } = render();
    const all = [...fillColors, ...strokeColors, ...fills].map((c) =>
      c.toLowerCase(),
    );
    for (const hex of FORBIDDEN_HEX) expect(all).not.toContain(hex);
  });

  test("eski `valueColor` (`#1a7a4a`) `bwInfoTable`da e'tiborga olinmaydi", () => {
    const { fillColors } = render();
    expect(fillColors).not.toContain("#1a7a4a");
  });

  test("hech qaysi `.text()` chaqiruvida `ellipsis` yo'q (matn kesilmaydi)", () => {
    const { textCalls } = render();
    expect(hasEllipsisOption(textCalls)).toBe(false);
  });
});

describe("bwSectionTitle — ramkali katak, qalin/markaz/qora", () => {
  test("ramka chiziladi (`rect`+`stroke`), fon YO'Q (`fill` chaqirilmaydi)", () => {
    const doc = newDoc();
    const rectSpy = jest.spyOn(PDFDocument.prototype, "rect");
    const strokeSpy = jest.spyOn(PDFDocument.prototype, "stroke");
    const fillSpy = jest.spyOn(PDFDocument.prototype, "fill");

    bwSectionTitle(doc, "Ta'lim natijalari (TN)");
    doc.end();

    expect(rectSpy).toHaveBeenCalledTimes(1);
    expect(strokeSpy).toHaveBeenCalled();
    expect(fillSpy).not.toHaveBeenCalled();
    rectSpy.mockRestore();
    strokeSpy.mockRestore();
    fillSpy.mockRestore();
  });

  test("matn markazda, qalin shrift bilan chiziladi", () => {
    const doc = newDoc();
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    const fontSpy = jest.spyOn(PDFDocument.prototype, "font");

    bwSectionTitle(doc, "Fan mazmuni");
    doc.end();

    const call = textSpy.mock.calls.find((c) => c[0] === "Fan mazmuni");
    expect(call).toBeDefined();
    expect(call[3]).toMatchObject({ align: "center" });
    expect(fontSpy.mock.calls.map((c) => c[0])).toContain("Helvetica-Bold");
    textSpy.mockRestore();
    fontSpy.mockRestore();
  });

  test("sahifa oxirida bo'lsa yangi sahifaga o'tadi (ensureSpace naqshi)", () => {
    const doc = newDoc();
    doc.y = 800;
    const addPageSpy = jest.spyOn(PDFDocument.prototype, "addPage");

    bwSectionTitle(doc, "Baholash mezonlari");
    doc.end();

    expect(addPageSpy).toHaveBeenCalled();
    addPageSpy.mockRestore();
  });

  test("uzun sarlavha kesilmaydi — katak balandligi matnga qarab o'sadi", () => {
    const doc = newDoc();
    const longText =
      "Bu juda uzun bo'lim sarlavhasi bo'lib, bitta qatorga sig'may, ikki yoki undan ko'p qatorga o'ralishi kutiladi va baribir to'liq chiziladi";
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwSectionTitle(doc, longText);
    doc.end();

    const call = textSpy.mock.calls.find((c) => c[0] === longText);
    expect(call).toBeDefined();
    textSpy.mockRestore();
  });
});

describe("bwTable — to'liq ramkali grid, sarlavha qalin qora", () => {
  const columns = [
    { header: "№", key: "n", width: 0.4 },
    { header: "Mavzu nomi", key: "topic", width: 5 },
    { header: "Soatlar", key: "hour", width: 0.8 },
  ];

  test("sarlavha matni chiziladi, bo'sh katak '—' bo'ladi", () => {
    const doc = newDoc();
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwTable(doc, columns, [{ n: 1, topic: "Kirish", hour: 2 }, { n: 2 }]);
    doc.end();

    const texts = textSpy.mock.calls.map((c) => c[0]);
    expect(texts).toContain("Mavzu nomi");
    expect(texts).toContain("Kirish");
    expect(texts).toContain("—");
    textSpy.mockRestore();
  });

  test("ustunlar orasida ichki chiziqlar chiziladi (to'liq grid)", () => {
    const doc = newDoc();
    const moveSpy = jest.spyOn(PDFDocument.prototype, "moveTo");
    const lineSpy = jest.spyOn(PDFDocument.prototype, "lineTo");

    bwTable(doc, columns, [{ n: 1, topic: "Kirish", hour: 2 }]);
    doc.end();

    expect(moveSpy.mock.calls.length).toBe(lineSpy.mock.calls.length);
    expect(moveSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
    moveSpy.mockRestore();
    lineSpy.mockRestore();
  });

  test("sahifa to'lganda sarlavha yangi sahifada QAYTA chiziladi", () => {
    const doc = newDoc();
    const oneColumn = [{ header: "N", key: "n", width: 1 }];
    const rows = Array.from({ length: 40 }, (_, i) => ({ n: i + 1 }));
    const addPageSpy = jest.spyOn(PDFDocument.prototype, "addPage");
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwTable(doc, oneColumn, rows);
    doc.end();

    expect(addPageSpy).toHaveBeenCalled();
    const headerOccurrences = textSpy.mock.calls.filter((c) => c[0] === "N").length;
    expect(headerOccurrences).toBeGreaterThanOrEqual(2);
    addPageSpy.mockRestore();
    textSpy.mockRestore();
  });

  test("uzun katak matni butunlay chiziladi (ellipsis yo'q, qisqartirilmaydi)", () => {
    const doc = newDoc();
    const longTopic =
      "Bu juda uzun mavzu nomi bo'lib, ustun kengligiga sig'maydi va bir necha qatorga o'ralishi kerak, lekin baribir to'liq ko'rinishi shart";
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwTable(doc, columns, [{ n: 1, topic: longTopic, hour: 2 }]);
    doc.end();

    const texts = textSpy.mock.calls.map((c) => c[0]);
    expect(texts).toContain(longTopic);
    expect(hasEllipsisOption(textSpy.mock.calls)).toBe(false);
    textSpy.mockRestore();
  });
});

describe("bwInfoTable — 2 ustunli ramkali kalit/qiymat", () => {
  test("yorliq ':' bilan, qiymat rangsiz qora chiziladi", () => {
    const doc = newDoc();
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwInfoTable(doc, [["Fan kodi", "FA1003"]]);
    doc.end();

    const texts = textSpy.mock.calls.map((c) => c[0]);
    expect(texts).toContain("Fan kodi:");
    expect(texts).toContain("FA1003");
    textSpy.mockRestore();
  });

  test("`null`/`undefined` qiymat — '—' chiziladi", () => {
    const doc = newDoc();
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwInfoTable(doc, [
      ["Fan turi", null],
      ["Izoh", undefined],
    ]);
    doc.end();

    const texts = textSpy.mock.calls.map((c) => c[0]);
    expect(texts.filter((t) => t === "—").length).toBeGreaterThanOrEqual(2);
    textSpy.mockRestore();
  });

  test("har qator uchun ramka chiziladi, fon YO'Q", () => {
    const doc = newDoc();
    const rectSpy = jest.spyOn(PDFDocument.prototype, "rect");
    const fillSpy = jest.spyOn(PDFDocument.prototype, "fill");

    bwInfoTable(doc, [
      ["Fan kodi", "FA1003"],
      ["Fan turi", "Majburiy"],
    ]);
    doc.end();

    expect(rectSpy.mock.calls.length).toBe(2);
    expect(fillSpy).not.toHaveBeenCalled();
    rectSpy.mockRestore();
    fillSpy.mockRestore();
  });
});

describe("bwList — raqamli ro'yxat, ko'k nuqta YO'Q", () => {
  test("har band '1.', '2.' bilan raqamlanadi", () => {
    const doc = newDoc();
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwList(doc, ["Birinchi band", "Ikkinchi band"]);
    doc.end();

    const texts = textSpy.mock.calls.map((c) => c[0]);
    expect(texts).toContain("1.");
    expect(texts).toContain("2.");
    expect(texts).toContain("Birinchi band");
    expect(texts).toContain("Ikkinchi band");
    textSpy.mockRestore();
  });

  test("bullet doira (`circle`) chizilmaydi", () => {
    const doc = newDoc();
    const circleSpy = jest.spyOn(PDFDocument.prototype, "circle");

    bwList(doc, ["Band"]);
    doc.end();

    expect(circleSpy).not.toHaveBeenCalled();
    circleSpy.mockRestore();
  });

  test("bo'sh ro'yxat — '—' chiziladi", () => {
    const doc = newDoc();
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");

    bwList(doc, []);
    doc.end();

    expect(textSpy.mock.calls.map((c) => c[0])).toContain("—");
    textSpy.mockRestore();
  });
});
