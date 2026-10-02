"use strict";
const {
  createDoc,
  drawHeader,
  drawTable,
  INSTITUTE_NAME,
  PAGE,
} = require("./pdfHelpers");

const LONG_TEXT =
  "Odam anatomiyasi, topografik anatomiya va operativ xirurgiya asoslari " +
  "(klinik ordinatura uchun kengaytirilgan kurs)";

function makeDoc() {
  const doc = createDoc();
  const spy = jest.spyOn(doc, "text");
  return { doc, spy };
}

const textCalls = (spy) => spy.mock.calls.map(([text, , , opts]) => ({ text, opts }));

describe("drawHeader — F-23 institut nomi", () => {
  test("default banner real institut nomi (umumiy «OLIY TA'LIM MUASSASASI» emas)", () => {
    const { doc, spy } = makeDoc();
    drawHeader(doc);
    const texts = textCalls(spy).map((c) => c.text);
    expect(INSTITUTE_NAME).toBe("FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI");
    expect(texts).toContain(INSTITUTE_NAME);
    expect(texts).not.toContain("OLIY TA'LIM MUASSASASI");
    doc.end();
  });

  test("aniq uzatilgan nom avvalgidek ustun", () => {
    const { doc, spy } = makeDoc();
    drawHeader(doc, "SINOV INSTITUTI");
    expect(textCalls(spy).map((c) => c.text)).toContain("SINOV INSTITUTI");
    doc.end();
  });
});

describe("drawTable — F-25 matn qisqartirilmaydi", () => {
  const columns = [
    { key: "no", header: "№", width: 0.5 },
    { key: "title", header: "Fan nomi", width: 3 },
    { key: "hours", header: "Soat", width: 1, align: "right" },
  ];

  test("hech bir katakda `ellipsis` yo'q, matn to'liq uzatiladi", () => {
    const { doc, spy } = makeDoc();
    drawTable(doc, columns, [{ no: 1, title: LONG_TEXT, hours: 120 }]);
    const calls = textCalls(spy);
    const long = calls.find((c) => c.text === LONG_TEXT);
    expect(long).toBeDefined();
    for (const c of calls) {
      expect(c.opts && c.opts.ellipsis).toBeFalsy();
      expect(c.opts && c.opts.lineBreak).toBe(true);
    }
    doc.end();
  });

  test("uzun matnli qator balandligi 18 pt dan katta (o'raladi)", () => {
    const { doc } = makeDoc();
    const y0 = doc.y;
    drawTable(doc, columns, [{ no: 1, title: LONG_TEXT, hours: 120 }]);
    const rowsHeight = doc.y - y0;
    expect(rowsHeight).toBeGreaterThan(20 + 18 + 4);
    doc.end();
  });

  test("qisqa matnli qatorlar avvalgidek 18 pt (regressiya: mavjud hujjatlar o'zgarmaydi)", () => {
    const { doc } = makeDoc();
    const y0 = doc.y;
    drawTable(doc, columns, [
      { no: 1, title: "Anatomiya", hours: 10 },
      { no: 2, title: "Fiziologiya", hours: 12 },
    ]);
    const total = doc.y - y0;
    expect(total).toBeGreaterThanOrEqual(56);
    expect(total).toBeLessThan(56 + 12);
    doc.end();
  });

  test("baland qatorlar sahifa oxirida yangi sahifa ochadi (kesilmaydi)", () => {
    const { doc } = makeDoc();
    const rows = Array.from({ length: 40 }, (_, i) => ({
      no: i + 1,
      title: LONG_TEXT,
      hours: i,
    }));
    const before = doc.bufferedPageRange().count;
    drawTable(doc, columns, rows);
    const after = doc.bufferedPageRange().count;
    expect(after).toBeGreaterThan(before);
    expect(doc.y).toBeLessThanOrEqual(PAGE.height - PAGE.margin);
    doc.end();
  });
});
