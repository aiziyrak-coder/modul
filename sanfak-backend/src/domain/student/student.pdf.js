"use strict";
const { ErrorHandler } = require("#shared/error");
const Student = require("#domain/student/student.model");
const Attendance = require("#domain/attendance/attendance.model");
const {
  createDoc,
  pipeToResponse,
  drawHeader,
  drawTitle,
  drawSectionTitle,
  drawInfoCard,
  drawTable,
  drawFooter,
  ensureSpace,
  COLORS,
  PAGE,
  CONTENT_WIDTH,
} = require("#shared/pdfGenerators/pdfHelpers");

const STATUS_UZ = {
  active: "O'qiydi",
  leave: "Akademik ta'til",
  expelled: "Chetlatilgan",
  graduated: "Bitirgan",
  transferred: "O'tkazilgan",
};
const STATUS_COLOR = {
  active: COLORS.approved,
  leave: COLORS.pending,
  expelled: COLORS.rejected,
  graduated: COLORS.secondary,
  transferred: COLORS.muted,
};

async function buildStudentPdf(id, opts = {}) {
  const s = await Student.findById(id)
    .populate("group", "title studentNumber")
    .populate("faculty", "title")
    .populate("direction", "title directionCode")
    .populate("user", "email")

    .exec();

  if (!s) throw new Error("Talaba topilmadi");

  const doc = createDoc();
  const fullName = [s.lastName, s.firstName, s.middleName]
    .filter(Boolean)
    .join(" ");

  drawHeader(doc);
  drawTitle(doc, "TALABA MA'LUMOTNOMASI", fullName);

  const st = s.status || "active";
  doc
    .rect(PAGE.margin, doc.y, CONTENT_WIDTH, 20)
    .fill(STATUS_COLOR[st] || COLORS.muted);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.white)
    .text(
      `Holat: ${STATUS_UZ[st] || st}` +
        (s.statusChangedAt
          ? `  |  ${new Date(s.statusChangedAt).toLocaleDateString("uz-UZ")}`
          : ""),
      PAGE.margin + 6,
      doc.y - 15,
      { width: CONTENT_WIDTH - 12 },
    );
  doc.y = doc.y + 5;
  doc.moveDown(0.8);

  drawSectionTitle(doc, "Shaxsiy ma'lumotlar");
  drawInfoCard(
    doc,
    [
      ["Talaba ID", s.studentId],
      ["F.I.Sh.", fullName],
      [
        "Tug'ilgan sana",
        s.birthDate ? new Date(s.birthDate).toLocaleDateString("uz-UZ") : null,
      ],
      [
        "Jinsi",
        s.gender === "male" ? "Erkak" : s.gender === "female" ? "Ayol" : null,
      ],
      ["JSHSHIR", s.jshshir],
      [
        "Pasport",
        s.passportSeries && s.passportNumber
          ? `${s.passportSeries} ${s.passportNumber}`
          : null,
      ],
      ["Pasport berilgan", s.passportIssuedBy],
      [
        "Berilgan sana",
        s.passportIssuedAt
          ? new Date(s.passportIssuedAt).toLocaleDateString("uz-UZ")
          : null,
      ],
      ["Telefon", s.phone],
      ["Email", s.email || s.user?.email],
      [
        "Manzil",
        [s.address?.region, s.address?.district, s.address?.street]
          .filter(Boolean)
          .join(", ") || null,
      ],
    ].filter(([, v]) => v),
  );

  ensureSpace(doc, 60);
  drawSectionTitle(doc, "O'quv ma'lumotlari");
  const dirTitle = s.direction?.title;
  const dirCode = s.direction?.directionCode;
  drawInfoCard(
    doc,
    [
      ["Fakultet", s.faculty?.title],
      [
        "Yo'nalish",
        dirTitle && dirCode ? `${dirCode} — ${dirTitle}` : dirTitle || dirCode,
      ],
      ["Guruh", s.group?.title],
      ["Kurs", s.course ? `${s.course}-kurs` : null],
      ["Semestr", s.semester ? `${s.semester}-semestr` : null],
      ["Qabul yili", s.enrollmentYear ? String(s.enrollmentYear) : null],
      [
        "Ta'lim turi",
        s.studyType === "grant"
          ? "Grant"
          : s.studyType === "contract"
            ? "Kontrakt"
            : null,
      ],
      ["Ta'lim shakli", s.educationForm],
    ].filter(([, v]) => v),
  );

  if (s.statusChangeReason && st !== "active") {
    ensureSpace(doc, 40);
    drawSectionTitle(doc, "Holat o'zgarish sababi");
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.text)
      .text(s.statusChangeReason, PAGE.margin, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.5);
  }

  if (opts.withAttendance) {
    const attendanceData = await _getAttendanceStats(id);
    if (attendanceData.total > 0) {
      ensureSpace(doc, 60);
      drawSectionTitle(doc, "Davomad statistikasi");
      drawTable(
        doc,
        [
          { header: "Jami dars", key: "total", width: 1 },
          { header: "Keldi", key: "present", width: 1 },
          { header: "Kelmadi", key: "absent", width: 1 },
          { header: "Kech", key: "late", width: 1 },
          { header: "Uzrli", key: "excused", width: 1 },
          { header: "Foiz", key: "rate", width: 1 },
        ],
        [
          {
            total: attendanceData.total,
            present: attendanceData.present,
            absent: attendanceData.absent,
            late: attendanceData.late,
            excused: attendanceData.excused,
            rate: `${attendanceData.rate}%`,
          },
        ],
        { headerBg: COLORS.secondary },
      );
    }
  }

  ensureSpace(doc, 60);
  doc.moveDown(1);
  const sigY = doc.y;
  const colW = CONTENT_WIDTH / 2;
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.primary)
    .text("Talaba:", PAGE.margin, sigY, { width: colW - 10 });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(fullName, PAGE.margin, doc.y, { width: colW - 10 });
  doc.text("(imzo)", PAGE.margin, doc.y, { width: colW - 10 });

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.primary)
    .text("Dekan:", PAGE.margin + colW, sigY, { width: colW - 10 });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("___________________", PAGE.margin + colW, sigY + 14, {
      width: colW - 10,
    });
  doc.text("(imzo)", PAGE.margin + colW, sigY + 26, { width: colW - 10 });

  doc.moveDown(2);
  drawFooter(doc, "Talaba ma'lumotnomasi", st);
  doc.flushPages();
  return doc;
}

async function _getAttendanceStats(studentId) {
  const mongoose = require("mongoose");
  const oid = new mongoose.Types.ObjectId(studentId);
  const rows = await Attendance.aggregate([
    { $match: { "attendances.student": oid } },
    { $unwind: "$attendances" },
    { $match: { "attendances.student": oid } },
    { $group: { _id: "$attendances.status", count: { $sum: 1 } } },
  ]);
  const s = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) {
    s[r._id] = r.count;
    s.total += r.count;
  }
  s.rate = s.total ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
  return s;
}

async function generateStudentPdf(req, res, next) {
  try {
    const withAttendance = req.query.attendance === "true";
    const doc = await buildStudentPdf(req.params.id, { withAttendance });
    pipeToResponse(res, doc, `student-${req.params.id}`);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Student PDF yaratishda xatolik", err.message));
  }
}

module.exports = { generateStudentPdf, buildStudentPdf };
