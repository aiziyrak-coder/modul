"use strict";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { QR_SIZE_ROW } = require("#modules/4.02-studyLoad/_shared/verifyQr");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const ORIGINAL_ENV = process.env;
const D = new Date(2026, 8, 20);
const METHODICAL = { step: "methodical", label: "O'UB", shortName: "N.Rahimova", date: D };
const DEAN = { step: "dean", label: "Dekan", shortName: "D.Rahmonov", date: D };
const DEAN_PERSON = { firstName: "Dilshod", lastName: "Rahmonov" };

const wsFixture = ({ deanSigned, snapshot }) => ({
  _id: "ws1",
  status: "in_review",
  agreed: {},
  confirmation: {},
  academicYear: { title: "2026/2027" },
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  methodicalHead: { leader: { firstName: "Nilufar", lastName: "Rahimova" } },
  facultyDean: { dean: deanSigned ? DEAN_PERSON : null },
  approvalHistory: [
    { step: "methodical", status: "approved", approvedBy: { firstName: "Nilufar", lastName: "Rahimova" }, date: D },
    { step: "dean", status: deanSigned ? "approved" : "pending", approvedBy: deanSigned ? DEAN_PERSON : null, date: deanSigned ? D : null },
    { step: "prorektor", status: "pending" },
    { step: "rektor", status: "pending" },
  ],
  verify: { token: "c".repeat(32), revokedAt: null, snapshot },
});

const render = async (ws) => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({ workingSchedule: "ws1", semesters: null, studyPlanLabel: null }),
  });
  const chain = { populate: jest.fn(), exec: jest.fn().mockResolvedValue(ws) };
  chain.populate.mockReturnValue(chain);
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);
  const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
  const textSpy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    return {
      images: imageSpy.mock.calls.map((c) => ({ y: c[2], w: c[3] && c[3].width })),
      texts: textSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string"),
    };
  } finally {
    imageSpy.mockRestore();
    textSpy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, PUBLIC_BASE_URL: "https://ais.test.uz" };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("in_review — QR faqat imzolangan slotlarda (ADR-039)", () => {
  test("O'UB imzolagan, dekan kutilmoqda — 1 QR (O'UB qatori), holat matni yo'q, dekan bo'sh", async () => {
    const one = await render(wsFixture({ deanSigned: false, snapshot: [METHODICAL] }));
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(one.images).toHaveLength(1);
    expect(one.images[0].w).toBe(QR_SIZE_ROW);
    expect(one.texts).not.toContain("Elektron tasdiqlangan");
    expect(one.texts).not.toContain("D.Rahmonov");

    const two = await render(wsFixture({ deanSigned: true, snapshot: [METHODICAL, DEAN] }));
    expect(two.images).toHaveLength(2);
    expect(two.images.every((i) => i.w === QR_SIZE_ROW)).toBe(true);
    expect(two.images[0].y).toBe(one.images[0].y);
    expect(two.images[1].y).toBeGreaterThan(two.images[0].y);
    expect(two.texts).toContain("D.Rahmonov");
    expect(two.texts).not.toContain("Elektron tasdiqlangan");
  });

  test("STALE snapshot tuzog'i: dekan imzolagan, snapshot'da yo'q → dekan sloti manual, QR YO'Q", async () => {
    const stale = await render(wsFixture({ deanSigned: true, snapshot: [METHODICAL] }));
    expect(stale.images).toHaveLength(1);
  });

  test("draft (token bor bo'lsa ham) — QR yo'q", async () => {
    const ws = { ...wsFixture({ deanSigned: false, snapshot: [METHODICAL] }), status: "draft" };
    const r = await render(ws);
    expect(r.images).toHaveLength(0);
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
  });
});
