const ORIGINAL_ENV = { ...process.env };

const loadRegistry = () => {
  jest.resetModules();
  return require("../_authProviders");
};

describe("_authProviders/index — fail-closed registry", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOW_PIN_IN_PROD;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("production + AUTH_PROVIDER=pin → boot to'xtaydi (throw)", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "pin";

    expect(() => loadRegistry()).toThrow(/production'da faqat "oneid"/);
  });

  test("production + AUTH_PROVIDER bo'sh → boot to'xtaydi (throw)", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_PROVIDER;

    expect(() => loadRegistry()).toThrow();
  });

  test("production + AUTH_PROVIDER noto'g'ri qiymat → boot to'xtaydi (throw)", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "google";

    expect(() => loadRegistry()).toThrow();
  });

  test("production + AUTH_PROVIDER=oneid → registry muvaffaqiyatli yuklanadi", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "oneid";

    const activeProvider = loadRegistry();
    expect(activeProvider.name).toBe("oneid");
  });

  test("dev + AUTH_PROVIDER bo'sh → 'pin' ga fallback qiladi (yiqilmaydi)", () => {
    process.env.NODE_ENV = "test";
    delete process.env.AUTH_PROVIDER;

    const activeProvider = loadRegistry();
    expect(activeProvider.name).toBe("pin");
  });

  test("dev + AUTH_PROVIDER=pin → 'pin' provayder faol", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_PROVIDER = "pin";

    const activeProvider = loadRegistry();
    expect(activeProvider.name).toBe("pin");
  });

  test("dev + AUTH_PROVIDER=oneid → 'oneid' provayder faol", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_PROVIDER = "oneid";

    const activeProvider = loadRegistry();
    expect(activeProvider.name).toBe("oneid");
  });

  test("dev + AUTH_PROVIDER noto'g'ri qiymat → 'pin' ga fallback (yiqilmaydi)", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_PROVIDER = "google";

    const activeProvider = loadRegistry();
    expect(activeProvider.name).toBe("pin");
  });
});

describe("_authProviders/index — ALLOW_PIN_IN_PROD istisnosi (ADR-015)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOW_PIN_IN_PROD;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("production + pin + ALLOW_PIN_IN_PROD=true → registry yuklanadi, pin faol", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "pin";
    process.env.ALLOW_PIN_IN_PROD = "true";

    const activeProvider = loadRegistry();
    expect(activeProvider.name).toBe("pin");
  });

  test("production + pin + ALLOW_PIN_IN_PROD=false → boot to'xtaydi (default o'chiq)", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "pin";
    process.env.ALLOW_PIN_IN_PROD = "false";

    expect(() => loadRegistry()).toThrow(/production'da faqat "oneid"/);
  });

  test("production + pin + bayroq \"1\" → boot to'xtaydi (faqat aynan 'true')", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "pin";
    process.env.ALLOW_PIN_IN_PROD = "1";

    expect(() => loadRegistry()).toThrow();
  });

  test("production + pin + bayroq \"  TRUE \" → yuklanadi (trim + lowercase)", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "pin";
    process.env.ALLOW_PIN_IN_PROD = "  TRUE ";

    expect(loadRegistry().name).toBe("pin");
  });

  test("production + AUTH_PROVIDER bo'sh + bayroq true → BARIBIR to'xtaydi", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_PROVIDER;
    process.env.ALLOW_PIN_IN_PROD = "true";

    expect(() => loadRegistry()).toThrow();
  });

  test("production + noma'lum provayder + bayroq true → BARIBIR to'xtaydi", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "google";
    process.env.ALLOW_PIN_IN_PROD = "true";

    expect(() => loadRegistry()).toThrow();
  });

  test("production + oneid + bayroq true → oneid faol qoladi (bayroq o'g'irlamaydi)", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "oneid";
    process.env.ALLOW_PIN_IN_PROD = "true";

    expect(loadRegistry().name).toBe("oneid");
  });

  test("istisno faol bo'lganda boot'da OCHIQ winston.warn chiqadi", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "pin";
    process.env.ALLOW_PIN_IN_PROD = "true";

    jest.resetModules();
    const warn = jest.fn();
    jest.doMock("#shared/winston.logger", () => ({
      warn,
      info: jest.fn(),
      error: jest.fn(),
    }));
    require("../_authProviders");

    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("ALLOW_PIN_IN_PROD=true"))).toBe(true);
    expect(messages.some((m) => m.includes("VAQTINCHALIK"))).toBe(true);
  });
});

describe("_authProviders/index — NODE_ENV allowlist (fail-closed)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOW_PIN_IN_PROD;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test.each(["prod", "Production", "PRODUCTION", "staging", "prod-1"])(
    "NODE_ENV=%s + AUTH_PROVIDER=pin → endi PROD kabi qattiq (throw)",
    (env) => {
      process.env.NODE_ENV = env;
      process.env.AUTH_PROVIDER = "pin";

      expect(() => loadRegistry()).toThrow(/production'da faqat "oneid"/);
    },
  );

  test("NODE_ENV umuman yo'q + AUTH_PROVIDER=pin → PROD kabi qattiq (throw)", () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOW_PIN_IN_PROD;
    delete process.env.NODE_ENV;
    process.env.AUTH_PROVIDER = "pin";

    expect(() => loadRegistry()).toThrow(/production'da faqat "oneid"/);
  });

  test("NODE_ENV umuman yo'q + AUTH_PROVIDER bo'sh → PROD kabi qattiq (throw)", () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALLOW_PIN_IN_PROD;
    delete process.env.NODE_ENV;
    delete process.env.AUTH_PROVIDER;

    expect(() => loadRegistry()).toThrow();
  });

  test("NODE_ENV=prod + AUTH_PROVIDER=oneid → normal yuklanadi", () => {
    process.env.NODE_ENV = "prod";
    process.env.AUTH_PROVIDER = "oneid";

    expect(loadRegistry().name).toBe("oneid");
  });

  test("NODE_ENV=prod + pin + ALLOW_PIN_IN_PROD=true → ADR-015 istisnosi ISHLAYDI", () => {
    process.env.NODE_ENV = "prod";
    process.env.AUTH_PROVIDER = "pin";
    process.env.ALLOW_PIN_IN_PROD = "true";

    expect(loadRegistry().name).toBe("pin");
  });

  test.each(["dev", "development", "test", "qa", "local", "DEV"])(
    "NODE_ENV=%s → dev rejimi (pin fallback, yiqilmaydi)",
    (env) => {
      process.env.NODE_ENV = env;
      delete process.env.AUTH_PROVIDER;

      expect(loadRegistry().name).toBe("pin");
    },
  );
});
