jest.mock("#system/_shared/socketHandler", () => ({
  emitToUser: jest.fn().mockResolvedValue(true),
}));
jest.mock("#modules/4.07-task/_services/taskSequence", () => ({
  reserveTaskCodes: jest.fn().mockResolvedValue({ start: 1 }),
  formatTaskCode: (n) => `T-${n}`,
}));
jest.mock("#modules/4.07-task/_services/taskBot", () => ({
  sendTaskAssigned: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const Task = require("./task.model");
const TaskResponse = require("#modules/4.07-task/taskResponse/taskResponse.model");
const { emitToUser } = require("#system/_shared/socketHandler");
const service = require("./task.service");

const CREATOR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ASSIGNEE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const STRANGER_ID = "cccccccccccccccccccccccc";

const makeTask = (overrides = {}) => ({
  _id: "task-1",
  code: "T-1",
  title: "Sinov topshirig'i",
  createdBy: CREATOR_ID,
  assignee: ASSIGNEE_ID,
  status: "new",
  deadline: null,
  readAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
  toObject() {
    return { ...this };
  },
  ...overrides,
});

const makeCreatedResponse = (populated = { _id: "resp-1", author: { firstName: "Ali" } }) => ({
  populate: jest.fn().mockResolvedValue(populated),
});

afterEach(() => jest.clearAllMocks());

describe("task.service.addResponse — taskResponse:new socket push", () => {
  test("ijrochi javob yozganda — creator VA assignee ikkalasiga yuboriladi", async () => {
    jest.spyOn(Task, "findById").mockResolvedValue(makeTask());
    jest.spyOn(TaskResponse, "create").mockResolvedValue(makeCreatedResponse());

    await service.addResponse(
      "task-1",
      { _id: ASSIGNEE_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
      { text: "Bajarildi" },
    );

    expect(emitToUser).toHaveBeenCalledTimes(2);
    const recipients = emitToUser.mock.calls.map((c) => c[0]).sort();
    expect(recipients).toEqual([CREATOR_ID, ASSIGNEE_ID].sort());
    emitToUser.mock.calls.forEach(([, event, payload]) => {
      expect(event).toBe("taskResponse:new");
      expect(payload.taskId).toBe("task-1");
    });
  });

  test("yaratuvchi izoh yozganda ham ikkalasiga yuboriladi", async () => {
    jest.spyOn(Task, "findById").mockResolvedValue(makeTask());
    jest.spyOn(TaskResponse, "create").mockResolvedValue(makeCreatedResponse());

    await service.addResponse(
      "task-1",
      { _id: CREATOR_ID, role: { title: "rektor", scopeLevel: "global" } },
      { text: "Izoh" },
    );

    expect(emitToUser).toHaveBeenCalledTimes(2);
  });

  test("begona user (403) — TaskResponse.create va emitToUser umuman chaqirilmaydi", async () => {
    jest.spyOn(Task, "findById").mockResolvedValue(makeTask());
    const createSpy = jest.spyOn(TaskResponse, "create");

    await expect(
      service.addResponse(
        "task-1",
        { _id: STRANGER_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
        { text: "..." },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(createSpy).not.toHaveBeenCalled();
    expect(emitToUser).not.toHaveBeenCalled();
  });

  test("javob real-time yuborilganda muallif to'g'ri select bilan populate qilinadi", async () => {
    jest.spyOn(Task, "findById").mockResolvedValue(makeTask());
    const created = makeCreatedResponse();
    jest.spyOn(TaskResponse, "create").mockResolvedValue(created);

    await service.addResponse(
      "task-1",
      { _id: ASSIGNEE_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
      { text: "Bajarildi" },
    );

    expect(created.populate).toHaveBeenCalledWith({
      path: "author",
      select: "firstName lastName middleName",
    });
    const [, , payload] = emitToUser.mock.calls[0];
    expect(payload.response).toEqual({ _id: "resp-1", author: { firstName: "Ali" } });
  });

  test("socket xatosi javobni bloklamaydi (best-effort)", async () => {
    jest.spyOn(Task, "findById").mockResolvedValue(makeTask());
    jest.spyOn(TaskResponse, "create").mockResolvedValue(makeCreatedResponse());
    emitToUser.mockImplementation(() => {
      throw new Error("socket portlab ketdi");
    });

    const result = await service.addResponse(
      "task-1",
      { _id: ASSIGNEE_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
      { text: "Bajarildi" },
    );

    expect(result.response).toBeDefined();
    expect(result.task).toBeDefined();
  });

  test("async socket reject ham javobni bloklamaydi (audit F-01 regressiyasi)", async () => {
    jest.spyOn(Task, "findById").mockResolvedValue(makeTask());
    jest.spyOn(TaskResponse, "create").mockResolvedValue(makeCreatedResponse());
    emitToUser.mockRejectedValue(new Error("redis down"));

    const result = await service.addResponse(
      "task-1",
      { _id: ASSIGNEE_ID, role: { title: "oqituvchi", scopeLevel: "self" } },
      { text: "Bajarildi" },
    );

    expect(result.response).toBeDefined();
    expect(result.task).toBeDefined();
    expect(emitToUser).toHaveBeenCalledTimes(2);
  });
});
