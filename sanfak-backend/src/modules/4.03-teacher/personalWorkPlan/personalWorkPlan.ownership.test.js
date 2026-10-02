jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");

const ME = "1111aaaa1111aaaa1111aaaa";
const VICTIM = "2222bbbb2222bbbb2222bbbb";
const AY = "3333cccc3333cccc3333cccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(null);
});

describe("addWorkPlan — `teacher` egaligi", () => {
  test("begona `teacher` E'TIBORSIZ qoldiriladi, reja so'rovchiga biriktiriladi", async () => {
    PersonalWorkPlanModel.mockImplementation(function ctor(doc) {
      this.doc = doc;
      this.save = jest.fn().mockResolvedValue({ _id: "plan-1" });
    });

    await Controller.addWorkPlan(
      {
        body: { teacher: VICTIM, academicYear: AY, name: "soxta" },
        user: { _id: ME },
      },
      createRes(),
      jest.fn(),
    );

    const passed = PersonalWorkPlanModel.mock.calls[0][0];
    expect(String(passed.teacher)).toBe(ME);
    expect(String(passed.teacher)).not.toBe(VICTIM);
    expect(passed.status).toBe("draft");
  });

  test("takroriy reja tekshiruvi ham SO'ROVCHI bo'yicha ketadi (begona bo'yicha emas)", async () => {
    PersonalWorkPlanModel.mockImplementation(function ctor() {
      this.save = jest.fn().mockResolvedValue({ _id: "plan-2" });
    });

    await Controller.addWorkPlan(
      { body: { teacher: VICTIM, academicYear: AY }, user: { _id: ME } },
      createRes(),
      jest.fn(),
    );

    const [dupFilter] = PersonalWorkPlanModel.findOne.mock.calls[0];
    expect(String(dupFilter.teacher)).toBe(ME);
    expect(String(dupFilter.teacher)).not.toBe(VICTIM);
  });

  test("409 ham so'rovchining o'z rejasi bo'yicha qaytadi", async () => {
    PersonalWorkPlanModel.findOne = jest
      .fn()
      .mockResolvedValue({ _id: "mavjud" });
    const res = createRes();

    await Controller.addWorkPlan(
      { body: { teacher: VICTIM, academicYear: AY }, user: { _id: ME } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    const [dupFilter] = PersonalWorkPlanModel.findOne.mock.calls[0];
    expect(String(dupFilter.teacher)).toBe(ME);
  });
});
