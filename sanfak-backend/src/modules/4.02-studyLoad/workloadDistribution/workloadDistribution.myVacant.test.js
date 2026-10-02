jest.mock("./workloadDistribution.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");

const ME = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockFind = (docs) => {
  const q = {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(docs),
  };
  WorkloadDistribution.find = jest.fn().mockReturnValue(q);
};

describe("GET /my — D-20 vakant yozuv", () => {
  beforeEach(() => jest.clearAllMocks());

  test("so'rov faqat vakant BO'LMAGAN yozuvli taqsimotlarni oladi ($elemMatch)", async () => {
    mockFind([]);

    await Controller.getMyDistributions({ user: { _id: ME } }, createRes(), jest.fn());

    const [filter] = WorkloadDistribution.find.mock.calls[0];
    expect(filter).toEqual({
      teachers: { $elemMatch: { teacher: ME, isVacant: { $ne: true } } },
    });
  });

  test("bir hujjatda faol va vakant yozuv bo'lsa — faqat faoli qaytadi", async () => {
    mockFind([
      {
        _id: "d1",
        status: "approved",
        teachers: [
          { _id: "e-vacant", teacher: ME, isVacant: true, totalHour: 226, blocks: [] },
          { _id: "e-active", teacher: ME, isVacant: false, totalHour: 100, blocks: [] },
        ],
      },
    ]);
    const res = createRes();

    await Controller.getMyDistributions({ user: { _id: ME } }, res, jest.fn());

    const [row] = res.json.mock.calls[0][0];
    expect(row.myEntries.map((e) => e.teacherEntryId)).toEqual(["e-active"]);
  });
});
