"use strict";

const MY_RESIDENT = "1111111111111111aaaaaaaa";
const OTHER_RESIDENT = "2222222222222222bbbbbbbb";
const RAHBAR_A = "3333333333333333cccccccc";
const RAHBAR_B = "4444444444444444dddddddd";
const MAGISTRANT_U = "5555555555555555eeeeeeee";

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn((q) => ({
    distinct: jest.fn(async () => {
      if (String(q.user) === "5555555555555555eeeeeeee")
        return ["1111111111111111aaaaaaaa"];
      if (String(q.supervisor) === "3333333333333333cccccccc")
        return ["1111111111111111aaaaaaaa"];
      return [];
    }),
  })),
}));
jest.mock("#system/notification/notificationDispatcher", () => ({ dispatch: jest.fn() }));

const { canAccessPlan, guardPlan, buildPlanScope } = require("./workPlanService");

const user = (title, scopeLevel, _id) => ({ _id, role: { title, scopeLevel } });
const plan = (over = {}) => ({
  _id: "9999999999999999ffffffff",
  resident: MY_RESIDENT,
  supervisor: RAHBAR_A,
  status: "yangi",
  ...over,
});

describe("canAccessPlan — cheklovsiz rollar", () => {
  it.each([
    ["magistratura_bolim", "self"],
    ["kafedra_mudiri", "department"],
    ["rektor", "global"],
  ])("%s barcha rejani ko'radi", async (title, scope) => {
    await expect(canAccessPlan(user(title, scope, "x"), plan())).resolves.toBe(true);
  });
});

describe("canAccessPlan — ilmiy rahbar (biriktirish izolyatsiyasi)", () => {
  it("O'ZI rahbar bo'lgan rejani ko'radi", async () => {
    await expect(
      canAccessPlan(user("ilmiy_rahbar", "department", RAHBAR_A), plan()),
    ).resolves.toBe(true);
  });

  it("BOSHQA rahbarning rejasini ko'ra olmaydi", async () => {
    await expect(
      canAccessPlan(user("ilmiy_rahbar", "department", RAHBAR_B), plan()),
    ).resolves.toBe(false);
  });

  it("o'ziga BIRIKTIRILMAGAN talabaning rejasini ko'ra olmaydi", async () => {
    await expect(
      canAccessPlan(
        user("ilmiy_rahbar", "department", RAHBAR_A),
        plan({ resident: OTHER_RESIDENT }),
      ),
    ).resolves.toBe(false);
  });

  it("D-2 REGRESSIYA: eski/noto'g'ri `supervisor` snapshot'i to'sqinlik qilmaydi", async () => {
    const rahbarA = user("ilmiy_rahbar", "department", RAHBAR_A);
    await expect(canAccessPlan(rahbarA, plan({ supervisor: RAHBAR_B }))).resolves.toBe(true);
    await expect(canAccessPlan(rahbarA, plan({ supervisor: null }))).resolves.toBe(true);
  });

  it("D-2 REGRESSIYA: snapshot O'ZINI ko'rsatsa ham, biriktirish bekor bo'lsa ko'rinmaydi", async () => {
    await expect(
      canAccessPlan(user("ilmiy_rahbar", "department", RAHBAR_B), plan({ supervisor: RAHBAR_B })),
    ).resolves.toBe(false);
  });
});

describe("canAccessPlan — magistrant (self)", () => {
  it("O'Z rejasini ko'radi", async () => {
    await expect(
      canAccessPlan(user("magistrant", "self", MAGISTRANT_U), plan()),
    ).resolves.toBe(true);
  });

  it("D5 REGRESSIYA: BEGONA rejani ko'ra/tahrirlay OLMAYDI", async () => {
    await expect(
      canAccessPlan(user("magistrant", "self", MAGISTRANT_U), plan({ resident: OTHER_RESIDENT })),
    ).resolves.toBe(false);
  });

  it("talaba yozuvi umuman bo'lmagan foydalanuvchi hech nimani ko'rmaydi", async () => {
    await expect(
      canAccessPlan(user("magistrant", "self", "0000000000000000zzzzzzzz"), plan()),
    ).resolves.toBe(false);
  });
});

describe("canAccessPlan — populate qilingan hujjat", () => {
  it("`resident` obyekt bo'lsa ham to'g'ri solishtiriladi (String(doc) id BERMAYDI)", async () => {
    const populated = plan({ resident: { _id: MY_RESIDENT, fullName: "Test" } });
    await expect(
      canAccessPlan(user("magistrant", "self", MAGISTRANT_U), populated),
    ).resolves.toBe(true);
    const foreign = plan({ resident: { _id: OTHER_RESIDENT, fullName: "Begona" } });
    await expect(
      canAccessPlan(user("magistrant", "self", MAGISTRANT_U), foreign),
    ).resolves.toBe(false);
  });

  it("ilmiy rahbar uchun ham `resident` populate qilingan shaklda ishlaydi", async () => {
    const rahbarA = user("ilmiy_rahbar", "department", RAHBAR_A);
    const mine = plan({ resident: { _id: MY_RESIDENT, fullName: "Test" } });
    await expect(canAccessPlan(rahbarA, mine)).resolves.toBe(true);
    const foreign = plan({ resident: { _id: OTHER_RESIDENT, fullName: "Begona" } });
    await expect(canAccessPlan(rahbarA, foreign)).resolves.toBe(false);
  });
});

describe("buildPlanScope — RO'YXAT so'rovi filtri", () => {
  it.each([
    ["magistratura_bolim", "self"],
    ["kafedra_mudiri", "department"],
    ["rektor", "global"],
  ])("%s cheklovsiz ({} filtri)", async (title, scope) => {
    await expect(buildPlanScope(user(title, scope, "x"))).resolves.toEqual({});
  });

  it("ilmiy_rahbar → biriktirilgan talabalarning rejalari", async () => {
    await expect(
      buildPlanScope(user("ilmiy_rahbar", "department", RAHBAR_A)),
    ).resolves.toEqual({ resident: { $in: [MY_RESIDENT] } });
  });

  it("magistrant → faqat o'z talaba yozuvi", async () => {
    await expect(buildPlanScope(user("magistrant", "self", MAGISTRANT_U))).resolves.toEqual({
      resident: { $in: [MY_RESIDENT] },
    });
  });

  it("biriktirilmagan rahbar/yozuvsiz user → bo'sh ro'yxat (hammasi EMAS)", async () => {
    await expect(
      buildPlanScope(user("ilmiy_rahbar", "department", RAHBAR_B)),
    ).resolves.toEqual({ resident: { $in: [] } });
  });
});

describe("canAccessPlan — buzuq kirish", () => {
  it("user yoki doc yo'q bo'lsa false", async () => {
    await expect(canAccessPlan(null, plan())).resolves.toBe(false);
    await expect(canAccessPlan(user("rektor", "global", "x"), null)).resolves.toBe(false);
  });
});

describe("guardPlan — HTTP javobi", () => {
  const mkRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  it("ruxsat bo'lsa true, javob yuborilmaydi", async () => {
    const res = mkRes();
    const req = { user: user("magistratura_bolim", "self", "x") };
    await expect(guardPlan(req, res, plan())).resolves.toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("ruxsat bo'lmasa 404 (403 EMAS — mavjudlik oshkor bo'lmasin)", async () => {
    const res = mkRes();
    const req = { user: user("magistrant", "self", MAGISTRANT_U) };
    await expect(guardPlan(req, res, plan({ resident: OTHER_RESIDENT }))).resolves.toBe(false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "not found" });
  });
});
