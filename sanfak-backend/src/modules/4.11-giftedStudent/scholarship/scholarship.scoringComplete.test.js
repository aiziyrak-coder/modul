jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("./scholarship.model", () => ({ findById: jest.fn() }));
jest.mock("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model", () => ({
  find: jest.fn(),
}));
jest.mock("../_services/scoringComplete", () => ({
  isScoringComplete: jest.fn(),
  touchesScoring: jest.fn(),
}));
jest.mock("../_services/roleEligibility", () => ({ rolesGranting: jest.fn() }));
jest.mock("../_services/userCandidates", () => ({ usersWithRoles: jest.fn() }));

const Controller = require("./scholarship.controller");
const ScholarshipModel = require("./scholarship.model");
const { isScoringComplete } = require("../_services/scoringComplete");

const ID = "6a7efdac5916905f06cebeb6";

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function arrangeDoc(doc) {
  const chain = {
    populate: jest.fn(() => chain),
    exec: jest.fn(async () => doc),
  };
  ScholarshipModel.findById.mockReturnValue(chain);
}

const schDoc = (over = {}) => {
  const plain = { _id: ID, name: "Rektor yo'nalishi", type: "rektor", judges: ["j1"], ...over };
  return { ...plain, toObject: () => ({ ...plain }) };
};

beforeEach(() => jest.clearAllMocks());

describe("findOneScholarship — `scoringComplete` (D-69)", () => {
  test("🔴 baholash tugagan — javobda `scoringComplete: true`", async () => {
    arrangeDoc(schDoc());
    isScoringComplete.mockResolvedValue(true);
    const res = mockRes();

    await Controller.findOneScholarship({ params: { id: ID } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].scoringComplete).toBe(true);
  });

  test("baholash tugamagan — `false`", async () => {
    arrangeDoc(schDoc());
    isScoringComplete.mockResolvedValue(false);
    const res = mockRes();

    await Controller.findOneScholarship({ params: { id: ID } }, res, jest.fn());

    expect(res.json.mock.calls[0][0].scoringComplete).toBe(false);
  });

  test("holat HUJJATNING O'ZIDAN hisoblanadi (qulf bilan bir manba)", async () => {
    const doc = schDoc();
    arrangeDoc(doc);
    isScoringComplete.mockResolvedValue(true);

    await Controller.findOneScholarship({ params: { id: ID } }, mockRes(), jest.fn());

    expect(isScoringComplete).toHaveBeenCalledTimes(1);
    expect(isScoringComplete.mock.calls[0][0]).toBe(doc);
  });

  test("qolgan maydonlar TEGILMAYDI — bu additiv maydon", async () => {
    arrangeDoc(schDoc({ minScore: 40 }));
    isScoringComplete.mockResolvedValue(false);
    const res = mockRes();

    await Controller.findOneScholarship({ params: { id: ID } }, res, jest.fn());

    expect(res.json.mock.calls[0][0]).toMatchObject({
      _id: ID,
      name: "Rektor yo'nalishi",
      type: "rektor",
      minScore: 40,
    });
  });

  test("yo'nalish topilmasa 404 — `isScoringComplete` chaqirilmaydi", async () => {
    arrangeDoc(null);
    const res = mockRes();

    await Controller.findOneScholarship({ params: { id: ID } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(isScoringComplete).not.toHaveBeenCalled();
  });
});
