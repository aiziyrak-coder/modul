"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const QRCode = require("qrcode");
const winston = require("#shared/winston.logger");
const { prepareVerifyQr, QR_MAX_URL_BYTES } = require("./verifyQr");

const ORIGINAL_ENV = process.env;
const TOKEN = "a157f635f34f303d6f0c1e037e8170d3";

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.NODE_ENV;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const approved = (extra = {}) => ({
  _id: "doc1",
  status: "approved",
  verify: { token: TOKEN, revokedAt: null, ...extra.verify },
  ...extra,
});

describe("prepareVerifyQr — 5 holat", () => {
  test("draft → null, toBuffer chaqirilmaydi", async () => {
    const r = await prepareVerifyQr({ status: "draft", verify: { token: TOKEN } }, { docType: "workload" });
    expect(r).toBeNull();
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("approved, lekin token yo'q (legacy) → null", async () => {
    const r = await prepareVerifyQr({ status: "approved", verify: {} });
    expect(r).toBeNull();
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("revoked → null", async () => {
    const r = await prepareVerifyQr(approved({ verify: { token: TOKEN, revokedAt: new Date() } }));
    expect(r).toBeNull();
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("prod + PUBLIC_BASE_URL yo'q → null + winston.error (fail-closed, ADR-020 SHART #1)", async () => {
    process.env.NODE_ENV = "production";
    const r = await prepareVerifyQr(approved(), { docType: "syllabus" });
    expect(r).toBeNull();
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("PUBLIC_BASE_URL sozlanmagan"));
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("docType=syllabus"));
    expect(winston.error).not.toHaveBeenCalledWith(expect.stringContaining(TOKEN));
  });

  test("yaroqli → { url, image }; toBuffer AYNAN bir marta, opsiyalar M / margin 1 / scale 8", async () => {
    process.env.PUBLIC_BASE_URL = "https://test4.softlab.uz";
    const r = await prepareVerifyQr(approved(), { docType: "workload" });
    expect(r).toEqual({ url: `https://test4.softlab.uz/verify/doc/${TOKEN}`, image: Buffer.from("fake-qr") });
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(QRCode.toBuffer).toHaveBeenCalledWith(r.url, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
    });
    expect(winston.warn).not.toHaveBeenCalled();
    expect(winston.error).not.toHaveBeenCalled();
  });
});

describe("prepareVerifyQr — chekka holatlar", () => {
  test("URL 84 baytdan uzun (uzun host) → warn, lekin QR baribir yaratiladi", async () => {
    process.env.PUBLIC_BASE_URL = "https://juda-uzun-institut-nomi.sub.domain.example.uz";
    const r = await prepareVerifyQr(approved());
    expect(r).not.toBeNull();
    expect(Buffer.byteLength(r.url)).toBeGreaterThan(QR_MAX_URL_BYTES);
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("QR moduli kichrayadi"));
    expect(winston.warn).not.toHaveBeenCalledWith(expect.stringContaining(TOKEN));
    expect(winston.warn).not.toHaveBeenCalledWith(expect.stringContaining("/verify/doc/"));
  });

  test("toBuffer xato bersa → null + winston.error, throw yo'q", async () => {
    process.env.PUBLIC_BASE_URL = "https://test4.softlab.uz";
    QRCode.toBuffer.mockRejectedValueOnce(new Error("png fail"));
    await expect(prepareVerifyQr(approved())).resolves.toBeNull();
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("png fail"));
    expect(winston.error).not.toHaveBeenCalledWith(expect.stringContaining(TOKEN));
  });

  test("docLike null/undefined → null, throw yo'q", async () => {
    await expect(prepareVerifyQr(null)).resolves.toBeNull();
    await expect(prepareVerifyQr(undefined)).resolves.toBeNull();
  });

  test("dev (NODE_ENV yo'q) + PUBLIC_BASE_URL yo'q → localhost zaxirasi bilan QR yaratiladi", async () => {
    const r = await prepareVerifyQr(approved());
    expect(r.url).toMatch(/^http:\/\/localhost:\d+\/verify\/doc\//);
  });
});
