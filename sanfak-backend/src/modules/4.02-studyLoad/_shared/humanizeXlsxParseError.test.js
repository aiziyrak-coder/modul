const humanizeXlsxParseError = require("./humanizeXlsxParseError");

describe("humanizeXlsxParseError", () => {
  test("InvalidFileException (haqiqiy xlsx emas) → tushunarli xabar + fieldLabel", () => {
    const err = new Error(
      "Python skript xatolik bilan tugatdi (kod: 1).\n" +
        'Traceback (most recent call last):\n  File "jarayon_reader.py", line 117, in __init__\n' +
        "openpyxl.utils.exceptions.InvalidFileException: openpyxl does not support .xlsx?t=abc&e=123 file format, please check you can open it with Excel first.",
    );
    const result = humanizeXlsxParseError(err, "O'quv jarayoni fayli");
    expect(result).toContain("O'quv jarayoni fayli");
    expect(result).toContain("haqiqiy .xlsx fayl emas");
    expect(result).not.toContain("Traceback");
    expect(result).not.toContain("openpyxl.utils.exceptions");
  });

  test("ParseError (struktura muammosi) → sabab ko'rsatiladi, traceback yashiriladi", () => {
    const err = new Error(
      "Python skript xatolik bilan tugatdi (kod: 1).\n" +
        'Traceback (most recent call last):\n  File "reja_reader.py", line 1328, in parse\n' +
        "reja_reader.ParseError: Tartib raqamlari qatori topilmadi: uploads/file/x.xlsx",
    );
    const result = humanizeXlsxParseError(err, "O'quv reja fayli");
    expect(result).toBe(
      "«O'quv reja fayli»da xatolik: Tartib raqamlari qatori topilmadi: uploads/file/x.xlsx",
    );
    expect(result).not.toContain("Traceback");
  });

  test("noma'lum Python xatosi → traceback yashiriladi, umumiy xabar", () => {
    const err = new Error(
      "Python skript xatolik bilan tugatdi (kod: 1).\nSomeOtherError: kutilmagan holat",
    );
    const result = humanizeXlsxParseError(err, "O'quv jarayoni fayli");
    expect(result).toContain("kutilmagan xatolik");
    expect(result).not.toContain("SomeOtherError");
  });

  test("Python bilan bog'liq bo'lmagan xato o'zgarishsiz qaytadi", () => {
    const err = new Error("planFile yuklanmadi");
    expect(humanizeXlsxParseError(err, "O'quv reja fayli")).toBe(
      "planFile yuklanmadi",
    );
  });
});
