const PDFDocument = require("pdfkit");
const { registerCyrillicFonts } = require("#shared/pdfGenerators/pdfHelpers");

const resolvedFont = (doc, name) => {
  doc.font(name);
  return doc._font && doc._font.name;
};

describe("registerCyrillicFonts — kirill shriftlari alias bo'yicha topiladi", () => {
  let doc;

  beforeEach(() => {
    doc = new PDFDocument({ size: "A4" });
    registerCyrillicFonts(doc);
  });

  afterEach(() => {
    doc.end();
  });

  test.each([
    ["Helvetica", "TimesNewRomanPSMT"],
    ["Helvetica-Bold", "TimesNewRomanPS-BoldMT"],
    ["Helvetica-Oblique", "TimesNewRomanPS-ItalicMT"],
    ["TNR", "TimesNewRomanPSMT"],
    ["TNR-B", "TimesNewRomanPS-BoldMT"],
  ])("`%s` -> %s", (alias, expected) => {
    expect(resolvedFont(doc, alias)).toBe(expected);
  });

  test("🔴 `Helvetica` STANDART shriftda QOLMAYDI (asosiy defekt)", () => {
    expect(resolvedFont(doc, "Helvetica")).not.toBe("Helvetica");
  });

  test("kirill matni xatosiz yoziladi", () => {
    doc.font("Helvetica").fontSize(10);
    expect(() => doc.text("Тиббий ва биологик физика")).not.toThrow();
  });

  test("registratsiyadan keyin kesh alias'larni ushlab qolmaydi", () => {
    const cached = Object.keys(doc._fontFamilies || {});
    if (cached.includes("Helvetica")) {
      expect(doc._fontFamilies.Helvetica.name).toBe("TimesNewRomanPSMT");
    }
  });
});
