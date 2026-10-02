const WorkingScheduleModel = require("./workingSchedule.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");

const ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const COURSE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const STAT_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const lpKeys = () => [
  { key: " ", title: "Nazariy va amaliy ta'lim", week: 0, toObject() { return { ...this, toObject: undefined }; } },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi", week: 0, toObject() { return { ...this, toObject: undefined }; } },
  { key: "T", title: "Ta'til", week: 0, toObject() { return { ...this, toObject: undefined }; } },
  { key: " ", title: "JAMI", week: 0, toObject() { return { ...this, toObject: undefined }; } },
];

const courseStats = () => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 30 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy davlat attestatsiyasi", value: 2 },
  { key: "T", slug: "tatil_xaftalar_soni", title: "Ta'til xaftalar soni", value: 8 },
  { key: null, slug: "hammasi", title: "Hammasi", value: 40 },
];

const currentDoc = () => ({
  _id: ID,
  courses: [{ _id: { toString: () => COURSE_ID }, total: 40, statistics: courseStats() }],
  allValues: { total: 12, statistics: [{ key: null, slug: "hammasi", title: "Hammasi", value: 12 }] },
  learningProcessData: { keys: lpKeys() },
});

const keysWrite = (spy) =>
  spy.mock.calls.find((c) => c[1]?.$set?.["learningProcessData.keys"])?.[1].$set;

const callUpdate = async () => {
  jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
    select: jest.fn().mockResolvedValue({ status: "draft" }),
  });
  jest
    .spyOn(WorkingScheduleModel, "findOneAndUpdate")
    .mockResolvedValue({ _id: ID });
  const updateSpy = jest
    .spyOn(WorkingScheduleModel, "findByIdAndUpdate")
    .mockResolvedValue({ _id: ID });
  jest.spyOn(WorkingScheduleModel, "findById").mockResolvedValue(currentDoc());

  const res = createRes();
  await Controller.updateWorkingProcess(
    {
      params: { id: ID },
      body: { courseId: COURSE_ID, statistics: [{ _id: STAT_ID, value: 8 }] },
      scope: {},
      user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
    },
    res,
    jest.fn(),
  );
  return { res, updateSpy };
};

describe("updateWorkingProcess — Tarkibiy qismlar `key` bo'yicha yangilanadi", () => {
  afterEach(() => jest.restoreAllMocks());

  test("sarlavha mos kelmasa ham T va D yangilanadi (asosiy defekt)", async () => {
    const { res, updateSpy } = await callUpdate();
    expect(res.status).toHaveBeenCalledWith(200);

    const written = keysWrite(updateSpy)["learningProcessData.keys"];
    const week = (title) => written.find((k) => k.title === title).week;
    expect(week("Ta'til")).toBe(8);
    expect(week("Yakuniy Davlat attestatsiyasi")).toBe(2);
    expect(week("Nazariy va amaliy ta'lim")).toBe(30);
  });

  test("JAMI — KURS statistikasidagi 'hammasi' dan (eskirgan allValues'dan EMAS)", async () => {
    const { updateSpy } = await callUpdate();
    const written = keysWrite(updateSpy)["learningProcessData.keys"];
    expect(written.find((k) => k.title === "JAMI").week).toBe(40);
  });

  test("`allValues` kurs bilan sinxronlanadi (drift yo'q)", async () => {
    const { updateSpy } = await callUpdate();
    const $set = keysWrite(updateSpy);
    expect($set["allValues.total"]).toBe(40);
    expect($set["allValues.statistics"]).toEqual(
      courseStats().map((s) => ({ key: s.key, slug: s.slug, title: s.title, value: s.value })),
    );
  });
});
