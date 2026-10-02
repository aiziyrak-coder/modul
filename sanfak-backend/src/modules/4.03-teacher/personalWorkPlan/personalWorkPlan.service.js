const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { ROLES, PAGINATION } = require("#config/constants");
const { escapeRegex } = require("#shared/searchFilter");
const { withTiebreaker } = require("#shared/paginate");
const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const { EDITABLE_SECTIONS, APPROVAL_STEP_KEYS } = require("./personalWorkPlan.validation");
const { completionBlockers } = require("./personalWorkPlan.completion");
const {
  ROLE_STEP,
  canApprove,
  nextGroupFor,
  buildGroupedVisibilityFilter,
  VISIBILITY_BYPASS,
  andFilters,
} = require("#modules/4.03-teacher/_shared/workPlanChain");
const {
  safeDispatch,
  safeDispatchMany,
  getRecipientsForSteps,
  describeOwner,
} = require("#modules/4.03-teacher/_shared/chainNotify");
const workPlanVerify = require("#modules/4.03-teacher/_verify/workPlanVerify.service");

const VERIFIER_ROLES = [ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM];

const isSuperAdmin = (user) => user?.role?.title === ROLES.SUPER_ADMIN;

const stepLabel = (plan, step) =>
  plan.approvals.find((s) => s.step === step)?.label || step;

async function saveSigned(plan, user) {
  await workPlanVerify.issueOrRefresh(plan, user && user._id);
  await plan.save();
}

async function saveRevoked(plan) {
  workPlanVerify.revoke(plan, "rejected");
  await plan.save();
}

async function findScoped(id, scope) {
  const plan = await PersonalWorkPlanModel.findOne({ _id: id, ...scope });
  if (!plan) throw new ErrorHandler(404, "Topilmadi");
  return plan;
}

function resolveStepForUser(user, body) {
  if (isSuperAdmin(user)) {
    const requested = body?.step;
    if (!requested || !APPROVAL_STEP_KEYS.includes(requested)) {
      throw new ErrorHandler(
        400,
        "super_admin uchun tasdiqlanayotgan bosqich (`step`) ko'rsatilishi kerak",
      );
    }
    return requested;
  }
  const step = ROLE_STEP[user?.role?.title];
  if (!step) {
    throw new ErrorHandler(
      403,
      "Bu rolga shaxsiy ish rejani tasdiqlash huquqi berilmagan",
    );
  }
  return step;
}

function markStepApproved(plan, step, user, body = {}) {
  const entry = plan.approvals.find((s) => s.step === step);
  if (!entry) {
    throw new ErrorHandler(500, `"${step}" bosqichi rejada topilmadi`);
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
  return entry;
}

function approveTeacherStep(plan, user, body) {
  const role = user?.role?.title;
  if (!isSuperAdmin(user) && role !== ROLES.OQITUVCHI) {
    throw new ErrorHandler(
      403,
      "Faqat o'qituvchi (rejaning egasi) 1-bosqichni tasdiqlashi mumkin",
    );
  }
  if (role === ROLES.OQITUVCHI && String(plan.teacher) !== String(user._id)) {
    throw new ErrorHandler(403, "Faqat o'z ish rejangizni tasdiqlashingiz mumkin");
  }
  const entry = markStepApproved(plan, "teacher", user, body);
  plan.status = "submitted";
  return entry;
}

function approveChainStep(plan, user, body) {
  const step = resolveStepForUser(user, body);
  if (step === "teacher") {
    throw new ErrorHandler(400, "1-bosqich allaqachon tasdiqlangan");
  }
  if (!isSuperAdmin(user) && !canApprove(plan, step)) {
    const next = nextGroupFor(plan);
    throw new ErrorHandler(
      409,
      `Navbat hali kelmagan: avval "${next?.label || "oldingi guruh"}" tasdiqlashi kerak`,
    );
  }
  const entry = markStepApproved(plan, step, user, body);

  const allDone = plan.approvals
    .filter((s) => s.step !== "teacher")
    .every((s) => s.status === "approved");
  if (allDone) {
    plan.status = "approved";
    plan.approvedBy = user?._id || null;
    plan.approvalDate = new Date();
  }
  return entry;
}

const INBOX_LINK = "/teacher/work-plans/inbox";
const planLink = (plan) => `/teacher/work-plans/${plan._id}`;

async function notifyGroupPending(plan, group, eventType, title) {
  if (!group) return;
  try {
    const userIds = await getRecipientsForSteps(group.steps, plan.teacher);
    if (userIds.length === 0) return;
    const owner = await describeOwner(plan.teacher, plan.academicYear);
    await safeDispatchMany(userIds, {
      eventType,
      title,
      body: `${owner ? `${owner}. ` : ""}Bosqich: ${group.label}`,
      link: INBOX_LINK,
      metadata: { planId: plan._id, group: group.key, steps: group.steps },
    });
  } catch (err) {
    winston.warn(
      `[personalWorkPlan] ${eventType} bildirishnoma xato: ${err.message}`,
    );
  }
}

async function notifyOwnerResult(plan, eventType, title, body, metadata = {}) {
  try {
    await safeDispatch({
      userId: plan.teacher,
      eventType,
      title,
      body,
      link: planLink(plan),
      metadata: { planId: plan._id, ...metadata },
    });
  } catch (err) {
    winston.warn(
      `[personalWorkPlan] ${eventType} bildirishnoma xato: ${err.message}`,
    );
  }
}

const notifySubmitted = (plan) =>
  notifyGroupPending(
    plan,
    nextGroupFor(plan),
    "personalWorkPlan_submitted",
    "Shaxsiy ish reja: tasdiqlash uchun keldi",
  );

async function submit(id, user, scope) {
  const plan = await findScoped(id, scope);
  if (plan.status !== "draft") {
    throw new ErrorHandler(
      400,
      `Faqat 'draft' ish rejasini yuborish mumkin. Joriy: ${plan.status}`,
    );
  }
  const entry = approveTeacherStep(plan, user, {});
  await saveSigned(plan, user);
  await notifySubmitted(plan);
  return { plan, entry };
}

async function approve(id, user, scope, body = {}) {
  const plan = await findScoped(id, scope);

  let entry;
  let wasDraft = false;
  let groupBefore = null;
  if (plan.status === "draft") {
    wasDraft = true;
    entry = approveTeacherStep(plan, user, body);
  } else if (plan.status === "submitted") {
    groupBefore = nextGroupFor(plan);
    entry = approveChainStep(plan, user, body);
  } else {
    throw new ErrorHandler(
      400,
      `Bu holatda tasdiqlab bo'lmaydi. Joriy: ${plan.status}`,
    );
  }
  await saveSigned(plan, user);

  if (wasDraft) {
    await notifySubmitted(plan);
  } else if (plan.status === "approved") {
    await notifyOwnerResult(
      plan,
      "personalWorkPlan_approved",
      "Shaxsiy ish reja tasdiqlandi",
      "Ish rejangiz barcha bosqichlardan o'tib tasdiqlandi.",
      { step: entry.step },
    );
  } else {
    const groupAfter = nextGroupFor(plan);
    if (groupAfter && groupAfter.key !== groupBefore?.key) {
      await notifyGroupPending(
        plan,
        groupAfter,
        "personalWorkPlan_stepPending",
        "Shaxsiy ish reja: sizning tasdiqingiz kutilmoqda",
      );
    }
  }
  return { plan, entry };
}

async function reject(id, user, scope, body = {}) {
  const plan = await findScoped(id, scope);
  if (plan.status !== "submitted") {
    throw new ErrorHandler(
      400,
      `Faqat 'submitted' ish rejasini rad etish mumkin. Joriy: ${plan.status}`,
    );
  }

  const step = resolveStepForUser(user, body);
  if (step === "teacher") {
    throw new ErrorHandler(400, "1-bosqich rad etilmaydi");
  }
  if (!canApprove(plan, step)) {
    const next = nextGroupFor(plan);
    throw new ErrorHandler(
      409,
      `Navbat hali kelmagan: avval "${next?.label || "oldingi guruh"}" tasdiqlashi kerak`,
    );
  }
  const entry = plan.approvals.find((s) => s.step === step);
  if (!entry) throw new ErrorHandler(500, `"${step}" bosqichi rejada topilmadi`);
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

  plan.status = "rejected";
  plan.approvedBy = user?._id || null;
  plan.approvalDate = new Date();
  plan.approvalComment = body.comment;

  await saveRevoked(plan);
  await notifyOwnerResult(
    plan,
    "personalWorkPlan_rejected",
    "Shaxsiy ish reja rad etildi",
    `Bosqich: ${entry.label || entry.step}. Sabab: ${body.comment}`,
    { step: entry.step },
  );
  return { plan, entry };
}

async function reopen(id, user, scope) {
  const plan = await findScoped(id, scope);
  if (
    user?.role?.title === ROLES.OQITUVCHI &&
    String(plan.teacher) !== String(user._id)
  ) {
    throw new ErrorHandler(403, "Bu hujjat sizga tegishli emas");
  }
  if (plan.status !== "rejected") {
    throw new ErrorHandler(
      400,
      `Faqat 'rejected' ish rejasini qayta ochish mumkin. Joriy: ${plan.status}`,
    );
  }

  plan.approvals.forEach((s) => {
    s.status = "pending";
    s.approvedBy = null;
    s.date = null;
    s.comment = null;
    s.eriSignature = null;
    s.eriSerial = null;
    s.eriSignedAt = null;
  });
  plan.status = "draft";
  plan.approvedBy = null;
  plan.approvalDate = null;
  plan.approvalComment = null;

  await plan.save();
  return { plan };
}

async function complete(id, user, scope) {
  const plan = await findScoped(id, scope);
  const role = user?.role?.title;
  if (!isSuperAdmin(user) && role !== ROLES.ICHKI_NAZORAT) {
    throw new ErrorHandler(
      403,
      "Faqat ichki nazorat va monitoring bo'limi ish rejani yakunlashi mumkin",
    );
  }
  if (plan.status !== "approved") {
    throw new ErrorHandler(
      400,
      `Faqat 'approved' ish rejasini yakunlash mumkin. Joriy: ${plan.status}`,
    );
  }

  const { notCompleted, notVerified } = completionBlockers(plan, EDITABLE_SECTIONS);
  if (notCompleted > 0) {
    throw new ErrorHandler(
      400,
      "Barcha rejalashtirilgan ishlar hali 'bajarilgan' deb belgilanmagan",
    );
  }
  if (notVerified > 0) {
    throw new ErrorHandler(
      400,
      `${notVerified} ta ish dalili hali tasdiqlanmagan (tekshiruvda yoki ` +
        "qaytarilgan) — avval kafedra mudiri tasdiqlashi kerak",
    );
  }

  plan.status = "completed";
  await plan.save();
  return { plan };
}

async function verifyActivity(id, activityId, user, scope, body = {}) {
  const role = user?.role?.title;
  if (!isSuperAdmin(user) && !VERIFIER_ROLES.includes(role)) {
    throw new ErrorHandler(
      403,
      "Bu rolga bajarilgan ish elementini tekshirish huquqi berilmagan",
    );
  }

  const { section, decision, comment } = body;
  const plan = await findScoped(id, scope);

  const item = plan[section]?.id(activityId);
  if (!item) throw new ErrorHandler(404, "Faoliyat topilmadi");

  if (item.status !== "completed") {
    throw new ErrorHandler(
      400,
      "Faqat 'bajarilgan' deb belgilangan elementni tekshirish mumkin",
    );
  }
  if (item.verification?.status !== "pending") {
    throw new ErrorHandler(
      400,
      `Bu element allaqachon "${item.verification?.status}"`,
    );
  }

  item.verification.status = decision;
  item.verification.reviewedBy = user?._id || null;
  item.verification.date = new Date();
  item.verification.comment = decision === "rejected" ? comment : null;

  await plan.save();
  return { plan, item };
}

const COMPLETED_SECTIONS = EDITABLE_SECTIONS;

function completedItemsPipeline(scope, query = {}, user = {}) {
  const role = user?.role?.title;
  const userId = user?._id;

  const chainFilter = VERIFIER_ROLES.includes(role)
    ? {}
    : buildGroupedVisibilityFilter(role);
  const match = andFilters(scope, chainFilter);
  match.active = true;

  if (!VISIBILITY_BYPASS.includes(role)) {
    match.$or = [
      { status: { $ne: "draft" } },
      { teacher: userId ? new mongoose.Types.ObjectId(String(userId)) : null },
    ];
  }

  if (query.academicYear) {
    match.academicYear = new mongoose.Types.ObjectId(String(query.academicYear));
  }

  const sections =
    query.section && COMPLETED_SECTIONS.includes(query.section)
      ? [query.section]
      : COMPLETED_SECTIONS;

  const pipeline = [
    { $match: match },
    {
      $project: {
        teacher: 1,
        academicYear: 1,
        items: {
          $concatArrays: sections.map((section) => ({
            $map: {
              input: { $ifNull: [`$${section}`, []] },
              as: "it",
              in: { $mergeObjects: ["$$it", { section }] },
            },
          })),
        },
      },
    },
    { $unwind: "$items" },
    { $match: { "items.status": "completed" } },
  ];

  if (query.verificationStatus) {
    pipeline.push({
      $match: { "items.verification.status": query.verificationStatus },
    });
  }

  pipeline.push(
    { $lookup: { from: "users", localField: "teacher", foreignField: "_id", as: "teacherDoc" } },
    { $unwind: { path: "$teacherDoc", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "academicyears", localField: "academicYear", foreignField: "_id", as: "yearDoc" } },
    { $unwind: { path: "$yearDoc", preserveNullAndEmptyArrays: true } },
  );

  if (query.search) {
    const safe = escapeRegex(query.search.trim());
    if (safe) {
      pipeline.push({
        $match: {
          $or: [
            { "items.title": { $regex: safe, $options: "i" } },
            { "teacherDoc.firstName": { $regex: safe, $options: "i" } },
            { "teacherDoc.lastName": { $regex: safe, $options: "i" } },
          ],
        },
      });
    }
  }

  pipeline.push({
    $project: {
      _id: 0,
      planId: "$_id",
      section: "$items.section",
      itemId: "$items._id",
      title: "$items.title",
      teacher: {
        _id: "$teacherDoc._id",
        firstName: "$teacherDoc.firstName",
        lastName: "$teacherDoc.lastName",
        middleName: "$teacherDoc.middleName",
      },
      academicYear: { _id: "$yearDoc._id", title: "$yearDoc.title" },
      completedAt: "$items.completedAt",
      link: "$items.link",
      fileUrl: "$items.fileUrl",
      status: { $ifNull: ["$items.verification.status", null] },
      verificationComment: { $ifNull: ["$items.verification.comment", null] },
    },
  });

  return pipeline;
}

function paginateCompletedItems(scope, query = {}, user = {}) {
  const pipeline = completedItemsPipeline(scope, query, user);
  return PersonalWorkPlanModel.aggregatePaginate(
    PersonalWorkPlanModel.aggregate(pipeline),
    {
      useFacet: false,
      page: parseInt(query.page) || PAGINATION.DEFAULT_PAGE,
      limit: Math.min(
        parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT,
        PAGINATION.MAX_LIMIT,
      ),
      sort: withTiebreaker({ completedAt: -1 }, "itemId"),
    },
  );
}

function completedItemsRows(scope, query = {}, user = {}) {
  return PersonalWorkPlanModel.aggregate([
    ...completedItemsPipeline(scope, query, user),
    { $sort: withTiebreaker({ completedAt: -1 }, "itemId") },
  ]);
}

module.exports = {
  ROLE_STEP,
  APPROVAL_STEP_KEYS,
  resolveStepForUser,
  stepLabel,
  submit,
  approve,
  reject,
  reopen,
  complete,
  VERIFIER_ROLES,
  verifyActivity,
  completedItemsPipeline,
  paginateCompletedItems,
  completedItemsRows,
};
