"use strict";

const PDFDocument = require("pdfkit");
const {
  drawSignatureBlock,
  measureSignatureBlock,
  layoutSignatureBlock,
} = require("./signatureBlock");

const makeDoc = () => new PDFDocument({ size: "A4", margin: 0 });

describe("drawSignatureBlock — chiziq CHIZILMAYDI (ADR-021 Qaror #1)", () => {
  test("moveTo/lineTo hech qachon chaqirilmaydi (sig.name bor holatda ham)", () => {
    const doc = makeDoc();
    const moveSpy = jest.spyOn(doc, "moveTo");
    const lineSpy = jest.spyOn(doc, "lineTo");

    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    });

    expect(moveSpy).not.toHaveBeenCalled();
    expect(lineSpy).not.toHaveBeenCalled();
  });
});

describe("drawSignatureBlock — geometriya", () => {
  test("heading/position/name/date bir xil x'da, ketma-ket y'larda chiziladi", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");

    drawSignatureBlock(doc, {
      x: 100,
      y: 50,
      w: 200,
      heading: '"KELISHILDI"',
      position: "O'quv ishlari bo'yicha prorektor",
      sig: { name: "U. Boltaboyev", dateText: "2026-yil “ 3 ” sentabr", source: "chain" },
    });

    const calls = spy.mock.calls;
    const headingCall = calls.find((c) => c[0] === '"KELISHILDI"');
    const positionCall = calls.find((c) => c[0] === "O'quv ishlari bo'yicha prorektor");
    const nameCall = calls.find((c) => c[0] === "U. Boltaboyev");

    expect(headingCall[1]).toBe(100);
    expect(positionCall[1]).toBe(100);
    expect(nameCall[1]).toBe(100);
    expect(positionCall[2]).toBeGreaterThan(headingCall[2]);
    expect(nameCall[2]).toBeGreaterThan(positionCall[2]);
  });

  test("`position` massiv bo'lsa — har qator ALOHIDA `doc.text` chaqiruvi (aniq matn saqlanadi)", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");

    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      heading: '"KELISHILDI"',
      position: [
        "O'quv ishlari bo'yicha prorektor",
        { text: "Farg'ona jamoat salomatligi tibbiyot instituti", fs: 6.5 },
      ],
      sig: {},
    });

    const texts = spy.mock.calls.map((c) => c[0]);
    expect(texts).toContain("O'quv ishlari bo'yicha prorektor");
    expect(texts).toContain("Farg'ona jamoat salomatligi tibbiyot instituti");
    expect(texts).not.toContain(
      "O'quv ishlari bo'yicha prorektor\nFarg'ona jamoat salomatligi tibbiyot instituti",
    );
  });

  test("balandlik deterministik — bir xil kirish bilan ikki marta chaqirilsa bir xil qiymat qaytadi", () => {
    const opts = {
      x: 18,
      y: 20,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    };
    const h1 = drawSignatureBlock(makeDoc(), opts);
    const h2 = drawSignatureBlock(makeDoc(), opts);
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThan(0);
  });

  test("heading bo'lmasa — sarlavha chizilmaydi, balandlik kichikroq", () => {
    const doc1 = makeDoc();
    const withHeading = drawSignatureBlock(doc1, {
      x: 18,
      y: 0,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: {},
    });
    const doc2 = makeDoc();
    const withoutHeading = drawSignatureBlock(doc2, {
      x: 18,
      y: 0,
      w: 200,
      position: "Rektor",
      sig: {},
    });
    expect(withoutHeading).toBeLessThan(withHeading);
  });
});

describe("drawSignatureBlock — holat qatori FAQAT haqiqat (ADR-021 Qaror #4)", () => {
  test.each(["snapshot", "chain"])("source=%s — 'Elektron tasdiqlangan' chiziladi", (source) => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      sig: { name: "A. Aliyev", dateText: "2026-yil", source },
    });
    expect(spy.mock.calls.map((c) => c[0])).toContain("Elektron tasdiqlangan");
  });

  test.each(["manual", "none", undefined])("source=%s — 'Elektron tasdiqlangan' CHIZILMAYDI", (source) => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      sig: { name: "A. Aliyev", dateText: "2026-yil", source },
    });
    expect(spy.mock.calls.map((c) => c[0])).not.toContain("Elektron tasdiqlangan");
  });
});

describe("drawSignatureBlock — `gapText` (imzo bo'shlig'idagi kursiv matn)", () => {
  const base = { x: 18, y: 20, w: 200, position: "Rektor" };

  test("gapText berilsa — matn chiziladi va 'Elektron tasdiqlangan' CHIZILMAYDI (takror emas)", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, {
      ...base,
      sig: { name: "A. Aliyev", dateText: "2026-yil", source: "chain" },
      gapText: "ERI bilan imzolangan",
    });
    const texts = spy.mock.calls.map((c) => c[0]);
    expect(texts).toContain("ERI bilan imzolangan");
    expect(texts).not.toContain("Elektron tasdiqlangan");
  });

  test("gapText BALANDLIKNI o'zgartirmaydi (bo'shliq ichida chiziladi)", () => {
    const sig = { name: "A. Aliyev", dateText: "2026-yil", source: "manual" };
    const without = measureSignatureBlock(makeDoc(), { ...base, sig });
    const withText = measureSignatureBlock(makeDoc(), { ...base, sig, gapText: "ERI bilan imzolangan" });
    expect(withText).toBe(without);
  });

  test("gapText kursiv va kichikroq (6pt) shriftda, lavozimdan PASTDA, F.I.O dan YUQORIDA", () => {
    const doc = makeDoc();
    const calls = [];
    const origFont = doc.font.bind(doc);
    const origSize = doc.fontSize.bind(doc);
    let curFont = null, curSize = null;
    jest.spyOn(doc, "font").mockImplementation((f) => { curFont = f; return origFont(f); });
    jest.spyOn(doc, "fontSize").mockImplementation((n) => { curSize = n; return origSize(n); });
    jest.spyOn(doc, "text").mockImplementation((t, x, y) => { calls.push({ t, y, font: curFont, size: curSize }); return doc; });
    drawSignatureBlock(doc, {
      ...base,
      sig: { name: "A. Aliyev", dateText: "2026-yil", source: "chain" },
      gapText: "ERI bilan imzolangan",
    });
    const gap = calls.find((c) => c.t === "ERI bilan imzolangan");
    const pos = calls.find((c) => c.t === "Rektor");
    const name = calls.find((c) => c.t === "A. Aliyev");
    expect(gap.font).toBe("Helvetica-Oblique");
    expect(gap.size).toBe(6);
    expect(gap.y).toBeGreaterThan(pos.y);
    expect(gap.y).toBeLessThan(name.y);
  });

  test("gapText berilmasa — eski xulq (holat qatori chiziladi)", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, { ...base, sig: { name: "A. Aliyev", source: "chain" } });
    const texts = spy.mock.calls.map((c) => c[0]);
    expect(texts).toContain("Elektron tasdiqlangan");
    expect(texts).not.toContain("ERI bilan imzolangan");
  });
});

describe("drawSignatureBlock — `fonts` override (Times New Roman va h.k. hujjatlar uchun)", () => {
  test("`fonts` berilmasa — default Helvetica* nomlari ishlatiladi (mavjud xulq o'zgarmaydi)", () => {
    const doc = makeDoc();
    const fontSpy = jest.spyOn(doc, "font");
    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    });
    const fontNames = fontSpy.mock.calls.map((c) => c[0]);
    expect(fontNames).toContain("Helvetica-Bold");
    expect(fontNames).toContain("Helvetica");
    expect(fontNames).not.toEqual(expect.arrayContaining(["TNR", "TNR-B", "TNR-I"]));
  });

  test("`fonts:{bold,regular,italic}` berilsa — shu nomlar ishlatiladi (masalan scienceProgram TNR)", () => {
    const doc = makeDoc();
    const fontSpy = jest.spyOn(doc, "font").mockImplementation(function (name) {
      this._fontFamily = name;
      return this;
    });
    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
      fonts: { bold: "TNR-B", regular: "TNR", italic: "TNR-I" },
    });
    const fontNames = fontSpy.mock.calls.map((c) => c[0]);
    expect(fontNames).toContain("TNR-B");
    expect(fontNames).toContain("TNR");
    expect(fontNames).not.toContain("Helvetica-Bold");
    expect(fontNames).not.toContain("Helvetica");
    fontSpy.mockRestore();
  });

  test("`fonts.italic` faqat holat qatorida ishlatiladi (source=chain)", () => {
    const doc = makeDoc();
    const fontSpy = jest.spyOn(doc, "font").mockImplementation(function (name) {
      this._fontFamily = name;
      return this;
    });
    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
      fonts: { bold: "TNR-B", regular: "TNR", italic: "TNR-I" },
    });
    expect(fontSpy.mock.calls.map((c) => c[0])).toContain("TNR-I");
    fontSpy.mockRestore();
  });
});

describe("drawSignatureBlock — `scale` override (tor joyga sig'dirish uchun)", () => {
  test("`scale` berilmasa (default 1) — balandlik ADR-021 qat'iy konstantalar bilan bir xil", () => {
    const opts = {
      x: 18,
      y: 0,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    };
    const withoutScale = drawSignatureBlock(makeDoc(), opts);
    const withScale1 = drawSignatureBlock(makeDoc(), { ...opts, scale: 1 });
    expect(withScale1).toBe(withoutScale);
  });

  test("`scale < 1` — balandlik proporsional kichikroq", () => {
    const opts = {
      x: 18,
      y: 0,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    };
    const full = drawSignatureBlock(makeDoc(), opts);
    const half = drawSignatureBlock(makeDoc(), { ...opts, scale: 0.5 });
    expect(half).toBeLessThan(full);
    expect(half).toBeCloseTo(full * 0.5, 0);
  });

  test("`scale` bilan ham chiziq CHIZILMAYDI (moveTo/lineTo hamon 0)", () => {
    const doc = makeDoc();
    const moveSpy = jest.spyOn(doc, "moveTo");
    const lineSpy = jest.spyOn(doc, "lineTo");
    drawSignatureBlock(doc, {
      x: 18,
      y: 20,
      w: 200,
      heading: '"KELISHILDI"',
      position: "Prorektor",
      sig: { name: "U. Boltaboyev", dateText: "2026", source: "chain" },
      scale: 0.6,
    });
    expect(moveSpy).not.toHaveBeenCalled();
    expect(lineSpy).not.toHaveBeenCalled();
  });
});

describe("drawSignatureBlock — `gapSignature` opsiyasi", () => {
  test("berilmasa — default 16pt (mavjud xulq AYNAN saqlanadi)", () => {
    const opts = {
      x: 18,
      y: 0,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    };
    const withoutOpt = drawSignatureBlock(makeDoc(), opts);
    const with16 = drawSignatureBlock(makeDoc(), { ...opts, gapSignature: 16 });
    expect(with16).toBe(withoutOpt);
  });

  test("kichikroq qiymat (8) — balandlik proporsional kamayadi, boshqa hech narsa o'zgarmaydi", () => {
    const opts = {
      x: 18,
      y: 0,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    };
    const full = drawSignatureBlock(makeDoc(), opts);
    const reduced = drawSignatureBlock(makeDoc(), { ...opts, gapSignature: 8 });
    expect(reduced).toBeCloseTo(full - 8, 9);
  });

  test("boshqa 8 generator `gapSignature` uzatmaydi — global GAP_BEFORE_SIGNATURE=16 o'zgarmadi (regressiya)", () => {
    const h = drawSignatureBlock(makeDoc(), {
      x: 18,
      y: 0,
      w: 200,
      position: "Kafedra mudiri",
      sig: {},
    });
    const h2 = drawSignatureBlock(makeDoc(), {
      x: 18,
      y: 0,
      w: 200,
      position: "Kafedra mudiri",
      sig: {},
      gapSignature: 16,
    });
    expect(h).toBe(h2);
  });
});

describe('drawSignatureBlock — layout:"row"', () => {
  const rowOpts = (sig) => ({
    x: 100,
    y: 50,
    w: 400,
    layout: "row",
    position: "Kafedra mudiri",
    sig,
  });

  test("default `layout` (berilmasa) — stack (mavjud xulq)", () => {
    const h1 = drawSignatureBlock(makeDoc(), {
      x: 18,
      y: 0,
      w: 200,
      position: "Rektor",
      sig: {},
    });
    const h2 = drawSignatureBlock(makeDoc(), {
      x: 18,
      y: 0,
      w: 200,
      layout: "stack",
      position: "Rektor",
      sig: {},
    });
    expect(h1).toBe(h2);
  });

  test("uch ustun: lavozim(chap) → holat(o'rta) → F.I.O(o'ng), bir xil y'da", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    drawSignatureBlock(
      doc,
      rowOpts({ name: "R. Karimov", dateText: "2026-yil", source: "chain" }),
    );
    const calls = spy.mock.calls;
    const posCall = calls.find((c) => c[0] === "Kafedra mudiri");
    const statusCall = calls.find((c) => c[0] === "Elektron tasdiqlangan");
    const nameCall = calls.find((c) => c[0] === "R. Karimov");

    expect(posCall).toBeTruthy();
    expect(statusCall).toBeTruthy();
    expect(nameCall).toBeTruthy();
    expect(statusCall[2]).toBe(posCall[2]);
    expect(nameCall[2]).toBe(posCall[2]);
    expect(posCall[1]).toBeLessThan(statusCall[1]);
    expect(statusCall[1]).toBeLessThan(nameCall[1]);
  });

  test("holat matni FAQAT chain/snapshot da (ADR-021 Qaror #4 row'da ham amal qiladi)", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    drawSignatureBlock(
      doc,
      rowOpts({ name: "R. Karimov", dateText: "2026-yil", source: "manual" }),
    );
    expect(spy.mock.calls.map((c) => c[0])).not.toContain("Elektron tasdiqlangan");
  });

  test("bo'sh `sig.name` bilan ham chizishda xatolik yo'q, ism qatori chizilmaydi", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    expect(() =>
      drawSignatureBlock(doc, rowOpts({ name: "", dateText: "", source: "none" })),
    ).not.toThrow();
    expect(spy.mock.calls.map((c) => c[0])).not.toContain(undefined);
  });

  test("`heading` row rejimida chizilmaydi (bugungi ikkita chaqiruvchida heading yo'q)", () => {
    const doc = makeDoc();
    const spy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, {
      ...rowOpts({ name: "", dateText: "", source: "none" }),
      heading: '"TASDIQLAYMAN"',
    });
    expect(spy.mock.calls.map((c) => c[0])).not.toContain('"TASDIQLAYMAN"');
  });

  test("chiziq CHIZILMAYDI (row'da ham, ADR-021 Qaror #1)", () => {
    const doc = makeDoc();
    const moveSpy = jest.spyOn(doc, "moveTo");
    const lineSpy = jest.spyOn(doc, "lineTo");
    drawSignatureBlock(
      doc,
      rowOpts({ name: "R. Karimov", dateText: "2026-yil", source: "chain" }),
    );
    expect(moveSpy).not.toHaveBeenCalled();
    expect(lineSpy).not.toHaveBeenCalled();
  });
});

describe("measureSignatureBlock — YAGONA geometriya manbai", () => {
  test("stack: balandlik `drawSignatureBlock` bilan AYNAN bir xil", () => {
    const opts = {
      x: 18,
      y: 0,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    };
    const measured = measureSignatureBlock(makeDoc(), opts);
    const drawn = drawSignatureBlock(makeDoc(), opts);
    expect(measured).toBe(drawn);
  });

  test("row: balandlik `drawSignatureBlock` bilan AYNAN bir xil", () => {
    const opts = {
      x: 18,
      y: 0,
      w: 400,
      layout: "row",
      position: "Kafedra mudiri",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    };
    const measured = measureSignatureBlock(makeDoc(), opts);
    const drawn = drawSignatureBlock(makeDoc(), opts);
    expect(measured).toBe(drawn);
  });

  test("hech qanday matn/chiziq chaqirilmaydi (faqat o'lchaydi)", () => {
    const doc = makeDoc();
    const textSpy = jest.spyOn(doc, "text");
    const moveSpy = jest.spyOn(doc, "moveTo");
    measureSignatureBlock(doc, {
      x: 18,
      y: 0,
      w: 200,
      heading: '"TASDIQLAYMAN"',
      position: "Rektor",
      sig: { name: "R. Karimov", dateText: "2026-yil", source: "chain" },
    });
    expect(textSpy).not.toHaveBeenCalled();
    expect(moveSpy).not.toHaveBeenCalled();
  });

  test("`layoutSignatureBlock` — `boxes` massivi qaytaradi, `drawSignatureBlock` shundan chizadi", () => {
    const doc = makeDoc();
    const opts = {
      x: 18,
      y: 0,
      w: 200,
      position: "Rektor",
      sig: {},
    };
    const { height, boxes } = layoutSignatureBlock(doc, opts);
    expect(Array.isArray(boxes)).toBe(true);
    expect(boxes.length).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});
