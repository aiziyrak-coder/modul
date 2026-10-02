const Task = require("./task.model");
const TaskResponse = require("#modules/4.07-task/taskResponse/taskResponse.model");
const service = require("./task.service");

const CREATOR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ASSIGNEE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const STRANGER_ID = "cccccccccccccccccccccccc";

const makeTask = (overrides = {}) => ({
  _id: "task-1",
  createdBy: CREATOR_ID,
  assignee: ASSIGNEE_ID,
  status: "new",
  deadline: null,
  readAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const chainQuery = (doc) => {
  const q = Promise.resolve(doc);
  q.populate = jest.fn().mockResolvedValue(doc);
  return q;
};

afterEach(() => jest.restoreAllMocks());

describe("task.service.findOne — IDOR himoyasi", () => {
  test("begona user (creator/assignee/seesAll emas) → 403", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(makeTask()));

    await expect(
      service.findOne("task-1", {
        _id: STRANGER_ID,
        role: { title: "oqituvchi", scopeLevel: "self" },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("assignee (ijrochi) → muvaffaqiyatli qaytadi", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(makeTask()));

    const result = await service.findOne("task-1", {
      _id: ASSIGNEE_ID,
      role: { title: "oqituvchi", scopeLevel: "self" },
    });

    expect(result._id).toBe("task-1");
  });

  test("creator (yaratuvchi) → muvaffaqiyatli qaytadi", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(makeTask()));

    const result = await service.findOne("task-1", {
      _id: CREATOR_ID,
      role: { title: "oqituvchi", scopeLevel: "self" },
    });

    expect(result._id).toBe("task-1");
  });

  test("seesAll (global/admin) → begona bo'lsa ham muvaffaqiyatli qaytadi", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(makeTask()));

    const result = await service.findOne("task-1", {
      _id: STRANGER_ID,
      role: { title: "admin", scopeLevel: "global" },
    });

    expect(result._id).toBe("task-1");
  });

  test("topilmagan task → null (controller 404ga aylantiradi)", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(null));

    const result = await service.findOne("yoq", {
      _id: STRANGER_ID,
      role: { title: "oqituvchi", scopeLevel: "self" },
    });

    expect(result).toBeNull();
  });
});

describe("task.service.listResponses — IDOR himoyasi", () => {
  test("begona user → 403, TaskResponse.paginate umuman chaqirilmaydi", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(makeTask()));
    const paginateSpy = jest.spyOn(TaskResponse, "paginate");

    await expect(
      service.listResponses(
        "task-1",
        { _id: STRANGER_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
        {},
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(paginateSpy).not.toHaveBeenCalled();
  });

  test("assignee (ijrochi) → muvaffaqiyatli, paginate natijasi qaytadi", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(makeTask()));
    jest
      .spyOn(TaskResponse, "paginate")
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    const result = await service.listResponses(
      "task-1",
      { _id: ASSIGNEE_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
      {},
    );

    expect(result).toEqual({ docs: [], totalDocs: 0 });
  });

  test("creator (yaratuvchi) → muvaffaqiyatli", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(makeTask()));
    jest
      .spyOn(TaskResponse, "paginate")
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    const result = await service.listResponses(
      "task-1",
      { _id: CREATOR_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
      {},
    );

    expect(result).toEqual({ docs: [], totalDocs: 0 });
  });

  test("topilmagan task → 404", async () => {
    jest.spyOn(Task, "findById").mockReturnValue(chainQuery(null));

    await expect(
      service.listResponses(
        "yoq",
        { _id: STRANGER_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
        {},
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
