const { attendanceDate, planDueDate, MIN_DATE } = require("./dateBounds");
const { createSchema: activityCreate } = require("../activityPlan/activityPlan.validation");
const { createAttendanceSchema } = require("../attendance/attendance.validation");

const iso = (offsetDays) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();

describe("dateBounds — davomat sanasi (D-11)", () => {
  test("bugungi sana QABUL qilinadi", () => {
    const { error } = attendanceDate().validate(new Date());
    expect(error).toBeUndefined();
  });

  test("o'tgan sana QABUL qilinadi", () => {
    const { error } = attendanceDate().validate(iso(-30));
    expect(error).toBeUndefined();
  });

  test("ERTANGI sana RAD ETILADI — kelajakdagi darsga davomat yo'q", () => {
    const { error } = attendanceDate().validate(iso(2));
    expect(error).toBeDefined();
    expect(error.message).toMatch(/kelajakdagi sanaga/i);
  });

  test("2000-yildan oldingi sana RAD ETILADI", () => {
    const { error } = attendanceDate().validate("1899-05-05");
    expect(error).toBeDefined();
  });

  test("createAttendanceSchema kelajak sanani RAD ETADI (zanjir ulangan)", () => {
    const { error } = createAttendanceSchema.validate({
      resident: "64b2f0c2a1b2c3d4e5f60718",
      date: iso(5),
      status: "present",
      manualVerified: true,
    });
    expect(error).toBeDefined();
  });

  test("createAttendanceSchema bugungi sanani QABUL qiladi", () => {
    const { error } = createAttendanceSchema.validate({
      resident: "64b2f0c2a1b2c3d4e5f60718",
      date: new Date().toISOString(),
      status: "present",
      manualVerified: true,
    });
    expect(error).toBeUndefined();
  });
});

describe("dateBounds — chegara boot kuniga MUZLAMAYDI (D-24)", () => {
  const frozenAtBoot = attendanceDate();

  afterEach(() => {
    jest.useRealTimers();
  });

  const travelDays = (n) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.now() + n * 24 * 60 * 60 * 1000));
  };

  test("3 kun o'tgach ham 'bugun' QABUL qilinadi (bug: 400 berardi)", () => {
    travelDays(3);
    const { error } = frozenAtBoot.validate(new Date());
    expect(error).toBeUndefined();
  });

  test("3 kun o'tgach kelajak HAMON yopiq — chegara surilgan, o'chirilmagan", () => {
    travelDays(3);
    const { error } = frozenAtBoot.validate(
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    );
    expect(error).toBeDefined();
    expect(error.message).toMatch(/kelajakdagi sanaga/i);
  });

  test("createAttendanceSchema (haqiqiy zanjir) 3 kun o'tgach 'bugun'ni QABUL qiladi", () => {
    travelDays(3);
    const { error } = createAttendanceSchema.validate({
      resident: "64b2f0c2a1b2c3d4e5f60718",
      date: new Date().toISOString(),
      status: "present",
      manualVerified: true,
    });
    expect(error).toBeUndefined();
  });

  test("chegara sxemada STATIK Date sifatida saqlanmaydi", () => {
    const rules = attendanceDate().describe().rules ?? [];
    const max = rules.find((r) => r.name === "max");
    expect(max).toBeUndefined();
  });
});

describe("dateBounds — reja muddati (D-4)", () => {
  test("kelasi yildagi muddat QABUL qilinadi", () => {
    const { error } = planDueDate().validate(iso(400));
    expect(error).toBeUndefined();
  });

  test("o'tgan sanadagi muddat QABUL qilinadi (kechikkan band)", () => {
    const { error } = planDueDate().validate(iso(-10));
    expect(error).toBeUndefined();
  });

  test("YIL 202610 RAD ETILADI — aynan D-4 dagi buzuq qiymat", () => {
    const { error } = planDueDate().validate("+202610-02-28T19:00:00.000Z");
    expect(error).toBeDefined();
    expect(error.message).toMatch(/uzoq kelajakda/i);
  });

  test("activityPlan createSchema buzuq yilni RAD ETADI (zanjir ulangan)", () => {
    const { error } = activityCreate.validate({
      title: "Reja",
      tasks: [
        {
          category: "oquv_metodik",
          title: "Seminar tayyorlash",
          targetCount: 1,
          dueDate: "+202610-02-28T19:00:00.000Z",
        },
      ],
    });
    expect(error).toBeDefined();
  });

  test("activityPlan createSchema haqiqiy muddatni QABUL qiladi", () => {
    const { error } = activityCreate.validate({
      title: "Reja",
      tasks: [
        {
          category: "oquv_metodik",
          title: "Seminar tayyorlash",
          targetCount: 1,
          dueDate: "2026-12-31",
        },
      ],
    });
    expect(error).toBeUndefined();
  });

  test("MIN_DATE 2000-yil — akademik sana undan oldin bo'lmaydi", () => {
    expect(MIN_DATE.getUTCFullYear()).toBe(2000);
  });
});
