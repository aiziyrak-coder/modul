"use strict";
const { ErrorHandler } = require("#shared/error");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const {
  canSeePersonal,
} = require("#modules/4.03-teacher/_shared/profilePrivacy");
const {
  createDoc,
  pipeToResponse,
  drawHeader,
  drawTitle,
  drawSectionTitle,
  drawInfoCard,
  drawParagraph,
  drawTable,
  drawFooter,
  ensureSpace,
  COLORS,
  PAGE,
  CONTENT_WIDTH,
} = require("#shared/pdfGenerators/pdfHelpers");

const hrColor = (s) =>
  s === "approved"
    ? COLORS.approved
    : s === "rejected"
      ? COLORS.rejected
      : COLORS.pending;
const hrLabel = (s) =>
  s === "approved"
    ? "Tasdiqlangan"
    : s === "rejected"
      ? "Rad etildi"
      : "Kutilmoqda";

async function buildTeacherPdf(id, scope = {}, req = null) {
  const t = await TeacherProfile.findOne({ _id: id, ...scope })
    .populate("user", "firstName lastName middleName email phone photo degrees")
    .populate("department", "title")
    .populate("faculty", "title")
    .populate("position", "title")
    .populate("hrApprovedBy", "firstName lastName")

    .exec();

  if (!t) {
    throw new ErrorHandler(
      404,
      "O'qituvchi profili topilmadi (yoki sizga tegishli emas)",
    );
  }

  const showPersonal = canSeePersonal(req, t);

  const doc = createDoc();
  const user = t.user || {};
  const fullName = [user.lastName, user.firstName, user.middleName]
    .filter(Boolean)
    .join(" ");

  drawHeader(doc);
  drawTitle(doc, "O'QITUVCHI ELEKTRON PROFILI", fullName || "—");

  const hrStatus = t.hrApprovalStatus || "pending";
  const bandY = doc.y;
  const BAND_H = 20;
  doc.rect(PAGE.margin, bandY, CONTENT_WIDTH, BAND_H).fill(hrColor(hrStatus));
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.white)
    .text(
      `Kadrlar bo'limi holati: ${hrLabel(hrStatus)}` +
        (t.hrApprovalDate
          ? `  |  ${new Date(t.hrApprovalDate).toLocaleDateString("uz-UZ")}`
          : ""),
      PAGE.margin + 6,
      bandY + 5,
      { width: CONTENT_WIDTH - 12, lineBreak: false },
    );
  doc.y = bandY + BAND_H;
  doc.moveDown(0.8);

  drawSectionTitle(doc, "Shaxsiy ma'lumotlar");
  drawInfoCard(
    doc,
    [
      ["F.I.Sh.", fullName, false],
      [
        "Tug'ilgan sana",
        t.birthDate ? new Date(t.birthDate).toLocaleDateString("uz-UZ") : null,
        true,
      ],
      [
        "Jinsi",
        t.gender === "male" ? "Erkak" : t.gender === "female" ? "Ayol" : null,
        false,
      ],
      ["JSHSHIR", t.jshshir, true],
      [
        "Pasport",
        t.passportSeries && t.passportNumber
          ? `${t.passportSeries} ${t.passportNumber}`
          : null,
        true,
      ],
      ["Pasport berilgan", t.passportIssuedBy, true],
      [
        "Berilgan sana",
        t.passportIssuedAt
          ? new Date(t.passportIssuedAt).toLocaleDateString("uz-UZ")
          : null,
        true,
      ],
      ["Telefon", t.contactInfo?.phone || user.phone, false],
      ["Email", t.contactInfo?.email || user.email, false],
      [
        "Manzil",
        [t.address?.region, t.address?.district, t.address?.street]
          .filter(Boolean)
          .join(", ") || null,
        true,
      ],
    ]
      .filter(([, v, personal]) => v && (!personal || showPersonal))
      .map(([label, value]) => [label, value]),
  );

  ensureSpace(doc, 60);
  drawSectionTitle(doc, "Ish ma'lumotlari");
  drawInfoCard(
    doc,
    [
      ["Fakultet", t.faculty?.title],
      ["Kafedra", t.department?.title],
      ["Lavozim", t.position?.title],
      ["Ish turi", t.employmentType],
      ["Ilmiy daraja", t.academicDegree],
      ["Ilmiy unvon", t.academicTitle],
      ["h-index", t.hIndex ? String(t.hIndex) : null],
      ["Google Scholar", t.googleScholarUrl],
      ["Scopus", t.scopusUrl],
      ["ORCID", t.orcidUrl],
    ].filter(([, v]) => v),
  );

  if (t.education?.length) {
    ensureSpace(doc, 60);
    drawSectionTitle(doc, "Ta'lim ma'lumotlari");
    drawTable(
      doc,
      [
        { header: "Daraja", key: "level", width: 1.2 },
        { header: "Muassasa", key: "inst", width: 3 },
        { header: "Mutaxassislik", key: "spec", width: 2 },
        { header: "Yil", key: "year", width: 0.6 },
        { header: "Diplom №", key: "dip", width: 1 },
      ],
      t.education.map((e) => ({
        level: e.level || "—",
        inst: e.institution || "—",
        spec: e.specialty || "—",
        year: e.graduationYear ? String(e.graduationYear) : "—",
        dip: e.diplomaNumber || "—",
      })),
      { rowFontSize: 7.5 },
    );
  }

  const DEGREE_LABELS = {
    bachelorDegree: "Bakalavr daraja",
    masterDegree: "Magistr daraja",
    scientificDegree: "Ilmiy daraja",
    scientificTitle: "Ilmiy unvon",
  };
  const degreeRows = Object.entries(DEGREE_LABELS).flatMap(([key, label]) =>
    (t.user?.degrees?.[key] || []).map((d) => ({
      type: label,
      name: d.title || "—",
    })),
  );
  if (degreeRows.length) {
    ensureSpace(doc, 60);
    drawSectionTitle(doc, "Ta'lim hujjatlari");
    drawTable(
      doc,
      [
        { header: "Toifa", key: "type", width: 2 },
        { header: "Hujjat nomi", key: "name", width: 5.8 },
      ],
      degreeRows,
      { rowFontSize: 7.5 },
    );
  }

  if (t.hrComment) {
    ensureSpace(doc, 50);
    drawSectionTitle(doc, "Kadrlar bo'limi izohi");
    drawParagraph(doc, t.hrComment);
  }

  ensureSpace(doc, 80);
  const colW = CONTENT_WIDTH / 2;
  const sigY = doc.y + 10;

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.primary)
    .text("O'qituvchi:", PAGE.margin, sigY, { width: colW - 10 });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(fullName || "___________________", PAGE.margin, doc.y, {
      width: colW - 10,
    });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text("(imzo)", PAGE.margin, doc.y, { width: colW - 10 });

  const hrPerson = t.hrApprovedBy;
  const hrName = hrPerson
    ? `${hrPerson.lastName || ""} ${hrPerson.firstName || ""}`.trim()
    : "___________________";
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.primary)
    .text("Kadrlar bo'limi boshlig'i:", PAGE.margin + colW, sigY, {
      width: colW - 10,
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(hrName, PAGE.margin + colW, sigY + 14, { width: colW - 10 });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text("(imzo)", PAGE.margin + colW, sigY + 26, { width: colW - 10 });

  doc.moveDown(3);

  drawFooter(doc, "O'qituvchi profili", hrStatus);
  doc.flushPages();
  return doc;
}

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

async function generateTeacherPdf(req, res, next) {
  try {
    const doc = await buildTeacherPdf(req.params.id, req.scope, req);
    pipeToResponse(res, doc, `teacher-profile-${req.params.id}`);
    doc.end();
  } catch (err) {
    return next(wrapErr(err, "Teacher PDF yaratishda xatolik"));
  }
}

module.exports = { generateTeacherPdf, buildTeacherPdf };
