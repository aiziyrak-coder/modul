const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { narrowTeacherFilter } = require("./personalWorkPlan.scope");
const ScienceModel = require("#references/science/science.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const { EDITABLE_SECTIONS } = require("./personalWorkPlan.validation");
const {
  completeActivityLock,
  countsAsCompleted,
} = require("./personalWorkPlan.completion");
const { pipeToResponse } = require("#shared/pdfGenerators/pdfHelpers");
const {
  buildMonitoringPdf,
  PLAN_STATUS_LABELS,
} = require("#modules/4.03-teacher/_pdf/personalWorkPlanMonitoring.pdf");
const {
  buildGroupedVisibilityFilter,
  andFilters,
} = require("#modules/4.03-teacher/_shared/workPlanChain");

const CONTENT_EDITABLE_STATUSES = ["draft", "rejected"];

const UPDATABLE_PLAN_FIELDS = ["name", "semester"];

const pickUpdatable = (body) =>
  Object.fromEntries(
    UPDATABLE_PLAN_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]),
  );

const isOwner = (plan, userId) =>
  Boolean(plan?.teacher) && plan.teacher.toString() === String(userId);

const contentLockError = (plan) =>
  CONTENT_EDITABLE_STATUSES.includes(plan.status)
    ? null
    : {
        message:
          `Bu holatdagi reja mazmunini o'zgartirib bo'lmaydi. Joriy: ${plan.status}. ` +
          `Faqat ${CONTENT_EDITABLE_STATUSES.join("/")} holatida mumkin.`,
      };
const approvalService = require("./personalWorkPlan.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const { blockHours, blockCounts } = require("./personalWorkPlan.teachingLoad");

const buildExcel = (title, rows) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SANFAK AIS";
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 2 }] });

  if (!rows.length) {
    ws.addRow([title]);
    ws.addRow(["Ma'lumot topilmadi"]);
    return wb;
  }

  const keys = Object.keys(rows[0]);
  ws.mergeCells(1, 1, 1, keys.length);
  ws.getRow(1).getCell(1).value = title;
  ws.getRow(1).getCell(1).font = { bold: true, size: 13 };
  ws.getRow(1).getCell(1).alignment = { horizontal: "center" };

  const header = ws.addRow(keys);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12B76A" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  ws.columns = keys.map((k) => ({ key: k, width: Math.max(k.length + 4, 12) }));
  rows.forEach((row) => ws.addRow(Object.values(row)));
  return wb;
};

const VERIFICATION_LABELS = {
  pending: "Yangi",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

const completedItemRow = (r, i) => ({
  "№": i + 1,
  "Vazifa nomi": r.title || "—",
  "F.I.SH": `${r.teacher?.lastName || ""} ${r.teacher?.firstName || ""} ${r.teacher?.middleName || ""}`.trim() || "—",
  "O'quv yili": r.academicYear?.title || "—",
  Sana: r.completedAt ? new Date(r.completedAt).toLocaleDateString("uz-UZ") : "—",
  Link: r.link || "—",
  Fayl: r.fileUrl || "—",
  Status: VERIFICATION_LABELS[r.status] || r.status || "—",
});

const monitoringRow = (r, i) => ({
  "№": i + 1,
  "F.I.SH": r.teacherName || "—",
  Kafedra: r.department?.title || "—",
  "O'quv yili": r.academicYear?.title || "—",
  "Reja holati": PLAN_STATUS_LABELS[r.submitStatus] || r.submitStatus || "—",
  Rejalangan: r.totalItems,
  Bajarilgan: r.completedItems,
  "Bajarilish %": r.completionPercent,
  Kechikkan: r.overdueCount,
});

function toCourseSemester(globalSemester) {
  const n = Number(globalSemester);
  if (!Number.isInteger(n) || n < 1) return 1;
  return ((n - 1) % 2) + 1;
}

async function buildTeachingLoad(teacherId, academicYear) {
  const distributions = await WorkloadDistribution.find(
    {
      academicYear,
      active: true,
      teachers: {
        $elemMatch: {
          teacher: teacherId,
          acceptanceStatus: "accepted",
          isVacant: false,
        },
      },
    },
    { teachers: 1, _id: 1 },
  );

  const sciences = [];
  let plannedHour = 0;

  for (const dist of distributions) {
    for (const entry of dist.teachers || []) {
      if (
        entry.teacher?.toString() !== teacherId.toString() ||
        entry.acceptanceStatus !== "accepted" ||
        entry.isVacant
      )
        continue;

      for (const block of entry.blocks || []) {
        const sw = block.studyWork || {};
        const blockTotal = block.totalHour || 0;
        const hoursByType = blockHours(block);
        const { streamCount, groupCount } = blockCounts(block);

        plannedHour += blockTotal;

        sciences.push({
          science: block.science || null,
          scienceName: block.practiceTitle || null,
          course: block.course || 0,
          semester: toCourseSemester(sw.semester),
          hoursByType,
          totalHour: blockTotal,
          stavka: entry.stavka || 1.0,
          streamCount,
          groupCount,
          blockId: block._id || null,
          distributionId: dist._id,
          teacherEntryId: entry._id,
        });
      }
    }
  }

  const missingIds = [
    ...new Set(
      sciences
        .filter((x) => !x.scienceName && x.science)
        .map((x) => String(x.science)),
    ),
  ];

  if (missingIds.length > 0) {
    const docs = await ScienceModel.find({ _id: { $in: missingIds } })
      .select("title")
      .lean();
    const titleById = new Map(docs.map((d) => [String(d._id), d.title]));

    for (const item of sciences) {
      if (!item.scienceName && item.science) {
        item.scienceName = titleById.get(String(item.science)) || null;
      }
    }
  }

  return { plannedHour, sciences };
}

function summarizeSections(plan) {
  let totalItems = 0;
  let completedItems = 0;
  let overdueCount = 0;

  for (const section of EDITABLE_SECTIONS) {
    const items = plan[section] || [];
    totalItems += items.length;
    for (const item of items) {
      if (countsAsCompleted(item)) completedItems += 1;
      if (item.effectiveStatus === "overdue") overdueCount += 1;
    }
  }

  const completionPercent =
    totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  return { totalItems, completedItems, overdueCount, completionPercent };
}

async function buildMonitoringRows(scope, query = {}) {
  const { teacher, academicYear, status } = query;
  const filter = { active: true, ...narrowTeacherFilter(scope, teacher) };
  if (academicYear) filter.academicYear = academicYear;
  if (status) filter.status = status;

  const plans = await PersonalWorkPlanModel.find(filter, {
    createdAt: 0,
    updatedAt: 0,
  })
    .populate({
      path: "teacher",
      select: "firstName lastName division department",
      populate: { path: "department", select: "title" },
    })
    .populate("academicYear", "title")
    .exec();

  return plans.map((p) => {
    const { totalItems, completedItems, overdueCount, completionPercent } =
      summarizeSections(p);

    return {
      planId: p._id,
      teacherId: p.teacher?._id,
      teacherName:
        `${p.teacher?.lastName || ""} ${p.teacher?.firstName || ""}`.trim(),
      academicYear: p.academicYear,
      department: p.teacher?.department
        ? { _id: p.teacher.department._id, title: p.teacher.department.title }
        : null,
      totalResearch: (p.researchWork || []).length,
      completedResearch: (p.researchWork || []).filter(
        (i) => i.status === "completed",
      ).length,
      totalMentoring: (p.mentoringWork || []).length,
      completedMentoring: (p.mentoringWork || []).filter(
        (i) => i.status === "completed",
      ).length,
      totalOrg: (p.organizationalWork || []).length,
      completedOrg: (p.organizationalWork || []).filter(
        (i) => i.status === "completed",
      ).length,
      submitStatus: p.status,
      overdueCount,
      totalItems,
      completedItems,
      completionPercent,
    };
  });
}

module.exports = {
  addWorkPlan: async (req, res, next) => {
    try {
      const { teacher: _t, ...planData } = req.body;
      const teacherId = req.user._id;

      const exists = await PersonalWorkPlanModel.findOne(
        {
          teacher: teacherId,
          academicYear: req.body.academicYear,
          active: true,
        },
        { _id: 1 },
      );

      if (exists) {
        return res.status(409).json({
          message: "Bu o'quv yili uchun ish reja allaqachon mavjud",
          _id: exists._id,
        });
      }

      const doc = await new PersonalWorkPlanModel({
        ...planData,
        teacher: teacherId,
        status: "draft",
      }).save();

      return res
        .status(201)
        .json({ message: "Ish reja yaratildi", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ish reja yaratishda xatolik", err.message),
      );
    }
  },

  generateFromWorkload: async (req, res, next) => {
    try {
      const teacher = req.user._id;
      const { academicYear, name } = req.body;
      if (!academicYear) {
        return res.status(400).json({ message: "academicYear majburiy" });
      }

      let plan = await PersonalWorkPlanModel.findOne({
        teacher,
        academicYear,
        active: true,
      });

      if (plan && !CONTENT_EDITABLE_STATUSES.includes(plan.status)) {
        return res.status(400).json({
          message: "Ish rejani faqat qoralama yoki rad etilgan holatda qayta shakllantirish mumkin",
        });
      }

      const { plannedHour, sciences } = await buildTeachingLoad(
        teacher,
        academicYear,
      );

      if (sciences.length === 0) {
        const ayDoc = await AcademicYearModel.findById(academicYear)
          .select("title")
          .lean();
        const ayLabel = ayDoc?.title ? `${ayDoc.title} o'quv yili` : "Tanlangan o'quv yili";
        return res.status(404).json({
          message: `${ayLabel} uchun qabul qilingan yuklama topilmadi`,
        });
      }

      if (plan) {
        plan.teachingLoad = {
          autoGenerated: true,
          generatedAt: new Date(),
          plannedHour,
          completedHour: plan.teachingLoad?.completedHour || 0,
          sciences,
        };
        await plan.save();
        return res.status(200).json({
          message: "O'quv yuklamasi yangilandi",
          _id: plan._id,
          plannedHour,
          scienceCount: sciences.length,
        });
      } else {
        plan = await new PersonalWorkPlanModel({
          teacher,
          academicYear,
          name: name || null,
          teachingLoad: {
            autoGenerated: true,
            generatedAt: new Date(),
            plannedHour,
            completedHour: 0,
            sciences,
          },
          status: "draft",
        }).save();
        return res.status(201).json({
          message: "Shaxsiy ish reja avtomatik yaratildi",
          _id: plan._id,
          plannedHour,
          scienceCount: sciences.length,
        });
      }
    } catch (err) {
      return next(
        new ErrorHandler(400, "Avtomatik yaratishda xatolik", err.message),
      );
    }
  },

  findAllWorkPlans: async (req, res, next) => {
    try {
      const { teacher, academicYear, status, active = true } = req.query;
      const filter = andFilters(
        narrowTeacherFilter(req.scope, teacher),
        buildGroupedVisibilityFilter(req.user?.role?.title),
      );
      if (active !== undefined)
        filter.active = active === "false" ? false : true;
      if (academicYear) filter.academicYear = academicYear;
      if (status) filter.status = status;

      const docs = await PersonalWorkPlanModel.find(filter, {
        updatedAt: 0,
      })
        .populate("teacher", "firstName lastName middleName")
        .populate("approvedBy", "firstName lastName")
        .populate("teachingLoad.sciences.science", "title scienceCode")
        .populate("academicYear", "title")
        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ish rejalarni olishda xatolik", err.message),
      );
    }
  },

  paginateWorkPlans: async (req, res, next) => {
    try {
      const { teacher, academicYear, status, page = 1, limit = 20 } = req.query;
      const filter = andFilters(
        { active: true },
        narrowTeacherFilter(req.scope, teacher),
        buildGroupedVisibilityFilter(req.user?.role?.title),
      );
      if (academicYear) filter.academicYear = academicYear;
      if (status) filter.status = status;

      const doc = await PersonalWorkPlanModel.paginate(filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        select:
          "-updatedAt -teachingLoad.sciences -researchWork -mentoringWork -organizationalWork -extraWork",
        populate: [
          { path: "teacher", select: "firstName lastName middleName" },
          { path: "approvedBy", select: "firstName lastName" },
          { path: "academicYear", select: "title" },
        ],
        lean: true,
        leanWithVirtuals: true,
      });

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xatolik", err.message));
    }
  },

  findOneWorkPlan: async (req, res, next) => {
    try {
      const doc = await PersonalWorkPlanModel.findOne(
        andFilters(
          { _id: req.params.id },
          req.scope,
          buildGroupedVisibilityFilter(req.user?.role?.title),
        ),
        { createdAt: 0, updatedAt: 0 },
      )
        .populate("teacher", "firstName lastName middleName")
        .populate("approvedBy", "firstName lastName")
        .populate("approvals.approvedBy", "firstName lastName")
        .populate("teachingLoad.sciences.science", "title scienceCode")
        .populate("academicYear", "title")
        .exec();

      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ish rejani olishda xatolik", err.message),
      );
    }
  },

  updateWorkPlan: async (req, res, next) => {
    try {
      const existing = await PersonalWorkPlanModel.findOne(
        { _id: req.params.id, ...req.scope },
        { status: 1, teacher: 1 },
      );
      if (!existing) return res.status(404).json({ message: "Topilmadi" });
      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(existing, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }
      if (existing.status !== "draft") {
        return res.status(400).json({
          message: `Faqat 'draft' ish rejasini tahrirlash mumkin. Joriy: ${existing.status}`,
        });
      }

      await PersonalWorkPlanModel.findOneAndUpdate(
        { _id: req.params.id, ...req.scope, status: "draft" },
        { $set: pickUpdatable(req.body) },
        { new: true, runValidators: true },
      );
      return res.status(200).json({ message: "Ish reja yangilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  deleteWorkPlan: async (req, res, next) => {
    try {
      const DELETABLE = ["draft", "rejected"];
      const existing = await PersonalWorkPlanModel.findOne(
        { _id: req.params.id, ...req.scope },
        "status teacher",
      ).lean();
      if (!existing) return res.status(404).json({ message: "Topilmadi" });
      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(existing, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }
      if (!DELETABLE.includes(existing.status)) {
        return res.status(400).json({
          message:
            `Faqat 'draft' yoki 'rejected' ish rejasini o'chirish mumkin. ` +
            `Joriy: ${existing.status}`,
        });
      }

      const doc = await PersonalWorkPlanModel.findOneAndDelete({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res
        .status(200)
        .json({ message: "Ish reja o'chirildi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },

  submitWorkPlan: async (req, res, next) => {
    try {
      const { plan } = await approvalService.submit(
        req.params.id,
        req.user,
        req.scope,
      );
      return res.status(200).json({
        message: "Ish reja ko'rib chiqish uchun yuborildi",
        status: plan.status,
        approvals: plan.approvals,
      });
    } catch (err) {
      return next(wrapErr(err, "Yuborishda xatolik"));
    }
  },

  approveWorkPlan: async (req, res, next) => {
    try {
      const { plan, entry } = await approvalService.approve(
        req.params.id,
        req.user,
        req.scope,
        req.body,
      );
      return res.status(200).json({
        message: `"${entry.label || entry.step}" bosqichi tasdiqlandi`,
        approvedStep: entry.step,
        status: plan.status,
        approvals: plan.approvals,
      });
    } catch (err) {
      return next(wrapErr(err, "Tasdiqlashda xatolik"));
    }
  },

  rejectWorkPlan: async (req, res, next) => {
    try {
      const { plan, entry } = await approvalService.reject(
        req.params.id,
        req.user,
        req.scope,
        req.body,
      );
      return res.status(200).json({
        message: `"${entry.label || entry.step}" bosqichi rad etildi`,
        rejectedStep: entry.step,
        status: plan.status,
        approvals: plan.approvals,
      });
    } catch (err) {
      return next(wrapErr(err, "Rad etishda xatolik"));
    }
  },

  completeWorkPlan: async (req, res, next) => {
    try {
      const { plan } = await approvalService.complete(
        req.params.id,
        req.user,
        req.scope,
      );
      return res.status(200).json({
        message: "Ish reja yakunlandi (bajarilgan)",
        status: plan.status,
        approvals: plan.approvals,
      });
    } catch (err) {
      return next(wrapErr(err, "Yakunlashda xatolik"));
    }
  },

  addActivity: async (req, res, next) => {
    try {
      const { section, item } = req.body;
      if (!EDITABLE_SECTIONS.includes(section)) {
        return res
          .status(400)
          .json({ message: `Bo'lim noto'g'ri: ${section}` });
      }
      const plan = await PersonalWorkPlanModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!plan) return res.status(404).json({ message: "Topilmadi" });
      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(plan, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }
      const lock = contentLockError(plan);
      if (lock) return res.status(400).json(lock);
      plan[section].push(item);
      await plan.save();
      return res.status(200).json({ message: "Faoliyat qo'shildi", plan });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Faoliyat qo'shishda xatolik", err.message),
      );
    }
  },

  updateActivity: async (req, res, next) => {
    try {
      const { section, ...fields } = req.body;
      if (!EDITABLE_SECTIONS.includes(section)) {
        return res
          .status(400)
          .json({ message: `Bo'lim noto'g'ri: ${section}` });
      }
      const plan = await PersonalWorkPlanModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!plan) return res.status(404).json({ message: "Topilmadi" });
      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(plan, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }
      const lock = contentLockError(plan);
      if (lock) return res.status(400).json(lock);
      const item = plan[section].id(req.params.activityId);
      if (!item) return res.status(404).json({ message: "Faoliyat topilmadi" });
      Object.assign(item, fields);
      await plan.save();
      return res.status(200).json({ message: "Faoliyat yangilandi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Faoliyat yangilashda xatolik", err.message),
      );
    }
  },

  deleteActivity: async (req, res, next) => {
    try {
      const { section } = req.body;
      if (!EDITABLE_SECTIONS.includes(section)) {
        return res
          .status(400)
          .json({ message: `Bo'lim noto'g'ri: ${section}` });
      }
      const plan = await PersonalWorkPlanModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!plan) return res.status(404).json({ message: "Topilmadi" });
      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(plan, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }
      const lock = contentLockError(plan);
      if (lock) return res.status(400).json(lock);
      plan[section].pull({ _id: req.params.activityId });
      await plan.save();
      return res.status(200).json({ message: "Faoliyat o'chirildi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Faoliyat o'chirishda xatolik", err.message),
      );
    }
  },

  completeActivity: async (req, res, next) => {
    try {
      const { section, fileUrl, link, actualCount } = req.body;
      if (!EDITABLE_SECTIONS.includes(section)) {
        return res
          .status(400)
          .json({ message: `Bo'lim noto'g'ri: ${section}` });
      }
      const plan = await PersonalWorkPlanModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!plan) return res.status(404).json({ message: "Topilmadi" });
      if (
        req.user?.role?.title === ROLES.OQITUVCHI &&
        !isOwner(plan, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }
      const item = plan[section].id(req.params.activityId);
      if (!item) return res.status(404).json({ message: "Faoliyat topilmadi" });
      const lock = completeActivityLock(plan, item);
      if (lock) return res.status(400).json({ message: lock });
      item.status = "completed";
      item.completedAt = new Date();
      if (fileUrl) item.fileUrl = fileUrl;
      if (link) item.link = link;
      item.actualCount =
        actualCount !== undefined ? actualCount : item.plannedCount || 0;
      item.verification = {
        status: "pending",
        reviewedBy: null,
        date: null,
        comment: null,
      };
      await plan.save();
      return res
        .status(200)
        .json({ message: "Faoliyat bajarildi deb belgilandi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Faoliyat bajarishda xatolik", err.message),
      );
    }
  },

  getMonitoring: async (req, res, next) => {
    try {
      let rows = await buildMonitoringRows(req.scope, req.query);

      const { search, page = 1, limit = 20 } = req.query;
      if (search) {
        const needle = String(search).trim().toLowerCase();
        rows = rows.filter((r) =>
          (r.teacherName || "").toLowerCase().includes(needle),
        );
      }

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const start = (pageNum - 1) * limitNum;

      return res.status(200).json({
        docs: rows.slice(start, start + limitNum),
        totalDocs: rows.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(rows.length / limitNum)),
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Monitoring olishda xatolik", err.message),
      );
    }
  },

  monitoringExport: async (req, res, next) => {
    try {
      const { format = "excel", academicYear } = req.query;
      const rows = await buildMonitoringRows(req.scope, req.query);

      if (format === "pdf") {
        let academicYearTitle = null;
        if (academicYear) {
          const ayDoc = await AcademicYearModel.findById(academicYear)
            .select("title")
            .lean();
          academicYearTitle = ayDoc?.title || null;
        }
        const doc = buildMonitoringPdf(rows, {
          departmentTitle: req.user?.department?.title || null,
          academicYearTitle,
        });
        pipeToResponse(res, doc, "monitoring-hisobot");
        doc.end();
        return;
      }

      const wb = buildExcel(
        "Monitoring va nazorat hisoboti",
        rows.map(monitoringRow),
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="monitoring-hisobot.xlsx"',
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(wrapErr(err, "Monitoring eksportida xatolik"));
    }
  },

  reopenWorkPlan: async (req, res, next) => {
    try {
      const { plan } = await approvalService.reopen(
        req.params.id,
        req.user,
        req.scope,
      );
      return res.status(200).json({
        message: "Ish reja qayta tahrirlash uchun ochildi",
        status: plan.status,
        approvals: plan.approvals,
      });
    } catch (err) {
      return next(wrapErr(err, "Qayta ochishda xatolik"));
    }
  },

  completedItems: async (req, res, next) => {
    try {
      const doc = await approvalService.paginateCompletedItems(
        req.scope,
        req.query,
        req.user,
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        wrapErr(err, "Bajarilgan ish elementlarini olishda xatolik"),
      );
    }
  },

  completedItemsExport: async (req, res, next) => {
    try {
      const rows = await approvalService.completedItemsRows(
        req.scope,
        req.query,
        req.user,
      );
      const wb = buildExcel(
        "Bajarilgan ish rejalar",
        rows.map(completedItemRow),
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="completed-work-items.xlsx"',
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(wrapErr(err, "Eksport qilishda xatolik"));
    }
  },

  verifyActivity: async (req, res, next) => {
    try {
      const { item } = await approvalService.verifyActivity(
        req.params.id,
        req.params.activityId,
        req.user,
        req.scope,
        req.body,
      );
      return res.status(200).json({
        message:
          item.verification.status === "approved"
            ? "Ish elementi tasdiqlandi"
            : "Ish elementi sabab bilan qaytarildi",
        data: {
          itemId: item._id,
          status: item.verification.status,
          comment: item.verification.comment,
        },
      });
    } catch (err) {
      return next(wrapErr(err, "Tekshirishda xatolik"));
    }
  },

  summarizeSections,
};
