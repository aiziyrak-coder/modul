"use strict";

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const {
  drawSignatureBlock,
  measureSignatureBlock,
  layoutSignatureBlock,
  QR_PAD,
  QR_CAPTION_PAD,
} = require("./signatureBlock");

const makeDoc = () => new PDFDocument({ size: "A4", margin: 0 });
let qrImage;
beforeAll(async () => {
  qrImage = await QRCode.toBuffer("https://example.test/verify/doc/0123456789abcdef0123456789abcdef", {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 4,
  });
});

const CHAIN_SIG = { name: "U.A.Boltaboyev", dateText: "2026-yil “ 15 ” sentabr", source: "chain" };
const BASE = { x: 40, y: 60, w: 150, heading: '"TASDIQLAYMAN"', position: "Rektor" };

describe("stack — QR sloti", () => {
  test("qr + source=chain → `doc.image` bir marta, QR blok ichida markazda, holat matni YO'Q", () => {
    const doc = makeDoc();
    const imgSpy = jest.spyOn(doc, "image");
    const txtSpy = jest.spyOn(doc, "text");

    const h = drawSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG, qr: { image: qrImage, size: 44 } });

    expect(imgSpy).toHaveBeenCalledTimes(1);
    const [img, qx, , opts] = imgSpy.mock.calls[0];
    expect(img).toBe(qrImage);
    expect(opts).toEqual({ width: 44, height: 44 });
    expect(qx).toBeCloseTo(BASE.x + (BASE.w - 44) / 2, 5);
    expect(txtSpy.mock.calls.some((c) => c[0] === "Elektron tasdiqlangan")).toBe(false);
    expect(txtSpy.mock.calls.some((c) => c[0] === CHAIN_SIG.name)).toBe(true);
    expect(h).toBeGreaterThan(0);
  });

  test("QR lavozimdan PASTDA, F.I.O dan YUQORIDA; bo'shliq = QR_PAD + size + QR_PAD", () => {
    const doc = makeDoc();
    const { boxes, images } = layoutSignatureBlock(doc, {
      ...BASE,
      sig: CHAIN_SIG,
      qr: { image: qrImage, size: 44 },
    });
    const pos = boxes.find((b) => b.text === "Rektor");
    const name = boxes.find((b) => b.text === CHAIN_SIG.name);
    const img = images[0];
    expect(img.y).toBeGreaterThan(pos.y);
    expect(name.y).toBeGreaterThan(img.y + img.h);
    doc.font("Helvetica").fontSize(7);
    const posH = doc.heightOfString("Rektor", { width: BASE.w, align: "center", lineBreak: true });
    expect(name.y - (pos.y + posH)).toBeCloseTo(QR_PAD + 44 + QR_PAD, 5);
  });

  test.each([["manual"], ["none"], [undefined]])(
    "source=%s → QR CHIZILMAYDI (slot darvozasi), geometriya QR'siz chaqiruv bilan BIR XIL",
    (source) => {
      const doc = makeDoc();
      const imgSpy = jest.spyOn(doc, "image");
      const sig = { name: "X.Y", dateText: "", source };
      const withQr = measureSignatureBlock(doc, { ...BASE, sig, qr: { image: qrImage, size: 44 } });
      const withoutQr = measureSignatureBlock(doc, { ...BASE, sig });
      drawSignatureBlock(doc, { ...BASE, sig, qr: { image: qrImage, size: 44 } });
      expect(imgSpy).not.toHaveBeenCalled();
      expect(withQr).toBe(withoutQr);
    },
  );

  test("source=chain, lekin qr YO'Q → holat matni SAQLANADI (R-4.02-54)", () => {
    const doc = makeDoc();
    const txtSpy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG });
    expect(txtSpy.mock.calls.some((c) => c[0] === "Elektron tasdiqlangan")).toBe(true);
  });

  test("qr bor bo'lsa `gapText` ham chizilmaydi (takror emas)", () => {
    const doc = makeDoc();
    const txtSpy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, {
      ...BASE,
      sig: CHAIN_SIG,
      gapText: "(ERI bilan imzolangan)",
      qr: { image: qrImage, size: 44 },
    });
    expect(txtSpy.mock.calls.some((c) => c[0] === "(ERI bilan imzolangan)")).toBe(false);
  });

  test("qr.size `scale` ga ko'paytirilmaydi (mutlaq)", () => {
    const doc = makeDoc();
    const imgSpy = jest.spyOn(doc, "image");
    drawSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG, scale: 1.3, qr: { image: qrImage, size: 44 } });
    expect(imgSpy.mock.calls[0][3]).toEqual({ width: 44, height: 44 });
  });

  test("yaroqsiz qr (Buffer emas / size 0) → jimgina o'tkaziladi, throw yo'q", () => {
    const doc = makeDoc();
    const imgSpy = jest.spyOn(doc, "image");
    expect(() =>
      drawSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG, qr: { image: "not-a-buffer", size: 44 } }),
    ).not.toThrow();
    expect(() => drawSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG, qr: { image: qrImage, size: 0 } })).not.toThrow();
    expect(imgSpy).not.toHaveBeenCalled();
  });
});

describe("stack — `qrCaption` (N-03: QR markaziga tekis)", () => {
  test("izoh markazi QR markazi bilan bir xil, kengligi size + 2·QR_CAPTION_PAD (blokka sig'sa)", () => {
    const doc = makeDoc();
    const { boxes, images } = layoutSignatureBlock(doc, {
      ...BASE,
      sig: CHAIN_SIG,
      qr: { image: qrImage, size: 44 },
      qrCaption: "Elektron tasdiqlangan",
    });
    const cap = boxes.find((b) => b.text === "Elektron tasdiqlangan");
    const img = images[0];
    expect(cap).toBeDefined();
    expect(cap.w).toBeCloseTo(44 + 2 * QR_CAPTION_PAD, 5);
    expect(cap.x + cap.w / 2).toBeCloseTo(img.x + img.w / 2, 5);
    expect(cap.y).toBeGreaterThan(img.y + img.h);
  });

  test("tor blokda izoh qutisi blok chegarasiga qisiladi (chiqib ketmaydi)", () => {
    const doc = makeDoc();
    const { boxes } = layoutSignatureBlock(doc, {
      ...BASE,
      w: 50,
      sig: CHAIN_SIG,
      qr: { image: qrImage, size: 44 },
      qrCaption: "Elektron tasdiqlangan",
    });
    const cap = boxes.find((b) => b.text === "Elektron tasdiqlangan");
    expect(cap.x).toBeGreaterThanOrEqual(BASE.x);
    expect(cap.x + cap.w).toBeLessThanOrEqual(BASE.x + 50);
  });

  test("qrCaption faqat QR chizilganda — QR'siz slotda izoh YO'Q", () => {
    const doc = makeDoc();
    const txtSpy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, { ...BASE, sig: { source: "none" }, qrCaption: "Izoh" });
    expect(txtSpy.mock.calls.some((c) => c[0] === "Izoh")).toBe(false);
  });
});

describe("stack — `emptySlotGap` (draft ixcham bo'shliq, Q4)", () => {
  test("qr yo'q + gapText yo'q → bo'shliq emptySlotGap (16 o'rniga 4: balandlik 12 ga kam)", () => {
    const doc = makeDoc();
    const sig = { source: "none" };
    const dflt = measureSignatureBlock(doc, { ...BASE, sig });
    const compact = measureSignatureBlock(doc, { ...BASE, sig, emptySlotGap: 4 });
    expect(dflt - compact).toBeCloseTo(12, 5);
  });

  test("gapText bor bo'lsa emptySlotGap E'TIBORGA OLINMAYDI (matn 16pt joy talab qiladi)", () => {
    const doc = makeDoc();
    const sig = { ...CHAIN_SIG };
    const a = measureSignatureBlock(doc, { ...BASE, sig, gapText: "(ERI bilan imzolangan)" });
    const b = measureSignatureBlock(doc, { ...BASE, sig, gapText: "(ERI bilan imzolangan)", emptySlotGap: 4 });
    expect(a).toBe(b);
  });

  test("qr chizilganda emptySlotGap ishlatilmaydi (QR o'zi joy oladi)", () => {
    const doc = makeDoc();
    const a = measureSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG, qr: { image: qrImage, size: 44 } });
    const b = measureSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG, qr: { image: qrImage, size: 44 }, emptySlotGap: 4 });
    expect(a).toBe(b);
  });
});

describe("row — QR o'rta ustunda (holat matni o'rniga)", () => {
  const ROW = { x: 30, y: 400, w: 500, layout: "row", position: "O'quv-uslubiy boshqarma boshlig'i:" };

  test("qr + chain → rasm o'rta ustun markazida, holat matni yo'q, balandlik ≥ size", () => {
    const doc = makeDoc();
    const imgSpy = jest.spyOn(doc, "image");
    const txtSpy = jest.spyOn(doc, "text");
    const h = drawSignatureBlock(doc, { ...ROW, sig: { ...CHAIN_SIG, dateText: "" }, qr: { image: qrImage, size: 40 } });
    expect(imgSpy).toHaveBeenCalledTimes(1);
    const [, qx, qy, opts] = imgSpy.mock.calls[0];
    expect(opts).toEqual({ width: 40, height: 40 });
    expect(qx + 20).toBeCloseTo(ROW.x + ROW.w * 0.6, 5);
    expect(qy).toBeCloseTo(ROW.y, 5);
    expect(h).toBeGreaterThanOrEqual(40);
    expect(txtSpy.mock.calls.some((c) => c[0] === "Elektron tasdiqlangan")).toBe(false);
  });

  test("qr bo'lsa lavozim va F.I.O QR ga nisbatan vertikal markazda (yuqoriga yopishmaydi)", () => {
    const doc = makeDoc();
    const { boxes, height } = layoutSignatureBlock(doc, {
      ...ROW,
      sig: { ...CHAIN_SIG, dateText: "" },
      qr: { image: qrImage, size: 40 },
    });
    const pos = boxes.find((b) => b.text === ROW.position);
    const name = boxes.find((b) => b.text === CHAIN_SIG.name);
    expect(pos.y).toBeGreaterThan(ROW.y);
    expect(name.y).toBeGreaterThan(ROW.y);
    expect(pos.y).toBeLessThan(ROW.y + height);
  });

  test("qr yo'q → eski xulq: holat matni `statusText` (default 'Elektron tasdiqlangan') bilan", () => {
    const doc = makeDoc();
    const txtSpy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, { ...ROW, sig: CHAIN_SIG, statusText: "(ERI bilan imzolangan)" });
    expect(txtSpy.mock.calls.some((c) => c[0] === "(ERI bilan imzolangan)")).toBe(true);
    expect(txtSpy.mock.calls.some((c) => c[0] === "Elektron tasdiqlangan")).toBe(false);
  });

  test("row + source=manual + qr → QR ham, holat matni ham yo'q (darvoza)", () => {
    const doc = makeDoc();
    const imgSpy = jest.spyOn(doc, "image");
    const txtSpy = jest.spyOn(doc, "text");
    drawSignatureBlock(doc, { ...ROW, sig: { name: "T.Uzuvchi", source: "manual" }, qr: { image: qrImage, size: 40 } });
    expect(imgSpy).not.toHaveBeenCalled();
    expect(txtSpy.mock.calls.some((c) => c[0] === "Elektron tasdiqlangan")).toBe(false);
  });

  test("row — qr uzatilmagan chaqiruv geometriyasi O'ZGARMAGAN (qutilar y = y, siljish 0)", () => {
    const doc = makeDoc();
    const { boxes } = layoutSignatureBlock(doc, { ...ROW, sig: CHAIN_SIG });
    for (const b of boxes) expect(b.y).toBeGreaterThanOrEqual(ROW.y);
    const pos = boxes.find((b) => b.text === ROW.position);
    const status = boxes.find((b) => b.text === "Elektron tasdiqlangan");
    const name = boxes.find((b) => b.text === CHAIN_SIG.name);
    expect(pos.y).toBe(ROW.y);
    expect(status.y).toBe(ROW.y);
    expect(name.y).toBe(ROW.y);
  });
});

describe("chiziq CHIZILMAYDI — QR bilan ham (ADR-021 Qaror #1)", () => {
  test("moveTo/lineTo 0 marta", () => {
    const doc = makeDoc();
    const moveSpy = jest.spyOn(doc, "moveTo");
    const lineSpy = jest.spyOn(doc, "lineTo");
    drawSignatureBlock(doc, { ...BASE, sig: CHAIN_SIG, qr: { image: qrImage, size: 44 }, qrCaption: "x" });
    drawSignatureBlock(doc, { x: 30, y: 300, w: 400, layout: "row", position: "P", sig: CHAIN_SIG, qr: { image: qrImage, size: 40 } });
    expect(moveSpy).not.toHaveBeenCalled();
    expect(lineSpy).not.toHaveBeenCalled();
  });
});
