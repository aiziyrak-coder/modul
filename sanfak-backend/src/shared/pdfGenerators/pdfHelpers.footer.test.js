"use strict";
const { createDoc, drawHeader, drawTitle, drawFooter, PAGE } = require("./pdfHelpers");

const HEADER_BOTTOM = PAGE.margin - 10 - 8 + 36;

describe("drawFooter — F-52/F-24: footer bo'sh sahifa qo'shmaydi", () => {
  test("bitta sahifali hujjatda footer'dan keyin ham 1 sahifa", () => {
    const doc = createDoc();
    doc.text("Sinov matni");
    expect(doc.bufferedPageRange().count).toBe(1);
    drawFooter(doc, "Sinov hujjati", "approved");
    expect(doc.bufferedPageRange().count).toBe(1);
    doc.end();
  });

  test("ko'p sahifali hujjatda har sahifaga footer, ortiqcha sahifa yo'q", () => {
    const doc = createDoc();
    doc.text("1-sahifa");
    doc.addPage();
    doc.text("2-sahifa");
    doc.addPage();
    doc.text("3-sahifa");
    expect(doc.bufferedPageRange().count).toBe(3);
    const spy = jest.spyOn(doc, "text");
    drawFooter(doc, "Sinov hujjati", "draft", "KOD-1");
    expect(doc.bufferedPageRange().count).toBe(3);
    const texts = spy.mock.calls.map(([t]) => t);
    expect(texts).toEqual(
      expect.arrayContaining(["1 / 3", "2 / 3", "3 / 3", "Sinov hujjati | Holat: Qoralama | Kod: KOD-1"]),
    );
    for (const call of spy.mock.calls) {
      const opts = call[3] || {};
      expect(opts.width).toBeUndefined();
      expect(opts.lineBreak).toBe(false);
    }
    doc.end();
  });

  test("sahifa raqami o'ng chetga tekislangan (widthOfString bilan)", () => {
    const doc = createDoc();
    doc.text("x");
    const spy = jest.spyOn(doc, "text");
    drawFooter(doc, "T", "approved");
    const pageCall = spy.mock.calls.find(([t]) => t === "1 / 1");
    expect(pageCall).toBeDefined();
    const x = pageCall[1];
    doc.font("Helvetica").fontSize(7);
    expect(x + doc.widthOfString("1 / 1")).toBeCloseTo(PAGE.width - PAGE.margin, 3);
    doc.end();
  });
});

describe("drawHeader — F-52: sarlavha banner ustiga chizilmaydi", () => {
  test("drawHeader'dan keyin doc.y banner pastki chegarasidan past", () => {
    const doc = createDoc();
    drawHeader(doc);
    expect(doc.y).toBeGreaterThanOrEqual(HEADER_BOTTOM + 4);
    doc.end();
  });

  test("drawTitle sarlavhasi banner pastidan boshlanadi", () => {
    const doc = createDoc();
    drawHeader(doc);
    const spy = jest.spyOn(doc, "text");
    drawTitle(doc, "SINOV SARLAVHA", "Ism Familiya");
    expect(spy).toHaveBeenCalled();
    expect(doc.y).toBeGreaterThan(HEADER_BOTTOM + 14);
    doc.end();
  });
});
