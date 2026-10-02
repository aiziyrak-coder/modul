const Task = require("./task.model");
const TaskResponse = require("#modules/4.07-task/taskResponse/taskResponse.model");
const service = require("./task.service");

const ADMIN = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  role: { title: "admin", scopeLevel: "global" },
};

const populateOf = (spy) => spy.mock.calls[0][1].populate;
const pathOf = (populate, path) => populate.find((p) => p.path === path);

afterEach(() => jest.restoreAllMocks());

describe("POPULATE — ro'yxat/detal uchun ism + lavozim", () => {
  const spyPaginate = () => {
    jest.spyOn(TaskResponse, "aggregate").mockResolvedValue([]);
    return jest
      .spyOn(Task, "paginate")
      .mockResolvedValue({ docs: [], totalDocs: 0, page: 1, limit: 10 });
  };

  test("`createdBy` va `assignee` sharifni ham so'raydi", async () => {
    const spy = spyPaginate();
    await service.paginate(ADMIN, { page: 1, limit: 10 });

    const pop = populateOf(spy);
    expect(pathOf(pop, "createdBy").select).toContain("middleName");
    expect(pathOf(pop, "assignee").select).toContain("middleName");
  });

  test("lavozim ichma-ich populate qilinadi", async () => {
    const spy = spyPaginate();
    await service.paginate(ADMIN, { page: 1, limit: 10 });

    const assignee = pathOf(populateOf(spy), "assignee");
    expect(assignee.select).toContain("position");
    expect(assignee.populate).toMatchObject({ path: "position" });
  });

  test("`position` topshiriq DARAJASIDA populate QILINMAYDI (StrictPopulateError)", async () => {
    const spy = spyPaginate();
    await service.paginate(ADMIN, { page: 1, limit: 10 });

    expect(pathOf(populateOf(spy), "position")).toBeUndefined();
  });

  test("`paginateMine` (Kiruvchi topshiriqlar) ham AYNI shaklni oladi", async () => {
    const spy = spyPaginate();
    await service.paginateMine(ADMIN, { page: 1, limit: 10 });

    expect(pathOf(populateOf(spy), "assignee").select).toContain("middleName");
  });
});

describe("monitoring pipeline — F.I.Sh to'liq", () => {
  const pipelineOf = () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);
    service.monitoringRows(ADMIN, {});
    return spy.mock.calls[0][0];
  };
  const addFieldsWithName = (pipeline) =>
    pipeline.find((s) => s.$addFields && s.$addFields.fullName).$addFields;
  const projectOf = (pipeline) => pipeline.find((s) => s.$project).$project;

  test("`fullName` uchala qismdan quriladi (qidiruv shu maydon ustidan ishlaydi)", () => {
    const parts = addFieldsWithName(pipelineOf()).fullName.$trim.input.$concat;
    expect(parts).toContainEqual({ $ifNull: ["$user.middleName", ""] });
  });

  test("sharif OXIRIDA — satr o'rtasida qo'sh bo'shliq hosil bo'lmaydi", () => {
    const parts = addFieldsWithName(pipelineOf()).fullName.$trim.input.$concat;
    expect(parts[parts.length - 1]).toEqual({ $ifNull: ["$user.middleName", ""] });
  });

  test("`middleName` pipeline'dan CHIQADI ham (`$project` uni tashlamaydi)", () => {
    expect(pipelineOf().find((s) => s.$addFields && s.$addFields.middleName)).toBeDefined();
    expect(projectOf(pipelineOf()).middleName).toBe(1);
  });

  test("`?search` `$match`i `$project`dan OLDIN turadi", () => {
    const spy = jest.spyOn(Task, "aggregate").mockResolvedValue([]);
    service.monitoringRows(ADMIN, { search: "Akmalovich" });
    const pipeline = spy.mock.calls[0][0];

    const searchIdx = pipeline.findIndex((s) => s.$match && s.$match.fullName);
    const projectIdx = pipeline.findIndex((s) => s.$project);
    expect(searchIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeLessThan(projectIdx);
  });
});

describe("yozishmalar — REST va socket AYNI select bilan", () => {
  test("`listResponses` muallif sharifini ham so'raydi", async () => {
    jest.spyOn(Task, "findById").mockResolvedValue({
      _id: "t1",
      createdBy: ADMIN._id,
      assignee: "bbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const spy = jest
      .spyOn(TaskResponse, "paginate")
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await service.listResponses("t1", ADMIN, { page: 1, limit: 20 });

    expect(spy.mock.calls[0][1].populate).toEqual({
      path: "author",
      select: "firstName lastName middleName",
    });
  });
});

describe("ijrochi pikeri — jadval bilan bir xil ism", () => {
  test("`select` sharifni oladi, qidiruv ham uni qamraydi", async () => {
    const paginate = jest.fn().mockResolvedValue({ docs: [], totalDocs: 0 });
    jest.spyOn(require("mongoose"), "model").mockReturnValue({ paginate });

    await service.assignableUsers(
      { _id: ADMIN._id, role: { title: "super_admin" } },
      { search: "Akmalovich" },
    );

    const [filter, options] = paginate.mock.calls[0];
    expect(options.select).toContain("middleName");
    expect(filter.$or).toContainEqual({
      middleName: { $regex: "Akmalovich", $options: "i" },
    });
  });
});
