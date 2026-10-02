const Task = require("./task.model");
const service = require("./task.service");

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: { title: "admin", scopeLevel: "global" } };

const firstMatch = (spy, callIndex = 0) => spy.mock.calls[callIndex][0][0].$match;

afterEach(() => jest.restoreAllMocks());

describe("task.service.stats — ro'yxat filtrlari sanoqqa ham qo'llanadi", () => {
  test("muddat oralig'i va muhimlik `$match`ga tushadi", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    await service.stats(ADMIN, {
      priority: "high",
      deadlineFrom: "2026-08-01T00:00:00.000Z",
      deadlineTo: "2026-08-31T23:59:59.999Z",
    });

    const match = firstMatch(spy);
    expect(match.priority).toBe("high");
    expect(match.deadline.$gte).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(match.deadline.$lte).toEqual(new Date("2026-08-31T23:59:59.999Z"));
    expect(match.deletedAt).toBeNull();
  });

  test("qidiruv `$or` bilan qo'llanadi", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    await service.stats(ADMIN, { search: "hisobot" });

    const match = firstMatch(spy);
    expect(match.$or).toEqual([
      { title: { $regex: "hisobot", $options: "i" } },
      { code: { $regex: "hisobot", $options: "i" } },
    ]);
  });

  test("`status` E'TIBORSIZ qoldiriladi (har tab o'z statusini sanaydi)", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    await service.stats(ADMIN, { status: "completed", priority: "low" });

    const match = firstMatch(spy);
    expect(match.status).toBeUndefined();
    expect(match.priority).toBe("low");
  });

  test("sahifa/sort parametrlari `$match`ga sizib kirmaydi", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    await service.stats(ADMIN, { page: 2, limit: 10, sort: "deadline", order: "asc" });

    const match = firstMatch(spy);
    expect(match.page).toBeUndefined();
    expect(match.limit).toBeUndefined();
    expect(match.sort).toBeUndefined();
    expect(match.order).toBeUndefined();
  });

  test("ikki doira ham (created + assigned) bir xil filtr bilan sanaladi", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    await service.stats(ADMIN, { priority: "high" });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(firstMatch(spy, 0).priority).toBe("high");
    const assigned = firstMatch(spy, 1);
    expect(assigned.priority).toBe("high");
    expect(String(assigned.assignee)).toBe(String(ADMIN._id));
  });

  test("filtrsiz chaqiruv avvalgidek ishlaydi (dashboard)", async () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);

    const out = await service.stats(ADMIN);

    expect(firstMatch(spy)).toEqual({ deletedAt: null });
    expect(out.created.total).toBe(0);
    expect(out.assigned.total).toBe(0);
  });
});
