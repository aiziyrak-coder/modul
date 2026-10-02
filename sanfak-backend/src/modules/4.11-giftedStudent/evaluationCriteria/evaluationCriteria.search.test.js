jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {},
}));

const mockFind = jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) }));
jest.mock("./evaluationCriteria.model", () => ({ find: (...a) => mockFind(...a) }));

const Controller = require("./evaluationCriteria.controller");

const res = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const filterFor = async (query) => {
  mockFind.mockClear();
  await Controller.findAllCriteria({ query }, res(), jest.fn());
  return mockFind.mock.calls[0][0];
};

describe("findAllCriteria — `?search=`", () => {
  test("qism-satr bo'yicha, registrga sezgir emas (anchor YO'Q)", async () => {
    const f = await filterFor({ search: "loyiha" });
    expect(f.name).toEqual({ $regex: "loyiha", $options: "i" });
  });

  test("metakarakterlar escape qilinadi — yiqilish YO'Q", async () => {
    const f = await filterFor({ search: "Grant (xalqaro)" });
    expect(f.name.$regex).toBe("Grant \\(xalqaro\\)");
    expect(() => new RegExp(f.name.$regex)).not.toThrow();
  });

  test("bo'shliqlar kesiladi va siqiladi", async () => {
    const f = await filterFor({ search: "  ixtiro   patenti  " });
    expect(f.name.$regex).toBe("ixtiro patenti");
  });

  test("faqat bo'shliqli so'rov FILTR QO'YMAYDI", async () => {
    const f = await filterFor({ search: "   " });
    expect(f.name).toBeUndefined();
  });

  test("kirill matni ham `i` bilan topiladi", async () => {
    const f = await filterFor({ search: "лойиҳа" });
    expect(new RegExp(f.name.$regex, f.name.$options).test("Илмий ЛОЙИҲА")).toBe(true);
  });
});
