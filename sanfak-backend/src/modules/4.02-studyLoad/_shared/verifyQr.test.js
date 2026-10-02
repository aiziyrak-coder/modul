"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const { buildVerifyUrl } = require("./verifyQr");

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.NODE_ENV;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("buildVerifyUrl — SHART #1 (fail-closed)", () => {
  test("PUBLIC_BASE_URL bor bo'lsa — shundan quriladi (NODE_ENV'dan qat'i nazar)", () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    expect(buildVerifyUrl("a".repeat(32))).toBe(
      `https://ais.test.uz/verify/doc/${"a".repeat(32)}`,
    );
  });

  test("PUBLIC_BASE_URL oxiridagi slash tozalanadi", () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz/";
    expect(buildVerifyUrl("x")).toBe("https://ais.test.uz/verify/doc/x");
  });

  test("env YO'Q + NODE_ENV=production → null (QR chizilmaydi)", () => {
    process.env.NODE_ENV = "production";
    expect(buildVerifyUrl("x")).toBeNull();
  });

  test("env YO'Q + dev/test → localhost zaxirasi", () => {
    process.env.NODE_ENV = "test";
    process.env.PORT = "4100";
    expect(buildVerifyUrl("x")).toBe("http://localhost:4100/verify/doc/x");
  });

  test("WP-C: env atrofidagi bo'sh joy ham tozalanadi (resolvePublicBaseUrl delegatsiyasi)", () => {
    process.env.PUBLIC_BASE_URL = "  https://ais.test.uz  ";
    expect(buildVerifyUrl("x")).toBe("https://ais.test.uz/verify/doc/x");
  });
});
