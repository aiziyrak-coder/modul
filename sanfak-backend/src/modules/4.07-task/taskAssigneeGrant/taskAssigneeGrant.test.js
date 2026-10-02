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

const mongoose = require("mongoose");
const grants = require("./taskAssigneeGrant.service");
const Task = require("#modules/4.07-task/task/task.model");
const service = require("#modules/4.07-task/task/task.service");

const RAHBAR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const GRANTED_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const OUTSIDER_ID = "cccccccccccccccccccccccc";

const rahbar = (scopeLevel = "global") => ({
  _id: RAHBAR_ID,
  role: { title: "tm_rahbar", scopeLevel },
});

const mockGrants = (ids) =>
  jest.spyOn(grants, "grantedAssigneeIds").mockResolvedValue(new Set(ids));

const originalStrict = process.env.TASK_ASSIGNEE_GRANT_STRICT;

afterEach(() => {
  jest.restoreAllMocks();
  if (originalStrict === undefined) delete process.env.TASK_ASSIGNEE_GRANT_STRICT;
  else process.env.TASK_ASSIGNEE_GRANT_STRICT = originalStrict;
});

describe("isPlatformAdmin — cheklovdan ozod rollar", () => {
  test("super_admin va admin → true", () => {
    expect(grants.isPlatformAdmin({ role: { title: "super_admin" } })).toBe(true);
    expect(grants.isPlatformAdmin({ role: { title: "admin" } })).toBe(true);
  });

  test("scopeLevel: global rahbar → false (cheklanishi mumkin)", () => {
    expect(grants.isPlatformAdmin({ role: { title: "tm_rahbar", scopeLevel: "global" } })).toBe(false);
  });

  test("rol yo'q → false", () => {
    expect(grants.isPlatformAdmin({})).toBe(false);
    expect(grants.isPlatformAdmin(null)).toBe(false);
  });
});

describe("isStrictMode", () => {
  test("env yo'q yoki 'false' → fallback yoqiq", () => {
    delete process.env.TASK_ASSIGNEE_GRANT_STRICT;
    expect(grants.isStrictMode()).toBe(false);
    process.env.TASK_ASSIGNEE_GRANT_STRICT = "false";
    expect(grants.isStrictMode()).toBe(false);
  });

  test("'true' (registrga bog'liq emas) → strict", () => {
    process.env.TASK_ASSIGNEE_GRANT_STRICT = "TRUE";
    expect(grants.isStrictMode()).toBe(true);
  });
});

describe("task.create — biriktirish tekshiruvi", () => {
  const baseBody = { title: "Test", deadline: new Date(), assignees: [] };

  const mockUserLookup = (users) => {
    const docs = users.map((u) => (typeof u === "string" ? { _id: u } : u));
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(docs),
      }),
    });
    jest.spyOn(mongoose, "model").mockImplementation((name) => {
      if (name === "user") return { find };
      throw new Error(`kutilmagan model: ${name}`);
    });
  };

  test("grant BOR + biriktirilmagan ijrochi → 403", async () => {
    mockUserLookup([OUTSIDER_ID]);
    mockGrants([GRANTED_ID]);

    await expect(
      service.create({ ...baseBody, assignees: [OUTSIDER_ID] }, rahbar()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("grant BOR + aralash ro'yxat (bittasi ruxsatsiz) → 403 (hammasi rad etiladi)", async () => {
    mockUserLookup([GRANTED_ID, OUTSIDER_ID]);
    mockGrants([GRANTED_ID]);

    await expect(
      service.create({ ...baseBody, assignees: [GRANTED_ID, OUTSIDER_ID] }, rahbar()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("grant BOR + biriktirilgan ijrochi → topshiriq yaratiladi", async () => {
    mockUserLookup([GRANTED_ID]);
    mockGrants([GRANTED_ID]);
    jest.spyOn(Task, "bulkWrite").mockResolvedValue({ insertedCount: 1 });

    const items = await service.create({ ...baseBody, assignees: [GRANTED_ID] }, rahbar());

    expect(items).toHaveLength(1);
    expect(String(items[0].assignee)).toBe(GRANTED_ID);
  });

  test("grant YO'Q + global rahbar → eski xulq (ruxsat)", async () => {
    mockUserLookup([OUTSIDER_ID]);
    mockGrants([]);
    jest.spyOn(Task, "bulkWrite").mockResolvedValue({ insertedCount: 1 });

    const items = await service.create({ ...baseBody, assignees: [OUTSIDER_ID] }, rahbar());

    expect(items).toHaveLength(1);
  });

  test("grant YO'Q + self-scope + boshqa odam → eski xulq (403)", async () => {
    mockUserLookup([OUTSIDER_ID]);
    mockGrants([]);

    await expect(
      service.create({ ...baseBody, assignees: [OUTSIDER_ID] }, rahbar("self")),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("grant YO'Q + STRICT rejim → 403 (fallback o'chgan)", async () => {
    process.env.TASK_ASSIGNEE_GRANT_STRICT = "true";
    mockUserLookup([OUTSIDER_ID]);
    mockGrants([]);

    await expect(
      service.create({ ...baseBody, assignees: [OUTSIDER_ID] }, rahbar()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("super_admin → grant yo'q bo'lsa ham cheklovsiz (STRICT'da ham)", async () => {
    process.env.TASK_ASSIGNEE_GRANT_STRICT = "true";
    mockUserLookup([OUTSIDER_ID]);
    const grantSpy = mockGrants([]);
    jest.spyOn(Task, "bulkWrite").mockResolvedValue({ insertedCount: 1 });

    const items = await service.create(
      { ...baseBody, assignees: [OUTSIDER_ID] },
      { _id: RAHBAR_ID, role: { title: "super_admin" } },
    );

    expect(items).toHaveLength(1);
    expect(grantSpy).not.toHaveBeenCalled();
  });

  test("bo'sh ijrochi ro'yxati → 400 (grant tekshiruvidan oldin)", async () => {
    await expect(service.create({ ...baseBody, assignees: [] }, rahbar())).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("task.create — bloklangan (active:false) ijrochi", () => {
  const baseBody = { title: "Test", deadline: new Date(), assignees: [] };

  const mockUserLookup = (docs) => {
    const find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) }),
    });
    jest.spyOn(mongoose, "model").mockImplementation((name) => {
      if (name === "user") return { find };
      throw new Error(`kutilmagan model: ${name}`);
    });
  };

  test("bloklangan ijrochi → 400, ismi xabarda ko'rinadi", async () => {
    mockUserLookup([
      { _id: OUTSIDER_ID, firstName: "Aziz", lastName: "Aziziy", active: false },
    ]);
    const grantSpy = mockGrants([OUTSIDER_ID]);

    await expect(
      service.create({ ...baseBody, assignees: [OUTSIDER_ID] }, rahbar()),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("Aziziy Aziz") });

    expect(grantSpy).not.toHaveBeenCalled();
  });

  test("super_admin ham bloklangan xodimga biriktira olmaydi", async () => {
    mockUserLookup([{ _id: OUTSIDER_ID, firstName: "A", lastName: "B", active: false }]);

    await expect(
      service.create(
        { ...baseBody, assignees: [OUTSIDER_ID] },
        { _id: RAHBAR_ID, role: { title: "super_admin" } },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("aralash ro'yxatda bitta bloklangan bo'lsa ham → 400", async () => {
    mockUserLookup([
      { _id: GRANTED_ID, firstName: "Faol", lastName: "Xodim", active: true },
      { _id: OUTSIDER_ID, firstName: "Blok", lastName: "Xodim", active: false },
    ]);
    mockGrants([GRANTED_ID, OUTSIDER_ID]);

    await expect(
      service.create({ ...baseBody, assignees: [GRANTED_ID, OUTSIDER_ID] }, rahbar()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("`active` maydonsiz (eski) hujjat → bloklanmagan deb qaraladi", async () => {
    mockUserLookup([{ _id: GRANTED_ID, firstName: "Eski", lastName: "Yozuv" }]);
    mockGrants([GRANTED_ID]);
    jest.spyOn(Task, "bulkWrite").mockResolvedValue({ insertedCount: 1 });

    const items = await service.create({ ...baseBody, assignees: [GRANTED_ID] }, rahbar());
    expect(items).toHaveLength(1);
  });
});
