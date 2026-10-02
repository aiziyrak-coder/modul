jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model", () => ({ findOne: jest.fn() }));
jest.mock("#modules/4.01-auth/user/user.model", () => ({ find: jest.fn() }));

const PersonalWorkPlanModel = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const svc = require("./workPlanVerify.service");

const U1 = "111111111111111111111111";
const U2 = "222222222222222222222222";
const users = [
  { _id: U1, firstName: "Anvar", middleName: "Akramovich", lastName: "Anatomov" },
  { _id: U2, firstName: "Dilnoza", lastName: "Dekanova" },
];
const mockUsers = (rows = users) =>
  UserModel.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(rows) }) });

const step = (name, status = "pending", approvedBy = null, date = null) => ({ step: name, status, approvedBy, date });
const plan = (over = {}) => ({
  status: "draft",
  approvals: [
    step("teacher", "approved", U1, new Date("2026-09-20")),
    step("kafedraMudiri"),
    step("dekan", "approved", U2, new Date("2026-09-22")),
    step("ichkiNazorat"),
  ],
  verify: {},
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUsers();
});

describe("issueOrRefresh — ADR-039: token birinchi imzoda, keyin faqat snapshot", () => {
  test("token yo'q — 32 hex token, snapshot blanka lavozimi + «A.A.Familiya»", async () => {
    const p = plan();
    const token = await svc.issueOrRefresh(p, U1);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(p.verify).toMatchObject({ token, issuedBy: U1, revokedAt: null });
    expect(p.verify.snapshot).toEqual([
      { step: "teacher", label: "Kafedra assistenti", shortName: "A.A.Anatomov", date: new Date("2026-09-20") },
      { step: "dekan", label: "Fakultet dekani", shortName: "D.Dekanova", date: new Date("2026-09-22") },
    ]);
  });

  test("faol token bor — token O'ZGARMAYDI (G1 parallel imzolar), snapshot yangilanadi", async () => {
    const p = plan({ verify: { token: "a".repeat(32), revokedAt: null, snapshot: [] } });
    expect(await svc.issueOrRefresh(p, U2)).toBe("a".repeat(32));
    expect(p.verify.snapshot).toHaveLength(2);
  });

  test("bekor qilingan token (rad → qayta ochish → yuborish) — YANGI token", async () => {
    const p = plan({ verify: { token: "b".repeat(32), revokedAt: new Date(), snapshot: [] } });
    const token = await svc.issueOrRefresh(p, U1);
    expect(token).not.toBe("b".repeat(32));
    expect(p.verify.revokedAt).toBeNull();
  });

  test("snapshot xatosi tasdiqni to'xtatmaydi — `null`, throw YO'Q (SHART #4)", async () => {
    UserModel.find.mockReturnValue({ select: () => ({ lean: () => Promise.reject(new Error("db")) }) });
    await expect(svc.issueOrRefresh(plan(), U1)).resolves.toBeNull();
  });
});

describe("revoke", () => {
  test("token saqlanadi, `revokedAt` qo'yiladi; tokensiz reja — no-op", () => {
    const p = plan({ verify: { token: "c".repeat(32), revokedAt: null } });
    svc.revoke(p, "rejected");
    expect(p.verify).toMatchObject({ token: "c".repeat(32), revokedReason: "rejected" });
    expect(p.verify.revokedAt).toBeInstanceOf(Date);
    expect(() => svc.revoke(plan())).not.toThrow();
  });
});
