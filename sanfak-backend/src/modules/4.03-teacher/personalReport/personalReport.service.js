const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");
const PersonalReportModel = require("./personalReport.model");
const { narrowTeacherFilter } = require("./personalReport.scope");
const {
  withReportVisibility,
  REPORT_CHAIN_ROLES,
} = require("./personalReport.visibility");
const PersonalWorkPlanModel = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const {
  safeDispatch,
  safeDispatchMany,
  getRecipients,
  describeOwner,
} = require("#modules/4.03-teacher/_shared/chainNotify");

const ROLE_STEP = {
  [ROLES.DEKAN]: "dekan",
  [ROLES.FAKULTET_KENGASH_KOTIBI]: "kotib",
};

const VERIFIER_ROLES = REPORT_CHAIN_ROLES;

const isSuperAdmin = (user) => user?.role?.title === ROLES.SUPER_ADMIN;

async function findScoped(id, scope) {
  const report = await PersonalReportModel.findOne({ _id: id, ...scope });
  if (!report) throw new ErrorHandler(404, "Topilmadi");
  return report;
}

function resolveStepForUser(user, body) {
  if (isSuperAdmin(user)) {
    const requested = body?.step;
    if (!requested || !["dekan", "kotib"].includes(requested)) {
      throw new ErrorHandler(
        400,
        "super_admin uchun tasdiqlanayotgan bosqich (`step`) ko'rsatilishi kerak",
      );
    }
    return requested;
  }
  const step = ROLE_STEP[user?.role?.title];
  if (!step) {
    throw new ErrorHandler(403, "Bu rolga hisobotni tasdiqlash huquqi berilmagan");
  }
  return step;
}

function buildFilter(scope, query = {}, user) {
  const filter = { active: true, ...narrowTeacherFilter(scope, query.teacher) };
  if (query.plan) filter.plan = query.plan;
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.semester) filter.semester = Number(query.semester);
  if (query.status) filter.status = query.status;
  return withReportVisibility(filter, user);
}

const POPULATE = [
  { path: "teacher", select: "firstName lastName middleName" },
  { path: "academicYear", select: "title" },
  { path: "approvals.approvedBy", select: "firstName lastName" },
];

const REPORTS_LINK = "/teacher/work-plans/reports";

async function notifyReportSubmitted(report) {
  try {
    const userIds = await getRecipients({
      roleTitles: [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI],
      level: "faculty",
      ownerId: report.teacher,
    });
    if (userIds.length === 0) return;
    const owner = await describeOwner(report.teacher, report.academicYear);
    await safeDispatchMany(userIds, {
      eventType: "personalReport_submitted",
      title: "Hisobot: tasdiqlash uchun keldi",
      body: `${owner ? `${owner}. ` : ""}${report.semester}-semestr hisoboti.`,
      link: REPORTS_LINK,
      metadata: { reportId: report._id, planId: report.plan },
    });
  } catch (err) {
    winston.warn(
      `[personalReport] personalReport_submitted bildirishnoma xato: ${err.message}`,
    );
  }
}

async function notifyReportResult(report, eventType, title, body) {
  try {
    await safeDispatch({
      userId: report.teacher,
      eventType,
      title,
      body,
      link: `/teacher/work-plans/${report.plan}`,
      metadata: { reportId: report._id, planId: report.plan },
    });
  } catch (err) {
    winston.warn(
      `[personalReport] ${eventType} bildirishnoma xato: ${err.message}`,
    );
  }
}

module.exports = {
  ROLE_STEP,
  VERIFIER_ROLES,
  resolveStepForUser,
  buildFilter,

  create: async (body, user) => {
    const plan = await PersonalWorkPlanModel.findById(body.plan, "teacher")
      .lean()
      .exec();
    if (!plan) {
      throw new ErrorHandler(404, "Ish reja topilmadi");
    }
    if (String(plan.teacher) !== String(user._id)) {
      throw new ErrorHandler(
        403,
        "Hisobotni faqat o'z ish rejangizga biriktirishingiz mumkin",
      );
    }
    const duplicate = await PersonalReportModel.exists({
      plan: body.plan,
      semester: body.semester,
      active: { $ne: false },
    });
    if (duplicate) {
      throw new ErrorHandler(
        409,
        `Bu ish reja uchun ${body.semester}-semestr hisoboti allaqachon mavjud — ` +
          "mavjud hisobotni tahrirlang",
      );
    }
    return new PersonalReportModel({
      ...body,
      teacher: user._id,
      status: "draft",
    }).save();
  },

  submit: async (id, user, scope) => {
    const report = await findScoped(id, scope);
    if (report.status !== "draft") {
      throw new ErrorHandler(
        400,
        `Faqat 'draft' hisobotni yuborish mumkin. Joriy: ${report.status}`,
      );
    }
    const role = user?.role?.title;
    if (!isSuperAdmin(user) && role !== ROLES.OQITUVCHI) {
      throw new ErrorHandler(
        403,
        "Faqat hisobot egasi (o'qituvchi) uni yuborishi mumkin",
      );
    }
    if (role === ROLES.OQITUVCHI && String(report.teacher) !== String(user._id)) {
      throw new ErrorHandler(403, "Faqat o'z hisobotingizni yuborishingiz mumkin");
    }
    report.status = "submitted";
    await report.save();
    await notifyReportSubmitted(report);
    return report;
  },

  findAll: (scope, query = {}, user) =>
    PersonalReportModel.find(buildFilter(scope, query, user))
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .lean()
      .exec(),

  paginate: (scope, query = {}, user) =>
    PersonalReportModel.paginate(buildFilter(scope, query, user), {
      page: parseInt(query.page),
      limit: parseInt(query.limit),
      sort: { createdAt: -1 },
      populate: POPULATE,
      lean: true,
    }),

  exportRows: (scope, query = {}, user) =>
    PersonalReportModel.find(buildFilter(scope, query, user))
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .lean()
      .exec(),

  findOne: (id, scope, user) =>
    PersonalReportModel.findOne(withReportVisibility({ _id: id, ...scope }, user))
      .populate(POPULATE)
      .exec(),

  update: async (id, user, scope, body = {}) => {
    const report = await findScoped(id, scope);
    if (
      user?.role?.title === ROLES.OQITUVCHI &&
      String(report.teacher) !== String(user._id)
    ) {
      throw new ErrorHandler(403, "Bu hujjat sizga tegishli emas");
    }
    if (!["draft", "rejected"].includes(report.status)) {
      throw new ErrorHandler(
        400,
        `Faqat 'draft' yoki 'rejected' hisobotni tahrirlash mumkin. Joriy: ${report.status}`,
      );
    }

    const wasRejected = report.status === "rejected";
    ["semester", "text", "councilDecisionFile"].forEach((f) => {
      if (body[f] !== undefined) report[f] = body[f];
    });

    if (wasRejected) {
      report.approvals.forEach((s) => {
        s.status = "pending";
        s.approvedBy = null;
        s.date = null;
        s.comment = null;
        s.eriSignature = null;
        s.eriSerial = null;
        s.eriSignedAt = null;
      });
      report.status = "draft";
    }

    await report.save();
    return report;
  },

  remove: async (id, scope, user) => {
    const report = await findScoped(id, scope);
    if (
      user?.role?.title === ROLES.OQITUVCHI &&
      String(report.teacher) !== String(user._id)
    ) {
      throw new ErrorHandler(403, "Bu hujjat sizga tegishli emas");
    }
    if (!["draft", "rejected"].includes(report.status)) {
      throw new ErrorHandler(
        400,
        `Faqat 'draft' yoki 'rejected' hisobotni o'chirish mumkin. Joriy: ${report.status}`,
      );
    }
    await PersonalReportModel.deleteOne({ _id: report._id });
    return report;
  },

  approve: async (id, user, scope, body = {}) => {
    const role = user?.role?.title;
    if (!isSuperAdmin(user) && !VERIFIER_ROLES.includes(role)) {
      throw new ErrorHandler(403, "Bu rolga hisobotni tasdiqlash huquqi berilmagan");
    }
    const step = resolveStepForUser(user, body);

    const report = await findScoped(id, scope);
    if (report.status !== "submitted") {
      throw new ErrorHandler(
        400,
        `Faqat 'submitted' hisobotni tasdiqlash mumkin. Joriy: ${report.status}`,
      );
    }

    const entry = report.approvals.find((s) => s.step === step);
    if (!entry) {
      throw new ErrorHandler(500, `"${step}" bosqichi hisobotda topilmadi`);
    }
    if (entry.status !== "pending") {
      throw new ErrorHandler(
        400,
        `"${entry.label || step}" bosqichi allaqachon "${entry.status}"`,
      );
    }

    entry.status = "approved";
    entry.approvedBy = user?._id || null;
    entry.date = new Date();
    if (body.comment !== undefined) entry.comment = body.comment || null;
    if (body.eriSignature) {
      entry.eriSignature = body.eriSignature;
      entry.eriSerial = body.eriSerial || null;
      entry.eriSignedAt = new Date();
    }

    const allApproved = report.approvals.every((s) => s.status === "approved");
    report.status = allApproved ? "approved" : "submitted";

    await report.save();
    if (allApproved) {
      await notifyReportResult(
        report,
        "personalReport_approved",
        "Hisobot tasdiqlandi",
        `${report.semester}-semestr hisobotingiz dekan va kengash kotibi tomonidan tasdiqlandi.`,
      );
    }
    return { report, entry };
  },

  reject: async (id, user, scope, body = {}) => {
    const role = user?.role?.title;
    if (!isSuperAdmin(user) && !VERIFIER_ROLES.includes(role)) {
      throw new ErrorHandler(403, "Bu rolga hisobotni rad etish huquqi berilmagan");
    }
    const step = resolveStepForUser(user, body);

    const report = await findScoped(id, scope);
    if (report.status !== "submitted") {
      throw new ErrorHandler(
        400,
        `Faqat 'submitted' hisobotni rad etish mumkin. Joriy: ${report.status}`,
      );
    }

    const entry = report.approvals.find((s) => s.step === step);
    if (!entry) {
      throw new ErrorHandler(500, `"${step}" bosqichi hisobotda topilmadi`);
    }
    if (entry.status !== "pending") {
      throw new ErrorHandler(
        400,
        `"${entry.label || step}" bosqichi allaqachon "${entry.status}"`,
      );
    }

    entry.status = "rejected";
    entry.approvedBy = user?._id || null;
    entry.date = new Date();
    entry.comment = body.comment;

    report.status = "rejected";

    await report.save();
    await notifyReportResult(
      report,
      "personalReport_rejected",
      "Hisobot rad etildi",
      `Bosqich: ${entry.label || entry.step}. Sabab: ${body.comment}`,
    );
    return { report, entry };
  },
};
