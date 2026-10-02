"use strict";

jest.mock("./documentVerify.service");
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { lookup } = require("./documentVerify.service");
const Controller = require("./documentVerify.controller");

const TOKEN = "a".repeat(32);
const makeRes = () => {
  const res = {};
  res.set = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};
const htmlOf = async (result) => {
  lookup.mockResolvedValue(result);
  const res = makeRes();
  await Controller.verifyDocument({ params: { token: TOKEN } }, res);
  return { res, html: res.send.mock.calls[0][0] };
};

const IN_PROGRESS = {
  kind: "workingSchedule",
  title: '60910200 – "Davolash ishi" — 2026/2027 o\'quv yili ishchi o\'quv rejasi',
  state: "in_progress",
  approvedAt: new Date(2026, 8, 20),
  snapshot: [{ step: "methodical", label: "O'quv-uslubiy boshqarma boshlig'i", shortName: "N.Rahimova", date: new Date(2026, 8, 20) }],
  pending: [{ step: "dean", label: "Fakultet dekani" }],
  editedAfterApproval: false,
};

beforeEach(() => jest.clearAllMocks());

describe("verifyDocument — in_progress (ADR-039)", () => {
  test("200, «Jarayonda», imzolangan + «kutilmoqda», joriy holat sanasi; «tasdiqlangan» YO'Q", async () => {
    const { res, html } = await htmlOf(IN_PROGRESS);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(html).toContain("Jarayonda");
    expect(html).toContain("N.Rahimova");
    expect(html).toContain("Fakultet dekani");
    expect(html).toContain("kutilmoqda");
    expect(html).toContain("joriy holat, 20.09.2026 bo'yicha");
    expect(html).not.toMatch(/tasdiqlangan/i);
  });

  test("pending label yo'q bo'lsa step nomi, HTML escaping saqlanadi", async () => {
    const { html } = await htmlOf({
      ...IN_PROGRESS,
      title: "<script>x</script>",
      pending: [{ step: "rektor", label: null }],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("rektor");
  });

  test("approved (state:'approved') — eski sahifa: «Tasdiqlangan», «Jarayonda» yo'q", async () => {
    const { html } = await htmlOf({ ...IN_PROGRESS, state: "approved", pending: undefined });
    expect(html).toContain("Tasdiqlangan");
    expect(html).not.toContain("Jarayonda");
  });

  test("rejected → lookup null → 404 «Topilmadi»", async () => {
    const { res, html } = await htmlOf(null);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(html).toContain("Topilmadi");
  });
});
