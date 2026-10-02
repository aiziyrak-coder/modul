jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");
const { updateWorkPlanSchema } = require("./personalWorkPlan.validation");
const { ROLES } = require("#config/constants");

const OWNER = "cccccccccccccccccccccccc";
const PLAN = "aaaaaaaaaaaaaaaaaaaaaaaa";

describe("updateWorkPlanSchema — faqat name / semester", () => {
  test.each([[{ name: "Yangi nom" }], [{ semester: 2 }]])("%p — o'tadi", (body) => {
    expect(updateWorkPlanSchema.validate(body).error).toBeUndefined();
  });

  test.each([
    ["$set operatori", { $set: { status: "approved" } }],
    ["status", { status: "approved" }],
    ["soxta imzolar", { approvals: [{ step: "dekan", status: "approved" }] }],
    ["QR verify", { verify: { token: "a".repeat(32) } }],
    ["boshqa egasi", { teacher: "dddddddddddddddddddddddd" }],
    ["I bo'lim", { teachingLoad: { plannedHour: 1 } }],
    ["bo'sh tana", {}],
  ])("%s — rad etiladi (400)", (_n, body) => {
    expect(updateWorkPlanSchema.validate(body).error).toBeDefined();
  });
});

describe("updateWorkPlan — aniq $set (Joi chetlab o'tilsa ham)", () => {
  const run = async (body) => {
    PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue({ _id: PLAN, status: "draft", teacher: OWNER });
    PersonalWorkPlanModel.findOneAndUpdate = jest.fn().mockResolvedValue({});
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    const req = { params: { id: PLAN }, scope: { teacher: OWNER }, user: { _id: OWNER, role: { title: ROLES.OQITUVCHI } }, body };
    await Controller.updateWorkPlan(req, res, next);
    return { res, next };
  };

  test("faqat allowlist maydonlari yoziladi; operator/imzo/verify tashlanadi; filtr `status: draft`", async () => {
    const { res } = await run({
      name: "Yangi nom",
      $set: { status: "approved" },
      status: "approved",
      approvals: [{ step: "dekan", status: "approved" }],
      verify: { token: "a".repeat(32) },
      teacher: "dddddddddddddddddddddddd",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(PersonalWorkPlanModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: PLAN, teacher: OWNER, status: "draft" },
      { $set: { name: "Yangi nom" } },
      expect.any(Object),
    );
  });
});
