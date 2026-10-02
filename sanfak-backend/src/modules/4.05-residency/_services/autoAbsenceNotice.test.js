"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("#system/notification/notificationDispatcher", () => ({ dispatch: jest.fn() }));
jest.mock("#system/notification/notification.model", () => ({ countDocuments: jest.fn(), updateMany: jest.fn() }));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({ find: jest.fn(), STATUS_IN_STUDY: "oquvda" }));
jest.mock("#modules/4.05-residency/residencyNotice/residencyNotice.model", () => ({
  create: jest.fn(),
  find: jest.fn(),
  distinct: jest.fn(),
  updateOne: jest.fn(),
  exists: jest.fn(),
  NOTICE_KIND_AUTO: "avtomatik",
  AUTO_STATE_ACTIVE: "faol",
  AUTO_STATE_REVOKED: "bekor_qilingan",
  PROGRAMS: ["magistratura", "ordinatura"],
}));
jest.mock("./expulsionDraftData", () => ({
  ...jest.requireActual("./expulsionDraftData"),
  loadDraftResident: jest.fn(),
  loadDraftRows: jest.fn(),
}));
jest.mock("./officeRecipients", () => ({ officeUserIds: jest.fn() }));
jest.mock("./noticeFiles", () => ({ save: jest.fn() }));
jest.mock("#modules/4.05-residency/_pdf/autoAbsenceNotice.pdf", () => ({
  ...jest.requireActual("#modules/4.05-residency/_pdf/autoAbsenceNotice.pdf"),
  buildAutoAbsenceNoticePdf: jest.fn(),
}));

const winston = require("#shared/winston.logger");
const Notification = require("#system/notification/notification.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Notice = require("#modules/4.05-residency/residencyNotice/residencyNotice.model");
const { loadDraftResident, loadDraftRows } = require("./expulsionDraftData");
const noticeFiles = require("./noticeFiles");
const { buildAutoAbsenceNoticePdf } = require("#modules/4.05-residency/_pdf/autoAbsenceNotice.pdf");
const A = require("./autoAbsenceNotice");

const NOW = new Date("2026-10-05T03:00:00Z");
const YEAR = "2026/2027";
const PDF = Buffer.from("%PDF-1.7 test");
const STORED = { storageKey: "2026/10/a.pdf", size: PDF.length, sha256: "f".repeat(64) };
const R = {
  _id: "r1",
  fullName: "Aliyev Sardor",
  program: "ordinatura",
  courseNumber: 2,
  specialty: { title: "Kardiologiya" },
  department: null,
  departmentTitle: "Ichki kasalliklar",
  group: { name: "ORD-201" },
  status: "oquvda",
  active: true,
};
const absent = (day, hours) => ({ date: new Date(`2026-09-${day}T05:00:00Z`), science: { title: "Terapiya" }, lessonType: "amaliy", hours });
const SIX = [absent(10, 2), absent(11, 2), absent(12, 2)];
const chain = (result) => ({ select: () => ({ lean: async () => result }) });

beforeEach(() => {
  jest.resetAllMocks();
  loadDraftResident.mockResolvedValue(R);
  loadDraftRows.mockResolvedValue(SIX);
  buildAutoAbsenceNoticePdf.mockResolvedValue(PDF);
  noticeFiles.save.mockResolvedValue(STORED);
  Notice.create.mockImplementation(async (doc) => ({ _id: "n1", ...doc }));
  Notice.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Notification.updateMany.mockResolvedValue({ modifiedCount: 0 });
});

describe("issueOne — yaratish", () => {
  test("6 soat jonli: PDF (jadval = jami) → disk → bitta yozuv, kontrakt maydonlari bilan", async () => {
    const doc = await A.issueOne("r1", { year: YEAR, now: NOW });
    const input = buildAutoAbsenceNoticePdf.mock.calls[0][0];
    expect(input).toMatchObject({ countingYear: YEAR, hours: 6, generatedAt: NOW });
    expect(input.rows.map((r) => r.hours)).toEqual([2, 2, 2]);
    expect(input.resident).toEqual({ fullName: "Aliyev Sardor", program: "ordinatura", specialty: "Kardiologiya", department: "Ichki kasalliklar", course: 2, group: "ORD-201" });
    expect(noticeFiles.save).toHaveBeenCalledWith(PDF);
    expect(noticeFiles.save.mock.invocationCallOrder[0]).toBeLessThan(Notice.create.mock.invocationCallOrder[0]);
    expect(Notice.create).toHaveBeenCalledWith({
      kind: "avtomatik",
      sender: null,
      senderName: "Tizim (avtomatik)",
      resident: "r1",
      program: "ordinatura",
      academicYear: YEAR,
      title: A.AUTO_TITLE,
      content: input.sentence,
      status: "yangi",
      document: { ...STORED, fileName: "bildirgi-avtomatik-2026-10-05.pdf", generatedAt: NOW },
      auto: { countingYear: YEAR, state: "faol", hoursAtIssue: 6, templateVersion: 1, notifiedAt: null, revokedAt: null, hoursAtRevoke: null },
    });
    expect(doc._id).toBe("n1");
    expect(loadDraftRows).toHaveBeenCalledWith("r1", NOW);
  });

  test.each([
    ["jonli 5 soat (saqlangani 6 bo'lsa ham)", [absent(10, 2), absent(11, 3)]],
    ["NaN soat", [{ date: NOW, hours: Infinity }, { date: NOW, hours: -Infinity }]],
    ["qator yo'q", []],
  ])("%s — bildirgi yo'q, PDF chizilmaydi", async (_label, rows) => {
    loadDraftRows.mockResolvedValueOnce(rows);
    await expect(A.issueOne("r1", { year: YEAR, now: NOW })).resolves.toBeNull();
    expect(buildAutoAbsenceNoticePdf).not.toHaveBeenCalled();
    expect(noticeFiles.save).not.toHaveBeenCalled();
    expect(Notice.create).not.toHaveBeenCalled();
  });

});

describe("issueOne — rezident mos emas", () => {
  test.each([
    ["akademik ta'til", { status: "akademik_tatil" }],
    ["chetlatilgan", { status: "chetlatilgan" }],
    ["nofaol", { active: false }],
  ])("%s — yo'q, soat o'qilmaydi", async (_label, extra) => {
    loadDraftResident.mockResolvedValueOnce({ ...R, ...extra });
    await expect(A.issueOne("r1", { year: YEAR, now: NOW })).resolves.toBeNull();
    expect(loadDraftRows).not.toHaveBeenCalled();
  });

  test("o'chirilgan (hook `null`) — yo'q; noma'lum dastur — yo'q va ogohlantirish", async () => {
    loadDraftResident.mockResolvedValueOnce(null);
    await expect(A.issueOne("r1", { year: YEAR, now: NOW })).resolves.toBeNull();
    loadDraftResident.mockResolvedValueOnce({ ...R, program: "bakalavr" });
    await expect(A.issueOne("r1", { year: YEAR, now: NOW })).resolves.toBeNull();
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining('noma\'lum dastur "bakalavr"'));
    expect(Notice.create).not.toHaveBeenCalled();
  });

});

describe("issueOne — kim olmaydi / parallel yaratish", () => {
  test.each([[undefined], [null], ["oquvda"]])("holat %p — yaratiladi", async (status) => {
    loadDraftResident.mockResolvedValueOnce({ ...R, status });
    await expect(A.issueOne("r1", { year: YEAR, now: NOW })).resolves.toMatchObject({ _id: "n1" });
  });

  test("E11000 — parallel yaratilgan: `null`, fayl yetim deb loglanadi; boshqa xato — yuqoriga", async () => {
    Notice.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: 11000 }));
    await expect(A.issueOne("r1", { year: YEAR, now: NOW })).resolves.toBeNull();
    expect(winston.info).toHaveBeenCalledWith(expect.stringContaining(`yetim qoldi ${STORED.storageKey}`));
    Notice.create.mockRejectedValueOnce(new Error("validation"));
    await expect(A.issueOne("r1", { year: YEAR, now: NOW })).rejects.toThrow("validation");
  });
});

describe("issueDue — kimlar ishlanadi", () => {
  test("ostonadagi o'quvdagi faol rezidentlar; faol bildirgisi borlari o'tkaziladi", async () => {
    Resident.find.mockReturnValueOnce(chain([{ _id: "r1" }, { _id: "r2" }, { _id: "r3" }]));
    Notice.distinct.mockResolvedValueOnce(["r2"]);
    await expect(A.issueDue(YEAR, NOW)).resolves.toBe(2);
    expect(Resident.find).toHaveBeenCalledWith({ active: true, status: { $in: [null, "oquvda"] }, totalUnexcusedHours: { $gte: 6 } });
    expect(Notice.distinct).toHaveBeenCalledWith("resident", {
      kind: "avtomatik",
      "auto.state": "faol",
      "auto.countingYear": YEAR,
      resident: { $in: ["r1", "r2", "r3"] },
    });
    expect(loadDraftResident.mock.calls.map(([id]) => id)).toEqual(["r1", "r3"]);
  });

  test("bittasi yiqilsa keyingisi ishlanadi; hech kim yo'q — bildirgi so'rovi ham yo'q", async () => {
    Resident.find.mockReturnValueOnce(chain([{ _id: "r1" }, { _id: "r2" }]));
    Notice.distinct.mockResolvedValueOnce([]);
    loadDraftResident.mockRejectedValueOnce(new Error("blip"));
    await expect(A.issueDue(YEAR, NOW)).resolves.toBe(1);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("resident=r1: blip"));
    Resident.find.mockReturnValueOnce(chain([]));
    await expect(A.issueDue(YEAR, NOW)).resolves.toBe(0);
    expect(Notice.distinct).toHaveBeenCalledTimes(1);
  });
});

describe("revokeStale / revokeOne — soat 6 dan tushdi", () => {
  const open = [{ _id: "n1", resident: "r1" }, { _id: "n2", resident: "r2" }, { _id: "n3", resident: "r3" }];

  test("jonli < 6 — CAS bilan bekor, keyin xabarlar olinadi; jonli ≥ 6 va past bo'lmaganlar — tegilmaydi", async () => {
    Notice.find.mockReturnValueOnce(chain(open));
    Resident.find.mockReturnValueOnce(chain([{ _id: "r1" }, { _id: "r2" }]));
    loadDraftRows.mockImplementation(async (id) => (id === "r1" ? [absent(10, 2), absent(11, 2)] : SIX));
    await expect(A.revokeStale(YEAR, NOW)).resolves.toBe(1);
    expect(Notice.find).toHaveBeenCalledWith({ kind: "avtomatik", "auto.state": "faol", "auto.countingYear": YEAR });
    expect(Resident.find).toHaveBeenCalledWith({ _id: { $in: ["r1", "r2", "r3"] }, active: true, totalUnexcusedHours: { $lt: 6 } });
    expect(loadDraftRows.mock.calls.map(([id]) => id)).toEqual(["r1", "r2"]);
    expect(Notice.updateOne).toHaveBeenCalledTimes(1);
    expect(Notice.updateOne).toHaveBeenCalledWith(
      { _id: "n1", kind: "avtomatik", "auto.state": "faol" },
      { $set: { "auto.state": "bekor_qilingan", "auto.revokedAt": NOW, "auto.hoursAtRevoke": 4 } },
    );
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { eventType: "residency_absence_notice_auto", "metadata.noticeId": "n1", active: true },
      { $set: { active: false } },
    );
  });

  test("CAS yutqazildi (boshqa sweep bekor qildi) — xabarlarga tegilmaydi, sanalmaydi", async () => {
    loadDraftRows.mockResolvedValueOnce([absent(10, 2)]);
    Notice.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    await expect(A.revokeOne(open[0], NOW)).resolves.toBe(false);
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });

  test("NaN soat bekor qilmaydi", async () => {
    loadDraftRows.mockResolvedValueOnce([{ hours: Infinity }, { hours: -Infinity }]);
    await expect(A.revokeOne(open[0], NOW)).resolves.toBe(false);
    expect(Notice.updateOne).not.toHaveBeenCalled();
  });

  test("faol bildirgi yo'q — rezident so'rovi yo'q; bittasining xatosi keyingisini to'xtatmaydi", async () => {
    Notice.find.mockReturnValueOnce(chain([]));
    await expect(A.revokeStale(YEAR, NOW)).resolves.toBe(0);
    expect(Resident.find).not.toHaveBeenCalled();
    Notice.find.mockReturnValueOnce(chain(open.slice(0, 2)));
    Resident.find.mockReturnValueOnce(chain([{ _id: "r1" }, { _id: "r2" }]));
    loadDraftRows.mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce([absent(10, 2)]);
    await expect(A.revokeStale(YEAR, NOW)).resolves.toBe(1);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("notice=n1: blip"));
  });
});

describe("xabarlarni olish — bir martalik emas (daraja bo'yicha)", () => {
  test("CAS yutildi, xabarlarni olish yiqildi — baribir bekor qilingan (sanaladi), xato emas ogohlantirish", async () => {
    loadDraftRows.mockResolvedValueOnce([absent(10, 2)]);
    Notification.updateMany.mockRejectedValueOnce(new Error("transient"));
    await expect(A.revokeOne({ _id: "n1", resident: "r1" }, NOW)).resolves.toBe(true);
    expect(winston.warn).toHaveBeenCalledWith(
      expect.stringContaining("notice=n1 bekor qilindi, xabarlar hozir olinmadi (sweep oladi): transient"),
    );
    expect(winston.error).not.toHaveBeenCalled();
  });

  test("joriy va o'tgan yil bekor qilinganlarining HALI faol xabarlari olinadi; soni loglanadi", async () => {
    Notice.distinct.mockResolvedValueOnce(["n1", "n2"]);
    Notification.updateMany.mockResolvedValueOnce({ modifiedCount: 2 });
    await expect(A.withdrawRevokedAlerts(NOW)).resolves.toBe(2);
    expect(Notice.distinct).toHaveBeenCalledWith("_id", {
      kind: "avtomatik",
      "auto.state": "bekor_qilingan",
      "auto.countingYear": { $in: ["2025/2026", YEAR] },
    });
    expect(Notification.updateMany).toHaveBeenCalledWith(
      { eventType: "residency_absence_notice_auto", "metadata.noticeId": { $in: ["n1", "n2"] }, active: true },
      { $set: { active: false } },
    );
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("qolib ketgan 2 ta xabari olindi"));
  });

  test("yil chegarasi: 1-sentabr 00:00Z — yangi yil va tugagan yil", async () => {
    Notice.distinct.mockResolvedValueOnce([]);
    await A.withdrawRevokedAlerts(new Date("2027-09-01T00:00:00Z"));
    expect(Notice.distinct.mock.calls[0][1]["auto.countingYear"]).toEqual({ $in: ["2026/2027", "2027/2028"] });
  });

  test("bekor qilingan yo'q — xabar so'rovi yo'q; hammasi allaqachon olingan — jim", async () => {
    Notice.distinct.mockResolvedValueOnce([]);
    await expect(A.withdrawRevokedAlerts(NOW)).resolves.toBe(0);
    expect(Notification.updateMany).not.toHaveBeenCalled();
    Notice.distinct.mockResolvedValueOnce(["n1"]);
    await expect(A.withdrawRevokedAlerts(NOW)).resolves.toBe(0);
    expect(winston.warn).not.toHaveBeenCalled();
  });
});

describe("hisob darvozasi va matnlar", () => {
  test.each([
    [undefined, true],
    [null, true],
    ["oquvda", true],
    ["akademik_tatil", false],
    ["chetlatilgan", false],
  ])("accrues(%p) → %p", (status, want) => {
    expect(A.accrues(status)).toBe(want);
  });

  test("sarlavha va jumla — ostona, yil, soat; ism yo'q bo'lsa «Rezident»", () => {
    expect(A.AUTO_TITLE).toBe("Avtomatik bildirgi: sababsiz soatlar ostonasi (6 soat)");
    expect(A.autoSentence({ fullName: "Aliyev Sardor", year: YEAR, hours: 6 })).toBe(
      "Aliyev Sardor 2026/2027 o'quv yilida jami 6 soat mashg'ulotni sababsiz qoldirdi va 6 soatlik ostonaga yetdi " +
        "(TZ 4.5.4). Bildirgi tizim tomonidan avtomatik shakllantirildi; qaror bo'lim zimmasida.",
    );
    expect(A.autoSentence({ fullName: null, year: YEAR, hours: 7.5 })).toMatch(/^Rezident 2026\/2027 .* jami 7\.5 soat/);
  });
});
