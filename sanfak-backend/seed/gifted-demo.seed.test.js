const fs = require("fs");
const path = require("path");

const SEED_PATH = path.join(__dirname, "gifted-demo.seed.js");
const SRC = fs.readFileSync(SEED_PATH, "utf8");

class SeedQuit extends Error {}

describe("gifted-demo.seed — DEV_ENVS fail-closed qo'riqchisi (R-4, ijro bilan)", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  let printMock;
  let quitMock;

  beforeEach(() => {
    jest.resetModules();
    printMock = jest.fn();
    quitMock = jest.fn(() => {
      throw new SeedQuit("quit() chaqirildi — mongosh'da bu protsessni darhol to'xtatadi");
    });
    global.print = printMock;
    global.quit = quitMock;
  });

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    delete global.print;
    delete global.quit;
  });

  test("qo'riqchi xabari `.env` o'qilmasligini va TO'G'RI buyruqni ko'rsatadi (MD-50)", () => {
    delete process.env.NODE_ENV;
    expect(() => require(SEED_PATH)).toThrow(SeedQuit);
    const matn = printMock.mock.calls.map((c) => String(c[0])).join("\n");
    expect(matn).toMatch(/O'QIMAYDI/);
    expect(matn).toMatch(/NODE_ENV=development mongosh/);
    expect(matn).toContain("$env:NODE_ENV");
  });

  test("NODE_ENV=production — quit(1) bilan to'xtaydi, birorta db.* chaqirilmaydi", () => {
    process.env.NODE_ENV = "production";
    expect(() => require(SEED_PATH)).toThrow(SeedQuit);
    expect(quitMock).toHaveBeenCalledWith(1);
    expect(printMock).toHaveBeenCalled();
  });

  test("NODE_ENV o'rnatilmagan — FAIL-OPEN EMAS, baribir to'xtaydi", () => {
    delete process.env.NODE_ENV;
    expect(() => require(SEED_PATH)).toThrow(SeedQuit);
    expect(quitMock).toHaveBeenCalledWith(1);
  });

  test('NODE_ENV="prod" (typo/qisqartma) — allowlistda YO\'Q, to\'xtaydi', () => {
    process.env.NODE_ENV = "prod";
    expect(() => require(SEED_PATH)).toThrow(SeedQuit);
  });

  test("NODE_ENV=production katta-kichik harf farqi bilan (\"PRODUCTION\") — baribir to'xtaydi", () => {
    process.env.NODE_ENV = "PRODUCTION";
    expect(() => require(SEED_PATH)).toThrow(SeedQuit);
  });

  test("NODE_ENV=test (allowlist) — qo'riqchidan O'TADI: xato bo'lsa ham SeedQuit EMAS (db aniqlanmagani uchun ReferenceError)", () => {
    process.env.NODE_ENV = "test";
    expect(quitMock).not.toHaveBeenCalled();
    expect(() => require(SEED_PATH)).toThrow(/db is not defined/);
    expect(quitMock).not.toHaveBeenCalled();
  });

  test("NODE_ENV=dev/qa/local ham allowlistda — qo'riqchidan o'tadi", () => {
    for (const env of ["dev", "development", "qa", "local"]) {
      jest.resetModules();
      process.env.NODE_ENV = env;
      expect(() => require(SEED_PATH)).toThrow(/db is not defined/);
      expect(quitMock).not.toHaveBeenCalled();
    }
  });
});

describe("gifted-demo.seed — qo'riqchi manba tartibi (first-admin.seed.test.js bilan bir xil uslub)", () => {
  const lines = SRC.split("\n");
  const firstLineIndexOf = (re) => lines.findIndex((l) => re.test(l));

  test("DEV_ENVS ro'yxati boshqa test-user seedlari bilan BIR XIL", () => {
    expect(SRC).toMatch(/const DEV_ENVS = \["dev", "development", "test", "qa", "local"\];/);
  });

  test("NODE_ENV allowlist bilan tekshiriladi (`IS_DEV_ENV` shu asosda hisoblanadi)", () => {
    expect(SRC).toMatch(/DEV_ENVS\.includes\(/);
    expect(SRC).toMatch(/const IS_DEV_ENV = DEV_ENVS\.includes\(/);
  });

  test("qo'riqchi `quit(1)` bilan to'xtaydi (mongosh'ning haqiqiy chiqish primitivasi)", () => {
    expect(SRC).toMatch(/quit\(1\)/);
  });

  test("qo'riqchi (`if (!IS_DEV_ENV)`) FAYLNING ENG BOSHIDA — birinchi `db.*` chaqiruvidan OLDIN", () => {
    const guardLine = firstLineIndexOf(/if\s*\(!IS_DEV_ENV\)/);
    const firstDbCallLine = firstLineIndexOf(/\bdb\.\w+/);
    expect(guardLine).toBeGreaterThan(-1);
    expect(firstDbCallLine).toBeGreaterThan(-1);
    expect(guardLine).toBeLessThan(firstDbCallLine);
  });

  test("`quit(1)` chaqiruvining o'zi ham birinchi `db.*` chaqiruvidan OLDIN keladi", () => {
    const quitLine = firstLineIndexOf(/quit\(1\)/);
    const firstDbCallLine = firstLineIndexOf(/\bdb\.\w+/);
    expect(quitLine).toBeGreaterThan(-1);
    expect(quitLine).toBeLessThan(firstDbCallLine);
  });

  test("6 ta kolleksiya nomi (deleteMany ro'yxati) o'zgarmagan", () => {
    expect(SRC).toMatch(
      /\["giftedstudents", "evaluationcriterias", "documenttypes", "studentachievements", "scholarships", "scholarshipapplications"\]/,
    );
  });
});

describe("gifted-demo.seed — o'quv yili qoidasi MODUL bilan bir xil", () => {
  const { academicYearOf } = require("../src/modules/4.11-giftedStudent/_services/academicYearWindow");

  const seedRule = () => {
    const m = SRC.match(/const AY =\s*([\s\S]*?);/);
    expect(m).not.toBeNull();
    // eslint-disable-next-line no-new-func
    return new Function("now", `return ${m[1]}`);
  };

  test.each([
    ["1-sentabr — yangi yil", new Date(2026, 8, 1)],
    ["31-avgust — eski yil", new Date(2026, 7, 31)],
    ["dekabr", new Date(2026, 11, 15)],
    ["yanvar", new Date(2027, 0, 15)],
    ["iyun", new Date(2027, 5, 1)],
    ["bugun", new Date()],
  ])("%s — seed va modul BIR XIL natija beradi", (_name, date) => {
    expect(seedRule()(date)).toBe(academicYearOf(date));
  });

  test("kanonik format — SLASH (talabaning `YEAR` i tire bilan, chalkashmasin)", () => {
    expect(seedRule()(new Date(2026, 8, 1))).toBe("2026/2027");
    expect(SRC).toMatch(/const YEAR = "2025-2026";/);
  });

  test("🔴 ikkala talabaga ham `scoresByYear` yoziladi", () => {
    expect(SRC).toMatch(/totalScore: 80, scoresByYear: \{ \[AY\]: 80 \}/);
    expect(SRC).toMatch(/totalScore: 50, scoresByYear: \{ \[AY\]: 50 \}/);
  });

  test("yutuqlar ham yil bilan muhrlanadi", () => {
    expect(SRC).toMatch(/academicYear: AY/);
  });
});
