jest.mock("./syllabus.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));

const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");
const { createSyllabusSchema } = require("./syllabus.validation");
const { ROLES } = require("#config/constants");
const {
  restrictUnsubmittedVisibility,
} = require("#modules/4.02-studyLoad/_shared/draftVisibility");

const OWNER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DOC_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseDoc = (status, overrides = {}) => ({
  _id: DOC_ID,
  status,
  author: { teacher: OWNER_ID },
  approvalSteps: [
    { step: "kafedra", status: "pending" },
    { step: "arm", status: "pending" },
    { step: "methodical", status: "pending" },
    { step: "prorektor", status: "pending" },
  ],
  file: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const teacherReq = (userId, body = {}) => ({
  params: { id: DOC_ID },
  body,
  scope: {},
  user: { _id: userId, role: { title: ROLES.OQITUVCHI } },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("syllabus — status 'new' (draft/new ajratish, AA-BE)", () => {
  describe("addSyllabus — finalize (create-time)", () => {
    const teacherCreateReq = (body) => ({
      body,
      user: {
        _id: OWNER_ID,
        role: { title: ROLES.OQITUVCHI },
        department: { faculty: "fff0000000000000000000f" },
      },
    });

    test("(8) POST finalize:true → konstruktorga status:'new' beriladi (bitta chaqiruv, PUT shart emas)", async () => {
      const res = createRes();
      const next = jest.fn();

      await Controller.addSyllabus(
        teacherCreateReq({ science: "sci1", desc: "yakuniy", finalize: true }),
        res,
        next,
      );

      expect(next).not.toHaveBeenCalled();
      expect(Syllabus).toHaveBeenCalledWith(
        expect.objectContaining({ status: "new" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("(9) POST finalize YO'Q → konstruktorga 'status' kaliti umuman berilmaydi (model default 'draft' ishlaydi)", async () => {
      const res = createRes();
      const next = jest.fn();

      await Controller.addSyllabus(
        teacherCreateReq({ science: "sci1", desc: "qoralama" }),
        res,
        next,
      );

      expect(next).not.toHaveBeenCalled();
      const ctorArg = Syllabus.mock.calls[0][0];
      expect(Object.prototype.hasOwnProperty.call(ctorArg, "status")).toBe(false);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("(10b) POST body'da status:'approved' (mass-assignment urinishi) — controller e'tiborsiz qoldiradi (defense-in-depth)", async () => {
      const res = createRes();
      const next = jest.fn();

      await Controller.addSyllabus(
        teacherCreateReq({ science: "sci1", status: "approved" }),
        res,
        next,
      );

      expect(next).not.toHaveBeenCalled();
      const ctorArg = Syllabus.mock.calls[0][0];
      expect(ctorArg.status).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("(10a) validation qatlami: 'status' body'da yuborilsa Joi rad etadi (unknown key)", () => {
      const { error } = createSyllabusSchema.validate({
        science: "sci1",
        scienceProgram: "sp1",
        status: "approved",
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/status.*not allowed/);
    });

    test("validation qatlami: 'finalize' create'da qabul qilinadi (true/false)", () => {
      const { error } = createSyllabusSchema.validate({
        science: "sci1",
        scienceProgram: "sp1",
        finalize: true,
      });
      expect(error).toBeUndefined();
    });
  });

  describe("updateSyllabus — finalize trigger", () => {
    test("draft hujjat + finalize:true → $set.status = 'new'", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(baseDoc("draft"));
      Syllabus.findByIdAndUpdate = jest.fn().mockResolvedValue({});
      const res = createRes();

      await Controller.updateSyllabus(
        teacherReq(OWNER_ID, { desc: "yakuniy matn", finalize: true }),
        res,
        jest.fn(),
      );

      expect(Syllabus.findByIdAndUpdate).toHaveBeenCalledWith(
        DOC_ID,
        { $set: { desc: "yakuniy matn", status: "new" } },
        { runValidators: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("draft hujjat, finalize YO'Q → status $set'ga qo'shilmaydi (oddiy tahrirlash, regressiya)", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(baseDoc("draft"));
      Syllabus.findByIdAndUpdate = jest.fn().mockResolvedValue({});
      const res = createRes();

      await Controller.updateSyllabus(
        teacherReq(OWNER_ID, { desc: "faqat tahrir" }),
        res,
        jest.fn(),
      );

      expect(Syllabus.findByIdAndUpdate).toHaveBeenCalledWith(
        DOC_ID,
        { $set: { desc: "faqat tahrir" } },
        { runValidators: true },
      );
    });

    test("'new' holatidagi hujjat TAHRIRLANADI (TZ 4.2.8 — Yangi qatorida Tahrirlash bor)", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(baseDoc("new"));
      const res = createRes();

      await Controller.updateSyllabus(
        teacherReq(OWNER_ID, { desc: "tuzatish" }),
        res,
        jest.fn(),
      );

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(Syllabus.findByIdAndUpdate).toHaveBeenCalled();
    });

    test.each(["in_review", "approved", "rejected"])(
      "'%s' holatidagi hujjatga PUT — guard 400 beradi",
      async (status) => {
        Syllabus.findOne = jest.fn().mockResolvedValue(baseDoc(status));
        const res = createRes();

        await Controller.updateSyllabus(
          teacherReq(OWNER_ID, { desc: "x" }),
          res,
          jest.fn(),
        );

        expect(res.status).toHaveBeenCalledWith(400);
      },
    );
  });

  describe("approve() — submit (draft/new → in_review)", () => {
    test("egasi: 'new' → in_review (3)", async () => {
      const doc = baseDoc("new");
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.approve(teacherReq(OWNER_ID), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(doc.status).toBe("in_review");
      expect(doc.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("egasi: 'draft' → in_review hamon ishlaydi (4, regressiya)", async () => {
      const doc = baseDoc("draft");
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.approve(teacherReq(OWNER_ID), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(doc.status).toBe("in_review");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("begona o'qituvchi 'new' hujjatni submit qilishga urinadi — 403 (5)", async () => {
      const doc = baseDoc("new");
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const next = jest.fn();

      await Controller.approve(teacherReq(OTHER_TEACHER_ID), createRes(), next);

      expect(doc.status).toBe("new");
      expect(doc.save).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Bu hujjat sizga tegishli emas",
        }),
      );
    });

    test("scope tashqarisidagi 'new' hujjat — findOne null → 404", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(null);
      const next = jest.fn();

      await Controller.approve(teacherReq(OTHER_TEACHER_ID), createRes(), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });

  describe("_shared/draftVisibility — 'new' yuborilmagan hisoblanadi (tegilmadi, faqat tasdiqlash)", () => {
    test("egasi bo'lmagan rol (masalan kafedra_mudiri) uchun filter $nin:[draft,new] qo'shiladi", () => {
      const filter = { active: true };
      const req = {
        user: { role: { title: ROLES.KAFEDRA_MUDIRI } },
      };

      restrictUnsubmittedVisibility(filter, req, [ROLES.OQITUVCHI]);

      expect(filter.status).toEqual({ $nin: ["draft", "new"] });
    });

    test("'?status=new' bilan chetlab o'tishga urinish — bo'sh natija ($in: [])", () => {
      const filter = { active: true, status: "new" };
      const req = { user: { role: { title: ROLES.KAFEDRA_MUDIRI } } };

      restrictUnsubmittedVisibility(filter, req, [ROLES.OQITUVCHI]);

      expect(filter.status).toEqual({ $in: [] });
    });

    test("egasi (oqituvchi) — filter o'zgarmaydi, 'new' hujjatini ko'radi", () => {
      const filter = { active: true };
      const req = { user: { role: { title: ROLES.OQITUVCHI } } };

      restrictUnsubmittedVisibility(filter, req, [ROLES.OQITUVCHI]);

      expect(filter.status).toBeUndefined();
    });
  });
});

describe("syllabus.model — status enum kengaytmasi (mock'siz, real Mongoose schema)", () => {
  jest.resetModules();
  jest.unmock("./syllabus.model");
  const RealSyllabus = require("./syllabus.model");
  const mongoose = require("mongoose");

  const validDoc = () => ({
    science: new mongoose.Types.ObjectId(),
    faculty: new mongoose.Types.ObjectId(),
  });

  test("(1) yangi hujjat — status default 'draft' (o'zgarmagan)", () => {
    const doc = new RealSyllabus(validDoc());
    expect(doc.status).toBe("draft");
  });

  test("'new' enum'ga kiritilgan — validateSync xato bermaydi", () => {
    const doc = new RealSyllabus({ ...validDoc(), status: "new" });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
    expect(doc.status).toBe("new");
  });

  test("(7) mavjud 'approved' hujjat — validateSync xatosiz o'tadi (regressiya qulfi)", () => {
    const doc = new RealSyllabus({ ...validDoc(), status: "approved" });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test("noto'g'ri status ('unknown') — enum rad etadi (himoya buzilmagan)", () => {
    const doc = new RealSyllabus({ ...validDoc(), status: "unknown" });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });
});
