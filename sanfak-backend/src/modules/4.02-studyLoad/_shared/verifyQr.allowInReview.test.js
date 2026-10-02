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
const { prepareVerifyQr } = require("./verifyQr");

const ORIGINAL_ENV = process.env;
const TOKEN = "b157f635f34f303d6f0c1e037e8170d3";

const docOf = (status, verify = {}) => ({
  _id: "ws1",
  status,
  verify: { token: TOKEN, revokedAt: null, ...verify },
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, PUBLIC_BASE_URL: "https://ais.test.uz" };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("prepareVerifyQr — allowInReview (ADR-039)", () => {
  test("in_review, bayroqsiz → null (qolgan generatorlar xulqi o'zgarmaydi)", async () => {
    expect(await prepareVerifyQr(docOf("in_review"), { docType: "workload" })).toBeNull();
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("in_review + allowInReview:true → QR (url + image)", async () => {
    const r = await prepareVerifyQr(docOf("in_review"), {
      docType: "workingSchedule",
      allowInReview: true,
    });
    expect(r).toEqual({
      url: `https://ais.test.uz/verify/doc/${TOKEN}`,
      image: Buffer.from("fake-qr"),
    });
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
  });

  test("approved — bayroq bilan ham, bayroqsiz ham QR (o'zgarmagan)", async () => {
    expect(await prepareVerifyQr(docOf("approved"))).not.toBeNull();
    expect(await prepareVerifyQr(docOf("approved"), { allowInReview: true })).not.toBeNull();
  });

  test("revoked (in_review + bayroq) → null", async () => {
    const r = await prepareVerifyQr(docOf("in_review", { revokedAt: new Date() }), {
      allowInReview: true,
    });
    expect(r).toBeNull();
  });

  test("draft/rejected + bayroq → null (faqat in_review ochiladi)", async () => {
    expect(await prepareVerifyQr(docOf("draft"), { allowInReview: true })).toBeNull();
    expect(await prepareVerifyQr(docOf("rejected"), { allowInReview: true })).toBeNull();
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("allowInReview truthy lekin boolean EMAS → null (opt-in qat'iy)", async () => {
    expect(await prepareVerifyQr(docOf("in_review"), { allowInReview: "yes" })).toBeNull();
  });
});
