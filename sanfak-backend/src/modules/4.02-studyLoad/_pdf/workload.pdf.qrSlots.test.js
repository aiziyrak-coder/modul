"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const ORIGINAL_ENV = process.env;

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wlFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  department: { title: "Stomatologiya kafedrasi" },
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  directions: [],
  approvalSteps: [],
  agreed: {},
  confirmation: {},
  methodicalHead: null,
  financialHead: null,
  staffPositions: null,
  status: "draft",
  verify: null,
  ...overrides,
});

const render = async (wl) => {
  WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wl));
  const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    return imageSpy.mock.calls.length;
  } finally {
    imageSpy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, PUBLIC_BASE_URL: "https://ais.test.uz" };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("QR imzo slotlarida (ADR-021 Yangilanish 2026-09-15)", () => {
  test("approved + token, snapshot'da faqat rektor — toBuffer 1×, doc.image 1× (faqat TASDIQLAYMAN sloti)", async () => {
    const wl = wlFixture({
      status: "approved",
      verify: {
        token: "a".repeat(32),
        revokedAt: null,
        snapshot: [
          { step: "rektor", label: "Rektor", shortName: "R. Karimov", date: new Date(2026, 8, 3) },
        ],
      },
    });
    const imageCallCount = await render(wl);
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(imageCallCount).toBe(1);
  });

  test("to'liq zanjir snapshot'i (4 bosqich) — toBuffer 1×, doc.image 4× (2 yuqori + 2 qator), bitta buffer, holat matni/izoh yo'q", async () => {
    const snap = (step) => ({
      step,
      label: step,
      shortName: "T. Testov",
      date: new Date(2026, 8, 3),
    });
    const wl = wlFixture({
      status: "approved",
      verify: {
        token: "c".repeat(32),
        revokedAt: null,
        snapshot: ["prorektor", "rektor", "methodical", "financial"].map(snap),
      },
    });
    WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wl));
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    try {
      const doc = await buildWorkloadPdf("wl1");
      doc.end();
      expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
      expect(imageSpy).toHaveBeenCalledTimes(4);
      const buffers = new Set(imageSpy.mock.calls.map((c) => c[0]));
      expect(buffers.size).toBe(1);
      const texts = textSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
      expect(texts).not.toContain("(ERI bilan imzolangan)");
      expect(texts).not.toContain("Elektron tasdiqlangan");
      expect(texts.some((t) => t.startsWith("Tekshirish:") || t.startsWith("ID:"))).toBe(false);
    } finally {
      imageSpy.mockRestore();
      textSpy.mockRestore();
    }
  });

  test("prod + PUBLIC_BASE_URL YO'Q — to'liq zanjirda ham 0 rasm, toBuffer chaqirilmaydi (fail-closed)", async () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "production" };
    delete process.env.PUBLIC_BASE_URL;
    const snap = (step) => ({ step, label: step, shortName: "T. Testov", date: new Date(2026, 8, 3) });
    const count = await render(
      wlFixture({
        status: "approved",
        verify: {
          token: "d".repeat(32),
          revokedAt: null,
          snapshot: ["prorektor", "rektor", "methodical", "financial"].map(snap),
        },
      }),
    );
    expect(count).toBe(0);
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("draft (token yo'q) — QR umuman chizilmaydi", async () => {
    const wl = wlFixture({ status: "draft", verify: null });
    const imageCallCount = await render(wl);
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
    expect(imageCallCount).toBe(0);
  });

  test("status approved lekin token yo'q — QR chizilmaydi", async () => {
    const wl = wlFixture({ status: "approved", verify: null });
    const imageCallCount = await render(wl);
    expect(imageCallCount).toBe(0);
  });

  test("revoke qilingan token — QR chizilmaydi", async () => {
    const wl = wlFixture({
      status: "approved",
      verify: { token: "b".repeat(32), revokedAt: new Date(), snapshot: [] },
    });
    const imageCallCount = await render(wl);
    expect(imageCallCount).toBe(0);
  });
});
