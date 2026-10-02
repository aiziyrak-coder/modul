jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model", () => ({ findOne: jest.fn() }));
jest.mock("#modules/4.01-auth/user/user.model", () => ({ find: jest.fn() }));

const PersonalWorkPlanModel = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const { lookup } = require("./workPlanVerify.service");

const TOKEN = "d".repeat(32);
const FINAL = new Date("2026-09-25");
const snapshot = [{ step: "teacher", label: "Kafedra assistenti", shortName: "A.A.Anatomov", date: new Date("2026-09-20") }];

const doc = (over = {}) => ({
  _id: "planId",
  status: "approved",
  teacher: { firstName: "Anvar", middleName: "Akramovich", lastName: "Anatomov", oneIdPin: "x" },
  academicYear: { title: "2026/2027" },
  teachingLoad: { plannedHour: 226 },
  researchWork: [{ title: "maxfiy", link: "http://x" }],
  approvals: [
    { step: "teacher", status: "approved", date: new Date("2026-09-20") },
    { step: "dekan", status: "pending" },
    { step: "ichkiNazorat", status: "approved", date: FINAL },
  ],
  verify: { token: TOKEN, revokedAt: null, snapshot },
  ...over,
});

const arrange = (d) => {
  const q = { populate: jest.fn(), lean: jest.fn().mockResolvedValue(d) };
  q.populate.mockReturnValue(q);
  PersonalWorkPlanModel.findOne.mockReturnValue(q);
};

beforeEach(() => jest.clearAllMocks());

describe("lookup — holat xaritasi", () => {
  test("approved — «Tasdiqlangan», sana ichki nazorat bosqichidan", async () => {
    arrange(doc());
    await expect(lookup(TOKEN)).resolves.toMatchObject({ state: "approved", approvedAt: FINAL });
  });

  test("completed ham «Tasdiqlangan» (QR bajarilgan rejada ham ishlaydi)", async () => {
    arrange(doc({ status: "completed" }));
    await expect(lookup(TOKEN)).resolves.toMatchObject({ state: "approved" });
  });

  test("submitted — «Jarayonda» + kutilayotgan bosqichlar (blanka lavozimi)", async () => {
    arrange(doc({ status: "submitted" }));
    const r = await lookup(TOKEN);
    expect(r.state).toBe("in_progress");
    expect(r.pending).toEqual([{ step: "dekan", label: "Fakultet dekani" }]);
  });

  test.each([["draft"], ["rejected"]])("%s — null", async (status) => {
    arrange(doc({ status }));
    await expect(lookup(TOKEN)).resolves.toBeNull();
  });

  test("bekor qilingan token — null", async () => {
    arrange(doc({ verify: { token: TOKEN, revokedAt: new Date(), snapshot } }));
    await expect(lookup(TOKEN)).resolves.toBeNull();
  });

  test("format xato — DB'ga so'rov ham ketmaydi", async () => {
    await expect(lookup("../../etc")).resolves.toBeNull();
    expect(PersonalWorkPlanModel.findOne).not.toHaveBeenCalled();
  });
});

describe("lookup — allowlist (🔴 PII)", () => {
  test("faqat kind/title/snapshot/state/approvedAt — _id, soat, ishlar, PIN YO'Q", async () => {
    arrange(doc());
    const r = await lookup(TOKEN);
    expect(Object.keys(r).sort()).toEqual(["approvedAt", "kind", "snapshot", "state", "title"]);
    expect(r.title).toBe("Shaxsiy ish reja — A.A.Anatomov, 2026/2027");
    expect(JSON.stringify(r)).not.toMatch(/planId|226|maxfiy|oneIdPin/);
  });
});
