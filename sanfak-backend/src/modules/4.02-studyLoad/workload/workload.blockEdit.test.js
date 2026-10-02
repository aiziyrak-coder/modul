jest.mock("./workload.model");
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest.fn(),
}));

const { updateBlockContentSchema } = require("./workload.validation");
const WorkloadModel = require("./workload.model");
WorkloadModel.calculateBlockTotal =
  jest.requireActual("./workload.model").calculateBlockTotal;
const Controller = require("./workload.controller");
const { ROLES } = require("#config/constants");
const staffPositionsCalculator = require(
  "#modules/4.02-studyLoad/_services/staffPositionsCalculator",
);

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("workload.validation — updateBlockContentSchema (ADR-004 allowlist)", () => {
  const CT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const IT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

  test("to'liq ruxsat etilgan payload QABUL qilinadi", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: {
        classTypes: [{ _id: CT_ID, stream: 12 }],
        items: [{ _id: IT_ID, value: 4 }],
      },
      otherWork: { items: [{ _id: IT_ID, value: 2 }] },
      leadership: 3,
    });
    expect(error).toBeUndefined();
  });

  test("faqat leadership (qisman payload) QABUL qilinadi", () => {
    const { error } = updateBlockContentSchema.validate({ leadership: 5 });
    expect(error).toBeUndefined();
  });

  test("bo'sh body RAD etiladi (kamida 1 maydon kerak)", () => {
    const { error } = updateBlockContentSchema.validate({});
    expect(error).toBeDefined();
  });

  test("studyWork.stream (TOP-LEVEL, oqimlar soni) RAD etiladi", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: { stream: 99 },
    });
    expect(error).toBeDefined();
  });

  test("studyWork.group RAD etiladi", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: { group: 10 },
    });
    expect(error).toBeDefined();
  });

  test("totalHour RAD etiladi (derived, calculateBlockTotal yozadi)", () => {
    const { error } = updateBlockContentSchema.validate({ totalHour: 100 });
    expect(error).toBeDefined();
  });

  test("thisSemester.* RAD etiladi", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: { thisSemester: { totalHour: 100 } },
    });
    expect(error).toBeDefined();
  });

  test("classTypes[].total RAD etiladi (derived)", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: { classTypes: [{ _id: CT_ID, stream: 5, total: 50 }] },
    });
    expect(error).toBeDefined();
  });

  test.each(["slug", "title", "canonical", "colNum"])(
    "classTypes[].%s RAD etiladi (mass-assignment — PDF ustun/ko'paytiruvchi)",
    (field) => {
      const { error } = updateBlockContentSchema.validate({
        studyWork: {
          classTypes: [{ _id: CT_ID, stream: 5, [field]: "x" }],
        },
      });
      expect(error).toBeDefined();
    },
  );

  test("classTypes[]._id majburiy (indeks/slug bilan emas, _id bilan)", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: { classTypes: [{ stream: 5 }] },
    });
    expect(error).toBeDefined();
  });

  test("student RAD etiladi", () => {
    const { error } = updateBlockContentSchema.validate({ student: 50 });
    expect(error).toBeDefined();
  });

  test.each([
    "section",
    "type",
    "science",
    "practiceTitle",
    "course",
    "courseRef",
    "slug",
    "title",
    "canonical",
    "colNum",
    "status",
    "approvalSteps",
    "department",
    "file",
    "needsRecalculation",
    "lastRecalculation",
  ])("top-level %s RAD etiladi (unknown(false))", (field) => {
    const { error } = updateBlockContentSchema.validate({ [field]: "x" });
    expect(error).toBeDefined();
  });

  test("manfiy stream RAD etiladi (min(0))", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: { classTypes: [{ _id: CT_ID, stream: -1 }] },
    });
    expect(error).toBeDefined();
  });

  test("manfiy leadership RAD etiladi", () => {
    const { error } = updateBlockContentSchema.validate({ leadership: -1 });
    expect(error).toBeDefined();
  });

  test("massiv TO'LIQ almashtirish (title/slug bilan) — element shakli buzilsa RAD", () => {
    const { error } = updateBlockContentSchema.validate({
      studyWork: {
        classTypes: [
          { _id: CT_ID, title: "Yangi nom", slug: "x", stream: 5 },
        ],
      },
    });
    expect(error).toBeDefined();
  });
});

describe("updateBlockContent servis — staffPositions rebuild, needsRecalculation TEGILMAYDI", () => {
  const DOC_ID = "cccccccccccccccccccccccc";
  const BLOCK_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const CT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const UNKNOWN_BLOCK_ID = "dddddddddddddddddddddd1";

  const REBUILT_STAFF_POSITIONS = {
    items: [],
    totalPositions: 1,
    hourly: 40,
  };

  let doc;

  beforeEach(() => {
    jest.clearAllMocks();
    staffPositionsCalculator.buildStaffPositions.mockResolvedValue(
      REBUILT_STAFF_POSITIONS,
    );

    doc = {
      _id: DOC_ID,
      status: "draft",
      needsRecalculation: false,
      lastRecalculation: { triggeredBy: null, triggeredAt: null, reason: null },
      staffPositions: { items: [], totalPositions: 0, hourly: 0 },
      directions: [
        {
          direction: "dir1",
          blocks: [
            {
              _id: BLOCK_ID,
              studyWork: {
                group: 2,
                stream: 1,
                classTypes: [
                  { _id: CT_ID, canonical: "lecture", stream: 10, total: 0 },
                ],
                items: [],
                thisSemester: { totalHour: 0, auditoriumHour: 0 },
              },
              otherWork: { items: [] },
              leadership: 0,
              totalHour: 10,
            },
          ],
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
  });

  const callController = (body) =>
    Controller.updateBlockContent(
      {
        params: { id: DOC_ID, blockId: BLOCK_ID },
        body,
        scope: {},
        user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
      },
      createRes(),
      jest.fn(),
    );

  test("staffPositions QAYTA QURILADI (buildStaffPositions chaqiriladi, natija hujjatga yoziladi)", async () => {
    const res = createRes();
    const next = jest.fn();

    await Controller.updateBlockContent(
      {
        params: { id: DOC_ID, blockId: BLOCK_ID },
        body: { leadership: 7 },
        scope: {},
        user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
      },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(staffPositionsCalculator.buildStaffPositions).toHaveBeenCalledWith(
      doc,
    );
    expect(doc.staffPositions).toEqual(REBUILT_STAFF_POSITIONS);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ staffPositions: REBUILT_STAFF_POSITIONS }),
    );
  });

  test("needsRecalculation TEGILMAYDI (qo'lda tahrirdan keyin ham false qoladi)", async () => {
    await callController({ leadership: 7 });
    expect(doc.needsRecalculation).toBe(false);
  });

  test("needsRecalculation=true bo'lsa ham O'ZGARMAYDI (bu endpoint uni tozalamaydi/o'rnatmaydi)", async () => {
    doc.needsRecalculation = true;
    await callController({ leadership: 7 });
    expect(doc.needsRecalculation).toBe(true);
  });

  test("lastRecalculation TEGILMAYDI", async () => {
    const before = doc.lastRecalculation;
    await callController({ leadership: 7 });
    expect(doc.lastRecalculation).toBe(before);
  });

  test("studyWork.items ichida on/yan slug — QABUL QILINADI va `overridden` belgilanadi", async () => {
    const ON_ID = "eeeeeeeeeeeeeeeeeeeeeee1";
    doc.directions[0].blocks[0].studyWork.items = [
      { _id: ON_ID, slug: "on", title: "ON (1 tal. 0.2 soat)", value: 0 },
    ];
    const next = jest.fn();

    await Controller.updateBlockContent(
      {
        params: { id: DOC_ID, blockId: BLOCK_ID },
        body: { studyWork: { items: [{ _id: ON_ID, value: 99 }] } },
        scope: {},
        user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
      },
      createRes(),
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalled();
    const item = doc.directions[0].blocks[0].studyWork.items[0];
    expect(item.value).toBe(99);
    expect(item.overridden).toBe(true);
  });

  test("noma'lum _id (mos element topilmasa) — 404, YOZUV BO'LMAYDI", async () => {
    const next = jest.fn();

    await Controller.updateBlockContent(
      {
        params: { id: DOC_ID, blockId: BLOCK_ID },
        body: {
          studyWork: {
            classTypes: [{ _id: "ffffffffffffffffffffffff", stream: 5 }],
          },
        },
        scope: {},
        user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
      },
      createRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("blockId topilmasa — 404 (Blok topilmadi)", async () => {
    const next = jest.fn();

    await Controller.updateBlockContent(
      {
        params: { id: DOC_ID, blockId: UNKNOWN_BLOCK_ID },
        body: { leadership: 1 },
        scope: {},
        user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
      },
      createRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
  });
});
