const mockSave = jest.fn();
jest.mock("./attendance.model", () => {
  function Attendance(payload) {
    Object.assign(this, payload);
    // eslint-disable-next-line no-undef
    Attendance.__built.push(payload);
    this.save = (...a) => mockSave(...a);
  }
  Attendance.__built = [];
  Attendance.ATTENDANCE_STATUSES = ["present", "absent", "excused"];
  Attendance.CLIENT_ATTENDANCE_STATUSES = ["present", "absent"];
  Attendance.RESIDENCY_LESSON_TYPES = ["amaliy", "nazariy", "seminar"];
  Attendance.findOne = jest.fn();
  Attendance.find = jest.fn();
  Attendance.aggregate = jest.fn();
  return Attendance;
});
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: { expulsionWarning: () => "", expulsionOrder: () => "" },
}));
jest.mock("#system/notification/notificationDispatcher", () => ({ dispatch: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { createAttendanceSchema, updateAttendanceSchema } = require("./attendance.validation");
const Attendance = require("./attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Controller = require("./attendance.controller");

const OID = "6a97de5a52685c2068a0a543";
const OTHER = "6a5a0acbd34b3c21a575d59d";

const base = {
  resident: OID,
  date: "2026-09-02",
  status: "absent",
};

describe("validator — muallif maydonini mijoz YOZA OLMAYDI", () => {
  test("🔴 `teacher` yuborilsa JIMGINA tashlanadi (400 EMAS)", () => {
    const { error, value } = createAttendanceSchema.validate({ ...base, teacher: OTHER });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty("teacher");
  });

  test("🔴 `teacherName` ham tashlanadi", () => {
    const { error, value } = createAttendanceSchema.validate({
      ...base,
      teacherName: "Soxta Ism",
    });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty("teacherName");
  });

  test("TAHRIRLASH yo'li ham yopiq — mavjud yozuvning muallifi qayta yozilmaydi", () => {
    const { error, value } = updateAttendanceSchema.validate({
      status: "absent",
      teacher: OTHER,
      teacherName: "Soxta Ism",
    });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty("teacher");
    expect(value).not.toHaveProperty("teacherName");
  });

  test("qolgan maydonlar avvalgidek o'tadi", () => {
    const { error, value } = createAttendanceSchema.validate({
      ...base,
      hours: 2,
      excuseReason: "kasallik",
    });
    expect(error).toBeUndefined();
    expect(value.hours).toBe(2);
    expect(value.excuseReason).toBe("kasallik");
  });
});

describe("CREATE_FIELDS — allowlist", () => {
  test("🔴 `teacher`/`teacherName` allowlistda YO'Q", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "attendance.controller.js"),
      "utf8",
    );
    const block = src.slice(
      src.indexOf("const CREATE_FIELDS = ["),
      src.indexOf("function pick("),
    );
    expect(block).not.toMatch(/^\s*"teacher",\s*$/m);
    expect(block).not.toMatch(/^\s*"teacherName",\s*$/m);
  });

  test("muallif SERVERDA yoziladi", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "attendance.controller.js"),
      "utf8",
    );
    expect(src).toMatch(/payload\.teacher = req\.user\?\._id \?\? null;/);
  });

  test("`teacherName` snapshoti ATAYLAB yozilmaydi", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "attendance.controller.js"),
      "utf8",
    );
    expect(src).not.toMatch(/payload\.teacherName\s*=/);
  });
});

const res = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

const staffReq = (over = {}) => ({
  user: { _id: "staff-1", role: { title: "magistratura_bolim", scopeLevel: "global" } },
  body: { resident: OID, date: "2026-09-02", status: "absent", ...over },
});

describe("addAttendance — muallif SERVERDA yoziladi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Attendance.__built.length = 0;
    Attendance.findOne.mockResolvedValue(null);
    Attendance.find.mockResolvedValue([]);
    Resident.findById.mockResolvedValue({ _id: OID, group: null, user: null });
    Resident.findByIdAndUpdate.mockResolvedValue({});
    mockSave.mockResolvedValue({});
  });

  test("🔴 `absent` yozuvda `teacher` = so'rov egasi", async () => {
    await Controller.addAttendance(staffReq(), res(), jest.fn());

    expect(Attendance.__built).toHaveLength(1);
    expect(Attendance.__built[0].teacher).toBe("staff-1");
  });

  test("`excused` yozuvda ham yoziladi", async () => {
    await Controller.addAttendance(staffReq({ status: "excused" }), res(), jest.fn());
    expect(Attendance.__built[0].teacher).toBe("staff-1");
  });

  test("`present` + qo'lda tasdiq — muallif VA tasdiqlovchi ikkalasi ham", async () => {
    Resident.findById.mockResolvedValue({ _id: OID, program: "magistratura", group: null, user: null });
    await Controller.addAttendance(
      staffReq({ status: "present", manualVerified: true }),
      res(),
      jest.fn(),
    );
    const built = Attendance.__built[0];
    expect(built.teacher).toBe("staff-1");
    expect(built.manualVerifiedBy).toBe("staff-1");
  });

  test("🔴 mijoz yuborgan `teacher` E'TIBORGA OLINMAYDI", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "attendance.controller.js"),
      "utf8",
    );
    const assign = src.match(/payload\.teacher = [^;]+;/g) || [];
    expect(assign).toHaveLength(1);
    expect(assign[0]).not.toMatch(/req\.body/);
  });

  test("`teacherName` snapshoti yozilmaydi — nom jonli `populate` dan quriladi", async () => {
    await Controller.addAttendance(staffReq(), res(), jest.fn());
    expect(Attendance.__built[0].teacherName).toBeUndefined();
  });
});

describe("addAttendance — ordinaturada qo'lda «Keldi» yo'q (P7/D-PRE)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Attendance.__built.length = 0;
    Attendance.findOne.mockResolvedValue(null);
    Resident.findById.mockResolvedValue({ _id: OID, program: "ordinatura", group: null, user: null });
  });

  test("🔴 `present` + qo'lda tasdiq — 400 present_requires_sams, hech narsa qurilmaydi", async () => {
    const next = jest.fn();
    await Controller.addAttendance(staffReq({ status: "present", manualVerified: true }), res(), next);
    expect(next.mock.calls[0][0].meta).toEqual({ reason: "present_requires_sams" });
    expect(Attendance.__built).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });
});
