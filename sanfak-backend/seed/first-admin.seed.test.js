const fs = require("fs");
const path = require("path");

const {
  PIN_PATTERN,
  REQUIRED_UNIQUE_INDEX,
  INDEX_MISSING_MESSAGE,
  readFlag,
  parseArgs,
  readPinFromStdin,
  validatePin,
  parseName,
  planAction,
  redact,
  hasRequiredIndex,
} = require("./first-admin.seed");

const SEED_PATH = path.join(__dirname, "first-admin.seed.js");
const SRC = fs.readFileSync(SEED_PATH, "utf8");

const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function consoleCallArgs(src) {
  const calls = [];
  const re = /console\.\w+\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth += 1;
      else if (src[i] === ")") depth -= 1;
      i += 1;
    }
    calls.push(src.slice(m.index + m[0].length, i - 1));
  }
  return calls;
}

function expressionsOnly(call) {
  return call
    .replace(/`([^`]*)`/g, (_, body) => (body.match(/\$\{[^}]*\}/g) || []).join(" "))
    .replace(/"(?:\\.|[^"\\])*"/g, " ");
}

describe("first-admin.seed — PIN formati (14 raqam)", () => {
  test("--pin berilmasa xato qaytadi", () => {
    expect(validatePin(undefined)).toEqual(expect.any(String));
  });

  test("bo'sh --pin rad etiladi", () => {
    expect(validatePin("")).toEqual(expect.any(String));
  });

  test("13 raqamli PIN rad etiladi", () => {
    expect(validatePin("1234567890123")).toEqual(expect.any(String));
  });

  test("15 raqamli PIN rad etiladi", () => {
    expect(validatePin("123456789012345")).toEqual(expect.any(String));
  });

  test("harfli PIN rad etiladi (test_super_admin sinfi)", () => {
    expect(validatePin("test_super_admin")).toEqual(expect.any(String));
    expect(validatePin("qabul_xodim")).toEqual(expect.any(String));
    expect(validatePin("1234567890123a")).toEqual(expect.any(String));
  });

  test("bo'shliq/belgi aralashgan PIN rad etiladi", () => {
    expect(validatePin("1234 678901234")).toEqual(expect.any(String));
    expect(validatePin(" 12345678901234")).toEqual(expect.any(String));
    expect(validatePin("12345678901234\n")).toEqual(expect.any(String));
  });

  test("aynan 14 raqamli PIN qabul qilinadi", () => {
    expect(validatePin("12345678901234")).toBeNull();
  });

  test("Number tipidagi PIN rad etiladi (regex avtomatik cast qilib yubormasin)", () => {
    expect(PIN_PATTERN.test(12345678901234)).toBe(true);
    expect(validatePin(12345678901234)).toEqual(expect.any(String));
  });

  test("boolean/object PIN rad etiladi", () => {
    expect(validatePin(true)).toEqual(expect.any(String));
    expect(validatePin({})).toEqual(expect.any(String));
  });

  test("xato xabari PIN qiymatini oshkor qilmaydi", () => {
    expect(validatePin("1234567890123")).not.toContain("1234567890123");
    expect(validatePin("test_super_admin")).not.toContain("test_super_admin");
  });

  test("PIN_PATTERN aynan 14 raqamga bog'langan (anchor bilan)", () => {
    expect(PIN_PATTERN.source).toBe("^\\d{14}$");
  });
});

describe("first-admin.seed — argumentlar", () => {
  test("--pin qiymati o'qiladi", () => {
    expect(parseArgs(["--pin", "12345678901234"]).pin).toBe("12345678901234");
  });

  test("--pin=qiymat shakli ham o'qiladi", () => {
    expect(readFlag(["--pin=12345678901234"], "pin")).toBe("12345678901234");
  });

  test("--dry bayrog'i tanib olinadi va default o'chiq", () => {
    expect(parseArgs(["--pin", "12345678901234", "--dry"]).dry).toBe(true);
    expect(parseArgs(["--pin", "12345678901234"]).dry).toBe(false);
  });

  test("--pin dan keyin bayroq kelsa PIN sifatida qabul qilinmaydi", () => {
    const { pin } = parseArgs(["--pin", "--dry"]);
    expect(validatePin(pin)).toEqual(expect.any(String));
  });

  test("--pin-stdin bayrog'i tanib olinadi va --pin bilan adashtirilmaydi", () => {
    const args = parseArgs(["--pin-stdin", "--name", "Aziz Karimov"]);
    expect(args.pinStdin).toBe(true);
    expect(args.pin).toBeUndefined();
    expect(parseArgs(["--pin", "12345678901234"]).pinStdin).toBe(false);
  });

  test("stdin'dan birinchi qator o'qiladi, bo'sh joylar olib tashlanadi", async () => {
    const { Readable } = require("stream");
    await expect(readPinFromStdin(Readable.from(["1234567", "8901234\r\nortiqcha\n"]))).resolves.toBe("12345678901234");
    await expect(readPinFromStdin(Readable.from([]))).resolves.toBe("");
  });

  test("juda uzun stdin qiymati rad etiladi", async () => {
    const { Readable } = require("stream");
    await expect(readPinFromStdin(Readable.from(["9".repeat(300)]))).rejects.toThrow();
  });
});

describe("first-admin.seed — ism", () => {
  test("\"Ism Familiya\" firstName/lastName ga bo'linadi", () => {
    expect(parseName("Aziz Karimov")).toEqual({
      firstName: "Aziz",
      lastName: "Karimov",
      middleName: null,
    });
  });

  test("uchinchi so'z middleName ga tushadi", () => {
    expect(parseName("Aziz Karimov Baxtiyorovich").middleName).toBe("Baxtiyorovich");
  });

  test("bitta so'z rad etiladi (model lastName ni talab qiladi)", () => {
    expect(() => parseName("Aziz")).toThrow();
  });

  test("--name berilmasa rad etiladi", () => {
    expect(() => parseName(undefined)).toThrow();
    expect(() => parseName("   ")).toThrow();
  });

  test("--name o'rniga bayroq kelsa rad etiladi", () => {
    expect(() => parseName("--dry")).toThrow();
  });
});

describe("first-admin.seed — qaror (idempotentlik qulfi)", () => {
  test("super_admin roli yo'q bo'lsa — to'xtatiladi", () => {
    expect(planAction({ role: null, existingUser: null }).action).toBe("abort");
  });

  test("mavjud hisob HECH QACHON qayta yozilmaydi — faqat skip", () => {
    const plan = planAction({ role: { _id: "r1" }, existingUser: { _id: "u1" } });
    expect(plan.action).toBe("skip");
    expect(plan.action).not.toBe("create");
    expect(plan.action).not.toBe("update");
  });

  test("rol bor + hisob yo'q — yaratiladi", () => {
    expect(planAction({ role: { _id: "r1" }, existingUser: null }).action).toBe("create");
  });

  test("rol yo'qligi hisob mavjudligidan USTUN (avval abort)", () => {
    expect(planAction({ role: null, existingUser: { _id: "u1" } }).action).toBe("abort");
  });
});

describe("first-admin.seed — sir sizishiga qarshi qulflar", () => {
  test("hech bir console chaqiruvi PIN o'zgaruvchisini chop etmaydi", () => {
    const leaks = consoleCallArgs(CODE)
      .map(expressionsOnly)
      .filter((e) => /pin/i.test(e));
    expect(leaks).toEqual([]);
  });

  test("hech bir console chaqiruvi process.argv ni chop etmaydi", () => {
    const leaks = consoleCallArgs(CODE)
      .map(expressionsOnly)
      .filter((e) => /argv/i.test(e));
    expect(leaks).toEqual([]);
  });

  test("konsolga chiqadigan yagona yo'l console.* — winston ishlatilmaydi", () => {
    expect(CODE).not.toMatch(/winston/i);
  });

  test("catch handlerining ELSE shoxi err.message'ni FAQAT redact() orqali chop etadi", () => {
    expect(CODE).toMatch(/redact\s*\(\s*err\s*&&\s*err\.message\s*\)/);
  });

  test("redact 14 raqamli ketma-ketlikni yashiradi (E11000 xabari)", () => {
    const mongoErr =
      'E11000 duplicate key error collection: institute.users index: oneIdPin_unique_partial dup key: { oneIdPin: "12345678901234" }';
    expect(redact(mongoErr)).not.toContain("12345678901234");
    expect(redact(undefined)).toBe("");
  });

  test("manbada hech qanday 14 raqamli qiymat hardcode qilinmagan", () => {
    expect(SRC).not.toMatch(/\d{14}/);
  });

  test("PIN .env dan o'qilmaydi (faqat --pin argumenti)", () => {
    const envReads = CODE.match(/process\.env\.\w+/g) || [];
    expect(envReads).toEqual(["process.env.MONGO_HOST"]);
  });
});

describe("first-admin.seed — yozuv izi (DB xavfsizligi)", () => {
  test("mavjud hujjatni o'zgartiradigan operatsiya ishlatilmaydi", () => {
    expect(CODE).not.toMatch(
      /\.save\s*\(|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|deleteOne|deleteMany|findByIdAndDelete|bulkWrite|insertMany|\$set/,
    );
  });

  test("yagona yozuv nuqtasi — UserModel.create", () => {
    expect(CODE.match(/UserModel\.create/g)).toHaveLength(1);
  });

  test("rol/permission yaratilmaydi (RoleModel faqat o'qiladi)", () => {
    expect(CODE).not.toMatch(/RoleModel\.create/);
    expect(CODE).toMatch(/RoleModel\.findOne/);
  });

  test("autoIndex O'CHIQ — skript indeks yozmaydi", () => {
    expect(CODE).toMatch(/autoIndex:\s*false/);
  });

  test("autoCreate O'CHIQ — --dry kolleksiya/baza ham yaratmaydi", () => {
    expect(CODE).toMatch(/autoCreate:\s*false/);
  });

  test("yangi hujjat aniq allowlist bilan quriladi (mass-assignment yo'q)", () => {
    expect(CODE).not.toMatch(/UserModel\.create\(\s*\{\s*\.\.\./);
    expect(CODE).toMatch(/active:\s*true/);
  });
});

describe("first-admin.seed — oneIdPin unique indeksi tekshiruvi", () => {
  test("REQUIRED_UNIQUE_INDEX aynan model'dagi indeks nomi bilan bir xil", () => {
    expect(REQUIRED_UNIQUE_INDEX).toBe("oneIdPin_unique_partial");
  });

  test("INDEX_MISSING_MESSAGE tuzatish buyrug'ini o'z ichiga oladi", () => {
    expect(INDEX_MISSING_MESSAGE).toMatch(/migrate:oneidpin-index/);
  });

  test("hasRequiredIndex eksport qilingan funksiya", () => {
    expect(typeof hasRequiredIndex).toBe("function");
  });

  test("indeks tekshiruvi --dry oldidan ishlatiladi (manba tartibi)", () => {
    const srcLines = CODE.split("\n");
    const at = (pred) => srcLines.findIndex(pred);

    const indexCheckLine = at((l) => l.includes("hasRequiredIndex()"));
    const mainDryLine = at((l) => l.startsWith("  if (dry) {"));

    expect(indexCheckLine).toBeGreaterThan(-1);
    expect(mainDryLine).toBeGreaterThan(-1);
    expect(indexCheckLine).toBeLessThan(mainDryLine);
  });
});

describe("first-admin.seed — muhit qo'riqchisining YO'QLIGI ataylab", () => {
  test("DEV_ENVS qo'riqchisi yo'q (bu production protsedurasi)", () => {
    expect(CODE).not.toMatch(/DEV_ENVS/);
    expect(CODE).not.toMatch(/NODE_ENV/);
  });
});
