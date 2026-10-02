"use strict";

jest.mock("./documentVerify.service");
jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const { lookup } = require("./documentVerify.service");
const winston = require("#shared/winston.logger");
const Controller = require("./documentVerify.controller");

function makeRes() {
  const res = {};
  res.set = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

const SECURITY_HEADERS = [
  ["Cache-Control", "no-store"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Robots-Tag", "noindex, noarchive"],
  ["X-Content-Type-Options", "nosniff"],
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("verifyDocument — header'lar (200 va 404 ikkalasida ham)", () => {
  test("200 — 4 header ham o'rnatiladi", async () => {
    lookup.mockResolvedValue({
      kind: "workload",
      title: "Test kafedrasi — 2026/2027 yuklamasi",
      approvedAt: new Date("2026-09-01"),
      snapshot: [],
      editedAfterApproval: false,
    });
    const res = makeRes();
    await Controller.verifyDocument({ params: { token: "a".repeat(32) } }, res);
    for (const [k, v] of SECURITY_HEADERS) {
      expect(res.set).toHaveBeenCalledWith(k, v);
    }
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("404 — 4 header ham o'rnatiladi", async () => {
    lookup.mockResolvedValue(null);
    const res = makeRes();
    await Controller.verifyDocument({ params: { token: "notfound" } }, res);
    for (const [k, v] of SECURITY_HEADERS) {
      expect(res.set).toHaveBeenCalledWith(k, v);
    }
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("verifyDocument — bir xil 404 (SHART #8, enumeration/oracle yo'q)", () => {
  test.each([
    ["topilmadi", null],
  ])("%s → renderInvalid bilan bir xil HTML", async (_label, lookupResult) => {
    lookup.mockResolvedValue(lookupResult);
    const res = makeRes();
    await Controller.verifyDocument({ params: { token: "x" } }, res);
    expect(res.send).toHaveBeenCalledWith(Controller.renderInvalid());
  });

  test("lookup xato tashlasa ham — renderInvalid bilan bir xil (catch)", async () => {
    lookup.mockRejectedValue(new Error("kutilmagan xato"));
    const res = makeRes();
    await Controller.verifyDocument({ params: { token: "x" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(Controller.renderInvalid());
    expect(winston.error).toHaveBeenCalled();
  });
});

describe("renderInvalid — token EKRANGA CHIQARILMAYDI", () => {
  test("renderInvalid parametr olmaydi — chaqiruvchi tokenni uzatolmaydi", () => {
    expect(Controller.renderInvalid.length).toBe(0);
  });

  test("controller javobida so'ralgan token qatori yo'q", async () => {
    const token = "deadbeef00112233deadbeef00112233";
    lookup.mockResolvedValue(null);
    const res = makeRes();
    await Controller.verifyDocument({ params: { token } }, res);
    const html = res.send.mock.calls[0][0];
    expect(html).not.toContain(token);
  });
});

describe("escapeHtml — XSS", () => {
  test("<script> va onload= escape qilinadi", () => {
    expect(Controller.escapeHtml('<script>alert(1)</script>')).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(Controller.escapeHtml('" onload="x()')).toBe(
      "&quot; onload=&quot;x()",
    );
  });

  test("renderValid — snapshot ichidagi xakerlik matni escape qilinadi", () => {
    const html = Controller.renderValid(
      {
        kind: "workload",
        title: '<img src=x onerror=alert(1)>',
        approvedAt: null,
        snapshot: [
          { step: "rektor", label: '"><script>x</script>', shortName: "R", date: null },
        ],
        editedAfterApproval: false,
      },
      "tok123",
    );
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});

describe("renderValid — ALLOWLIST (Kengash Invariant #3)", () => {
  test("javobda _id/eriSignature/eriSerial/comment/oneIdPin/files havolasi YO'Q", () => {
    const html = Controller.renderValid(
      {
        kind: "workload",
        title: "Kafedra — 2026/2027 yuklamasi",
        approvedAt: new Date("2026-09-01"),
        snapshot: [
          { step: "rektor", label: "Rektor", shortName: "R. Aliyev", date: new Date() },
        ],
        editedAfterApproval: false,
      },
      "a".repeat(32),
    );
    expect(html).not.toMatch(/_id/i);
    expect(html).not.toMatch(/eriSignature/i);
    expect(html).not.toMatch(/eriSerial/i);
    expect(html).not.toMatch(/oneIdPin/i);
    expect(html).not.toContain("/files/");
    expect(html).not.toMatch(/\bcomment\b/i);
  });

  test("editedAfterApproval:true — ogohlantirish ko'rinadi", () => {
    const html = Controller.renderValid(
      {
        kind: "workload",
        title: "T",
        approvedAt: null,
        snapshot: [],
        editedAfterApproval: true,
      },
      "tok",
    );
    expect(html).toMatch(/Tasdiqdan keyin tahrirlangan/);
  });

  test("editedAfterApproval:false — ogohlantirish YO'Q", () => {
    const html = Controller.renderValid(
      { kind: "workload", title: "T", approvedAt: null, snapshot: [], editedAfterApproval: false },
      "tok",
    );
    expect(html).not.toMatch(/Tasdiqdan keyin tahrirlangan/);
  });
});
