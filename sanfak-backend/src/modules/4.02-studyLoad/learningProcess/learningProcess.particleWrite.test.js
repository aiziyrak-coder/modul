const mongoose = require("mongoose");
const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const Controller = require("./learningProcess.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const SP_ID = String(new mongoose.Types.ObjectId());
const BLOCK_ID = new mongoose.Types.ObjectId();
const SCI_ID = new mongoose.Types.ObjectId();
const P_SOAT = new mongoose.Types.ObjectId();
const P_SEM = new mongoose.Types.ObjectId();

const updatedDoc = () => ({
  _id: SP_ID,
  blocks: [
    {
      _id: BLOCK_ID,
      sciences: [
        {
          _id: SCI_ID,
          particle: [
            { _id: P_SOAT, slug: "soat", value: 120 },
            { _id: P_SEM, slug: "seminar", value: 30 },
          ],
        },
      ],
    },
  ],
});

const call = async (body) => {
  jest.spyOn(StudyPlanModel, "findById").mockReturnValue({
    lean: jest.fn().mockResolvedValue({ learningProcess: "lp1" }),
  });
  jest.spyOn(LearningProcess, "exists").mockResolvedValue({ _id: "lp1" });
  jest.spyOn(StudyPlanModel, "findOneAndUpdate").mockResolvedValue(updatedDoc());
  const updateOne = jest.spyOn(StudyPlanModel, "updateOne").mockResolvedValue({ acknowledged: true });
  const res = createRes();
  const next = jest.fn();
  await Controller.updateStudyPlanScince(
    { params: { id: SP_ID }, body: { parentId: String(BLOCK_ID), _id: String(SCI_ID), ...body }, scope: {} },
    res,
    next,
  );
  return { res, next, updateOne };
};

describe("updateStudyPlanScince — particle yozuvi (slug `_id`)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("slug `_id` bilan kelgan mavjud ustun → 400 EMAS, `_id` bo'yicha $set", async () => {
    const { res, next, updateOne } = await call({
      title: "Anatomiya",
      particle: [{ _id: "soat", soat: 150 }],
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateOne).toHaveBeenCalledTimes(1);
    const [, update, opts] = updateOne.mock.calls[0];
    expect(update).toEqual({
      $set: { "blocks.$[block].sciences.$[science].particle.$[part].value": 150 },
    });
    expect(String(opts.arrayFilters[2]["part._id"])).toBe(String(P_SOAT));
  });

  test("qatorda yo'q «Kurs ishi» qiymati → $push (slug/title/canonical standart)", async () => {
    const { res, updateOne } = await call({
      particle: [
        { _id: "seminar", seminar: 30 },
        { _id: "kurs_ishi", kurs_ishi: 10 },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateOne).toHaveBeenCalledTimes(2);
    const [, pushUpdate] = updateOne.mock.calls[1];
    const pushed = pushUpdate.$push["blocks.$[block].sciences.$[science].particle"].$each;
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({ slug: "kurs_ishi", title: "Kurs ishi", canonical: "courseWork", value: 10 });
  });

  test("bo'sh «Klinik o'quv amaliyoti» (0) → hech qanday yozuv yo'q", async () => {
    const { res, updateOne } = await call({
      particle: [{ _id: "klinik_oquv_amaliyoti", klinik_oquv_amaliyoti: 0 }],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateOne).not.toHaveBeenCalled();
  });
});
