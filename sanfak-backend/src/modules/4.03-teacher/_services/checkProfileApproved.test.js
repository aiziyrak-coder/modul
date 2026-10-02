jest.mock("#modules/4.03-teacher/teacher/teacher.model");

const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const checkProfileApproved = require("./checkProfileApproved");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockProfile = (profile) => {
  TeacherProfile.findOne = jest.fn().mockResolvedValue(profile);
};

const run = async (req = { user: { _id: USER_ID } }) => {
  const res = createRes();
  const next = jest.fn();
  await checkProfileApproved(req, res, next);
  return { res, next };
};

beforeEach(() => jest.clearAllMocks());

describe("checkProfileApproved — TZ 4.3.2 darvozasi", () => {
  test("profil TASDIQLANGAN — o'tkazadi", async () => {
    mockProfile({ hrApprovalStatus: "approved" });
    const { next, res } = await run();

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("profil YO'Q — 403 va nima qilish kerakligi aytiladi", async () => {
    mockProfile(null);
    const { next, res } = await run();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].message).toMatch(/profil yarating/i);
  });

  test("profil KO'RIB CHIQILMOQDA (pending) — 403", async () => {
    mockProfile({ hrApprovalStatus: "pending" });
    const { next, res } = await run();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/ko'rib chiqilmoqda/);
    expect(body.hrApprovalStatus).toBe("pending");
  });

  test("profil RAD ETILGAN — 403", async () => {
    mockProfile({ hrApprovalStatus: "rejected" });
    const { next, res } = await run();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].message).toMatch(/rad etilgan/);
  });

  test("autentifikatsiyasiz — 401", async () => {
    const { next, res } = await run({});

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("DB xatosi — 500 (jimgina o'tkazib yubormaydi)", async () => {
    TeacherProfile.findOne = jest.fn().mockRejectedValue(new Error("db down"));
    const { next, res } = await run();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("faqat O'Z profili bo'yicha qidiradi", async () => {
    mockProfile({ hrApprovalStatus: "approved" });
    await run();

    expect(TeacherProfile.findOne).toHaveBeenCalledWith(
      { user: USER_ID },
      { hrApprovalStatus: 1 },
    );
  });
});

describe("Darvoza qamrovi — qaysi route'larga ulangan", () => {
  const fs = require("fs");
  const src = fs.readFileSync(
    require.resolve("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.routes"),
    "utf8",
  );

  const lineFor = (controllerName) =>
    src.split("\n").find((l) => l.includes(`Controller.${controllerName}`));

  test.each([
    ["addWorkPlan", "yangi ish reja"],
    ["generateFromWorkload", "avtomatik shakllantirish"],
    ["addActivity", "faoliyat qo'shish"],
    ["submitWorkPlan", "tasdiqlashga yuborish"],
    ["updateWorkPlan", "tahrirlash"],
  ])("%s — darvoza bor (%s)", (controllerName) => {
    const line = lineFor(controllerName);
    expect(line).toBeDefined();
    expect(line).toContain("checkProfileApproved");
  });

  test("`/approve` va `/reject` da darvoza ATAYIN YO'Q", () => {
    const lines = src.split("\n");
    const approve = lines.find((l) => l.includes('"/:id/approve"'));
    const reject = lines.find((l) => l.includes('"/:id/reject"'));

    expect(approve).not.toContain("checkProfileApproved");
    expect(reject).not.toContain("checkProfileApproved");
  });

  test("o'qish (GET) route'larida darvoza yo'q — ko'rish bloklanmaydi", () => {
    const lines = src.split("\n");
    const monitoring = lines.find((l) => l.includes('"/monitoring"'));
    expect(monitoring).not.toContain("checkProfileApproved");
  });
});
