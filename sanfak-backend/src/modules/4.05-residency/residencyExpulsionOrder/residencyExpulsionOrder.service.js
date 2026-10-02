"use strict";

const crypto = require("crypto");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const Order = require("./residencyExpulsionOrder.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const {
  canAccessResident,
  deletedResidentIds,
  residentIdsFor,
} = require("#modules/4.05-residency/_services/residentScope");
const {
  signOrder,
  rejectOrder,
  attachScan,
  attachDraftPdf,
  assertScanAccepted,
  assertDraftPrintable,
  assertDraftHours,
  assertNoScan,
  isSignable,
  MAX_HISTORY,
} = require("#modules/4.05-residency/_services/expulsionOrderDecision");
const {
  deliverDecision,
} = require("#modules/4.05-residency/_services/expulsionOfficeNotices");
const {
  countUnexcusedHours,
  sumUnexcusedHours,
} = require("#modules/4.05-residency/_services/expulsionCheck");
const files = require("#modules/4.05-residency/_services/expulsionOrderFiles");
const draftData = require("#modules/4.05-residency/_services/expulsionDraftData");
const {
  buildExpulsionDraftPdf,
  draftFileName,
  TEMPLATE_VERSION,
} = require("#modules/4.05-residency/_pdf/expulsionOrderDraft.pdf");
const { isOfficeSigner, notOfficeSigner, displayName } = require("./residencyExpulsionOrder.upload");

const { ORDER_OPEN, ORDER_SIGNED } = Order;
const POP = [
  {
    path: "resident",
    select:
      "fullName program courseNumber groupTitle specialtyTitle departmentTitle specialty department group status totalUnexcusedHours active",
    populate: RESIDENT_REF_POPULATE,
  },
  { path: "signedBy", select: "firstName lastName middleName" },
  { path: "closedBy", select: "firstName lastName middleName" },
  { path: "scan.uploadedBy", select: "firstName lastName middleName" },
  { path: "draftPdf.generatedBy", select: "firstName lastName middleName" },
];
const HIDDEN = "-scan.storageKey -draftPdf.storageKey -eriSubject -deliveries";

const FIELDS = [
  "_id", "resident", "residentName", "origin", "status", "countingYear", "draftedAt",
  "hoursAtDraft", "noticesSentAt", "closedAt", "closedBy", "closedByName", "closeReason",
  "closeNote", "hoursAtClose", "paperOrderNumber", "paperOrderDate", "signedAt", "signedBy",
  "signedByName", "hoursAtSign", "eriSerialNumber", "eriSignedAt", "residentAppliedAt",
  "basisLostAt", "hoursAtBasisLost", "history", "createdAt", "updatedAt",
];
const SCAN_FIELDS = ["fileName", "mimeType", "size", "sha256", "uploadedBy", "uploadedByName", "uploadedAt"];
const DRAFT_PDF_FIELDS = [
  "fileName", "size", "sha256", "hours", "templateVersion", "generatedAt", "generatedBy", "generatedByName",
];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

const notFound = () => new ErrorHandler(404, "not found", "order_not_found", { reason: "order_not_found" });

function assertOfficeSigner(user) {
  if (!isOfficeSigner(user)) throw notOfficeSigner();
}

const populatedResident = (order) =>
  order.resident && typeof order.resident === "object" ? order.resident : null;

const residentActive = (order) => populatedResident(order)?.active !== false;

const needsResumeOf = (order) =>
  order.status === ORDER_SIGNED &&
  !order.residentAppliedAt &&
  populatedResident(order)?.status !== "chetlatilgan";

const signReady = (order) =>
  Boolean(order.scan?.sha256) && isSignable(order, populatedResident(order));

function flagsFor(order, user) {
  const office = isOfficeSigner(user);
  const open = office && order.status === ORDER_OPEN;
  const needsResume = needsResumeOf(order);
  return {
    canUploadScan: open && (order.history?.length ?? 0) < MAX_HISTORY,
    canReject: open && residentActive(order),
    canSign: open && signReady(order),
    needsResume,
    canResume: office && needsResume,
  };
}

const draftPrintable = (order) =>
  order.status === ORDER_OPEN &&
  order.origin === "tizim" &&
  Boolean(order.noticesSentAt) &&
  !order.scan &&
  isSignable(order, populatedResident(order));

const canGetDraftPdf = (order, user) =>
  isOfficeSigner(user) && (Boolean(order.draftPdf) || draftPrintable(order));

function toOrderDTO(order, user) {
  return {
    ...pick(order, FIELDS),
    scan: order.scan ? pick(order.scan, SCAN_FIELDS) : null,
    draftPdf: order.draftPdf ? pick(order.draftPdf, DRAFT_PDF_FIELDS) : null,
    ...flagsFor(order, user),
    canGetDraftPdf: canGetDraftPdf(order, user),
  };
}

async function loadScoped(orderId, user) {
  const order = await Order.findById(orderId).select("resident status history").lean();
  if (!order) throw notFound();
  const resident = await Resident.findById(order.resident).select("user supervisor department");
  if (!resident || !canAccessResident(user, resident, "read")) throw notFound();
  return order;
}

async function detail(orderId, user) {
  const order = await Order.findById(orderId).select(HIDDEN).populate(POP).lean();
  if (!order) throw notFound();
  return toOrderDTO(order, user);
}

async function listFilter(query, user) {
  const allowed = await residentIdsFor(user);
  const resident = { $nin: await deletedResidentIds() };
  if (query.resident) resident.$in = allowed ? allowed.filter((id) => String(id) === query.resident) : [query.resident];
  else if (allowed) resident.$in = allowed;
  return {
    resident,
    ...(query.status && { status: query.status }),
    ...(query.origin && { origin: query.origin }),
  };
}

async function paginate(query, user) {
  const result = await Order.paginate(await listFilter(query, user), {
    page: Number(query.page),
    limit: Number(query.limit),
    sort: { draftedAt: -1, _id: -1 },
    select: HIDDEN,
    populate: POP,
    lean: true,
  });
  return { ...result, docs: result.docs.map((d) => toOrderDTO(d, user)) };
}

const findOne = async (orderId, user) => {
  await loadScoped(orderId, user);
  return detail(orderId, user);
};

const assertBinding = (orderId, body) => {
  if (body.orderId !== String(orderId)) {
    throw new ErrorHandler(400, "`orderId` yo'ldagi buyruqqa mos emas", "binding_mismatch", {
      reason: "binding_mismatch",
    });
  }
};

async function notifyDecision(order, kind) {
  try {
    await deliverDecision(order, kind);
  } catch (err) {
    winston.error(`[4.5 expulsionOrder] qaror xabari (${kind}) order=${order._id}: ${err.message}`);
  }
}

async function sign(orderId, body, eri, user) {
  assertOfficeSigner(user);
  assertBinding(orderId, body);
  await loadScoped(orderId, user);
  const { paperOrderNumber, paperOrderDate, scanSha256 } = body;
  const { order, flipped } = await signOrder({
    orderId,
    input: { paperOrderNumber, paperOrderDate, scanSha256 },
    eri,
    actor: user,
    countHours: countUnexcusedHours,
  });
  if (flipped) await notifyDecision(order, "signed");
  return detail(orderId, user);
}

async function reject(orderId, body, user) {
  assertOfficeSigner(user);
  assertBinding(orderId, body);
  await loadScoped(orderId, user);
  const { order } = await rejectOrder({ orderId, reason: body.reason, actor: user, countHours: countUnexcusedHours });
  await notifyDecision(order, "rejected");
  return detail(orderId, user);
}

async function removeIfUnreferenced(orderId, storageKey) {
  try {
    const current = await Order.findById(orderId).select("scan.storageKey").lean();
    if (current?.scan?.storageKey !== storageKey) await files.remove(storageKey);
  } catch (err) {
    winston.warn(`[4.5 expulsionOrder] skan bog'lanishi tekshirilmadi, fayl qoldirildi ${storageKey}: ${err.message}`);
  }
}

async function uploadScan(orderId, file, user) {
  assertOfficeSigner(user);
  assertScanAccepted(await loadScoped(orderId, user));
  const type = files.detectScanType(file?.buffer);
  if (!type) {
    throw new ErrorHandler(400, "Faqat PDF, JPG yoki PNG skan qabul qilinadi", "SCAN_TYPE_NOT_ALLOWED", {
      reason: "SCAN_TYPE_NOT_ALLOWED",
    });
  }
  const saved = await files.save(file.buffer, type.ext);
  const scan = { ...saved, fileName: displayName(file.originalname, type.ext), mimeType: type.mimeType };
  let attached;
  try {
    attached = await attachScan({ orderId, scan, actor: user });
  } catch (err) {
    await removeIfUnreferenced(orderId, saved.storageKey);
    throw err;
  }
  if (!attached) {
    await files.remove(saved.storageKey);
    assertScanAccepted(await loadScoped(orderId, user));
    throw new ErrorHandler(409, "Buyruq endi loyiha emas — sahifani yangilang", "order_not_open", {
      reason: "order_not_open",
    });
  }
  return detail(orderId, user);
}

async function scanForDownload(orderId, user) {
  assertOfficeSigner(user);
  await loadScoped(orderId, user);
  const order = await Order.findById(orderId).select("scan").lean();
  if (!order?.scan?.storageKey) {
    throw new ErrorHandler(404, "Skan hali yuklanmagan", "scan_missing", { reason: "scan_missing" });
  }
  const stat = await files.stat(order.scan.storageKey);
  if (!stat) {
    winston.error(`[4.5 expulsionOrder] skan fayli diskda yo'q order=${orderId}`);
    throw new ErrorHandler(404, "Skan fayli topilmadi", "scan_file_missing", { reason: "scan_file_missing" });
  }
  return { scan: order.scan, size: stat.size };
}

const DRAFT_SELECT =
  "resident residentName status origin countingYear draftedAt hoursAtDraft noticesSentAt scan draftPdf";
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

async function winnerDraftPdf(orderId) {
  const current = await Order.findById(orderId).select("status scan draftPdf").lean();
  if (!current) throw notFound();
  if (current.draftPdf) return current.draftPdf;
  if (current.status === ORDER_OPEN) assertNoScan(current);
  throw new ErrorHandler(409, "Buyruq endi loyiha emas — sahifani yangilang", "order_not_open", {
    reason: "order_not_open",
    currentStatus: current.status ?? null,
  });
}

async function storeDraftPdf(orderId, buffer, { hours, user, now }) {
  const saved = await files.save(buffer, "pdf", { prefix: "draft" });
  const draftPdf = { ...saved, fileName: draftFileName(orderId, now), hours, templateVersion: TEMPLATE_VERSION };
  let attached;
  try {
    attached = await attachDraftPdf({ orderId, draftPdf, actor: user, now });
  } catch (err) {
    winston.warn(`[4.5 expulsionOrder] loyiha PDF biriktirilmadi, fayl qoldirildi ${saved.storageKey}: ${err.message}`);
    throw err;
  }
  if (attached) return attached.draftPdf;
  await files.remove(saved.storageKey);
  return winnerDraftPdf(orderId);
}

async function createDraftPdf(order, user, now) {
  if (order.status !== ORDER_OPEN) {
    throw new ErrorHandler(404, "Bu buyruq uchun loyiha PDF'i yaratilmagan", "draft_pdf_missing", {
      reason: "draft_pdf_missing",
    });
  }
  const resident = await draftData.loadDraftResident(order.resident);
  if (!resident) throw notFound();
  assertDraftPrintable(order, resident, now);
  const rows = await draftData.loadDraftRows(order.resident, now);
  const total = sumUnexcusedHours(rows);
  assertDraftHours(total);
  const buffer = await buildExpulsionDraftPdf(draftData.toDraftInput({ order, resident, rows, total, now }));
  return storeDraftPdf(order._id, buffer, { hours: total, user, now });
}

async function verifiedDraftBytes(orderId, draftPdf) {
  const buffer = await files.readFile(draftPdf.storageKey);
  if (!buffer) {
    winston.error(`[4.5 expulsionOrder] loyiha PDF fayli diskda yo'q order=${orderId}`);
    throw new ErrorHandler(404, "Loyiha PDF fayli topilmadi", "draft_pdf_file_missing", {
      reason: "draft_pdf_file_missing",
    });
  }
  if (sha256(buffer) !== draftPdf.sha256) {
    winston.error(`[4.5 expulsionOrder] loyiha PDF fayli o'zgargan (sha256 mos emas) order=${orderId}`);
    throw new ErrorHandler(500, "Loyiha PDF fayli buzilgan", "draft_pdf_integrity", {
      reason: "draft_pdf_integrity",
    });
  }
  return buffer;
}

async function draftPdfForDownload(orderId, user, now = new Date()) {
  assertOfficeSigner(user);
  await loadScoped(orderId, user);
  const order = await Order.findById(orderId).select(DRAFT_SELECT).lean();
  if (!order) throw notFound();
  const draftPdf = order.draftPdf ?? (await createDraftPdf(order, user, now));
  return { draftPdf, buffer: await verifiedDraftBytes(orderId, draftPdf) };
}

module.exports = {
  paginate,
  findOne,
  sign,
  reject,
  uploadScan,
  scanForDownload,
  draftPdfForDownload,
  toOrderDTO,
  createReadStream: files.createReadStream,
};
