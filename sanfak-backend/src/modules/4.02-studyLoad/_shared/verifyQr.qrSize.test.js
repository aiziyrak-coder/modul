"use strict";

const QRCode = require("qrcode");
const {
  QR_SIZE_SLOT,
  QR_SIZE_ROW,
  QR_ERROR_CORRECTION,
  QR_MAX_URL_BYTES,
} = require("./verifyQr");

const PT_TO_MM = 25.4 / 72;
const MIN_MODULE_MM = 0.33;
const QUIET_MARGIN_MODULES = 2;

const TOKEN = "a157f635f34f303d6f0c1e037e8170d3";
const LONGEST_URL = `https://${"h".repeat(QR_MAX_URL_BYTES - "https:///verify/doc/".length - TOKEN.length)}/verify/doc/${TOKEN}`;

function moduleMm(sizePt, modules) {
  return (sizePt * PT_TO_MM) / (modules + QUIET_MARGIN_MODULES);
}

describe("QR modul o'lchami ≥ 0.33 mm (R-4.02-53)", () => {
  test("eng uzun URL 84 bayt — v5-M (37 modul) dan oshmaydi", () => {
    expect(Buffer.byteLength(LONGEST_URL, "utf8")).toBe(QR_MAX_URL_BYTES);
    const qr = QRCode.create(LONGEST_URL, { errorCorrectionLevel: QR_ERROR_CORRECTION });
    expect(qr.version).toBeLessThanOrEqual(5);
    expect(qr.modules.size).toBeLessThanOrEqual(37);
  });

  test.each([
    ["QR_SIZE_SLOT (yuqori blok)", QR_SIZE_SLOT],
    ["QR_SIZE_ROW (pastki qator)", QR_SIZE_ROW],
  ])("%s → modul ≥ 0.33 mm", (_label, sizePt) => {
    const qr = QRCode.create(LONGEST_URL, { errorCorrectionLevel: QR_ERROR_CORRECTION });
    const mm = moduleMm(sizePt, qr.modules.size);
    expect(mm).toBeGreaterThanOrEqual(MIN_MODULE_MM);
  });

  test("konstantalar Kengash qiymatlaridan KICHIK emas (44 / 40) va EC = M", () => {
    expect(QR_SIZE_SLOT).toBeGreaterThanOrEqual(44);
    expect(QR_SIZE_ROW).toBeGreaterThanOrEqual(40);
    expect(QR_ERROR_CORRECTION).toBe("M");
  });

  test("real prod URL (test4.softlab.uz) 84 baytdan oshmaydi", () => {
    const url = `https://test4.softlab.uz/verify/doc/${TOKEN}`;
    expect(Buffer.byteLength(url, "utf8")).toBeLessThanOrEqual(QR_MAX_URL_BYTES);
  });
});
