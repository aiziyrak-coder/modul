jest.mock("./personalWorkPlan.model");

const mongoose = require("mongoose");
const service = require("./personalWorkPlan.service");
const { ROLES } = require("#config/constants");
const {
  buildGroupedVisibilityFilter,
} = require("#modules/4.03-teacher/_shared/workPlanChain");

const SCOPE = { teacher: { $in: ["cccccccccccccccccccccccc"] } };
const userWithRole = (title, id = "aaaaaaaaaaaaaaaaaaaaaaaa") => ({
  _id: id,
  role: { title },
});

describe("completedItemsPipeline — zanjir ko'rinishi + draft himoyasi (N-1)", () => {
  test("dekan (G4) — priorSteps G0..G3 (G1 tugamagan reja filtrga tushadi)", () => {
    const pipeline = service.completedItemsPipeline(SCOPE, {}, userWithRole(ROLES.DEKAN));
    const match = pipeline[0].$match;
    expect(match.approvals).toEqual(
      buildGroupedVisibilityFilter(ROLES.DEKAN).approvals,
    );
    expect(match.approvals.$not.$elemMatch.step.$in).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
      "kafedraMudiri",
      "oquvUslubiy",
    ]);
  });

  test("navbati kelgan rol (oquv_uslubiy_boshqarma, G3) — priorSteps G0..G2", () => {
    const pipeline = service.completedItemsPipeline(
      SCOPE,
      {},
      userWithRole(ROLES.OQUV_USLUBIY_BOSHQARMA),
    );
    const match = pipeline[0].$match;
    expect(match.approvals.$not.$elemMatch.step.$in).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
      "kafedraMudiri",
    ]);
  });

  test("super_admin — zanjir filtri YO'Q va draft ham chiqadi (bypass)", () => {
    const pipeline = service.completedItemsPipeline(
      SCOPE,
      {},
      userWithRole(ROLES.SUPER_ADMIN),
    );
    const match = pipeline[0].$match;
    expect(match.approvals).toBeUndefined();
    expect(match.$expr).toBeUndefined();
    expect(match.$or).toBeUndefined();
  });

  test("draft — hech kimga (egasidan boshqa) chiqmaydi: `$or` bilan", () => {
    const userId = "bbbbbbbbbbbbbbbbbbbbbbbb";
    const pipeline = service.completedItemsPipeline(
      SCOPE,
      {},
      userWithRole(ROLES.DEKAN, userId),
    );
    const match = pipeline[0].$match;
    expect(match.$or).toEqual([
      { status: { $ne: "draft" } },
      { teacher: new mongoose.Types.ObjectId(userId) },
    ]);
  });

  test.each([ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM])(
    "%s (VERIFIER_ROLES) — zanjir tartibidan OZOD, lekin draft himoyasi qoladi",
    (role) => {
      const userId = "dddddddddddddddddddddddd";
      const pipeline = service.completedItemsPipeline(
        SCOPE,
        {},
        userWithRole(role, userId),
      );
      const match = pipeline[0].$match;
      expect(match.approvals).toBeUndefined();
      expect(match.$expr).toBeUndefined();
      expect(match.$or).toEqual([
        { status: { $ne: "draft" } },
        { teacher: new mongoose.Types.ObjectId(userId) },
      ]);
    },
  );

  test("zanjirda bosqichi yo'q, VERIFIER ham bo'lmagan rol — fail-closed", () => {
    const pipeline = service.completedItemsPipeline(
      SCOPE,
      {},
      userWithRole(ROLES.KADRLAR),
    );
    const match = pipeline[0].$match;
    expect(match.$expr).toEqual({ $eq: [1, 0] });
  });

  test("scope va zanjir filtri birga qo'llanadi (kalit to'qnashuvi yo'q)", () => {
    const pipeline = service.completedItemsPipeline(
      SCOPE,
      {},
      userWithRole(ROLES.DEKAN),
    );
    const match = pipeline[0].$match;
    expect(match.teacher).toEqual(SCOPE.teacher);
    expect(match.active).toBe(true);
  });
});
