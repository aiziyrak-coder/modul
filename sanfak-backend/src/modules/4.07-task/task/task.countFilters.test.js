const mongoose = require("mongoose");
const Task = require("./task.model");
const TaskResponse = require("#modules/4.07-task/taskResponse/taskResponse.model");
const service = require("./task.service");
const { buildFilter } = require("./task.service");
const V = require("./task.validation");

const ADMIN = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  role: { title: "admin", scopeLevel: "global" },
};
const CATEGORY_ID = "64f1a2b3c4d5e6f7a8b9c0d1";

const firstMatch = (spy, callIndex = 0) => spy.mock.calls[callIndex][0][0].$match;

afterEach(() => jest.restoreAllMocks());

describe("stats — `category` aggregate uchun ObjectId'ga cast qilinadi", () => {
  test("`$match.category` SATR emas, ObjectId bo'ladi", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    await service.stats(ADMIN, { category: CATEGORY_ID });

    const match = firstMatch(spy);
    expect(match.category).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(match.category)).toBe(CATEGORY_ID);
  });

  test("ikkala doira (created + assigned) ham cast qilingan qiymat oladi", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    await service.stats(ADMIN, { category: CATEGORY_ID });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(firstMatch(spy, 0).category).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(firstMatch(spy, 1).category).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  test("noto'g'ri shakldagi qiymat TEGILMAYDI (xulq avvalgidek)", () => {
    expect(buildFilter({}, { category: "abc" }).category).toBe("abc");
  });

  test("kategoriyasiz so'rovda kalit umuman qo'shilmaydi", () => {
    expect(buildFilter({}, {}).category).toBeUndefined();
  });
});

describe("buildFilter — `createdAt` oralig'i (monitoring oynasi bilan bir xil o'lchov)", () => {
  test("`createdFrom`/`createdTo` `createdAt` bandiga tushadi", () => {
    const f = buildFilter(
      {},
      { createdFrom: "2026-09-01T00:00:00.000Z", createdTo: "2026-09-30T23:59:59.999Z" },
    );
    expect(f.createdAt.$gte).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(f.createdAt.$lte).toEqual(new Date("2026-09-30T23:59:59.999Z"));
  });

  test("`deadline` bandini BOSIB O'TMAYDI (ikkalasi alohida kalit)", () => {
    const f = buildFilter(
      {},
      { createdFrom: "2026-09-01T00:00:00.000Z", deadlineTo: "2026-12-31T00:00:00.000Z" },
    );
    expect(f.createdAt.$gte).toBeInstanceOf(Date);
    expect(f.deadline.$lte).toBeInstanceOf(Date);
  });

  test("davr berilmasa so'rov avvalgidek qoladi", () => {
    expect(buildFilter({}, {}).createdAt).toBeUndefined();
  });

  test("validator `paginate` da qabul qiladi (aks holda HTTP 400)", () => {
    const { error } = V.paginate.validate({
      page: 1,
      limit: 100,
      createdFrom: "2026-09-01T00:00:00.000Z",
      createdTo: "2026-09-30T23:59:59.999Z",
    });
    expect(error).toBeUndefined();
  });
});

describe("paginateMine — yozishmalar soni `paginate` bilan bir xil", () => {
  const page = (docs) => ({ docs, totalDocs: docs.length, page: 1, limit: 10 });

  test("`responseCount` biriktiriladi (Doska '💬 0' ko'rsatmaydi)", async () => {
    jest.spyOn(Task, "paginate").mockResolvedValue(page([{ _id: "t1", status: "new" }]));
    jest.spyOn(TaskResponse, "aggregate").mockResolvedValue([{ _id: "t1", count: 12 }]);

    const res = await service.paginateMine(ADMIN, { page: 1, limit: 10 });

    expect(res.docs[0].responseCount).toBe(12);
  });

  test("ikkala endpoint AYNI topshiriq uchun bir xil son beradi", async () => {
    jest.spyOn(Task, "paginate").mockResolvedValue(page([{ _id: "t1", status: "new" }]));
    jest.spyOn(TaskResponse, "aggregate").mockResolvedValue([{ _id: "t1", count: 7 }]);

    const mine = await service.paginateMine(ADMIN, { page: 1, limit: 10 });
    const created = await service.paginate(ADMIN, { page: 1, limit: 10 });

    expect(mine.docs[0].responseCount).toBe(created.docs[0].responseCount);
  });

  test("yozishmasi yo'q topshiriqda 0 (undefined EMAS)", async () => {
    jest.spyOn(Task, "paginate").mockResolvedValue(page([{ _id: "t2", status: "new" }]));
    jest.spyOn(TaskResponse, "aggregate").mockResolvedValue([]);

    const res = await service.paginateMine(ADMIN, { page: 1, limit: 10 });

    expect(res.docs[0].responseCount).toBe(0);
  });
});

describe("monitoringPage — `useFacet: false` qulfi", () => {
  test("`$group` li pipeline'da facet rejimi YOQILMAYDI", async () => {
    jest.spyOn(Task, "aggregate").mockReturnValue({ pipeline: "x" });
    const spy = jest
      .spyOn(Task, "aggregatePaginate")
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await service.monitoringPage(ADMIN, { page: 1, limit: 12 });

    expect(spy.mock.calls[0][1].useFacet).toBe(false);
  });
});
