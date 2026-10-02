jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(`${message}: ${detail}`);
      this.status = status;
      this.detail = detail;
    }
  },
}));

const mockFind = jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) }));
const mockPaginate = jest.fn().mockResolvedValue({ docs: [] });
jest.mock("./scholarship.model", () => ({
  find: (...a) => mockFind(...a),
  paginate: (...a) => mockPaginate(...a),
}));
jest.mock(
  "#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model",
  () => ({ find: jest.fn() }),
);
jest.mock("../_services/scoringComplete", () => ({
  isScoringComplete: jest.fn(),
  touchesScoring: jest.fn(),
}));
jest.mock("../_services/roleEligibility", () => ({
  rolesGranting: jest.fn(),
  roleMatches: jest.fn(() => false),
}));
jest.mock("../_services/userCandidates", () => ({ usersWithRoles: jest.fn() }));

const Controller = require("./scholarship.controller");

const res = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const req = (query) => ({ query, user: { _id: "u1", role: null } });

const filterFor = async (query) => {
  mockFind.mockClear();
  const next = jest.fn();
  await Controller.findAllScholarships(req(query), res(), next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return mockFind.mock.calls[0][0];
};

describe("findAllScholarships — `?search=`", () => {
  test("qism-satr bo'yicha, registrga sezgir emas (anchor YO'Q)", async () => {
    const f = await filterFor({ search: "navoiy" });
    expect(f.name).toEqual({ $regex: "navoiy", $options: "i" });
  });

  test("metakarakterlar escape qilinadi", async () => {
    const f = await filterFor({ search: "Stipendiya (2025)" });
    expect(f.name.$regex).toBe("Stipendiya \\(2025\\)");
    expect(() => new RegExp(f.name.$regex)).not.toThrow();
  });

  test("bo'shliqlar kesiladi va siqiladi", async () => {
    const f = await filterFor({ search: "  Alisher   Navoiy  " });
    expect(f.name.$regex).toBe("Alisher Navoiy");
  });

  test("faqat bo'shliqli so'rov FILTR QO'YMAYDI", async () => {
    const f = await filterFor({ search: "   " });
    expect(f.name).toBeUndefined();
  });

  test("kirill matni ham `i` bilan topiladi", async () => {
    const f = await filterFor({ search: "навоий" });
    expect(new RegExp(f.name.$regex, f.name.$options).test("Алишер НАВОИЙ")).toBe(true);
  });

  test("paginate ham AYNAN shu filtrni oladi (sahifa/jami — FILTRLANGAN to'plamdan)", async () => {
    mockPaginate.mockClear();
    await Controller.paginateScholarships(
      req({ search: "Stipendiya (2025)", page: "1", limit: "10" }),
      res(),
      jest.fn(),
    );
    expect(mockPaginate.mock.calls[0][0].name).toEqual({
      $regex: "Stipendiya \\(2025\\)",
      $options: "i",
    });
  });
});
