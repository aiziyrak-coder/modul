const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { parseJarayon } = require("#shared/pythonParser");

const ESKI_SHABLON = path.join(
  __dirname,
  "../../uploads/file/learning-process/1787552993616.xlsx",
);
const YANGI_SHABLON_1 = path.join(
  __dirname,
  "../../uploads/file/learning-process/1787689582479.xlsx",
);
const YANGI_SHABLON_2 = path.join(
  __dirname,
  "../../uploads/file/learning-process/1787670590045.xlsx",
);

const fs = require("fs");
const fixturesExist = [ESKI_SHABLON, YANGI_SHABLON_1, YANGI_SHABLON_2].every(
  (p) => fs.existsSync(p),
);

const describeIfFixtures = fixturesExist ? describe : describe.skip;

describeIfFixtures("jarayon_reader — legend zaxira (Variant A)", () => {
  jest.setTimeout(30000);

  test("a) ESKI shablon (legend qatori BOR) — 7 kalit, ogohlantirish YO'Q (regressiya qulfi)", async () => {
    const natija = await parseJarayon(ESKI_SHABLON);

    expect(natija.keys).toHaveLength(7);
    const kalitlar = natija.keys.map((k) => k.key);
    expect(kalitlar).toEqual(
      expect.arrayContaining([" ", "A", "K", "M", "D", "T", "G"]),
    );
    expect(natija.warnings || []).toHaveLength(0);
  });

  test("b) YANGI shablon (legend qatori YO'Q) — kalitlar > 1, ' ' bor, LEGEND_FALLBACK ogohlantirish bor", async () => {
    const natija = await parseJarayon(YANGI_SHABLON_1);

    const kalitlar = natija.keys.map((k) => k.key);
    expect(kalitlar).toContain(" ");

    const title = (k) => natija.keys.find((x) => x.key === k)?.title;
    expect(title("A")).toBe("Attestatsiyalar");
    expect(title("M")).toBe("Malakaviy amaliyot");
    expect(title("T")).toBe("Ta'til");
    expect(title(" ")).toBe("Nazariy va amaliy ta'lim");

    expect(natija.keys).toHaveLength(7);
    expect(kalitlar).not.toContain("А");

    expect(natija.warnings.length).toBeGreaterThan(0);
    expect(natija.warnings[0]).toEqual(
      expect.objectContaining({ code: "LEGEND_FALLBACK" }),
    );
  });

  test("b2) ikkinchi YANGI shablon fayli ham xuddi shunday ishlaydi", async () => {
    const natija = await parseJarayon(YANGI_SHABLON_2);

    expect(natija.keys).toHaveLength(7);
    expect(natija.keys.map((k) => k.key)).toContain(" ");
    expect(natija.keys.map((k) => k.key)).not.toContain("А");
    expect(natija.keys.find((x) => x.key === "A")?.title).toBe("Attestatsiyalar");
    expect(natija.warnings.length).toBeGreaterThan(0);
    expect(natija.warnings[0].code).toBe("LEGEND_FALLBACK");
  });

  test("c) Kurs ustunidagi rim raqamlari (I/V/VI) kalitga TUSHMAYDI", async () => {
    const eski = await parseJarayon(ESKI_SHABLON);
    const yangi1 = await parseJarayon(YANGI_SHABLON_1);
    const yangi2 = await parseJarayon(YANGI_SHABLON_2);

    const RIM_HARFLAR = new Set(["I", "V"]);
    for (const natija of [eski, yangi1, yangi2]) {
      const kalitlar = natija.keys.map((k) => k.key);
      for (const rim of RIM_HARFLAR) {
        expect(kalitlar).not.toContain(rim);
      }
    }
  });
});
