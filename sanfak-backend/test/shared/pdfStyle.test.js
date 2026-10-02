const {
  PAGE,
  PALETTE,
  KEY_COLORS,
  getKeyBg,
  cell,
} = require("#shared/pdfGenerators/pdfStyle");

const createMockDoc = () => {
  const doc = {};
  ["rect", "fill", "strokeColor", "lineWidth", "stroke", "font", "fontSize", "fillColor"].forEach(
    (m) => {
      doc[m] = jest.fn(() => doc);
    },
  );
  doc.text = jest.fn(() => doc);
  return doc;
};

describe("pdfStyle — PAGE/PALETTE/KEY_COLORS (etalon qiymatlar, regressiya qulfi)", () => {
  test("PAGE — A4 landscape, hoshiya 18, contentWidth 806", () => {
    expect(PAGE).toEqual({
      width: 842,
      height: 595,
      margin: 18,
      contentWidth: 806,
    });
  });

  test("PALETTE — neytral kulrang jadval qiymatlari", () => {
    expect(PALETTE).toEqual({
      border: "#444",
      lineWidth: 0.4,
      text: "#000",
      muted: "#333",
      headerBg: "#ddd",
      subHeaderBg: "#eee",
      accentBg: "#eef2f7",
      white: "#fff",
    });
  });

  test("KEY_COLORS — kalendar kalit ranglari", () => {
    expect(KEY_COLORS).toEqual({
      T: "#4a90d9",
      A: "#f39c12",
      K: "#27ae60",
      I: "#8e44ad",
      M: "#e74c3c",
      D: "#16a085",
      G: "#2c3e50",
    });
  });
});

describe("pdfStyle.getKeyBg()", () => {
  test("mavjud kalit uchun rangini qaytaradi", () => {
    expect(getKeyBg("T")).toBe("#4a90d9");
  });

  test("kichik harf ham katta harfga keltirilib topiladi", () => {
    expect(getKeyBg("t")).toBe("#4a90d9");
  });

  test("bo'sh joylar kesiladi (trim)", () => {
    expect(getKeyBg(" A ")).toBe("#f39c12");
  });

  test("noma'lum kalit uchun null qaytaradi", () => {
    expect(getKeyBg("Z")).toBeNull();
  });

  test("argument berilmasa null qaytaradi", () => {
    expect(getKeyBg()).toBeNull();
    expect(getKeyBg("")).toBeNull();
  });
});

describe("pdfStyle.cell() — chizish ketma-ketligi", () => {
  test("bg berilmasa — faqat ramka chiziladi, fill chaqirilmaydi", () => {
    const doc = createMockDoc();
    cell(doc, 10, 20, 100, 14, "Salom");

    expect(doc.rect).toHaveBeenCalledTimes(1);
    expect(doc.rect).toHaveBeenCalledWith(10, 20, 100, 14);
    expect(doc.fill).not.toHaveBeenCalled();
    expect(doc.strokeColor).toHaveBeenCalledWith(PALETTE.border);
    expect(doc.lineWidth).toHaveBeenCalledWith(PALETTE.lineWidth);
    expect(doc.stroke).toHaveBeenCalledTimes(1);
  });

  test("bg berilsa — avval fon to'ldiriladi, keyin xuddi shu geometriyada ramka chiziladi", () => {
    const doc = createMockDoc();
    cell(doc, 0, 0, 50, 10, "X", { bg: "#ddd" });

    expect(doc.rect).toHaveBeenCalledTimes(2);
    expect(doc.rect).toHaveBeenNthCalledWith(1, 0, 0, 50, 10);
    expect(doc.rect).toHaveBeenNthCalledWith(2, 0, 0, 50, 10);
    expect(doc.fill).toHaveBeenCalledWith("#ddd");
    expect(doc.strokeColor).toHaveBeenCalledWith("#444");
  });

  test("ramka rangi/qalinligi opts orqali ustidan yozilmaydi (B7 migratsiya to'sig'i)", () => {
    const doc = createMockDoc();
    cell(doc, 0, 0, 10, 10, "Y", { border: "#123456", lineWidth: 9, bg: "#fff" });

    expect(doc.strokeColor).toHaveBeenCalledWith(PALETTE.border);
    expect(doc.lineWidth).toHaveBeenCalledWith(PALETTE.lineWidth);
  });

  test("bold:true — Helvetica-Bold, aks holda Helvetica", () => {
    const doc = createMockDoc();
    cell(doc, 0, 0, 10, 10, "B", { bold: true });
    expect(doc.font).toHaveBeenCalledWith("Helvetica-Bold");

    const doc2 = createMockDoc();
    cell(doc2, 0, 0, 10, 10, "N");
    expect(doc2.font).toHaveBeenCalledWith("Helvetica");
  });

  test("matn joylashuvi — defolt markazlashgan formula (h - fs*1.3)/2, min 1", () => {
    const doc = createMockDoc();
    cell(doc, 10, 20, 100, 14, "Salom", { align: "left" });

    expect(doc.text).toHaveBeenCalledWith("Salom", 11.5, 23.1, {
      width: 97,
      height: 12,
      align: "left",
      lineBreak: true,
      ellipsis: true,
    });
  });

  test("valign:'top' — Y formuladan mustaqil, doim +2", () => {
    const doc = createMockDoc();
    cell(doc, 0, 0, 50, 30, "Z", { valign: "top", fs: 8 });

    expect(doc.text).toHaveBeenCalledWith(
      "Z",
      1.5,
      2,
      expect.objectContaining({ width: 47, height: 28 }),
    );
  });

  test("null/undefined matn bo'sh qatorga aylanadi (\"null\"/\"undefined\" chiqmaydi)", () => {
    const doc = createMockDoc();
    cell(doc, 0, 0, 10, 10, null);
    expect(doc.text.mock.calls[0][0]).toBe("");

    const doc2 = createMockDoc();
    cell(doc2, 0, 0, 10, 10, undefined);
    expect(doc2.text.mock.calls[0][0]).toBe("");
  });

  test("raqamli matn String() bilan o'giriladi", () => {
    const doc = createMockDoc();
    cell(doc, 0, 0, 10, 10, 42);
    expect(doc.text.mock.calls[0][0]).toBe("42");
  });
});
