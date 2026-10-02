"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const ORIGINAL_ENV = process.env;

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wsFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { title: "2025/2026" },
  stage: null,
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  desc: null,
  courses: [],
  keys: [],
  statistics: {},
  attestationNote: null,
  allValues: {},
  comment: null,
  comments: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
  status: "draft",
  verify: null,
  approvalHistory: [],
  ...overrides,
});

const render = async (ws) => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({
      workingSchedule: "ws1",
      semesters: null,
      studyPlanLabel: null,
    }),
  });
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chainablePopulate(ws));
  const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
  try {
    const doc = await buildWorkingRejaDoc("wp1");
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
    const ws = wsFixture({
      status: "approved",
      verify: {
        token: "a".repeat(32),
        revokedAt: null,
        snapshot: [
          {
            step: "rektor",
            label: "Farg'ona jamoat salomatligi tibbiyot instituti rektori",
            shortName: "R.Karimov",
            date: new Date(2026, 8, 3),
          },
        ],
      },
    });
    const imageCallCount = await render(ws);
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(imageCallCount).toBe(1);
  });

  test("to'liq zanjir snapshot'i (4 bosqich) — toBuffer 1×, doc.image 4× (2 yuqori blok + 2 qator), bitta buffer", async () => {
    const snap = (step, shortName) => ({ step, label: step, shortName, date: new Date(2026, 8, 3) });
    const ws = wsFixture({
      status: "approved",
      verify: {
        token: "d".repeat(32),
        revokedAt: null,
        snapshot: [
          snap("methodical", "N.Rahimova"),
          snap("dean", "D.Rahmonov"),
          snap("prorektor", "U.Boltaboyev"),
          snap("rektor", "S.Qodirova"),
        ],
      },
    });
    WorkingPlanModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ workingSchedule: "ws1", semesters: null, studyPlanLabel: null }),
    });
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chainablePopulate(ws));
    const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
    const textSpy = jest.spyOn(PDFDocument.prototype, "text");
    try {
      const doc = await buildWorkingRejaDoc("wp1");
      doc.end();
      expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
      expect(imageSpy).toHaveBeenCalledTimes(4);
      const buffers = new Set(imageSpy.mock.calls.map((c) => c[0]));
      expect(buffers.size).toBe(1);
      const texts = textSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
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
    const snap = (step, shortName) => ({ step, label: step, shortName, date: new Date(2026, 8, 3) });
    const count = await render(
      wsFixture({
        status: "approved",
        verify: {
          token: "e".repeat(32),
          revokedAt: null,
          snapshot: [
            snap("methodical", "N.Rahimova"),
            snap("dean", "D.Rahmonov"),
            snap("prorektor", "U.Boltaboyev"),
            snap("rektor", "S.Qodirova"),
          ],
        },
      }),
    );
    expect(count).toBe(0);
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });

  test("draft (token yo'q) — QR umuman chizilmaydi", async () => {
    const imageCallCount = await render(wsFixture({ status: "draft", verify: null }));
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
    expect(imageCallCount).toBe(0);
  });

  test("status approved lekin token yo'q — QR chizilmaydi", async () => {
    const imageCallCount = await render(wsFixture({ status: "approved", verify: null }));
    expect(imageCallCount).toBe(0);
  });

  test("revoke qilingan token — QR chizilmaydi", async () => {
    const imageCallCount = await render(
      wsFixture({
        status: "approved",
        verify: { token: "b".repeat(32), revokedAt: new Date(), snapshot: [] },
      }),
    );
    expect(imageCallCount).toBe(0);
  });
});

describe("zanjirdan avto-to'ldirish + snapshot 0-manba (B2-2/B2-3)", () => {
  test("approvalHistory'da rektor approved — TASDIQLAYMAN blokida ism/holat avto chiqadi", async () => {
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const ws = wsFixture({
      approvalHistory: [
        {
          step: "rektor",
          status: "approved",
          approvedBy: { firstName: "Ravshan", middleName: "Q", lastName: "Aliyev" },
          date: new Date(2026, 8, 3),
        },
      ],
    });
    WorkingPlanModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        workingSchedule: "ws1",
        semesters: null,
        studyPlanLabel: null,
      }),
    });
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chainablePopulate(ws));
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    spy.mockRestore();

    expect(texts).toContain("R.Q.Aliyev");
    expect(texts).toContain("Elektron tasdiqlangan");
  });

  test("draft (approvalHistory hammasi pending) — ism/holat chizilmaydi ('o'ylab topilmaydi')", async () => {
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const ws = wsFixture({
      approvalHistory: [
        { step: "methodical", status: "pending" },
        { step: "dean", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
    });
    WorkingPlanModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        workingSchedule: "ws1",
        semesters: null,
        studyPlanLabel: null,
      }),
    });
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chainablePopulate(ws));
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    spy.mockRestore();

    expect(texts).not.toContain("Elektron tasdiqlangan");
  });

  test("snapshot bor bo'lsa — 0-manba: approvalHistory'dagi ism BOSIB O'TILADI", async () => {
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    const ws = wsFixture({
      status: "approved",
      approvalHistory: [
        {
          step: "rektor",
          status: "approved",
          approvedBy: { firstName: "Yangi", lastName: "Rahbar" },
          date: new Date(),
        },
      ],
      verify: {
        token: "c".repeat(32),
        revokedAt: null,
        snapshot: [
          { step: "rektor", label: "Rektor", shortName: "Eski.Ism", date: new Date(2020, 0, 1) },
        ],
      },
    });
    WorkingPlanModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        workingSchedule: "ws1",
        semesters: null,
        studyPlanLabel: null,
      }),
    });
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chainablePopulate(ws));
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    const texts = spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
    spy.mockRestore();

    expect(texts).toContain("Eski.Ism");
    expect(texts).not.toContain("Y.Rahbar");
  });
});
