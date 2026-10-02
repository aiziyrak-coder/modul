"use strict";

const SPEC_A = "6a5a0acbd34b3c21a575d5a1";
const SPEC_B = "6a5a0acbd34b3c21a575d5b2";

const mockSkillFind = jest.fn();
const mockResidentFind = jest.fn();
const mockLogFind = jest.fn();
const mockResidentIdsFor = jest.fn();

jest.mock("./residencySkill.model", () => ({
  find: (...a) => mockSkillFind(...a),
}));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: (...a) => mockResidentFind(...a),
}));
jest.mock("#modules/4.05-residency/dailyLog/dailyLog.model", () => ({
  find: (...a) => mockLogFind(...a),
}));
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  residentIdsFor: (...a) => mockResidentIdsFor(...a),
  buildResidentScope: jest.fn(),
}));

const C = require("./residencySkill.controller");

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const req = { query: {}, user: { _id: "u1" } };

const residentChain = (rows) => {
  const chain = {};
  chain.select = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.lean = jest.fn().mockResolvedValue(rows);
  return chain;
};

const SKILLS = [
  {
    _id: "sk1",
    specialty: SPEC_A,
    semester: "1-semestr",
    practicalSkill: "Punksiya",
    theoryTopicTitle: "Mavzu",
    patientCount: 3,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockResidentIdsFor.mockResolvedValue(null);
  mockSkillFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(SKILLS) });
  mockLogFind.mockReturnValue({
    select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
  });
});

describe("progress — mutaxassislik ma'lumotnomasi populate qilinadi", () => {
  it("`specialty` populate SO'RALADI (tirik manba)", async () => {
    const chain = residentChain([]);
    mockResidentFind.mockReturnValue(chain);
    await C.progress(req, resFor(), jest.fn());
    expect(chain.populate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "specialty" }),
    );
  });

  it("`specialty` selektda ham qoladi (populate uchun ref maydoni shart)", async () => {
    const chain = residentChain([]);
    mockResidentFind.mockReturnValue(chain);
    await C.progress(req, resFor(), jest.fn());
    expect(chain.select.mock.calls[0][0]).toContain("specialty");
  });

  it("qatorda snapshot HAM, tirik obyekt HAM bo'ladi", async () => {
    mockResidentFind.mockReturnValue(
      residentChain([
        {
          _id: "r1",
          fullName: "Aliyev Sardor",
          specialtyTitle: "Terapiya (eski nom)",
          specialty: { _id: SPEC_A, title: "Ichki kasalliklar", code: "5A510101" },
        },
      ]),
    );
    const res = resFor();
    await C.progress(req, res, jest.fn());
    const [row] = res.json.mock.calls[0][0];
    expect(row.specialtyTitle).toBe("Terapiya (eski nom)");
    expect(row.specialty.title).toBe("Ichki kasalliklar");
  });
});

describe("progress — populate'dan keyin mutaxassislik filtri ISHLAYDI", () => {
  it("mos mutaxassislikdagi talaba uchun qator QAYTADI", async () => {
    mockResidentFind.mockReturnValue(
      residentChain([
        {
          _id: "r1",
          fullName: "Aliyev Sardor",
          specialty: { _id: SPEC_A, title: "Ichki kasalliklar" },
        },
      ]),
    );
    const res = resFor();
    await C.progress(req, res, jest.fn());
    expect(res.json.mock.calls[0][0]).toHaveLength(1);
  });

  it("BOSHQA mutaxassislikdagi talabaning ko'nikmasi chiqmaydi", async () => {
    mockResidentFind.mockReturnValue(
      residentChain([
        {
          _id: "r2",
          fullName: "Zokirov Bobur",
          specialty: { _id: SPEC_B, title: "Jarrohlik" },
        },
      ]),
    );
    const res = resFor();
    await C.progress(req, res, jest.fn());
    expect(res.json.mock.calls[0][0]).toHaveLength(0);
  });

  it("mutaxassilligi belgilanmagan talabaga BARCHA ko'nikmalar chiqadi", async () => {
    mockResidentFind.mockReturnValue(
      residentChain([{ _id: "r3", fullName: "Karimov Olim", specialty: null }]),
    );
    const res = resFor();
    await C.progress(req, res, jest.fn());
    expect(res.json.mock.calls[0][0]).toHaveLength(1);
  });
});
