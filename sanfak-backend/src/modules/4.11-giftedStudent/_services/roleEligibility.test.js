const mockFind = jest.fn();
jest.mock("mongoose", () => ({
  model: () => ({ find: (...a) => mockFind(...a) }),
}));

const { rolesGranting, hasGrant } = require("./roleEligibility");

const perm = (section, ...actionKeys) => ({ section, actionKeys });

const ROLES = [
  {
    _id: "r-teacher",
    title: "professor-o'qituvchi (qayta nomlangan)",
    permissions: [perm("giftedStudent", "read", "readAll"), perm("chat", "create", "read")],
  },
  {
    _id: "r-dept",
    title: "iqtidorli_bolim",
    permissions: [
      perm("giftedStudent", "create", "read", "readAll"),
      perm("studentAchievement", "create", "readAll"),
      perm("chat", "create"),
    ],
  },
  {
    _id: "r-student",
    title: "talaba",
    permissions: [perm("giftedStudent", "read"), perm("studentAchievement", "create", "read")],
  },
  {
    _id: "r-viewer",
    title: "prorektor",
    permissions: [perm("giftedStudent", "read", "readAll")],
  },
  {
    _id: "r-judge",
    title: "hakam",
    permissions: [perm("scholarshipApplication", "readAll", "score")],
  },
  {
    _id: "r-blocked",
    title: "eski_oqituvchi",
    active: false,
    permissions: [perm("giftedStudent", "readAll"), perm("chat", "create")],
  },
  {
    _id: "r-admin",
    title: "super_admin",
    permissions: [
      perm("giftedStudent", "create", "read", "readAll", "update", "delete"),
      perm("studentAchievement", "create", "readAll"),
      perm("chat", "create", "read", "readAll"),
    ],
  },
];

beforeEach(() => {
  mockFind.mockImplementation((filter) => ({
    select: () => ({
      lean: () =>
        Promise.resolve(
          filter?.active?.$ne === false ? ROLES.filter((r) => r.active !== false) : ROLES,
        ),
    }),
  }));
});

describe("hasGrant", () => {
  it("section + action mos kelsa true", () => {
    expect(hasGrant(ROLES[0], ["chat", "create"])).toBe(true);
  });

  it("section bor, action yo'q — false", () => {
    expect(hasGrant(ROLES[0], ["giftedStudent", "create"])).toBe(false);
  });

  it("permissions bo'sh/yo'q — false (crash emas)", () => {
    expect(hasGrant({}, ["chat", "create"])).toBe(false);
    expect(hasGrant(undefined, ["chat", "create"])).toBe(false);
  });

  it("wildcard QO'LLAB-QUVVATLANMAYDI — permit() bilan bir xil", () => {
    const wild = { permissions: [perm("giftedStudent", "*")] };
    expect(hasGrant(wild, ["giftedStudent", "readAll"])).toBe(false);
  });
});

describe("rolesGranting", () => {
  it("maslahatchi: readAll + chat:create, reyestr adminlari ISTISNO", async () => {
    const ids = await rolesGranting(
      [
        ["giftedStudent", "readAll"],
        ["chat", "create"],
      ],
      { excluding: [["giftedStudent", "create"]] },
    );
    expect(ids).toEqual(["r-teacher"]);
    expect(ids).not.toContain("r-viewer");
    expect(ids).not.toContain("r-dept");
    expect(ids).not.toContain("r-admin");
  });

  it("talaba akkaunti: studentAchievement:create, bo'lim xodimi ISTISNO", async () => {
    const ids = await rolesGranting([["studentAchievement", "create"]], {
      excluding: [["giftedStudent", "create"]],
    });
    expect(ids).toEqual(["r-student"]);
  });

  it("hakam: scholarshipApplication:score", async () => {
    const ids = await rolesGranting([["scholarshipApplication", "score"]]);
    expect(ids).toEqual(["r-judge"]);
  });

  it("bloklangan rol (active:false) hech qaysi ro'yxatga tushmaydi", async () => {
    const ids = await rolesGranting([
      ["giftedStudent", "readAll"],
      ["chat", "create"],
    ]);
    expect(ids).not.toContain("r-blocked");
  });

  it("hech kim mos kelmasa — bo'sh massiv", async () => {
    const ids = await rolesGranting([["giftedStudent", "nonExistentAction"]]);
    expect(ids).toEqual([]);
  });
});
