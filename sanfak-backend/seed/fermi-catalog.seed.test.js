const fs = require("fs");
const path = require("path");

const {
  normalizeForCompare,
  indexByNormalizedTitle,
  indexByField,
  resolveByNormalizedTitle,
  resolveByCodeThenTitle,
  resolveDirectionMatch,
} = require("./fermi-catalog.seed");

const SEED_PATH = path.join(__dirname, "fermi-catalog.seed.js");
const SRC = fs.readFileSync(SEED_PATH, "utf8");

describe("fermi-catalog.seed — normalizeForCompare", () => {
  test("imlo varianti: \"gigiyena\" va \"gigiena\" bir xil natija beradi", () => {
    expect(normalizeForCompare("Gigiyena, harbiy gigiyena. Tibbiy ekologiya")).toBe(
      normalizeForCompare("Gigiena, harbiy gigiena. Tibbiy ekologiya"),
    );
  });

  test("apostrof variantlarining barchasi bir xil natija beradi", () => {
    const variants = [
      "O'zbek va xorijiy tillar kafedrasi",
      "O‘zbek va xorijiy tillar kafedrasi",
      "O’zbek va xorijiy tillar kafedrasi",
      "Oʻzbek va xorijiy tillar kafedrasi",
      "Oʼzbek va xorijiy tillar kafedrasi",
      "O`zbek va xorijiy tillar kafedrasi",
      "O´zbek va xorijiy tillar kafedrasi",
    ];
    const normalized = variants.map(normalizeForCompare);
    normalized.forEach((n) => expect(n).toBe(normalized[0]));
    expect(normalized[0]).toBe("ozbek va horijiy tillar");
  });

  test("ketma-ket bo'shliqlar bittaga siqiladi", () => {
    expect(normalizeForCompare("Ijtimoiy    fanlar     kafedrasi")).toBe(normalizeForCompare("Ijtimoiy fanlar"));
  });

  test("\"kafedrasi\"/\"fakulteti\" qo'shimchalari solishtirishda hisobga olinmaydi", () => {
    expect(normalizeForCompare("Normal anatomiya kafedrasi")).toBe(normalizeForCompare("Normal anatomiya"));
    expect(normalizeForCompare("Pediatriya fakulteti")).toBe(normalizeForCompare("Pediatriya"));
  });

  test("nuqta/vergul olib tashlanadi", () => {
    expect(normalizeForCompare("Jamoat salomatligi. Marketing, menejment")).toBe(
      normalizeForCompare("Jamoat salomatligi Marketing menejment"),
    );
  });

  test("bo'sh/undefined/null qiymat bo'sh satr qaytaradi", () => {
    expect(normalizeForCompare(undefined)).toBe("");
    expect(normalizeForCompare(null)).toBe("");
    expect(normalizeForCompare("")).toBe("");
  });

  test("katta-kichik harf farqi yo'qoladi (lowercase)", () => {
    expect(normalizeForCompare("FALSAFA")).toBe(normalizeForCompare("falsafa"));
  });
});

describe("fermi-catalog.seed — indexByField / indexByNormalizedTitle", () => {
  test("bo'sh/null/undefined kalit e'tiborga olinmaydi", () => {
    const index = indexByField(
      [{ scienceCode: "" }, { scienceCode: null }, { scienceCode: undefined }, { scienceCode: "OK" }],
      "scienceCode",
    );
    expect(index.size).toBe(1);
    expect(index.get("OK")).toBeDefined();
  });

  test("bir xil normallashtirilgan title bir nechta hujjatni bitta Map elementiga to'playdi", () => {
    const index = indexByNormalizedTitle([{ title: "A kafedrasi" }, { title: "a" }]);
    expect(index.size).toBe(1);
    expect(index.get("a")).toHaveLength(2);
  });

  test("title'siz/bo'sh title'li hujjat indekslanmaydi", () => {
    const index = indexByNormalizedTitle([{ title: "" }, {}]);
    expect(index.size).toBe(0);
  });
});

describe("fermi-catalog.seed — resolveByCodeThenTitle", () => {
  test("(b) kod bo'yicha topilsa — nom UMUMAN tekshirilmaydi", () => {
    const byCode = indexByField([{ scienceCode: "X1", title: "Butunlay boshqa nom" }], "scienceCode");
    const titleIndex = new Map();
    const decision = resolveByCodeThenTitle({
      code: "X1",
      title: "Hech qanday aloqasi yo'q sarlavha",
      byCode,
      titleIndex,
    });
    expect(decision.action).toBe("code-match");
    expect(decision.existing.title).toBe("Butunlay boshqa nom");
  });

  test("(c) nom mos, kod BOSHQA -> yaratilmaydi, mismatch qaytadi", () => {
    const existingDocs = [{ scienceCode: "OLD1", title: "Bir xil nom", department: "dep1" }];
    const byCode = indexByField(existingDocs, "scienceCode");
    const titleIndex = indexByNormalizedTitle(existingDocs);
    const decision = resolveByCodeThenTitle({ code: "NEW1", title: "Bir xil nom", byCode, titleIndex });
    expect(decision.action).toBe("mismatch");
    expect(decision.candidates).toHaveLength(1);
    expect(decision.candidates[0].scienceCode).toBe("OLD1");
  });

  test("(c) nom normallashtirilgan holda mos bo'lsa ham (apostrof/imlo) mismatch aniqlanadi", () => {
    const existingDocs = [{ scienceCode: "OLD2", title: "O'zbek tili kafedrasi", department: "dep2" }];
    const byCode = indexByField(existingDocs, "scienceCode");
    const titleIndex = indexByNormalizedTitle(existingDocs);
    const decision = resolveByCodeThenTitle({ code: "NEW2", title: "O‘zbek tili", byCode, titleIndex });
    expect(decision.action).toBe("mismatch");
  });

  test("(d) hech narsa mos kelmasa -> yaratiladi", () => {
    const byCode = indexByField([], "scienceCode");
    const titleIndex = indexByNormalizedTitle([]);
    const decision = resolveByCodeThenTitle({ code: "X9", title: "Yangi fan", byCode, titleIndex });
    expect(decision.action).toBe("create");
  });
});

describe("fermi-catalog.seed — jonli dublikat juftliklari nomi mos deb aniqlanishi SHART", () => {
  test("FA1014 / JSMM1606 — \"Jamoat salomatligi. Marketing, menejment\" (aynan bir xil nom)", () => {
    const existingDocs = [
      { scienceCode: "FA1014", title: "Jamoat salomatligi. Marketing, menejment", department: "dep-FA1014" },
    ];
    const byCode = indexByField(existingDocs, "scienceCode");
    const titleIndex = indexByNormalizedTitle(existingDocs);
    const decision = resolveByCodeThenTitle({
      code: "JSMM1606",
      title: "Jamoat salomatligi. Marketing, menejment",
      byCode,
      titleIndex,
    });
    expect(decision.action).toBe("mismatch");
    expect(decision.candidates[0].scienceCode).toBe("FA1014");
  });

  test("FA1200 / GXGTE1406 — \"Gigiyena\" / \"Gigiena\" imlo varianti", () => {
    const existingDocs = [
      { scienceCode: "FA1200", title: "Gigiyena, harbiy gigiyena. Tibbiy ekologiya", department: "dep-FA1200" },
    ];
    const byCode = indexByField(existingDocs, "scienceCode");
    const titleIndex = indexByNormalizedTitle(existingDocs);
    const decision = resolveByCodeThenTitle({
      code: "GXGTE1406",
      title: "Gigiena, harbiy gigiena. Tibbiy ekologiya",
      byCode,
      titleIndex,
    });
    expect(decision.action).toBe("mismatch");
    expect(decision.candidates[0].scienceCode).toBe("FA1200");
  });
});

describe("fermi-catalog.seed — resolveByNormalizedTitle (kafedra/yo'nalish/fakultet)", () => {
  test("aynan bir xil title bo'lsa mavjud hujjat qaytadi", () => {
    const titleIndex = indexByNormalizedTitle([{ title: "Normal anatomiya kafedrasi" }]);
    const decision = resolveByNormalizedTitle({ title: "Normal anatomiya kafedrasi", titleIndex });
    expect(decision.action).toBe("match");
  });

  test("apostrof/imlo varianti bilan ham mos topadi", () => {
    const titleIndex = indexByNormalizedTitle([{ title: "O'zbek va xorijiy tillar kafedrasi" }]);
    const decision = resolveByNormalizedTitle({ title: "O‘zbek va xorijiy tillar kafedrasi", titleIndex });
    expect(decision.action).toBe("match");
  });

  test("\"kafedrasi\" qo'shilgan/qo'shilmagan variant ham bir xil deb topiladi", () => {
    const titleIndex = indexByNormalizedTitle([{ title: "Fiziologiya kafedrasi" }]);
    const decision = resolveByNormalizedTitle({ title: "Fiziologiya", titleIndex });
    expect(decision.action).toBe("match");
  });

  test("mos kelmasa yaratish qarori chiqadi", () => {
    const titleIndex = indexByNormalizedTitle([]);
    const decision = resolveByNormalizedTitle({ title: "Yangi kafedra", titleIndex });
    expect(decision.action).toBe("create");
  });
});

describe("fermi-catalog.seed — resolveDirectionMatch", () => {
  test("kod bo'lsa avval kod bo'yicha topiladi", () => {
    const byCode = indexByField([{ directionCode: "60910200", title: "Davolash ishi" }], "directionCode");
    const titleIndex = new Map();
    const existing = resolveDirectionMatch({ code: "60910200", title: "Boshqa nom", byCode, titleIndex });
    expect(existing.title).toBe("Davolash ishi");
  });

  test("kod yo'q bo'lsa normallashtirilgan title bilan topiladi", () => {
    const titleIndex = indexByNormalizedTitle([{ title: "Farmatsiya ishi" }]);
    const byCode = indexByField([], "directionCode");
    const existing = resolveDirectionMatch({ code: null, title: "farmatsiya ishi", byCode, titleIndex });
    expect(existing).toBeTruthy();
    expect(existing.title).toBe("Farmatsiya ishi");
  });

  test("mos kelmasa null qaytadi", () => {
    const byCode = indexByField([], "directionCode");
    const titleIndex = indexByNormalizedTitle([]);
    expect(resolveDirectionMatch({ code: null, title: "Yo'q narsa", byCode, titleIndex })).toBeNull();
  });
});

describe("fermi-catalog.seed — require.main qulfi (DB'siz import)", () => {
  test("main() faqat require.main === module ichida chaqiriladi", () => {
    expect(SRC).toMatch(/if\s*\(\s*require\.main\s*===\s*module\s*\)/);
  });

  test("normallashtirish/moslik funksiyalari eksport qilingan", () => {
    expect(typeof normalizeForCompare).toBe("function");
    expect(typeof indexByNormalizedTitle).toBe("function");
    expect(typeof indexByField).toBe("function");
    expect(typeof resolveByNormalizedTitle).toBe("function");
    expect(typeof resolveByCodeThenTitle).toBe("function");
    expect(typeof resolveDirectionMatch).toBe("function");
  });
});

describe("fermi-catalog.seed — hisobot matni tuzatilgan", () => {
  test("DRY-RUN holatida yakuniy hisobot \"yaratildi\" emas \"yaratilardi\" deydi", () => {
    expect(SRC).toMatch(/DRY \? "yaratilardi" : "yaratildi"/);
  });

  test("yakuniy hisobotda \"nomuvofiq\" qatori bor", () => {
    expect(SRC).toMatch(/nomuvofiq/);
  });

  test("MOSLIK SHUBHALI xabari kod va kafedrani ko'rsatadi", () => {
    expect(SRC).toMatch(/MOSLIK SHUBHALI/);
  });
});
