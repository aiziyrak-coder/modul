"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
require("#references/science/science.model");
require("#references/group/group.model");
require("#modules/4.05-residency/residencySpecialty/residencySpecialty.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Application = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const applicationRoutes = require("#modules/4.05-residency/residentApplication/residentApplication.routes");
const attendanceRoutes = require("#modules/4.05-residency/attendance/attendance.routes");

const app = express();
app.use(bodyParser.json());
app.use("/api/applications", applicationRoutes);
app.use("/api/attendance", attendanceRoutes);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => handleError(err, res));

const ACTIONS = [
  "create",
  "read",
  "readAll",
  "update",
  "delete",
  "approve",
  "reject",
];

const createUser = async (title) => {
  let role = await RoleModel.findOne({ title });
  if (!role) {
    role = await RoleModel.create({
      title,
      desc: `${title} (test)`,
      permissions: [
        { section: "residentApplication", actionKeys: ACTIONS },
        { section: "residentAttendance", actionKeys: ACTIONS },
      ],
      scopeLevel: "global",
      active: true,
    });
  }
  const user = await UserModel.create({
    firstName: "Test",
    lastName: title,
    role: role._id,
    active: true,
  });
  const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  return { user, token };
};

const DOC = "/files/file/applications/1712345678.pdf";

let xodim;
let resident;

beforeEach(async () => {
  xodim = await createUser("magistratura_bolim");
  resident = await Resident.create({
    program: "ordinatura",
    fullName: "Test Rezident",
    courseNumber: 1,
  });
});

const {
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");
const YM = (() => {
  const d = new Date(currentAcademicYearWindow().from);
  d.setUTCMonth(d.getUTCMonth() + 2);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
})();

const makeAbsence = (day) =>
  Attendance.create({
    resident: resident._id,
    date: new Date(`${YM}-${day}`),
    status: "absent",
    hours: 2,
    active: true,
  });

const approve = (id, body) =>
  request(app)
    .put(`/api/applications/${id}/review`)
    .set("Authorization", `Bearer ${xodim.token}`)
    .send(body);

describe("Ariza tasdiqlanishi — sababli davomat + hujjat havolasi", () => {
  it("oraliqdagi qatorlarni `excused` qiladi va ARIZAGA havola qoldiradi", async () => {
    const a1 = await makeAbsence("10");
    const a2 = await makeAbsence("11");
    const outside = await makeAbsence("20");

    const application = await Application.create({
      resident: resident._id,
      type: "academic_leave",
      reason: "Kasallik",
      fileUrl: DOC,
      status: "yangi",
    });

    const res = await approve(application._id, {
      status: "tasdiqlangan",
      fromDate: `${YM}-10`,
      toDate: `${YM}-12`,
    });
    expect(res.status).toBe(200);

    const [r1, r2, rOut] = await Promise.all([
      Attendance.findById(a1._id),
      Attendance.findById(a2._id),
      Attendance.findById(outside._id),
    ]);

    expect(r1.status).toBe("excused");
    expect(String(r1.application)).toBe(String(application._id));
    expect(r2.status).toBe("excused");
    expect(String(r2.application)).toBe(String(application._id));

    expect(rOut.status).toBe("absent");
    expect(rOut.application).toBeNull();
  });

  it("jurnal javobida arizaning HUJJATI ko'rinadi (nusxa emas, populate)", async () => {
    await makeAbsence("10");
    const application = await Application.create({
      resident: resident._id,
      type: "academic_leave",
      reason: "Kasallik",
      fileUrl: DOC,
      status: "yangi",
    });
    await approve(application._id, {
      status: "tasdiqlangan",
      fromDate: `${YM}-10`,
      toDate: `${YM}-10`,
    });

    const res = await request(app)
      .get(`/api/attendance/resident/${resident._id}`)
      .set("Authorization", `Bearer ${xodim.token}`);

    expect(res.status).toBe(200);
    const rows = res.body.docs ?? res.body;
    const row = rows.find((r) => r.status === "excused");

    expect(row.application).toBeTruthy();
    expect(row.application.fileUrl).toBe(DOC);
    expect(row.application.reason).toBe("Kasallik");
    expect(row.fileUrl).toBeUndefined();
  });

  it("arizadagi hujjat almashsa jurnal O'Z-O'ZIDAN ergashadi (bitta manba)", async () => {
    await makeAbsence("10");
    const application = await Application.create({
      resident: resident._id,
      type: "academic_leave",
      reason: "Kasallik",
      fileUrl: DOC,
      status: "yangi",
    });
    await approve(application._id, {
      status: "tasdiqlangan",
      fromDate: `${YM}-10`,
      toDate: `${YM}-10`,
    });

    const YANGI = "/files/file/applications/9999999999.pdf";
    await Application.findByIdAndUpdate(application._id, { fileUrl: YANGI });

    const res = await request(app)
      .get(`/api/attendance/resident/${resident._id}`)
      .set("Authorization", `Bearer ${xodim.token}`);
    const rows = res.body.docs ?? res.body;
    const row = rows.find((r) => r.status === "excused");

    expect(row.application.fileUrl).toBe(YANGI);
  });
});

describe("`application` mijozdan olinmaydi", () => {
  it("POST da yuborilgan `application` e'tiborsiz qoldiriladi", async () => {
    const application = await Application.create({
      resident: resident._id,
      type: "academic_leave",
      reason: "X",
      status: "yangi",
    });

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${xodim.token}`)
      .send({
        resident: String(resident._id),
        date: `${YM}-15`,
        status: "absent",
        hours: 2,
        application: String(application._id),
      });

    expect(res.status).toBe(400);
  });
});

const approveRange = (id, fromDate, toDate) =>
  approve(id, { status: "tasdiqlangan", fromDate, toDate });

const newApplication = () =>
  Application.create({
    resident: resident._id,
    type: "academic_leave",
    reason: "Kasallik",
    fileUrl: DOC,
    status: "yangi",
  });

describe("Tasdiq bekor qilinsa — davomat asl holiga qaytadi", () => {
  it("`rad_etilgan` qatorlarni `absent` ga qaytaradi va havolani uzadi", async () => {
    const a1 = await makeAbsence("10");
    const a2 = await makeAbsence("11");
    const app = await newApplication();
    await approveRange(app._id, `${YM}-10`, `${YM}-11`);

    expect((await Attendance.findById(a1._id)).status).toBe("excused");

    const res = await approve(app._id, {
      status: "rad_etilgan",
      comment: "bekor qilindi",
    });
    expect(res.status).toBe(200);

    for (const id of [a1._id, a2._id]) {
      const row = await Attendance.findById(id);
      expect(row.status).toBe("absent");
      expect(row.application).toBeNull();
      expect(row.excuseReason).toBeNull();
      expect(row.excuseApprovedBy).toBeNull();
    }
  });

  it("sababsiz soatlar qayta hisoblanadi", async () => {
    await makeAbsence("10");
    await makeAbsence("11");
    const app = await newApplication();

    await approveRange(app._id, `${YM}-10`, `${YM}-11`);
    expect((await Resident.findById(resident._id)).totalUnexcusedHours).toBe(0);

    await approve(app._id, { status: "rad_etilgan" });
    expect((await Resident.findById(resident._id)).totalUnexcusedHours).toBe(4);
  });

  it("qayta ko'rib chiqishga qaytarilsa ham qaytaradi", async () => {
    const a1 = await makeAbsence("10");
    const app = await newApplication();
    await approveRange(app._id, `${YM}-10`, `${YM}-10`);

    await approve(app._id, { status: "korib_chiqilmoqda" });
    expect((await Attendance.findById(a1._id)).status).toBe("absent");
  });

  it("BOSHQA ariza asoslagan qatorga TEGMAYDI", async () => {
    const a1 = await makeAbsence("10");
    const a2 = await makeAbsence("20");
    const app1 = await newApplication();
    const app2 = await newApplication();
    await approveRange(app1._id, `${YM}-10`, `${YM}-10`);
    await approveRange(app2._id, `${YM}-20`, `${YM}-20`);

    await approve(app1._id, { status: "rad_etilgan" });

    expect((await Attendance.findById(a1._id)).status).toBe("absent");
    const row2 = await Attendance.findById(a2._id);
    expect(row2.status).toBe("excused");
    expect(String(row2.application)).toBe(String(app2._id));
  });

  it("hech qachon tasdiqlanmagan arizani rad etish — no-op", async () => {
    const a1 = await makeAbsence("10");
    const app = await newApplication();

    const res = await approve(app._id, { status: "rad_etilgan" });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(a1._id)).status).toBe("absent");
  });

  it("qo'lda `present` qilingan qator HOLATINI saqlaydi, faqat havola uziladi", async () => {
    const a1 = await makeAbsence("10");
    const app = await newApplication();
    await approveRange(app._id, `${YM}-10`, `${YM}-10`);
    await Attendance.findByIdAndUpdate(a1._id, { status: "present" });

    await approve(app._id, { status: "rad_etilgan" });

    const row = await Attendance.findById(a1._id);
    expect(row.status).toBe("present");
    expect(row.application).toBeNull();
  });
});

describe("Qayta tasdiqlash — oraliq TORAYSA eski qatorlar osilib qolmaydi", () => {
  it("yangi oraliqdan tashqaridagi qatorlar `absent` ga qaytadi", async () => {
    const a10 = await makeAbsence("10");
    const a11 = await makeAbsence("11");
    const a12 = await makeAbsence("12");
    const app = await newApplication();

    await approveRange(app._id, `${YM}-10`, `${YM}-12`);
    for (const id of [a10._id, a11._id, a12._id]) {
      expect((await Attendance.findById(id)).status).toBe("excused");
    }

    await approveRange(app._id, `${YM}-10`, `${YM}-10`);

    expect((await Attendance.findById(a10._id)).status).toBe("excused");
    for (const id of [a11._id, a12._id]) {
      const row = await Attendance.findById(id);
      expect(row.status).toBe("absent");
      expect(row.application).toBeNull();
    }
  });
});

describe("Kesishuvchi tasdiqlar — tirik ariza qamragan kun sababsizga aylanmaydi", () => {
  it("app1 rad etilsa, app2 qamragan kunlar `excused` bo'lib QOLADI", async () => {
    const rows = {};
    for (const d of ["10", "11", "12", "13"]) rows[d] = await makeAbsence(d);

    const app1 = await newApplication();
    const app2 = await newApplication();
    await approveRange(app1._id, `${YM}-10`, `${YM}-12`);
    await approveRange(app2._id, `${YM}-11`, `${YM}-13`);

    await approve(app1._id, { status: "rad_etilgan" });

    expect((await Attendance.findById(rows["10"]._id)).status).toBe("absent");

    for (const d of ["11", "12", "13"]) {
      const row = await Attendance.findById(rows[d]._id);
      expect(row.status).toBe("excused");
      expect(String(row.application)).toBe(String(app2._id));
    }

    expect((await Resident.findById(resident._id)).totalUnexcusedHours).toBe(2);
  });

  it("oraliq toraysa ham boshqa tasdiq qamragan kun saqlanadi", async () => {
    const a11 = await makeAbsence("11");
    const app1 = await newApplication();
    const app2 = await newApplication();
    await approveRange(app1._id, `${YM}-11`, `${YM}-11`);
    await approveRange(app2._id, `${YM}-11`, `${YM}-11`);

    await approveRange(app1._id, `${YM}-20`, `${YM}-20`);

    const row = await Attendance.findById(a11._id);
    expect(row.status).toBe("excused");
    expect(String(row.application)).toBe(String(app2._id));
  });
});
