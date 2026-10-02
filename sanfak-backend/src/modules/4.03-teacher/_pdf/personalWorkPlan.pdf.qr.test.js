jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
jest.mock("#modules/4.03-teacher/personalReport/personalReport.model");
jest.mock("./_blankaTable", () => {
  const actual = jest.requireActual("./_blankaTable");
  return { ...actual, drawFooterLandscape: jest.fn(actual.drawFooterLandscape) };
});

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const PersonalWorkPlan = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const PersonalReport = require("#modules/4.03-teacher/personalReport/personalReport.model");
const { drawFooterLandscape } = require("./_blankaTable");
const { buildPersonalWorkPlanPdf } = require("./personalWorkPlan.pdf");

const TOKEN = "a1".repeat(16);
const basePlan = (over = {}) => ({
  _id: "planId123",
  status: "approved",
  academicYear: { title: "2026/2027" },
  teacher: { firstName: "Anvar", lastName: "Anatomov", department: { title: "Normal anatomiya kafedrasi", faculty: { title: "Davolash ishi fakulteti" } } },
  teachingLoad: { plannedHour: 124, sciences: [{ science: { title: "Odam anatomiyasi" }, course: 1, hoursByType: { lecture: 24, seminar: 100 }, totalHour: 124 }] },
  approvals: [],
  verify: { token: TOKEN, revokedAt: null, snapshot: [] },
  ...over,
});

const chain = (resolved, terminal = "exec") => {
  const c = {};
  for (const m of ["populate", "select", "lean"]) c[m] = jest.fn().mockReturnValue(c);
  c[terminal] = jest.fn().mockResolvedValue(resolved);
  return c;
};

const render = async (plan) => {
  PersonalWorkPlan.findOne = jest.fn().mockReturnValue(chain(plan));
  PersonalReport.find = jest.fn().mockReturnValue(chain([]));
  const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
  const qrSpy = jest.spyOn(QRCode, "toBuffer");
  const doc = await buildPersonalWorkPlanPdf("planId123", {});
  await new Promise((resolve) => {
    doc.on("end", resolve);
    doc.resume();
    doc.end();
  });
  return { images: imageSpy.mock.calls, qrCalls: qrSpy.mock.calls.length };
};

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  jest.restoreAllMocks();
});

describe("ADR-047 — ish reja PDF QR", () => {
  test.each([["approved"], ["completed"], ["submitted"]])("%s + token — bitta 44pt QR, toBuffer 1 marta", async (status) => {
    const { images, qrCalls } = await render(basePlan({ status }));
    expect(images).toHaveLength(1);
    expect(images[0][3]).toMatchObject({ width: 44, height: 44 });
    expect(qrCalls).toBe(1);
  });

  test.each([
    ["qoralama", basePlan({ status: "draft" })],
    ["token yo'q", basePlan({ verify: {} })],
    ["bekor qilingan", basePlan({ verify: { token: TOKEN, revokedAt: new Date() } })],
  ])("%s — QR chizilmaydi", async (_n, plan) => {
    const { images, qrCalls } = await render(plan);
    expect(images).toHaveLength(0);
    expect(qrCalls).toBe(0);
  });

  test("prod + PUBLIC_BASE_URL yo'q — QR yo'q, PDF baribir quriladi", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_BASE_URL;
    const { images } = await render(basePlan());
    expect(images).toHaveLength(0);
  });

  test("F-24 sahifa qulfi QR bilan ham: 1–2 bet", async () => {
    await render(basePlan());
    const pages = drawFooterLandscape.mock.results[drawFooterLandscape.mock.results.length - 1].value;
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(2);
  });
});
