jest.mock("./workload.model");
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest.fn(),
}));

const {
  updateStaffPositionsSchema,
  STAFF_POSITION_CATEGORY_SLUGS,
} = require("./workload.validation");
const WorkloadModel = require("./workload.model");
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

describe("workload.validation — updateStaffPositionsSchema", () => {
  test("to'liq ruxsat etilgan payload QABUL qilinadi", () => {
    const { error } = updateStaffPositionsSchema.validate({
      items: [{ category: "teachingStaff", slug: "professor", positions: 2, load: 300 }],
    });
    expect(error).toBeUndefined();
  });

  test("_id (mavjud elementni yangilash) bilan QABUL qilinadi", () => {
    const { error } = updateStaffPositionsSchema.validate({
      items: [
        {
          _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
          category: "supportStaff",
          slug: "laborant",
          positions: 1,
          load: 100,
        },
      ],
    });
    expect(error).toBeUndefined();
  });

  test("bo'sh items[] RAD etiladi", () => {
    const { error } = updateStaffPositionsSchema.validate({ items: [] });
    expect(error).toBeDefined();
  });

  test("items yo'q bo'lsa RAD etiladi", () => {
    const { error } = updateStaffPositionsSchema.validate({});
    expect(error).toBeDefined();
  });

  test("noma'lum category RAD etiladi", () => {
    const { error } = updateStaffPositionsSchema.validate({
      items: [{ category: "boshqa", slug: "professor", positions: 1, load: 1 }],
    });
    expect(error).toBeDefined();
  });

  test("category'ga mos kelmaydigan slug RAD etiladi (masalan supportStaff+professor)", () => {
    const { error } = updateStaffPositionsSchema.validate({
      items: [{ category: "supportStaff", slug: "professor", positions: 1, load: 1 }],
    });
    expect(error).toBeDefined();
  });

  test.each(Object.entries(STAFF_POSITION_CATEGORY_SLUGS))(
    "%s uchun HAR BIR ruxsat etilgan slug QABUL qilinadi",
    (category, slugs) => {
      for (const slug of slugs) {
        const { error } = updateStaffPositionsSchema.validate({
          items: [{ category, slug, positions: 1, load: 1 }],
        });
        expect(error).toBeUndefined();
      }
    },
  );

  test("teachingStaff + trainee QABUL qilinadi (yangi ustun)", () => {
    expect(STAFF_POSITION_CATEGORY_SLUGS.teachingStaff).toContain("trainee");
    const { error } = updateStaffPositionsSchema.validate({
      items: [{ category: "teachingStaff", slug: "trainee", positions: 1, load: 300 }],
    });
    expect(error).toBeUndefined();
  });

  test("trainee FAQAT teachingStaff'da — supportStaff + trainee RAD etiladi", () => {
    const { error } = updateStaffPositionsSchema.validate({
      items: [{ category: "supportStaff", slug: "trainee", positions: 1, load: 1 }],
    });
    expect(error).toBeDefined();
  });

  test("totalHours body'da RAD etiladi (derived, foydalanuvchi kiritmaydi)", () => {
    const { error } = updateStaffPositionsSchema.validate({
      items: [
        {
          category: "teachingStaff",
          slug: "professor",
          positions: 1,
          load: 1,
          totalHours: 500,
        },
      ],
    });
    expect(error).toBeDefined();
  });

  test("manfiy positions/load RAD etiladi", () => {
    const { error: e1 } = updateStaffPositionsSchema.validate({
      items: [{ category: "teachingStaff", slug: "professor", positions: -1, load: 1 }],
    });
    expect(e1).toBeDefined();

    const { error: e2 } = updateStaffPositionsSchema.validate({
      items: [{ category: "teachingStaff", slug: "professor", positions: 1, load: -1 }],
    });
    expect(e2).toBeDefined();
  });

  test("positions/load majburiy", () => {
    const { error } = updateStaffPositionsSchema.validate({
      items: [{ category: "teachingStaff", slug: "professor" }],
    });
    expect(error).toBeDefined();
  });
});

describe("updateStaffPositions servis — upsert, derived totalHours, guard", () => {
  const DOC_ID = "cccccccccccccccccccccccc";
  const EXISTING_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const EDITOR_ID = "222222222222222222222222";

  let doc;

  beforeEach(() => {
    jest.clearAllMocks();
    staffPositionsCalculator.buildStaffPositions.mockImplementation(
      async (workload) => ({
        items: workload.staffPositions.items,
        totalPositions: 3,
        hourly: 40,
      }),
    );

    doc = {
      _id: DOC_ID,
      status: "draft",
      staffPositions: {
        items: [
          {
            _id: EXISTING_ID,
            category: "teachingStaff",
            slug: "professor",
            positions: 1,
            load: 300,
            totalHours: 300,
          },
        ],
        totalPositions: 0,
        hourly: 0,
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
    WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
  });

  const callController = (items) =>
    Controller.updateStaffPositions(
      {
        params: { id: DOC_ID },
        body: { items },
        scope: {},
        user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
      },
      createRes(),
      jest.fn(),
    );

  const callControllerAs = (items, next = jest.fn()) =>
    Controller.updateStaffPositions(
      {
        params: { id: DOC_ID },
        body: { items },
        scope: {},
        user: {
          _id: EDITOR_ID,
          role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA },
        },
      },
      createRes(),
      next,
    );

  test("_id bo'yicha mavjud element YANGILANADI (yangi push qilinmaydi)", async () => {
    await callController([
      { _id: EXISTING_ID, category: "teachingStaff", slug: "professor", positions: 2, load: 350 },
    ]);

    expect(doc.staffPositions.items).toHaveLength(1);
    const item = doc.staffPositions.items[0];
    expect(item.positions).toBe(2);
    expect(item.load).toBe(350);
    expect(item.totalHours).toBe(700);
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("{category,slug} bo'yicha topilmasa — YANGI element qo'shiladi (upsert)", async () => {
    await callController([
      { category: "supportStaff", slug: "laborant", positions: 3, load: 100 },
    ]);

    expect(doc.staffPositions.items).toHaveLength(2);
    const created = doc.staffPositions.items.find(
      (it) => it.category === "supportStaff" && it.slug === "laborant",
    );
    expect(created).toBeDefined();
    expect(created.positions).toBe(3);
    expect(created.load).toBe(100);
    expect(created.totalHours).toBe(300);
  });

  test("{category,slug} bo'yicha MAVJUD element topilsa — YANGI push qilinmay, yangilanadi", async () => {
    await callController([
      { category: "teachingStaff", slug: "professor", positions: 5, load: 60 },
    ]);

    expect(doc.staffPositions.items).toHaveLength(1);
    expect(doc.staffPositions.items[0].positions).toBe(5);
    expect(doc.staffPositions.items[0].totalHours).toBe(300);
  });

  test("`hourly` berilsa yoziladi; berilmasa MAVJUD qiymat SAQLANADI", async () => {
    doc.staffPositions.items[0].hourly = 40;
    await callController([
      { category: "teachingStaff", slug: "professor", positions: 1, load: 300 },
    ]);
    expect(doc.staffPositions.items[0].hourly).toBe(40);

    await callController([
      { category: "teachingStaff", slug: "professor", positions: 1, load: 300, hourly: 55 },
      { category: "supportStaff", slug: "laborant", positions: 1, load: 0, hourly: 12 },
    ]);
    expect(doc.staffPositions.items[0].hourly).toBe(55);
    const created = doc.staffPositions.items.find((it) => it.slug === "laborant");
    expect(created.hourly).toBe(12);
  });

  test("noma'lum _id — 404, YOZUV BO'LMAYDI", async () => {
    const next = jest.fn();
    await Controller.updateStaffPositions(
      {
        params: { id: DOC_ID },
        body: {
          items: [
            {
              _id: "ffffffffffffffffffffff1",
              category: "teachingStaff",
              slug: "professor",
              positions: 1,
              load: 1,
            },
          ],
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

  const ITEM = {
    category: "teachingStaff",
    slug: "professor",
    positions: 1,
    load: 1,
  };

  test.each(["in_review", "approved", "rejected"])(
    "%s holatdagi yuklama — 400 va YOZUV BO'LMAYDI (qulf saqlanadi)",
    async (status) => {
      doc.status = status;
      const next = jest.fn();
      await callControllerAs([ITEM], next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining(status),
        }),
      );
      expect(doc.save).not.toHaveBeenCalled();
    },
  );

  test.each(["draft", "new"])(
    "%s — YOZUV BAJARILADI, lekin STAMP QO'YILMAYDI va PDF bekor qilinmaydi",
    async (status) => {
      doc.status = status;
      doc.file = "yuklama-eski.pdf";
      await callControllerAs([ITEM]);

      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(doc.lastEditedAfterApprovalAt).toBeUndefined();
      expect(doc.lastEditedAfterApprovalBy).toBeUndefined();
      expect(doc.file).toBe("yuklama-eski.pdf");
    },
  );

  test("scope tashqarisidagi hujjat — findOne null → 404", async () => {
    WorkloadModel.findOne = jest.fn().mockResolvedValue(null);
    const next = jest.fn();
    await Controller.updateStaffPositions(
      {
        params: { id: DOC_ID },
        body: {
          items: [
            { category: "teachingStaff", slug: "professor", positions: 1, load: 1 },
          ],
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
  });

  test("totalPositions/hourly — buildStaffPositions natijasidan (derived, response'ga chiqadi)", async () => {
    const res = createRes();
    await Controller.updateStaffPositions(
      {
        params: { id: DOC_ID },
        body: {
          items: [
            { _id: EXISTING_ID, category: "teachingStaff", slug: "professor", positions: 1, load: 300 },
          ],
        },
        scope: {},
        user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
      },
      res,
      jest.fn(),
    );

    expect(staffPositionsCalculator.buildStaffPositions).toHaveBeenCalledWith(doc);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        staffPositions: expect.objectContaining({ totalPositions: 3, hourly: 40 }),
      }),
    );
  });
});
