"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { buildDistributionPdf } = require("./distribution.pdf");

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const distFixture = (overrides = {}) => ({
  title: null,
  confirmation: {},
  department: { title: "Stomatologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  teachers: [],
  staffPositions: null,
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
  approvalSteps: [],
  verify: null,
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe("chiziq CHIZILMAYDI (ADR-021 Qaror #1)", () => {
  test("imzo bloklarida moveTo/lineTo YO'Q — faqat footer chizig'i (1 sahifa)", async () => {
    const approved = (step, name) => ({
      step,
      status: "approved",
      approvedBy: { lastName: name[0], firstName: name[1] },
      date: new Date(2026, 8, 3),
    });
    const dist = distFixture({
      approvalSteps: [
        approved("prorektor", ["Boltaboyev", "U."]),
        approved("methodical", ["Nodirov", "A."]),
        approved("financial", ["Yusupova", "N."]),
        approved("kafedra", ["Qosimov", "B."]),
      ],
    });
    WorkloadDistribution.findById = jest.fn().mockReturnValue(chainablePopulate(dist));
    const moveSpy = jest.spyOn(PDFDocument.prototype, "moveTo");
    const lineSpy = jest.spyOn(PDFDocument.prototype, "lineTo");
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    const moveCalls = moveSpy.mock.calls.length;
    const lineCalls = lineSpy.mock.calls.length;
    moveSpy.mockRestore();
    lineSpy.mockRestore();

    expect(moveCalls).toBe(1);
    expect(lineCalls).toBe(1);
  });
});

describe("QR shartli (ADR-021 Qaror #2) — `verify` maydoni WP-B Faza 2 dan bor", () => {
  const render = async (overrides) => {
    WorkloadDistribution.findById = jest
      .fn()
      .mockReturnValue(chainablePopulate(distFixture(overrides)));
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    try {
      const doc = await buildDistributionPdf("dist1");
      doc.end();
      return imageSpy.mock.calls.length;
    } finally {
      imageSpy.mockRestore();
    }
  };

  test("draft, verify yo'q — QR chizilmaydi", async () => {
    const count = await render({ status: "draft", verify: null });
    expect(count).toBe(0);
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("approved, lekin verify.token yo'q — QR chizilmaydi (hali issueToken chaqirilmagan)", async () => {
    const count = await render({ status: "approved", verify: null });
    expect(count).toBe(0);
  });

  test("approved + token BOR, lekin snapshot BO'SH (haqiqiy imzolovchi yo'q) — QR hech qayerda chizilmaydi", async () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    const count = await render({
      status: "approved",
      verify: { token: "a".repeat(32), revokedAt: null, snapshot: [] },
    });
    expect(count).toBe(0);
    delete process.env.PUBLIC_BASE_URL;
  });

  test("approved + token BOR, zanjirning BARCHA bosqichi snapshot'da — QR har haqiqiy slotda (1 yuqori + 3 qator = 4), bitta token/buffer", async () => {
    process.env.PUBLIC_BASE_URL = "https://ais.test.uz";
    const snap = (step) => ({
      step,
      label: step,
      shortName: "T. Testov",
      date: new Date(2026, 8, 3),
    });
    WorkloadDistribution.findById = jest.fn().mockReturnValue(
      chainablePopulate(
        distFixture({
          status: "approved",
          verify: {
            token: "a".repeat(32),
            revokedAt: null,
            snapshot: ["prorektor", "methodical", "financial", "kafedra"].map(snap),
          },
        }),
      ),
    );
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    try {
      const doc = await buildDistributionPdf("dist1");
      doc.end();
      expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
      expect(imageSpy).toHaveBeenCalledTimes(4);
      const buffers = new Set(imageSpy.mock.calls.map((c) => c[0]));
      expect(buffers.size).toBe(1);
    } finally {
      imageSpy.mockRestore();
      delete process.env.PUBLIC_BASE_URL;
    }
  });

  test("prod + PUBLIC_BASE_URL YO'Q — to'liq zanjirda ham 0 rasm, toBuffer chaqirilmaydi (fail-closed)", async () => {
    delete process.env.PUBLIC_BASE_URL;
    process.env.NODE_ENV = "production";
    const snap = (step) => ({ step, label: step, shortName: "T. Testov", date: new Date(2026, 8, 3) });
    try {
      const count = await render({
        status: "approved",
        verify: {
          token: "b".repeat(32),
          revokedAt: null,
          snapshot: ["prorektor", "methodical", "financial", "kafedra"].map(snap),
        },
      });
      expect(count).toBe(0);
      expect(QRCode.toBuffer).not.toHaveBeenCalled();
    } finally {
      delete process.env.NODE_ENV;
    }
  });
});
