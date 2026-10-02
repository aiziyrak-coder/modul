jest.mock("./syllabus.model");
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const Syllabus = require("./syllabus.model");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const SP_ID = "dddddddddddddddddddddddd";
const OWNER_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const putReq = (body) => ({
  params: { id: DOC_ID },
  body,
  scope: {},
  user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
});

const runUpdate = async (body, docStatus = "draft") => {
  Syllabus.findOne = jest
    .fn()
    .mockResolvedValue({
      _id: DOC_ID,
      status: docStatus,
      author: { teacher: OWNER_ID },
    });
  Syllabus.findByIdAndUpdate = jest.fn().mockResolvedValue({});
  const res = createRes();
  const next = jest.fn();
  await Controller.updateSyllabus(putReq(body), res, next);
  return { res, next, err: next.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("updateSyllabus — scienceProgram darvozasi", () => {
  test("tasdiqlanmagan fan dasturiga almashtirish RAD etiladi (400) va yozuv bo'lmaydi", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue({ lean: () => Promise.resolve({ status: "draft" }) });

    const { err } = await runUpdate({ scienceProgram: SP_ID });

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(Syllabus.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("xabar matni addSyllabus bilan AYNAN bir xil", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue({ lean: () => Promise.resolve({ status: "in_review" }) });

    const { err } = await runUpdate({ scienceProgram: SP_ID });

    expect(err.message).toBe(
      "Sillabus faqat tasdiqlangan fan dasturi asosida yaratiladi. Avval fan dasturini tasdiqlatib oling",
    );
  });

  test("mavjud bo'lmagan fan dasturi → 400 'topilmadi', yozuv bo'lmaydi", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue({ lean: () => Promise.resolve(null) });

    const { err } = await runUpdate({ scienceProgram: SP_ID });

    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Ko'rsatilgan fan dasturi topilmadi");
    expect(Syllabus.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("tasdiqlangan fan dasturi → o'tadi va yoziladi", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue({ lean: () => Promise.resolve({ status: "approved" }) });

    const { res, next } = await runUpdate({
      scienceProgram: SP_ID,
      desc: "matn",
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Syllabus.findByIdAndUpdate).toHaveBeenCalledWith(
      DOC_ID,
      { $set: { scienceProgram: SP_ID, desc: "matn" } },
      { runValidators: true },
    );
  });

  test("`scienceProgram` yuborilmasa — ScienceProgram umuman so'ralmaydi", async () => {
    ScienceProgram.findById = jest.fn();

    const { res, next } = await runUpdate({ desc: "faqat matn" });

    expect(ScienceProgram.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("`finalize: true` trigger'i hamon draft → new qiladi", async () => {
    ScienceProgram.findById = jest.fn();

    await runUpdate({ desc: "yakuniy", finalize: true });

    expect(Syllabus.findByIdAndUpdate).toHaveBeenCalledWith(
      DOC_ID,
      { $set: { desc: "yakuniy", status: "new" } },
      { runValidators: true },
    );
  });

  test("draft/new status qulfi buzilmagan — 'approved' hujjat tahrirlanmaydi", async () => {
    ScienceProgram.findById = jest
      .fn()
      .mockReturnValue({ lean: () => Promise.resolve({ status: "approved" }) });

    const { res } = await runUpdate({ scienceProgram: SP_ID }, "approved");

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ScienceProgram.findById).not.toHaveBeenCalled();
    expect(Syllabus.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
