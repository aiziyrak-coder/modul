"use strict";

const { ErrorHandler } = require("#shared/error");
const {
  buildStaffPositions,
} = require("#modules/4.02-studyLoad/_services/staffPositionsCalculator");
const WorkloadModel = require("./workload.model");

const { calculateBlockTotal } = WorkloadModel;

const CONTENT_EDITABLE_STATUSES = ["draft", "new"];

const POST_APPROVAL_EDIT_STATUSES = new Set(["approved"]);

const SUMMARY_STATUS = "approved";

function contentLockError(status) {
  if (CONTENT_EDITABLE_STATUSES.includes(status)) return null;
  return new ErrorHandler(
    400,
    `Bu holatdagi yuklama mazmunini o'zgartirib bo'lmaydi. Joriy holat: ${status}. ` +
      `Faqat ${CONTENT_EDITABLE_STATUSES.join("/")} holatida mumkin. ` +
      `Rad etilgan yuklamani tuzatish uchun avval qayta oching (tasdiqlash ` +
      `amalini bosing — hujjat 'draft'ga qaytadi).`,
  );
}

function stampPostApprovalEdit(target, previousStatus, userId) {
  if (!POST_APPROVAL_EDIT_STATUSES.has(previousStatus)) return false;
  target.lastEditedAfterApprovalAt = new Date();
  target.lastEditedAfterApprovalBy = userId ?? null;
  target.file = null;
  return true;
}

function findBlockById(doc, blockId) {
  for (const dir of doc.directions || []) {
    for (const blk of dir.blocks || []) {
      if (blk._id && blk._id.toString() === String(blockId)) return blk;
    }
  }
  return null;
}

const AUTO_ITEM_SLUGS = new Set(
  Object.keys(WorkloadModel.AUTO_CALCULATED_ITEM_SLUGS),
);

function mergeByIdOrThrow(list, edits, fieldName, entityLabel, opts = {}) {
  const { autoSlugs } = opts;
  for (const edit of edits || []) {
    const target = (list || []).find(
      (item) => item._id && item._id.toString() === String(edit._id),
    );
    if (!target) {
      throw new ErrorHandler(
        404,
        `${entityLabel} topilmadi`,
        `_id=${edit._id}`,
      );
    }
    target[fieldName] = edit[fieldName];
    if (autoSlugs && autoSlugs.has(target.slug)) {
      target.overridden = true;
    }
  }
}

async function applyBlockEdit({ filter, blockId, body, userId }) {
  const doc = await WorkloadModel.findOne(filter);
  if (!doc) throw new ErrorHandler(404, "not found");

  const previousStatus = doc.status;

  const lockErr = contentLockError(previousStatus);
  if (lockErr) throw lockErr;

  const block = findBlockById(doc, blockId);
  if (!block) throw new ErrorHandler(404, "Blok topilmadi");

  const previousHour = block.totalHour;

  if (body.studyWork?.classTypes) {
    mergeByIdOrThrow(
      block.studyWork.classTypes,
      body.studyWork.classTypes,
      "stream",
      "O'quv ish turi (classType)",
    );
  }
  if (body.studyWork?.items) {
    mergeByIdOrThrow(
      block.studyWork.items,
      body.studyWork.items,
      "value",
      "O'quv ish elementi (item)",
      { autoSlugs: AUTO_ITEM_SLUGS },
    );
  }
  if (body.otherWork?.items) {
    mergeByIdOrThrow(
      block.otherWork.items,
      body.otherWork.items,
      "value",
      "Boshqa ish elementi (item)",
    );
  }
  if (body.leadership !== undefined) {
    block.leadership = body.leadership;
  }

  block.totalHour = calculateBlockTotal(
    block.studyWork,
    block.otherWork,
    block.leadership,
    block.student,
  );

  doc.staffPositions = await buildStaffPositions(doc);

  stampPostApprovalEdit(doc, previousStatus, userId);

  await doc.save();

  return {
    previousHour,
    totalHour: block.totalHour,
    thisSemester: block.studyWork?.thisSemester,
    staffPositions: doc.staffPositions,
  };
}

const readHourly = (edit) =>
  edit.hourly === undefined || edit.hourly === null ? undefined : Number(edit.hourly) || 0;

function upsertStaffPositionItem(items, edit) {
  let target = null;

  if (edit._id) {
    target = items.find(
      (it) => it._id && it._id.toString() === String(edit._id),
    );
    if (!target) {
      throw new ErrorHandler(
        404,
        "Shtat birligi elementi topilmadi",
        `_id=${edit._id}`,
      );
    }
  } else {
    target = items.find(
      (it) => it.category === edit.category && it.slug === edit.slug,
    );
  }

  const positions = Number(edit.positions) || 0;
  const load = Number(edit.load) || 0;
  const totalHours = positions * load;
  const hourly = readHourly(edit);

  if (target) {
    target.category = edit.category;
    target.slug = edit.slug;
    target.positions = positions;
    target.load = load;
    target.totalHours = totalHours;
    if (hourly !== undefined) target.hourly = hourly;
  } else {
    items.push({
      category: edit.category,
      slug: edit.slug,
      title: "",
      positions,
      load,
      totalHours,
      hourly: hourly ?? 0,
    });
  }
}

async function applyStaffPositionsEdit({ filter, items, userId }) {
  const doc = await WorkloadModel.findOne(filter);
  if (!doc) throw new ErrorHandler(404, "not found");

  const previousStatus = doc.status;

  const lockErr = contentLockError(previousStatus);
  if (lockErr) throw lockErr;

  if (!doc.staffPositions) {
    doc.staffPositions = { items: [], totalPositions: 0, hourly: 0 };
  }
  if (!Array.isArray(doc.staffPositions.items)) {
    doc.staffPositions.items = [];
  }

  for (const edit of items) {
    upsertStaffPositionItem(doc.staffPositions.items, edit);
  }

  doc.staffPositions = await buildStaffPositions(doc);

  stampPostApprovalEdit(doc, previousStatus, userId);

  await doc.save();

  return { staffPositions: doc.staffPositions };
}

async function loadSummaryWorkloads(filter) {
  const approvedOnly = { ...filter, status: SUMMARY_STATUS };
  return WorkloadModel.find(approvedOnly)
    .select([
      "department",
      "academicYear",
      "status",
      "directions.blocks.totalHour",
      "staffPositions",
      "approvalSteps",
    ])
    .populate([
      {
        path: "department",
        select: "title head",
        populate: { path: "head", select: "firstName lastName middleName" },
      },
      { path: "approvalSteps.approvedBy", select: "firstName lastName middleName" },
    ])
    .lean();
}

module.exports = {
  applyBlockEdit,
  applyStaffPositionsEdit,
  loadSummaryWorkloads,
  SUMMARY_STATUS,
  CONTENT_EDITABLE_STATUSES,
  POST_APPROVAL_EDIT_STATUSES,
};
