jest.mock("#shared/pythonParser", () => ({
  parseJarayon: jest.fn(),
  fileUrlToPath: jest.fn((x) => x),
  parsePdfReja: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/_services/planStatistics", () => ({
  academicStatistics: jest.fn(() => ({})),
}));
jest.mock("#references/_services/courseResolver", () => ({
  resolveCourse: jest.fn().mockResolvedValue(null),
}));
jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.controller", () => ({
  subAddFormXlsx: jest.fn().mockResolvedValue({}),
}));

const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const { parseJarayon, parsePdfReja } = require("#shared/pythonParser");
const Controller = require("./learningProcess.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(DirectionModel, "findById")
    .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: "dir1", title: "Davolash ishi" }) });
  jest.spyOn(LearningProcess, "create").mockResolvedValue({ _id: "lp1" });
  jest.spyOn(LearningProcess, "findOne").mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
  jest.spyOn(LearningProcess, "findByIdAndDelete").mockResolvedValue({ _id: "lp1" });
  parseJarayon.mockResolvedValue({
    courses: [{ course: "1-kurs", courseNum: 1 }],
    keys: [],
    allValues: {},
  });
  parsePdfReja.mockResolvedValue({
    courses: [],
    keys: [],
    allValues: {},
    comment: null,
    header: {},
    learningProcessKeys: [],
    blocks: [],
  });
});

afterEach(() => jest.restoreAllMocks());

describe("learningProcess.controller — planSource allowlist (ADR-024 Faza 1)", () => {
  describe("addFromXlsx", () => {
    const baseReq = (body) => ({
      body: { file: "https://files/jarayon.xlsx", direction: "dir1", ...body },
      user: { _id: "u1" },
    });

    test("planSource: 'ministry' — saqlanadi", async () => {
      await Controller.addFromXlsx(baseReq({ planSource: "ministry" }), createRes(), jest.fn());

      expect(LearningProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({ planSource: "ministry" }),
      );
    });

    test("planSource: 'hack' (yaroqsiz qiymat) — 400 EMAS, jim default 'institute'", async () => {
      const next = jest.fn();
      await Controller.addFromXlsx(baseReq({ planSource: "hack" }), createRes(), next);

      expect(next).not.toHaveBeenCalled();
      expect(LearningProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({ planSource: "institute" }),
      );
    });

    test("planSource yuborilmasa — default 'institute'", async () => {
      await Controller.addFromXlsx(baseReq({}), createRes(), jest.fn());

      expect(LearningProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({ planSource: "institute" }),
      );
    });

    test("basisNote — string sifatida to'g'ridan-to'g'ri o'tadi", async () => {
      await Controller.addFromXlsx(
        baseReq({ basisNote: "TDTU 2025-yil tasdiqlangan reja asosida" }),
        createRes(),
        jest.fn(),
      );

      expect(LearningProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({
          basisNote: "TDTU 2025-yil tasdiqlangan reja asosida",
        }),
      );
    });

    test("basisNote yuborilmasa — null", async () => {
      await Controller.addFromXlsx(baseReq({}), createRes(), jest.fn());

      expect(LearningProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({ basisNote: null }),
      );
    });
  });

  describe("addFromPdf", () => {
    const baseReq = (body) => ({
      body: { file: "https://files/reja.pdf", direction: "dir1", ...body },
      user: { _id: "u1" },
    });

    test("planSource: 'ministry' — lpData ga saqlanadi", async () => {
      await Controller.addFromPdf(baseReq({ planSource: "ministry" }), createRes(), jest.fn());

      expect(LearningProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({ planSource: "ministry" }),
      );
    });

    test("planSource: 'hack' — 400 EMAS, jim default 'institute'", async () => {
      const next = jest.fn();
      await Controller.addFromPdf(baseReq({ planSource: "hack" }), createRes(), next);

      expect(LearningProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({ planSource: "institute" }),
      );
    });
  });

  describe("fullUpdate — planSource IMMUTABLE (fayl-siz shox)", () => {
    const LP_ID = "cccccccccccccccccccccccc";

    const buildLpUpdateChain = () => {
      const doc = { _id: LP_ID, toObject: () => ({ _id: LP_ID }) };
      doc.populate = jest.fn().mockReturnValue(doc);
      return doc;
    };

    beforeEach(() => {
      jest
        .spyOn(LearningProcess, "findOne")
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: LP_ID, status: "new" }) });
      jest
        .spyOn(LearningProcess, "findByIdAndUpdate")
        .mockReturnValue(buildLpUpdateChain());
      jest.spyOn(StudyPlanModel, "findOne").mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ file: null }),
      });
    });

    test("PUT fullupdate/:id da planSource: 'ministry' yuborilsa — DB yozuv obyektida planSource UMUMAN yo'q", async () => {
      const next = jest.fn();
      await Controller.fullUpdate(
        {
          params: { id: LP_ID },
          body: { direction: "dir1", planSource: "ministry", basisNote: "yangi izoh" },
          scope: {},
          user: { _id: "u1" },
        },
        createRes(),
        next,
      );

      expect(next).not.toHaveBeenCalled();
      const [, updateObj] = LearningProcess.findByIdAndUpdate.mock.calls[0];
      expect(updateObj).not.toHaveProperty("planSource");
      expect(updateObj).toHaveProperty("basisNote", "yangi izoh");
    });

    test("FAYLLI shox: basisNote yangilanadi, planSource baribir yo'q", async () => {
      const next = jest.fn();
      await Controller.fullUpdate(
        {
          params: { id: LP_ID },
          body: {
            direction: "dir1",
            file: "/files/reja.xlsx",
            planSource: "ministry",
            basisNote: "fayl bilan yangilangan izoh",
          },
          scope: {},
          user: { _id: "u1" },
        },
        createRes(),
        next,
      );

      expect(next).not.toHaveBeenCalled();
      const [, updateObj] = LearningProcess.findByIdAndUpdate.mock.calls[0];
      expect(updateObj).toHaveProperty("file", "/files/reja.xlsx");
      expect(updateObj).not.toHaveProperty("planSource");
      expect(updateObj).toHaveProperty("basisNote", "fayl bilan yangilangan izoh");
    });
  });
});
