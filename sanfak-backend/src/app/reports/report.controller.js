const ExcelJS = require("exceljs");
const PDFDoc = require("pdfkit");
const { ErrorHandler } = require("#shared/error");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const PersonalWorkPlan = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const ReportModel = require("./report.model");

async function sendExcel(res, workbook, filename) {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.xlsx"`,
  );
  await workbook.xlsx.write(res);
  res.end();
}

function sendPdf(res, filename, buildFn) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.pdf"`,
  );
  const doc = new PDFDoc({ margin: 40, size: "A4" });
  doc.pipe(res);
  buildFn(doc);
  doc.end();
}

function headerStyle(ws, row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1DB954" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function dataStyle(row, idx) {
  const bg = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE0E0E0" } },
      bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      left: { style: "thin", color: { argb: "FFE0E0E0" } },
      right: { style: "thin", color: { argb: "FFE0E0E0" } },
    };
  });
}

async function buildWorkloadReport(filter) {
  const docs = await WorkloadModel.find(filter, {
    directions: 0,
    meta: 0,
    createdAt: 0,
    updatedAt: 0,
  })
    .populate("department", "title")
    .populate("academicYear", "title");
  return docs.map((d, i) => ({
    "№": i + 1,
    Kafedra: d.department?.title || "—",
    "O'quv yili": d.academicYear?.title || "—",
    Sana: d.date || "—",
    Holat: d.status === "superseded" ? "O'z kuchini yo'qotgan (superseded)" : d.status || "draft",
    ID: d._id?.toString(),
  }));
}

async function buildDistributionReport(filter) {
  const live = {
    ...filter,
    active: { $ne: false },
    $and: [{ status: { $ne: "superseded" } }],
  };
  const docs = await WorkloadDistModel.find(live, {
    meta: 0,
    staffPositions: 0,
    createdAt: 0,
    updatedAt: 0,
  })
    .populate("department", "title")
    .populate("academicYear", "title")
    .populate("teachers.teacher", "firstName lastName middleName");
  const rows = [];
  let no = 1;
  for (const dist of docs) {
    for (const t of dist.teachers || []) {
      const name = t.isVacant
        ? "VAKANT"
        : t.teacher
          ? `${t.teacher.lastName || ""} ${t.teacher.firstName || ""} ${t.teacher.middleName || ""}`.trim()
          : "—";
      rows.push({
        "№": no++,
        Kafedra: dist.department?.title || "—",
        "O'quv yili": dist.academicYear?.title || "—",
        "O'qituvchi": name,
        Stavka: t.stavka ?? "—",
        Lavozim: t.position || "—",
        "Jami soat": t.totalHour ?? 0,
        "Qabul holati": t.acceptanceStatus || "pending",
        Vakant: t.isVacant ? "Ha" : "Yo'q",
        "Vakant sabab": t.vacancyReason || "—",
      });
    }
  }
  return rows;
}

async function buildTeachersReport(filter) {
  const docs = await TeacherProfile.find(filter, { createdAt: 0, updatedAt: 0 })
    .populate("user", "firstName lastName middleName")
    .populate("department", "title")
    .populate("faculty", "title")
    .populate("position", "title")
    .populate("hrApprovedBy", "firstName lastName");
  return docs.map((d, i) => {
    const u = d.user || {};
    return {
      "№": i + 1,
      "F.I.O":
        `${u.lastName || ""} ${u.firstName || ""} ${u.middleName || ""}`.trim() ||
        "—",
      Kafedra: d.department?.title || "—",
      Fakultet: d.faculty?.title || "—",
      Lavozim: d.position?.title || "—",
      "Ish turi": d.employmentType || "—",
      "Ilmiy daraja": d.academicDegree || "—",
      "Ilmiy unvon": d.academicTitle || "—",
      "HR holati": d.hrApprovalStatus || "pending",
      Tasdiqlagan: d.hrApprovedBy
        ? `${d.hrApprovedBy.lastName || ""} ${d.hrApprovedBy.firstName || ""}`.trim()
        : "—",
      "Tasdiqlash sanasi": d.hrApprovalDate
        ? new Date(d.hrApprovalDate).toLocaleDateString("uz-UZ")
        : "—",
    };
  });
}

async function buildWorkPlanReport(filter) {
  const docs = await PersonalWorkPlan.find(filter, {
    "teachingLoad.sciences": 0,
    researchWork: 0,
    mentoringWork: 0,
    organizationalWork: 0,
    extraWork: 0,
    createdAt: 0,
    updatedAt: 0,
  })
    .populate("teacher", "firstName lastName middleName")
    .populate("approvedBy", "firstName lastName");
  return docs.map((d, i) => {
    const t = d.teacher || {};
    return {
      "№": i + 1,
      "O'qituvchi":
        `${t.lastName || ""} ${t.firstName || ""} ${t.middleName || ""}`.trim() ||
        "—",
      "O'quv yili": d.academicYear || "—",
      "Rejalangan soat": d.teachingLoad?.plannedHour ?? 0,
      "Bajarilgan soat": d.teachingLoad?.completedHour ?? 0,
      Holat: d.status || "draft",
      Tasdiqlagan: d.approvedBy
        ? `${d.approvedBy.lastName || ""} ${d.approvedBy.firstName || ""}`.trim()
        : "—",
      "Tasdiqlash sanasi": d.approvalDate
        ? new Date(d.approvalDate).toLocaleDateString("uz-UZ")
        : "—",
    };
  });
}

function buildExcel(title, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SANFAK AIS";
  wb.created = new Date();

  const ws = wb.addWorksheet(title, {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  if (!rows.length) {
    ws.addRow(["Ma'lumot topilmadi"]);
    return wb;
  }

  const keys = Object.keys(rows[0]);

  ws.mergeCells(1, 1, 1, keys.length);
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { bold: true, size: 13 };
  titleRow.getCell(1).alignment = { horizontal: "center" };
  titleRow.height = 28;

  const headerRow = ws.addRow(keys);
  headerRow.height = 22;
  headerStyle(ws, headerRow);

  ws.columns = keys.map((k) => ({
    key: k,
    width: Math.max(k.length + 4, 14),
  }));

  rows.forEach((row, i) => {
    const r = ws.addRow(Object.values(row));
    r.height = 20;
    dataStyle(r, i);
  });

  return wb;
}

function buildPdfFn(title, rows) {
  return (doc) => {
    doc.fontSize(14).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(`Sana: ${new Date().toLocaleDateString("uz-UZ")}`, {
        align: "right",
      });
    doc.moveDown(0.5);

    if (!rows.length) {
      doc.fontSize(11).text("Ma'lumot topilmadi.");
      return;
    }

    const keys = Object.keys(rows[0]);
    const colW = Math.floor((doc.page.width - 80) / keys.length);

    let x = 40;
    let y = doc.y;
    doc.rect(40, y, doc.page.width - 80, 20).fill("#1DB954");
    keys.forEach((k) => {
      doc
        .fillColor("#ffffff")
        .fontSize(7)
        .font("Helvetica-Bold")
        .text(k, x + 2, y + 4, { width: colW - 4, ellipsis: true });
      x += colW;
    });
    doc.moveDown(1.5);

    rows.forEach((row, idx) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
      }
      x = 40;
      y = doc.y;
      const bg = idx % 2 === 0 ? "#F5F5F5" : "#FFFFFF";
      doc.rect(40, y, doc.page.width - 80, 16).fill(bg);
      Object.values(row).forEach((val) => {
        doc
          .fillColor("#333333")
          .fontSize(7)
          .font("Helvetica")
          .text(String(val ?? "—"), x + 2, y + 3, {
            width: colW - 4,
            ellipsis: true,
          });
        x += colW;
      });
      doc.moveDown(1.1);
    });

    doc
      .fontSize(8)
      .fillColor("#999999")
      .text(`Jami: ${rows.length} ta yozuv`, 40, doc.page.height - 40);
  };
}

exports.workloadReport = async (req, res, next) => {
  try {
    const { department, academicYear, status, format = "json" } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (academicYear) filter.academicYear = academicYear;
    if (status) filter.status = status;

    const rows = await buildWorkloadReport(filter);

    if (format === "excel") {
      const wb = buildExcel("O'quv yuklamalari hisoboti", rows);
      return await sendExcel(res, wb, "workloads-report");
    }
    if (format === "pdf") {
      return sendPdf(
        res,
        "workloads-report",
        buildPdfFn("O'quv yuklamalari hisoboti", rows),
      );
    }
    return res.status(200).json({ total: rows.length, data: rows });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Yuklama hisobotida xatolik", err.message),
    );
  }
};

exports.distributionReport = async (req, res, next) => {
  try {
    const { department, academicYear, status, format = "json" } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (academicYear) filter.academicYear = academicYear;
    if (status) filter.status = status;

    const rows = await buildDistributionReport(filter);

    if (format === "excel") {
      const wb = buildExcel("Taqsimot hisoboti", rows);
      return await sendExcel(res, wb, "distribution-report");
    }
    if (format === "pdf") {
      return sendPdf(
        res,
        "distribution-report",
        buildPdfFn("Taqsimot hisoboti", rows),
      );
    }
    return res.status(200).json({ total: rows.length, data: rows });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Taqsimot hisobotida xatolik", err.message),
    );
  }
};

exports.teachersReport = async (req, res, next) => {
  try {
    const {
      department,
      faculty,
      hrApprovalStatus,
      format = "json",
    } = req.query;
    const filter = { active: true };
    if (department) filter.department = department;
    if (faculty) filter.faculty = faculty;
    if (hrApprovalStatus) filter.hrApprovalStatus = hrApprovalStatus;

    const rows = await buildTeachersReport(filter);

    if (format === "excel") {
      const wb = buildExcel("O'qituvchilar profili hisoboti", rows);
      return await sendExcel(res, wb, "teachers-report");
    }
    if (format === "pdf") {
      return sendPdf(
        res,
        "teachers-report",
        buildPdfFn("O'qituvchilar profili hisoboti", rows),
      );
    }
    return res.status(200).json({ total: rows.length, data: rows });
  } catch (err) {
    return next(
      new ErrorHandler(400, "O'qituvchilar hisobotida xatolik", err.message),
    );
  }
};

exports.workPlanReport = async (req, res, next) => {
  try {
    const { teacher, academicYear, status, format = "json" } = req.query;
    const filter = { active: true };
    if (teacher) filter.teacher = teacher;
    if (academicYear) filter.academicYear = academicYear;
    if (status) filter.status = status;

    const rows = await buildWorkPlanReport(filter);

    if (format === "excel") {
      const wb = buildExcel("Shaxsiy ish reja hisoboti", rows);
      return await sendExcel(res, wb, "work-plans-report");
    }
    if (format === "pdf") {
      return sendPdf(
        res,
        "work-plans-report",
        buildPdfFn("Shaxsiy ish reja hisoboti", rows),
      );
    }
    return res.status(200).json({ total: rows.length, data: rows });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Ish reja hisobotida xatolik", err.message),
    );
  }
};

exports.summaryReport = async (req, res, next) => {
  try {
    const { academicYear } = req.query;
    const matchYear = academicYear ? { academicYear } : {};
    const notSuperseded = { ...matchYear, status: { $ne: "superseded" } };

    const [
      workloadsTotal,
      workloadsApproved,
      distributionsTotal,
      distributionsApproved,
      teachersTotal,
      teachersApproved,
      workPlansTotal,
      workPlansApproved,
    ] = await Promise.all([
      WorkloadModel.countDocuments(notSuperseded),
      WorkloadModel.countDocuments({ ...matchYear, status: "approved" }),
      WorkloadDistModel.countDocuments(notSuperseded),
      WorkloadDistModel.countDocuments({ ...matchYear, status: "approved" }),
      TeacherProfile.countDocuments({ active: true }),
      TeacherProfile.countDocuments({
        active: true,
        hrApprovalStatus: "approved",
      }),
      PersonalWorkPlan.countDocuments({ ...matchYear, active: true }),
      PersonalWorkPlan.countDocuments({
        ...matchYear,
        active: true,
        status: "approved",
      }),
    ]);

    return res.status(200).json({
      academicYear: academicYear || "Barcha yillar",
      workloads: { total: workloadsTotal, approved: workloadsApproved },
      distributions: {
        total: distributionsTotal,
        approved: distributionsApproved,
      },
      teachers: { total: teachersTotal, approved: teachersApproved },
      workPlans: { total: workPlansTotal, approved: workPlansApproved },
    });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Umumiy statistikada xatolik", err.message),
    );
  }
};

const REPORT_TITLES = {
  workload: "O'quv yuklamalari hisoboti",
  distribution: "Taqsimot hisoboti",
  teachers: "O'qituvchilar profili hisoboti",
  workPlan: "Shaxsiy ish reja hisoboti",
  summary: "Umumiy statistika hisoboti",
};

exports.createReport = async (req, res, next) => {
  try {
    const { type, academicYear, filters = {}, description } = req.body;

    if (!type || !REPORT_TITLES[type]) {
      return res.status(400).json({ message: "Noto'g'ri hisobot turi" });
    }

    const report = await ReportModel.create({
      type,
      title: REPORT_TITLES[type],
      academicYear,
      filters,
      description,
      createdBy: req.user?._id,
      status: "draft",
    });

    return res.status(201).json({ message: "Hisobot yaratildi", data: report });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobot yaratishda xatolik", err.message),
    );
  }
};

exports.listReports = async (req, res, next) => {
  try {
    const { type, status, academicYear, page = 1, limit = 20 } = req.query;
    const filter = { active: true };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (academicYear) filter.academicYear = academicYear;

    const result = await ReportModel.paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: "createdBy", select: "firstName lastName" },
        { path: "submittedBy", select: "firstName lastName" },
        { path: "approvedBy", select: "firstName lastName" },
        { path: "rejectedBy", select: "firstName lastName" },
      ],
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotlar ro'yxatida xatolik", err.message),
    );
  }
};

exports.getReport = async (req, res, next) => {
  try {
    const report = await ReportModel.findOne({
      _id: req.params.id,
      active: true,
    })
      .populate("createdBy", "firstName lastName")
      .populate("submittedBy", "firstName lastName")
      .populate("approvedBy", "firstName lastName")
      .populate("rejectedBy", "firstName lastName");
    if (!report) return res.status(404).json({ message: "Hisobot topilmadi" });
    return res.status(200).json({ data: report });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotni o'qishda xatolik", err.message),
    );
  }
};

exports.submitReport = async (req, res, next) => {
  try {
    const report = await ReportModel.findOne({
      _id: req.params.id,
      active: true,
    });
    if (!report) return res.status(404).json({ message: "Hisobot topilmadi" });

    if (report.status !== "draft") {
      return res.status(400).json({
        message: `Faqat "draft" holatidagi hisobotni yuborish mumkin (hozirgi holat: ${report.status})`,
      });
    }

    report.status = "submitted";
    report.submittedBy = req.user?._id;
    report.submittedAt = new Date();
    await report.save();

    return res
      .status(200)
      .json({ message: "Hisobot Dekanga yuborildi", data: report });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotni yuborishda xatolik", err.message),
    );
  }
};

exports.approveReport = async (req, res, next) => {
  try {
    const report = await ReportModel.findOne({
      _id: req.params.id,
      active: true,
    });
    if (!report) return res.status(404).json({ message: "Hisobot topilmadi" });

    if (report.status !== "submitted") {
      return res.status(400).json({
        message: `Faqat "submitted" holatidagi hisobotni tasdiqlash mumkin (hozirgi holat: ${report.status})`,
      });
    }

    report.status = "approved";
    report.approvedBy = req.user?._id;
    report.approvalDate = new Date();
    report.approvalComment = req.body.comment || null;

    report.rejectedBy = null;
    report.rejectionDate = null;
    report.rejectionComment = null;

    await report.save();
    return res
      .status(200)
      .json({ message: "Hisobot tasdiqlandi", data: report });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotni tasdiqlashda xatolik", err.message),
    );
  }
};

exports.rejectReport = async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res
        .status(400)
        .json({ message: "Rad etish uchun izoh (comment) majburiy" });
    }

    const report = await ReportModel.findOne({
      _id: req.params.id,
      active: true,
    });
    if (!report) return res.status(404).json({ message: "Hisobot topilmadi" });

    if (report.status !== "submitted") {
      return res.status(400).json({
        message: `Faqat "submitted" holatidagi hisobotni rad etish mumkin (hozirgi holat: ${report.status})`,
      });
    }

    report.status = "rejected";
    report.rejectedBy = req.user?._id;
    report.rejectionDate = new Date();
    report.rejectionComment = comment.trim();

    await report.save();
    return res
      .status(200)
      .json({ message: "Hisobot rad etildi", data: report });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotni rad etishda xatolik", err.message),
    );
  }
};

exports.reopenReport = async (req, res, next) => {
  try {
    const report = await ReportModel.findOne({
      _id: req.params.id,
      active: true,
    });
    if (!report) return res.status(404).json({ message: "Hisobot topilmadi" });

    if (report.status !== "rejected") {
      return res.status(400).json({
        message: `Faqat "rejected" holatidagi hisobotni qayta ochish mumkin (hozirgi holat: ${report.status})`,
      });
    }

    report.status = "draft";
    report.submittedBy = null;
    report.submittedAt = null;
    await report.save();

    return res
      .status(200)
      .json({
        message: "Hisobot qayta draft holatiga o'tkazildi",
        data: report,
      });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotni qayta ochishda xatolik", err.message),
    );
  }
};

exports.deleteReport = async (req, res, next) => {
  try {
    const report = await ReportModel.findOne({
      _id: req.params.id,
      active: true,
    });
    if (!report) return res.status(404).json({ message: "Hisobot topilmadi" });

    if (report.status === "approved") {
      return res
        .status(400)
        .json({ message: "Tasdiqlangan hisobotni o'chirish mumkin emas" });
    }

    report.active = false;
    await report.save();
    return res.status(200).json({ message: "Hisobot o'chirildi" });
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotni o'chirishda xatolik", err.message),
    );
  }
};

exports.downloadReport = async (req, res, next) => {
  try {
    const { format = "excel" } = req.query;
    const report = await ReportModel.findOne({
      _id: req.params.id,
      active: true,
    });
    if (!report) return res.status(404).json({ message: "Hisobot topilmadi" });

    if (report.status !== "approved") {
      return res.status(400).json({
        message: `Faqat tasdiqlangan hisobotni yuklab olish mumkin (hozirgi holat: ${report.status})`,
      });
    }

    const f = report.filters || {};
    const filter = {};
    if (f.department) filter.department = f.department;
    if (f.faculty) filter.faculty = f.faculty;
    if (f.status) filter.status = f.status;
    if (f.hrApprovalStatus) filter.hrApprovalStatus = f.hrApprovalStatus;
    if (f.teacher) filter.teacher = f.teacher;
    if (report.academicYear) filter.academicYear = report.academicYear;

    let rows = [];
    if (report.type === "workload") rows = await buildWorkloadReport(filter);
    else if (report.type === "distribution")
      rows = await buildDistributionReport(filter);
    else if (report.type === "teachers")
      rows = await buildTeachersReport({ active: true, ...filter });
    else if (report.type === "workPlan")
      rows = await buildWorkPlanReport({ active: true, ...filter });
    else {
      return res
        .status(200)
        .json({
          message:
            "Summary hisobotni JSON orqali ko'ring: GET /reports/summary",
        });
    }

    const title = report.title || REPORT_TITLES[report.type];

    if (format === "pdf") {
      return sendPdf(res, `${report.type}-report`, buildPdfFn(title, rows));
    }
    const wb = buildExcel(title, rows);
    return await sendExcel(res, wb, `${report.type}-report`);
  } catch (err) {
    return next(
      new ErrorHandler(400, "Hisobotni yuklab olishda xatolik", err.message),
    );
  }
};
