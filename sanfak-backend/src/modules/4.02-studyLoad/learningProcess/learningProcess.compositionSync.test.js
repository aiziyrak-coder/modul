const LearningProcess = require("./learningProcess.model");
const Controller = require("./learningProcess.controller");

const ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const COURSE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const STAT_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const planKeys = () => [
  { key: " ", title: "Nazariy va amaliy ta'lim", week: 0 },
  { key: "T", title: "Ta'til", week: 0 },
  { key: " ", title: "JAMI", week: 0 },
];

const statsFor = (n, t, all) => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: n },
  { key: "T", slug: "tatil_xaftalar_soni", title: "Ta'til xaftalar soni", value: t },
  { key: null, slug: "hammasi", title: "Hammasi", value: all },
];

const freshDoc = () => ({
  _id: ID,
  courses: [
    { _id: COURSE_ID, total: 40, statistics: statsFor(30, 6, 40) },
    { _id: "dddddddddddddddddddddddd", total: 42, statistics: statsFor(32, 7, 42) },
  ],
  allValues: {
    total: 0,
    statistics: [{ key: null, slug: "hammasi", title: "Hammasi", value: 0 }],
  },
  learningProcess: { keys: planKeys() },
});

const keysWrite = (spy) =>
  spy.mock.calls.find((c) => c[1]?.$set?.["learningProcess.keys"])?.[1].$set;

const callUpdate = async () => {
  jest.spyOn(LearningProcess, "exists").mockResolvedValue({ _id: ID });
  const updateSpy = jest
    .spyOn(LearningProcess, "findByIdAndUpdate")
    .mockResolvedValue({ _id: ID });
  jest.spyOn(LearningProcess, "findById").mockResolvedValue(freshDoc());

  const res = createRes();
  await Controller.update(
    {
      params: { id: ID },
      body: { courseId: COURSE_ID, statistics: [{ _id: STAT_ID, value: 6 }] },
      scope: {},
    },
    res,
    jest.fn(),
  );
  return { res, updateSpy };
};

describe("learningProcess.update (courseId) — Tarkibiy qismlar qayta hisoblanadi", () => {
  afterEach(() => jest.restoreAllMocks());

  test("keys[].week = Σ kurslar (sarlavha mos kelmasa ham `key` bo'yicha)", async () => {
    const { res, updateSpy } = await callUpdate();
    expect(res.status).toHaveBeenCalledWith(200);

    const written = keysWrite(updateSpy)["learningProcess.keys"];
    const week = (title) => written.find((k) => k.title === title).week;
    expect(week("Nazariy va amaliy ta'lim")).toBe(62);
    expect(week("Ta'til")).toBe(13);
  });

  test("JAMI = Σ 'hammasi' (40+42=82)", async () => {
    const { updateSpy } = await callUpdate();
    const written = keysWrite(updateSpy)["learningProcess.keys"];
    expect(written.find((k) => k.title === "JAMI").week).toBe(82);
  });

  test("allValues — total va statistics ham yig'indiga tenglashadi", async () => {
    const { updateSpy } = await callUpdate();
    const $set = keysWrite(updateSpy);
    expect($set["allValues.total"]).toBe(82);
    expect($set["allValues.statistics"][0].value).toBe(82);
  });

  test("statistics bo'lmasa — qayta hisoblash CHAQIRILMAYDI (xulq o'zgarmadi)", async () => {
    jest.spyOn(LearningProcess, "exists").mockResolvedValue({ _id: ID });
    const updateSpy = jest
      .spyOn(LearningProcess, "findByIdAndUpdate")
      .mockResolvedValue({ _id: ID });
    jest.spyOn(LearningProcess, "findById").mockResolvedValue(freshDoc());

    await Controller.update(
      {
        params: { id: ID },
        body: { courseId: COURSE_ID, total: 40 },
        scope: {},
      },
      createRes(),
      jest.fn(),
    );

    expect(keysWrite(updateSpy)).toBeUndefined();
  });
});
