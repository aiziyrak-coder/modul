jest.mock("./workloadDistribution.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_ENTRY = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DIST_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (action = "accepted") => ({
  params: { id: DIST_ID, teacherEntryId: OTHER_ENTRY },
  body: { action, reason: action === "rejected" ? "sabab" : undefined },
  user: { _id: USER_ID },
});

describe("REGRESSION-GUARD — teacherRespond egalik sharti", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue(null);
  });

  test("update filtri so'rov yuborayotgan userga bog'langan ($elemMatch.teacher)", async () => {
    const req = createReq("accepted");
    await Controller.teacherRespond(req, createRes(), jest.fn());

    expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalled();
    const [filter] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual(
      expect.objectContaining({
        _id: DIST_ID,
        teachers: {
          $elemMatch: { _id: OTHER_ENTRY, teacher: USER_ID },
        },
      }),
    );
  });

  test("filtrda `teacher` sharti YO'Q bo'lsa — bu regressiya (aniq assert)", async () => {
    const req = createReq("accepted");
    await Controller.teacherRespond(req, createRes(), jest.fn());

    const [filter] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
    expect(filter["teachers._id"]).toBeUndefined();
    expect(filter.teachers?.$elemMatch?.teacher).toBe(USER_ID);
  });

  test("D-19: rad etish `residueHour` ni O'ZGARTIRMAYDI", async () => {
    const req = createReq("rejected");
    await Controller.teacherRespond(req, createRes(), jest.fn());

    const [, update] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
    expect(update.$inc).toBeUndefined();
    expect(Object.keys(update)).toEqual(["$set"]);
  });

  test("D-19: rad etishda soat o'qish uchun qo'shimcha so'rov YUBORILMAYDI", async () => {
    const req = createReq("rejected");
    await Controller.teacherRespond(req, createRes(), jest.fn());

    expect(WorkloadDistribution.findOne).not.toHaveBeenCalled();
  });

  test("rad etish filtri ham egalik sharti bilan (begona yozuvga tegmaydi)", async () => {
    const req = createReq("rejected");
    await Controller.teacherRespond(req, createRes(), jest.fn());

    const [filter] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
    expect(filter.teachers?.$elemMatch?.teacher).toBe(USER_ID);
    expect(filter.status).toEqual({ $nin: ["approved", "superseded"] });
  });

  test("begona yozuv bo'lsa (filtr mos kelmasa) — 404, yon ta'sir yo'q", async () => {
    const res = createRes();
    await Controller.teacherRespond(createReq("accepted"), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("F2 — teacherRespond: blok darajasidagi arrayFilters + rollup dual-write", () => {
  const BLOCK_1 = "111111111111111111111111";
  const BLOCK_2 = "222222222222222222222222";

  const createReqWith = ({ action = "accepted", reason, blockIds } = {}) => ({
    params: { id: DIST_ID, teacherEntryId: OTHER_ENTRY },
    body: { action, reason, blockIds },
    user: { _id: USER_ID },
  });

  const makeDoc = (blocks, entryOverrides = {}) => ({
    _id: DIST_ID,
    teachers: [
      {
        _id: OTHER_ENTRY,
        teacher: USER_ID,
        acceptanceStatus: "pending",
        ...entryOverrides,
        blocks,
      },
    ],
  });

  const mockPreEntry = (preDoc) => {
    WorkloadDistribution.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(preDoc),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue(null);
  });

  test("egalik qulfi: arrayFilters[0] da t._id VA t.teacher ANIQ req.user._id ga teng (ObjectId cast)", async () => {
    const doc = makeDoc([
      { _id: BLOCK_1, acceptanceStatus: "accepted", rejectionReason: null, respondedAt: new Date() },
    ]);
    mockPreEntry(doc);
    WorkloadDistribution.findOneAndUpdate
      .mockResolvedValueOnce(doc)
      .mockResolvedValueOnce(doc);

    await Controller.teacherRespond(
      createReqWith({ action: "accepted", blockIds: [BLOCK_1] }),
      createRes(),
      jest.fn(),
    );

    const [, , opts] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
    expect(opts.arrayFilters).toBeDefined();
    const [tFilter] = opts.arrayFilters;
    expect(tFilter["t._id"].toString()).toBe(OTHER_ENTRY);
    expect(tFilter["t.teacher"].toString()).toBe(USER_ID);
  });

  test("asosiy defekt regressiyasi: blockIds:[BLOCK_1] berilganda arrayFilters faqat BLOCK_1 ga mos ($in), BLOCK_2 ga tegilmaydi", async () => {
    const doc = makeDoc([
      { _id: BLOCK_1, acceptanceStatus: "accepted", rejectionReason: null, respondedAt: new Date() },
      { _id: BLOCK_2, acceptanceStatus: "pending", rejectionReason: null, respondedAt: null },
    ]);
    mockPreEntry(doc);
    WorkloadDistribution.findOneAndUpdate
      .mockResolvedValueOnce(doc)
      .mockResolvedValueOnce(doc);

    const res = createRes();
    await Controller.teacherRespond(
      createReqWith({ action: "accepted", blockIds: [BLOCK_1] }),
      res,
      jest.fn(),
    );

    const [, update, opts] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
    expect(Object.keys(update.$set)[0]).toContain("blocks.$[b]");
    const [, bFilter] = opts.arrayFilters;
    expect(bFilter["b._id"].$in).toHaveLength(1);
    expect(bFilter["b._id"].$in[0].toString()).toBe(BLOCK_1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("blockIds berilmasa — arrayFilters da `b` identifikatori YO'Q, `blocks.$[]` ishlatiladi (eski xatti-harakat), pre-write `findOne` chaqirilmaydi", async () => {
    const doc = makeDoc([
      { _id: BLOCK_1, acceptanceStatus: "accepted", rejectionReason: null, respondedAt: new Date() },
    ]);
    WorkloadDistribution.findOneAndUpdate
      .mockResolvedValueOnce(doc)
      .mockResolvedValueOnce(doc);

    await Controller.teacherRespond(
      createReqWith({ action: "accepted" }),
      createRes(),
      jest.fn(),
    );

    const [, update, opts] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
    expect(opts.arrayFilters).toHaveLength(1);
    expect(Object.keys(update.$set)[0]).toContain("blocks.$[]");
    expect(WorkloadDistribution.findOne).not.toHaveBeenCalled();
  });

  test("F-1: aralash blockIds (1 o'ziniki + 1 begona) — 404, findOneAndUpdate YOZUV uchun umuman chaqirilmaydi", async () => {
    const FOREIGN_BLOCK = "999999999999999999999999";
    const doc = makeDoc([
      { _id: BLOCK_1, acceptanceStatus: "pending", rejectionReason: null, respondedAt: null },
    ]);
    mockPreEntry(doc);

    const res = createRes();
    await Controller.teacherRespond(
      createReqWith({ action: "accepted", blockIds: [BLOCK_1, FOREIGN_BLOCK] }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("mavjud bo'lmagan blockId — pre-write tekshiruvda 404, yozuv (findOneAndUpdate) umuman chaqirilmaydi", async () => {
    const preDoc = makeDoc([
      { _id: BLOCK_2, acceptanceStatus: "pending", rejectionReason: null, respondedAt: null },
    ]);
    mockPreEntry(preDoc);

    const res = createRes();
    await Controller.teacherRespond(
      createReqWith({ action: "accepted", blockIds: [BLOCK_1] }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("rollup dual-write: 2 blokdan 1 tasi rejected → entry (2-yozuv) `rejected` bilan yangilanadi", async () => {
    const respondedAt1 = new Date("2026-08-01T00:00:00Z");
    const respondedAt2 = new Date("2026-08-02T00:00:00Z");
    const doc = makeDoc([
      {
        _id: BLOCK_1,
        acceptanceStatus: "accepted",
        rejectionReason: null,
        respondedAt: respondedAt1,
      },
      {
        _id: BLOCK_2,
        acceptanceStatus: "rejected",
        rejectionReason: "sabab",
        respondedAt: respondedAt2,
      },
    ]);
    mockPreEntry(doc);
    WorkloadDistribution.findOneAndUpdate
      .mockResolvedValueOnce(doc)
      .mockResolvedValueOnce(doc);

    await Controller.teacherRespond(
      createReqWith({ action: "rejected", reason: "sabab", blockIds: [BLOCK_2] }),
      createRes(),
      jest.fn(),
    );

    expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const [filter2, update2] = WorkloadDistribution.findOneAndUpdate.mock.calls[1];
    expect(filter2.teachers?.$elemMatch?.teacher).toBe(USER_ID);
    expect(update2.$set["teachers.$.acceptanceStatus"]).toBe("rejected");
    expect(update2.$set["teachers.$.rejectionReason"]).toBe("sabab");
  });

  test("F-3: blocks:[] entry'ga respond — 400, 'javob beriladigan fan yo'q'", async () => {
    const doc = makeDoc([]);
    WorkloadDistribution.findOneAndUpdate.mockResolvedValueOnce(doc);

    const res = createRes();
    await Controller.teacherRespond(
      createReqWith({ action: "accepted" }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("javob beriladigan fan yo'q"),
      }),
    );
    expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("F-4: blockIds siz shoxda yozuv bo'lmasa (statuslar action bilan mos emas) — 404", async () => {
    const doc = makeDoc([
      { _id: BLOCK_1, acceptanceStatus: "pending", rejectionReason: null, respondedAt: null },
    ]);
    WorkloadDistribution.findOneAndUpdate.mockResolvedValueOnce(doc);

    const res = createRes();
    await Controller.teacherRespond(
      createReqWith({ action: "accepted" }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  const approvedDoc = (blocks) => ({ ...makeDoc(blocks), status: "approved" });

  describe("D-26 — tasdiqlangan hujjatda pending blokni qabul qilish", () => {
    test("pending blokni qabul qilish — 200; yozuv filtri `approved`, arrayFilters `pending` ni talab qiladi", async () => {
      const pre = approvedDoc([
        { _id: BLOCK_1, acceptanceStatus: "pending", rejectionReason: null, respondedAt: null },
      ]);
      mockPreEntry(pre);
      const post = approvedDoc([
        { _id: BLOCK_1, acceptanceStatus: "accepted", rejectionReason: null, respondedAt: new Date() },
      ]);
      WorkloadDistribution.findOneAndUpdate
        .mockResolvedValueOnce(post)
        .mockResolvedValueOnce(post);

      const res = createRes();
      await Controller.teacherRespond(
        createReqWith({ action: "accepted", blockIds: [BLOCK_1] }),
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(200);
      const [preFilter, preProjection] = WorkloadDistribution.findOne.mock.calls[0];
      expect(preFilter.status).toEqual({ $ne: "superseded" });
      expect(preProjection).toEqual(expect.objectContaining({ status: 1 }));

      const [filter1, , opts] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
      expect(filter1.status).toBe("approved");
      expect(filter1.teachers.$elemMatch.teacher).toBe(USER_ID);
      expect(opts.arrayFilters[1]["b.acceptanceStatus"]).toBe("pending");
      const [filter2] = WorkloadDistribution.findOneAndUpdate.mock.calls[1];
      expect(filter2.status).toBe("approved");
    });
  });

  describe("D-26 — tasdiqlangan hujjatda ruxsat berilmaydigan javoblar", () => {
    test("rad etish — 400, hech narsa yozilmaydi (tasdiqlangan hujjatda berk ko'cha)", async () => {
      mockPreEntry(
        approvedDoc([
          { _id: BLOCK_1, acceptanceStatus: "pending", rejectionReason: null, respondedAt: null },
        ]),
      );

      const res = createRes();
      await Controller.teacherRespond(
        createReqWith({ action: "rejected", reason: "sabab", blockIds: [BLOCK_1] }),
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test("allaqachon qabul qilingan blok — 400, qayta yozilmaydi", async () => {
      mockPreEntry(
        approvedDoc([
          { _id: BLOCK_1, acceptanceStatus: "accepted", rejectionReason: null, respondedAt: new Date() },
          { _id: BLOCK_2, acceptanceStatus: "pending", rejectionReason: null, respondedAt: null },
        ]),
      );

      const res = createRes();
      await Controller.teacherRespond(
        createReqWith({ action: "accepted", blockIds: [BLOCK_1, BLOCK_2] }),
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("D-26 — tasdiqlanmagan hujjat (eski xulq o'zgarmaydi)", () => {
    test("tasdiqlanmagan taqsimot — eski filtr (`$nin approved/superseded`), `pending` sharti YO'Q", async () => {
      const doc = makeDoc([
        { _id: BLOCK_1, acceptanceStatus: "accepted", rejectionReason: null, respondedAt: new Date() },
      ]);
      mockPreEntry({ ...doc, status: "in_review" });
      WorkloadDistribution.findOneAndUpdate
        .mockResolvedValueOnce(doc)
        .mockResolvedValueOnce(doc);

      await Controller.teacherRespond(
        createReqWith({ action: "accepted", blockIds: [BLOCK_1] }),
        createRes(),
        jest.fn(),
      );

      const [filter1, , opts] = WorkloadDistribution.findOneAndUpdate.mock.calls[0];
      expect(filter1.status).toEqual({ $nin: ["approved", "superseded"] });
      expect(opts.arrayFilters[1]).not.toHaveProperty("b.acceptanceStatus");
    });
  });
});
