jest.mock("./scienceProgram.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const ScienceProgram = require("./scienceProgram.model");
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const OWNER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const STRANGER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const V142_BODY = {
  educationForm: "kunduzgi",
  topics: [{ type: "maruza", code: "M1", title: "Kirish", hours: 2, refs: [1] }],
  authors: [{ fio: "Axmadaliyev Sh.Sh." }],
};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const run = async ({ doc, body, userId = OWNER_ID }) => {
  ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
  ScienceProgram.findByIdAndUpdate = jest.fn().mockResolvedValue({});
  const res = createRes();
  const next = jest.fn();
  await Controller.updateScienceProgram(
    {
      params: { id: DOC_ID },
      body,
      scope: {},
      user: { _id: userId, role: { title: ROLES.OQITUVCHI } },
    },
    res,
    next,
  );
  return { res, next, error: next.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("updateScienceProgram — v142 darvozasi (2-qavat gating)", () => {
  test("v259 draft hujjatga `v142` → 400 'Bu hujjat 142-son shaklida emas', DB yozuvi YO'Q", async () => {
    const { res, error } = await run({
      doc: { _id: DOC_ID, status: "draft", user: OWNER_ID, formVersion: "v259" },
      body: { title: "X", v142: V142_BODY },
    });

    expect(error).toBeDefined();
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Bu hujjat 142-son shaklida emas");
    expect(ScienceProgram.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("legacy hujjat (`formVersion` DB'da yo'q) + `v142` → 400 (v259 deb talqin qilinadi)", async () => {
    const { error } = await run({
      doc: { _id: DOC_ID, status: "draft", user: OWNER_ID },
      body: { v142: V142_BODY },
    });

    expect(error?.statusCode).toBe(400);
    expect(ScienceProgram.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("v142 draft hujjatga `v142` → 200, `$set.v142` TO'LIQ blok (D-6: qisman patch yo'q)", async () => {
    const { res, next } = await run({
      doc: { _id: DOC_ID, status: "draft", user: OWNER_ID, formVersion: "v142" },
      body: { title: "Yangi nom", v142: V142_BODY },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(ScienceProgram.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const [id, updateArg] = ScienceProgram.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe(DOC_ID);
    expect(updateArg.$set.v142).toEqual(V142_BODY);
    expect(updateArg.$set.title).toBe("Yangi nom");
    expect(updateArg.$set).not.toHaveProperty("formVersion");
  });

  test("`v142`siz body — darvoza tegmaydi: v259 hujjat 200 (mavjud xulq)", async () => {
    const { res, next } = await run({
      doc: { _id: DOC_ID, status: "draft", user: OWNER_ID, formVersion: "v259" },
      body: { title: "Faqat nom" },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const [, updateArg] = ScienceProgram.findByIdAndUpdate.mock.calls[0];
    expect(updateArg.$set).not.toHaveProperty("v142");
  });

  test("`v142`siz body — v142 hujjat ham 200 (blok ixtiyoriy, o'chirilmaydi)", async () => {
    const { res, next } = await run({
      doc: { _id: DOC_ID, status: "draft", user: OWNER_ID, formVersion: "v142" },
      body: { title: "Faqat nom" },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const [, updateArg] = ScienceProgram.findByIdAndUpdate.mock.calls[0];
    expect(updateArg.$set).not.toHaveProperty("v142");
  });

  test("TARTIB: begona hujjat + `v142` → 403 (egalik darvozasi v142 darvozasidan OLDIN)", async () => {
    const { error } = await run({
      doc: { _id: DOC_ID, status: "draft", user: OWNER_ID, formVersion: "v259" },
      body: { v142: V142_BODY },
      userId: STRANGER_ID,
    });

    expect(error?.statusCode).toBe(403);
    expect(ScienceProgram.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("TARTIB: v142 `in_review` hujjat + `v142` → 400 'draft' xabari (mavjud guard OLDIN, Kengash #9)", async () => {
    const { res, next } = await run({
      doc: { _id: DOC_ID, status: "in_review", user: OWNER_ID, formVersion: "v142" },
      body: { v142: V142_BODY },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/draft/);
    expect(ScienceProgram.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("`findOne` projeksiyasida `formVersion: 1` bor (busiz HAR v142 hujjat 400 olardi)", async () => {
    await run({
      doc: { _id: DOC_ID, status: "draft", user: OWNER_ID, formVersion: "v142" },
      body: { v142: V142_BODY },
    });

    const [, projection] = ScienceProgram.findOne.mock.calls[0];
    expect(projection).toEqual({ status: 1, user: 1, formVersion: 1 });
  });
});
