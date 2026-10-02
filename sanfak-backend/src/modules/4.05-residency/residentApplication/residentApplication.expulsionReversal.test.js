jest.mock("#modules/4.05-residency/attendance/attendance.model");
jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/residentApplication/residentApplication.model");
jest.mock("#modules/4.05-residency/_services/attendanceWarning", () => {
  const real = jest.requireActual(
    "#modules/4.05-residency/_services/attendanceWarning",
  );
  return { ...real, revokeWarningInBackground: jest.fn() };
});
jest.mock("#modules/4.05-residency/_services/expulsionOrderLifecycle", () => ({
  cancelDraftBelowThreshold: jest.fn().mockResolvedValue(undefined),
}));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  cancelDraftBelowThreshold,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  revokeWarningInBackground,
} = require("#modules/4.05-residency/_services/attendanceWarning");
const { _recountUnexcused } = require("./residentApplication.controller");

const armAbsences = (rows) => {
  Attendance.find = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue(rows),
  });
};

const armResident = (doc) => {
  Resident.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue(doc),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
});

describe("recountUnexcused — hisob oynasi joriy o'quv yili (P4)", () => {
  test("`Attendance.find` ga `date` sharti UZATILADI", async () => {
    armAbsences([]);
    armResident({ _id: "r1", user: "u1" });

    await _recountUnexcused("r1");

    const filter = Attendance.find.mock.calls[0][0];
    expect(filter).toMatchObject({
      resident: "r1",
      status: "absent",
      active: true,
    });
    expect(filter.date.$gte).toBeInstanceOf(Date);
    expect(filter.date.$lte).toBeInstanceOf(Date);
  });

  test("oyna `expulsionCheck` dagi bilan AYNAN bir xil", async () => {
    const {
      unexcusedDateFilter,
    } = require("#modules/4.05-residency/_services/unexcusedWindow");
    const kutilgan = unexcusedDateFilter();

    armAbsences([]);
    armResident({ _id: "r1", user: "u1" });
    await _recountUnexcused("r1");

    const { date } = Attendance.find.mock.calls[0][0];
    expect(date.$gte.toISOString()).toBe(kutilgan.$gte.toISOString());
    expect(date.$lte.toISOString()).toBe(kutilgan.$lte.toISOString());
  });

  test("`.select` FAQAT `hours` ni so'raydi — oyna so'rovda bo'lishi shart", async () => {
    const selectSpy = jest.fn().mockResolvedValue([]);
    Attendance.find = jest.fn().mockReturnValue({ select: selectSpy });
    armResident({ _id: "r1", user: "u1" });

    await _recountUnexcused("r1");

    expect(selectSpy).toHaveBeenCalledWith("hours");
  });
});

describe("recountUnexcused — chetlatish LOYIHASI bekor qilinadi (R2)", () => {
  test("soat 72 dan pastga tushdi — loyiha YOPILADI (P6a)", async () => {
    armAbsences([{ hours: 10 }, { hours: 10 }]);
    const doc = {
      _id: "r1",
      warningIssued: true,
      expulsionOrderCreated: true,
      user: "u1",
    };
    armResident(doc);

    const total = await _recountUnexcused("r1");

    expect(total).toBe(20);
    expect(cancelDraftBelowThreshold).toHaveBeenCalledWith(doc, {
      hours: 20,
      source: "application",
    });
  });

  test("bayroq `update` ga YOZILMAYDI — faqat hisob", async () => {
    armAbsences([{ hours: 10 }, { hours: 10 }]);
    armResident({ _id: "r1", warningIssued: true, expulsionOrderCreated: true, user: "u1" });

    await _recountUnexcused("r1");

    const update = Resident.findByIdAndUpdate.mock.calls[0][1];
    expect(update.totalUnexcusedHours).toBe(20);
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(update).not.toHaveProperty("expulsionOrderCreatedAt");
  });

});

describe("recountUnexcused — proyeksiya qulflari", () => {
  test("`select` `expulsionOrderCreated` ni SO'RAYDI", async () => {
    armAbsences([]);
    const selectSpy = jest.fn().mockResolvedValue({ user: "u1" });
    Resident.findById = jest.fn().mockReturnValue({ select: selectSpy });

    await _recountUnexcused("r1");

    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining("expulsionOrderCreated"),
    );
  });

  test.each(["status", "active", "expulsionOrderCreatedAt"])(
    "`select` `%s` ni SO'RAYDI",
    async (field) => {
      armAbsences([]);
      const selectSpy = jest.fn().mockResolvedValue({ user: "u1" });
      Resident.findById = jest.fn().mockReturnValue({ select: selectSpy });

      await _recountUnexcused("r1");

      expect(selectSpy.mock.calls[0][0].split(" ")).toContain(field);
    },
  );
});

describe("recountUnexcused — qachon yopilMAYDI", () => {

  test("soat HAMON 72 dan yuqori — loyiha bekor QILINMAYDI", async () => {
    armAbsences([{ hours: 80 }]);
    armResident({
      _id: "r1",
      warningIssued: true,
      expulsionOrderCreated: true,
      user: "u1",
    });

    await _recountUnexcused("r1");

    const update = Resident.findByIdAndUpdate.mock.calls[0][1];
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(cancelDraftBelowThreshold).not.toHaveBeenCalled();
  });

  test("loyiha bo'lmagan rezidentda yopish chaqirilmaydi", async () => {
    armAbsences([{ hours: 2 }]);
    armResident({ _id: "r1", warningIssued: false, user: "u1" });

    await _recountUnexcused("r1");

    expect(cancelDraftBelowThreshold).not.toHaveBeenCalled();
  });

  test("`chetlatilgan` — bayroq TEGILMAYDI, yopish chaqirilmaydi", async () => {
    armAbsences([{ hours: 2 }]);
    armResident({
      _id: "r1",
      status: "chetlatilgan",
      expulsionOrderCreated: true,
      user: "u1",
    });

    await _recountUnexcused("r1");

    const update = Resident.findByIdAndUpdate.mock.calls[0][1];
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(cancelDraftBelowThreshold).not.toHaveBeenCalled();
  });
});

describe("recountUnexcused — yozuv tartibi va chegaralar", () => {
  test("`user` yo'q — ogohlantirish bekor QILINMAYDI, loyiha esa QILINADI", async () => {
    armAbsences([]);
    armResident({
      _id: "r1",
      warningIssued: true,
      expulsionOrderCreated: true,
      user: null,
    });

    await _recountUnexcused("r1");

    expect(revokeWarningInBackground).not.toHaveBeenCalled();
    expect(cancelDraftBelowThreshold).toHaveBeenCalledTimes(1);
  });

});

describe("recountUnexcused — yozuv tartibi", () => {
  test("loyiha yopilishi rezident yozuvidan OLDIN kutiladi", async () => {
    let release;
    cancelDraftBelowThreshold.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    armAbsences([]);
    armResident({ _id: "r1", expulsionOrderCreated: true, user: "u1" });

    const run = _recountUnexcused("r1");
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(Resident.findByIdAndUpdate).not.toHaveBeenCalled();
    release();
    await run;
    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("bitta yozuvda ketadi — ikkinchi `findByIdAndUpdate` yo'q", async () => {
    armAbsences([]);
    armResident({
      _id: "r1",
      warningIssued: true,
      expulsionOrderCreated: true,
      user: "u1",
    });

    await _recountUnexcused("r1");

    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("`active` ga TEGILMAYDI", async () => {
    armAbsences([]);
    armResident({
      _id: "r1",
      warningIssued: true,
      expulsionOrderCreated: true,
      user: "u1",
    });

    await _recountUnexcused("r1");

    expect(Resident.findByIdAndUpdate.mock.calls[0][1]).not.toHaveProperty(
      "active",
    );
  });
});
