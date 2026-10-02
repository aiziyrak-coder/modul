const {
  renderValid,
  renderInvalid,
} = require("./certificateVerify.controller");

const SAMPLE = {
  code: "MO00001",
  fullName: "Aliyev Valijon Botirovich",
  courseName: "Biologiya texnologiyalari",
  courseType: "Qayta tayyorlov diplomi",
  creditHours: 72,
  form: 1,
  startDate: new Date(2026, 6, 9),
  endDate: new Date(2026, 6, 12),
  issuedAt: new Date(2026, 6, 14),
};

describe("certificateVerify.controller — HTML render", () => {
  describe("yaroqli sertifikat", () => {
    const html = renderValid(SAMPLE);

    test("to'liq HTML hujjat qaytadi", () => {
      expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
      expect(html.trimEnd().endsWith("</html>")).toBe(true);
    });

    test("barcha maydonlar sahifada bor", () => {
      expect(html).toContain("Aliyev Valijon Botirovich");
      expect(html).toContain("Biologiya texnologiyalari");
      expect(html).toContain("Qayta tayyorlov diplomi");
      expect(html).toContain("72 soat");
      expect(html).toContain("Onlayn");
      expect(html).toContain("09.07.2026 — 12.07.2026");
      expect(html).toContain("MO00001");
      expect(html).toContain("14.07.2026");
    });

    test("'Sertifikat haqiqiy' yorlig'i YO'Q (ataylab olib tashlangan)", () => {
      expect(html).not.toContain("Sertifikat haqiqiy");
    });

    test("PII sizmaydi — faqat blankadagi maydonlar", () => {
      for (const bad of ["JSHSHIR", "pasport", "Ball", "Narx", "jshshir"]) {
        expect(html).not.toContain(bad);
      }
    });

    test("logotip va shrift ichkariga singdirilgan (tashqi so'rov yo'q)", () => {
      expect(html).toContain("data:image/png;base64,");
      expect(html).toContain("data:font/woff2;base64,");
      expect(html).not.toContain("https://fonts.");
    });

    test("bo'sh maydon umuman chizilmaydi", () => {
      const bare = renderValid({
        ...SAMPLE,
        courseType: "",
        creditHours: null,
        form: null,
        startDate: null,
        endDate: null,
      });
      expect(bare).not.toContain("KURS TURI");
      expect(bare).not.toContain("Hajmi");
      expect(bare).not.toContain("Shakli");
      expect(bare).not.toContain("Kurs davri");
      expect(bare).toContain("Aliyev Valijon Botirovich");
    });

    test("HTML in'ektsiya escape qilinadi", () => {
      const evil = renderValid({
        ...SAMPLE,
        fullName: '<script>alert(1)</script>',
        courseName: 'Kurs " onload=x',
      });
      expect(evil).not.toContain("<script>alert(1)</script>");
      expect(evil).toContain("&lt;script&gt;");
      expect(evil).toContain("&quot; onload=x");
    });
  });

  describe("topilmagan sertifikat", () => {
    test("skanerlangan kod sahifada ko'rsatiladi", () => {
      const html = renderInvalid("mo99999");
      expect(html).toContain("Hujjat topilmadi");
      expect(html).toContain("MO99999");
    });

    test("juda uzun kod qirqiladi (32 belgi)", () => {
      const html = renderInvalid("M".repeat(200));
      expect(html).not.toContain("M".repeat(33));
    });

    test("kodsiz ham yiqilmaydi", () => {
      expect(() => renderInvalid("")).not.toThrow();
      expect(() => renderInvalid(null)).not.toThrow();
      expect(() => renderInvalid(undefined)).not.toThrow();
    });

    test("kod ham escape qilinadi", () => {
      const html = renderInvalid("<img src=x onerror=1>");
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;IMG");
    });
  });

  describe("hujjat turi", () => {
    const base = {
      code: "MN00004",
      fullName: "Aliyev Valijon",
      courseName: "Biologiya",
      courseType: "Sertifikat",
      creditHours: 72,
      form: 2,
      startDate: new Date(),
      endDate: new Date(),
      issuedAt: new Date(),
    };

    test("ma'lumotnoma SERTIFIKAT deb ko'rsatilmaydi", () => {
      const html = renderValid({ ...base, kind: 2 });
      expect(html).toContain("Ma'lumotnoma");
      expect(html).toMatch(/Ma.{0,6}lumotnoma kodi/);
      expect(html).not.toContain("muvaffaqiyatli bajargan");
      expect(html).toContain("o'ta olmagan");
    });

    test("sertifikat avvalgidek ko'rsatiladi", () => {
      const html = renderValid({ ...base, kind: 1, code: "I00001" });
      expect(html).toContain("Sertifikat kodi");
      expect(html).toContain("muvaffaqiyatli bajargan");
    });
  });
});
