jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message) { super(message); this.status = status; }
  },
}));
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: { expulsionWarning: () => "", expulsionOrder: () => "" },
}));
jest.mock("#system/notification/notificationDispatcher", () => ({ dispatch: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/attendanceWarning", () => ({
  WARNING_HOURS: 6,
  EXPULSION_HOURS: 72,
  clearWarningIfBelowThreshold: jest.fn(() => false),
  revokeWarningInBackground: jest.fn(),
}));
jest.mock("#modules/4.05-residency/_services/residentNotify", () => ({
  notifyUser: jest.fn(() => Promise.resolve()),
  EVENTS: { ATTENDANCE_WARNING_SUPERVISOR: "residency_attendance_warning_supervisor" },
  LINKS: { ATTENDANCE: "/residency/davomat" },
}));

const mockSave = jest.fn();
jest.mock("./attendance.model", () => {
  function Attendance(payload) { Object.assign(this, payload); this.save = (...a) => mockSave(...a); }
  Attendance.find = jest.fn();
  Attendance.findOne = jest.fn();
  Attendance.ATTENDANCE_STATUSES = ["present", "absent", "excused"];
  Attendance.RESIDENCY_LESSON_TYPES = ["amaliy"];
  return Attendance;
});
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(async () => ({})),
}));

const Attendance = require("./attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { notifyUser } = require("#modules/4.05-residency/_services/residentNotify");
const Controller = require("./attendance.controller");

const RID = "6a97de5a52685c2068a0a543";
const SUP = "6a5a0acbd34b3c21a575d59d";

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const req = () => ({
  user: { _id: "staff-1", role: { title: "magistratura_bolim", scopeLevel: "global" } },
  body: { resident: RID, date: "2026-09-02", status: "absent" },
});

const arrange = (resident, hours = 6) => {
  Resident.findById.mockImplementation(() => {
    const q = Promise.resolve(resident);
    q.populate = () => Promise.resolve(resident);
    return q;
  });
  Attendance.find.mockResolvedValue(Array.from({ length: hours / 2 }, () => ({ hours: 2 })));
};

const ordinator = (over = {}) => ({
  _id: RID, program: "ordinatura", supervisor: SUP,
  warningIssued: false, user: null, group: null, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  Attendance.findOne.mockResolvedValue(null);
  mockSave.mockResolvedValue({});
});

describe("ostona kesilganda ustozga xabar (D-16)", () => {
  test("🔴 ordinatura + ustoz bor — USTOZGA yuboriladi", async () => {
    arrange(ordinator());
    await Controller.addAttendance(req(), res(), jest.fn());

    expect(notifyUser).toHaveBeenCalledTimes(1);
    const [userId, payload] = notifyUser.mock.calls[0];
    expect(userId).toBe(SUP);
    expect(payload.eventType).toBe("residency_attendance_warning_supervisor");
    expect(payload.link).toBe("/residency/davomat");
  });

  test("xabar ustozga QARATILGAN — «siz qoldirdingiz» EMAS", async () => {
    arrange(ordinator());
    await Controller.addAttendance(req(), res(), jest.fn());
    const { body, title } = notifyUser.mock.calls[0][1];
    expect(`${title} ${body}`).not.toMatch(/qoldirdingiz/);
    expect(body).toMatch(/6 soat/);
  });

  test("🔴 matn «bildirgi yozing» ga CHORLAMAYDI", () => {
    arrange(ordinator());
    return Controller.addAttendance(req(), res(), jest.fn()).then(() => {
      const { body } = notifyUser.mock.calls[0][1];
      expect(body).not.toMatch(/bildirgi/i);
    });
  });

  test("🔴 MAGISTRATURA — yuborilmaydi (ustozda `residentAttendance` yo'q)", async () => {
    arrange(ordinator({ program: "magistratura" }));
    await Controller.addAttendance(req(), res(), jest.fn());
    expect(notifyUser).not.toHaveBeenCalled();
  });

  test("ustoz biriktirilmagan — jimgina o'tkaziladi", async () => {
    arrange(ordinator({ supervisor: null }));
    await Controller.addAttendance(req(), res(), jest.fn());
    expect(notifyUser).not.toHaveBeenCalled();
  });

  test("ostona kesilmagan (soat < 6) — yuborilmaydi", async () => {
    arrange(ordinator(), 4);
    await Controller.addAttendance(req(), res(), jest.fn());
    expect(notifyUser).not.toHaveBeenCalled();
  });

  test("🔴 TAKRORLANMAYDI — bayroq allaqachon yoqilgan bo'lsa", async () => {
    arrange(ordinator({ warningIssued: true }), 10);
    await Controller.addAttendance(req(), res(), jest.fn());
    expect(notifyUser).not.toHaveBeenCalled();
  });

  test("bildirishnoma xatosi davomat yozuvini BLOKLAMAYDI", async () => {
    arrange(ordinator());
    notifyUser.mockImplementationOnce(() => Promise.reject(new Error("dispatch tushdi")));
    const r = res();
    await Controller.addAttendance(req(), r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(201);
  });
});
