jest.mock("./teacherLeave.model");
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#modules/4.02-studyLoad/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getDepartmentHeadUserIds: jest.fn().mockResolvedValue([]),
}));
jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findById: jest.fn(() => ({
    select: () => ({ lean: async () => ({ department: null }) }),
  })),
}));

const TeacherLeave = require("./teacherLeave.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const Controller = require("./teacherLeave.controller");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DIST_ID_2 = "eeeeeeeeeeeeeeeeeeeeeeee";
const TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const ENTRY_ID = "cccccccccccccccccccccccc";
const OTHER_TEACHER_ID = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeLeave = (over = {}) => ({
  _id: "leave1",
  type: "resignation",
  status: "pending",
  distribution: DIST_ID,
  teacher: TEACHER_ID,
  teacherEntryId: undefined,
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

const makeDist = (over = {}) => ({
  _id: DIST_ID,
  residueHour: 0,
  teachers: [
    {
      _id: ENTRY_ID,
      teacher: TEACHER_ID,
      totalHour: 180,
      isVacant: false,
    },
  ],
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

const mockFindResult = (docs) => ({
  select: jest.fn().mockResolvedValue(docs),
});

describe("teacherLeave.controller — approve → vakant yozuvi arizaga bog'lanadi", () => {
  afterEach(() => jest.resetAllMocks());

  test("teacherEntryId YUBORILMAGAN — server o'zi aniqlab arizaga yozadi", async () => {
    const leave = makeLeave();
    const dist = makeDist();
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(dist.teachers[0].isVacant).toBe(true);
    expect(dist.residueHour).toBe(180);

    expect(String(leave.teacherEntryId)).toBe(ENTRY_ID);
    expect(leave.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("teacherEntryId ANIQ berilgan — o'sha yozuv ishlatiladi va saqlanadi", async () => {
    const leave = makeLeave({ teacherEntryId: ENTRY_ID });
    const dist = makeDist();
    dist.teachers.id = jest.fn().mockReturnValue(dist.teachers[0]);
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(dist.teachers[0].isVacant).toBe(true);
    expect(String(leave.teacherEntryId)).toBe(ENTRY_ID);
  });

  test("mos FAOL yozuv topilmasa (boshqa o'qituvchi) — endi JIM emas: 400 bilan bloklanadi, ariza pending qoladi", async () => {
    const leave = makeLeave({ teacher: OTHER_TEACHER_ID });
    const dist = makeDist();
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    const next = jest.fn();
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      next,
    );

    expect(dist.teachers[0].isVacant).toBe(false);
    expect(dist.save).not.toHaveBeenCalled();
    expect(leave.teacherEntryId).toBeUndefined();
    expect(leave.status).toBe("pending");
    expect(leave.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(res.status).not.toHaveBeenCalledWith(200);
  });

  test("distribution YO'Q + AYNAN 1 ta faol taqsimot — avto-topiladi, vakant hosil bo'ladi", async () => {
    const leave = makeLeave({ distribution: null });
    const dist = makeDist();
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.find = jest
      .fn()
      .mockReturnValue(mockFindResult([dist]));
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(WorkloadDistribution.find).toHaveBeenCalledWith(
      expect.objectContaining({ "teachers.teacher": TEACHER_ID, active: true }),
    );
    expect(dist.teachers[0].isVacant).toBe(true);
    expect(dist.residueHour).toBe(180);
    expect(String(leave.distribution)).toBe(DIST_ID);
    expect(String(leave.teacherEntryId)).toBe(ENTRY_ID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("distribution YO'Q + 0 ta faol taqsimot (resignation) — 400 bilan bloklanadi (jim emas)", async () => {
    const leave = makeLeave({ distribution: null, type: "resignation" });
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.find = jest
      .fn()
      .mockReturnValue(mockFindResult([]));
    const next = jest.fn();
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(leave.save).not.toHaveBeenCalled();
    expect(leave.status).toBe("pending");
    expect(res.status).not.toHaveBeenCalledWith(200);
  });

  test("distribution YO'Q + 0 ta faol taqsimot + type:'leave' — bloklanmaydi, lekin vacancyCreated:false ANIQ ko'rsatiladi", async () => {
    const leave = makeLeave({ distribution: null, type: "leave" });
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.find = jest
      .fn()
      .mockReturnValue(mockFindResult([]));
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(leave.save).toHaveBeenCalled();
    expect(leave.status).toBe("approved");
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.vacancyCreated).toBe(false);
    expect(typeof body.vacancyNote).toBe("string");
    expect(body.vacancyNote.length).toBeGreaterThan(0);
  });

  test("distribution YO'Q + 2 ta faol taqsimot — tizim TANLAMAYDI: 409 + nomzodlar ro'yxati, hech qanday save yo'q", async () => {
    const leave = makeLeave({ distribution: null });
    const distA = makeDist();
    const distB = makeDist({ _id: DIST_ID_2 });
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.find = jest
      .fn()
      .mockReturnValue(mockFindResult([distA, distB]));
    const next = jest.fn();
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        detail: expect.arrayContaining([
          expect.objectContaining({ _id: DIST_ID }),
          expect.objectContaining({ _id: DIST_ID_2 }),
        ]),
      }),
    );
    expect(distA.save).not.toHaveBeenCalled();
    expect(distB.save).not.toHaveBeenCalled();
    expect(leave.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(200);
  });

  test("body.distribution berilgan (leave.distribution yo'q) — avto-qidiruv UMUMAN chaqirilmaydi, o'sha taqsimot ishlatiladi", async () => {
    const leave = makeLeave({ distribution: null });
    const dist = makeDist();
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    WorkloadDistribution.find = jest.fn();
    const res = createRes();

    await Controller.approveTeacherLeave(
      {
        params: { id: "leave1" },
        body: { distribution: DIST_ID },
        user: { _id: "u1" },
        scope: {},
      },
      res,
      jest.fn(),
    );

    expect(WorkloadDistribution.findById).toHaveBeenCalledWith(DIST_ID);
    expect(WorkloadDistribution.find).not.toHaveBeenCalled();
    expect(dist.teachers[0].isVacant).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("bonus: body.distribution berilgan, lekin taqsimot bazada topilmadi — 400 (silent-branch bu yerda ham yopilgan)", async () => {
    const leave = makeLeave({ distribution: null });
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(null);
    const next = jest.fn();
    const res = createRes();

    await Controller.approveTeacherLeave(
      {
        params: { id: "leave1" },
        body: { distribution: DIST_ID },
        user: { _id: "u1" },
        scope: {},
      },
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(leave.save).not.toHaveBeenCalled();
  });

  test("idempotentlik: topilgan yozuv ALLAQACHON vakant — 400, residueHour IKKI MARTA OSHMAYDI", async () => {
    const leave = makeLeave({ teacherEntryId: ENTRY_ID });
    const dist = makeDist();
    dist.teachers[0].isVacant = true;
    dist.residueHour = 180;
    dist.teachers.id = jest.fn().mockReturnValue(dist.teachers[0]);
    TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    const next = jest.fn();
    const res = createRes();

    await Controller.approveTeacherLeave(
      { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(dist.residueHour).toBe(180);
    expect(dist.save).not.toHaveBeenCalled();
    expect(leave.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(200);
  });
});

const leaveVacatedDist = () => {
  const dist = makeDist({ residueHour: 180 });
  Object.assign(dist.teachers[0], { isVacant: true, vacancyReason: "leave" });
  return dist;
};
const approveLeave = async (leave) => {
  TeacherLeave.findOne = jest.fn().mockResolvedValue(leave);
  const res = createRes();
  const next = jest.fn();
  await Controller.approveTeacherLeave(
    { params: { id: "leave1" }, body: {}, user: { _id: "u1" }, scope: {} },
    res,
    next,
  );
  return { res, next };
};

describe("D-6 — ta'til vakantini doimiy ariza meros oladi", () => {
  afterEach(() => jest.resetAllMocks());

  test("taqsimot ko'rsatilgan: ishdan ketish tasdiqlanadi, sabab doimiy, qoldiq o'zgarmaydi", async () => {
    const dist = leaveVacatedDist();
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    const leave = makeLeave({ type: "resignation" });

    const { res, next } = await approveLeave(leave);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.teachers[0].vacancyReason).toBe("resignation");
    expect(dist.residueHour).toBe(180);
    expect(String(leave.teacherEntryId)).toBe(ENTRY_ID);
    expect(leave.status).toBe("approved");
    const body = res.json.mock.calls[0][0];
    expect(body.vacancyCreated).toBe(false);
    expect(body.vacancyNote).toContain("ta'til");
  });

  test("teacherEntryId bilan ham xuddi shunday (ko'chirish)", async () => {
    const dist = leaveVacatedDist();
    dist.teachers.id = jest.fn().mockReturnValue(dist.teachers[0]);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);

    const { res } = await approveLeave(makeLeave({ type: "transfer", teacherEntryId: ENTRY_ID }));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.teachers[0].vacancyReason).toBe("transfer");
    expect(dist.residueHour).toBe(180);
  });
});

describe("D-6 — meros olinmaydigan holatlar va avto-qidiruv", () => {
  afterEach(() => jest.resetAllMocks());

  test("ikkinchi TA'TIL arizasi ta'til vakantiga — 400, hech narsa yozilmaydi", async () => {
    const dist = leaveVacatedDist();
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);
    const leave = makeLeave({ type: "leave" });

    const { next } = await approveLeave(leave);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(dist.save).not.toHaveBeenCalled();
    expect(leave.save).not.toHaveBeenCalled();
  });

  test("ishdan ketish bilan vakant yozuv (ta'til emas) — meros olinmaydi, 400", async () => {
    const dist = makeDist({ residueHour: 180 });
    Object.assign(dist.teachers[0], { isVacant: true, vacancyReason: "resignation" });
    dist.teachers.id = jest.fn().mockReturnValue(dist.teachers[0]);
    WorkloadDistribution.findById = jest.fn().mockResolvedValue(dist);

    const { next } = await approveLeave(makeLeave({ type: "resignation", teacherEntryId: ENTRY_ID }));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(dist.save).not.toHaveBeenCalled();
  });

  test("avto-qidiruv: faol yozuv yo'q, yagona ta'til vakanti — meros olinadi", async () => {
    const dist = leaveVacatedDist();
    WorkloadDistribution.find = jest.fn().mockReturnValue(mockFindResult([dist]));
    const leave = makeLeave({ distribution: null, type: "resignation" });

    const { res } = await approveLeave(leave);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dist.teachers[0].vacancyReason).toBe("resignation");
    expect(dist.residueHour).toBe(180);
    expect(String(leave.teacherEntryId)).toBe(ENTRY_ID);
  });
});
