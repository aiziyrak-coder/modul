const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const Monograph = require("./monograph.model");
const {
  zipFileSlots,
  assertAllSlots,
} = require("#modules/4.10-scientificDept/_shared/fileSlots");
const { fileResigner } = require("#modules/4.10-scientificDept/_shared/fileUrlSign");

const { MONOGRAPH_FILE_SLOTS } = Monograph;

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const POPULATE = [
  { path: "author", select: "firstName lastName" },
  { path: "department", select: "title" },
  { path: "faculty", select: "title" },
  { path: "ilmiyApprovedBy", select: "firstName lastName" },
  { path: "kotibSignedBy", select: "firstName lastName" },
  { path: "prorektorSignedBy", select: "firstName lastName" },
  { path: "ssvSentBy", select: "firstName lastName" },
  { path: "dataApprovedBy", select: "firstName lastName" },
  { path: "rejectedBy", select: "firstName lastName" },
];

const notFound = () => new ErrorHandler(404, "Monografiya topilmadi");

const roleOf = (user) => user.role?.title;
const isAdmin = (user) =>
  roleOf(user) === ROLES.SUPER_ADMIN || roleOf(user) === ROLES.ADMIN;
const isIlmiy = (user) => roleOf(user) === ROLES.ILMIY_BOLIM || isAdmin(user);

const mapScope = (scope = {}) => {
  const q = { ...scope };
  if (q.user) {
    q.author = q.user;
    delete q.user;
  }
  return q;
};

const roleVisibility = (user) => {
  const role = roleOf(user);
  if (role === ROLES.ILMIY_KENGASH_KOTIBI) {
    return { ilmiyApprovedAt: { $ne: null } };
  }
  if (role === ROLES.PROREKTOR) {
    return { kotibSignedAt: { $ne: null } };
  }
  return {};
};

const buildQuery = async (query = {}, scope = {}, user) => {
  const q = { active: true, ...roleVisibility(user) };
  if (query.status) q.status = query.status;
  if (query.faculty) q.faculty = query.faculty;
  if (query.department) q.department = query.department;
  if (query.author) q.author = query.author;
  if (query.dateFrom || query.dateTo) {
    q.createdAt = {};
    if (query.dateFrom) q.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setUTCHours(23, 59, 59, 999);
      q.createdAt.$lte = end;
    }
  }
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    const authors = await mongoose
      .model("user")
      .find({ $or: [{ firstName: rx }, { lastName: rx }] })
      .select("_id")
      .lean();
    q.$or = [{ title: rx }, { author: { $in: authors.map((a) => a._id) } }];
  }
  return { ...q, ...mapScope(scope) };
};

const withFiles = fileResigner(["files", "isbnFileUrl", "ssvResponseFileUrl"]);

async function list(query, scope, user) {
  const docs = await Monograph.find(await buildQuery(query, scope, user))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
  return withFiles(docs);
}

async function paginate(query, scope, user) {
  const { page, limit } = query;
  const res = await Monograph.paginate(await buildQuery(query, scope, user), {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: POPULATE,
    lean: true,
  });
  return { ...res, docs: withFiles(res.docs) };
}

async function findById(id, scope, user) {
  const visibility = user
    ? { ...mapScope(scope || {}), ...roleVisibility(user) }
    : {};
  const doc = await Monograph.findOne({ _id: id, active: true, ...visibility })
    .populate(POPULATE)
    .lean();
  if (!doc) throw notFound();
  return withFiles(doc);
}

async function create(user, payload) {
  const files = zipFileSlots(payload, MONOGRAPH_FILE_SLOTS);
  assertAllSlots(files, MONOGRAPH_FILE_SLOTS, "Monografiya");

  return Monograph.create({
    author: user._id,
    department: user.department?._id || user.department,
    faculty: user.department?.faculty?._id || user.faculty,
    files,
    status: "new",
  });
}

async function update(user, id, payload) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();

  const isOwner = String(doc.author) === String(user._id);
  if (!isOwner && !isAdmin(user)) {
    throw new ErrorHandler(403, "Faqat o'z monografiyangizni tahrirlaysiz");
  }
  if (!["new", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(
      409,
      "Zanjirga o'tgan monografiyani tahrirlab bo'lmaydi",
    );
  }

  const files = zipFileSlots(payload, MONOGRAPH_FILE_SLOTS);
  Object.entries(files).forEach(([slot, url]) => {
    doc.files[slot] = url;
  });

  doc.status = "new";
  doc.ilmiyApprovedBy = undefined;
  doc.ilmiyApprovedAt = undefined;
  doc.kotibSignedBy = undefined;
  doc.kotibSignedAt = undefined;
  doc.kotibEriSerial = undefined;
  doc.prorektorSignedBy = undefined;
  doc.prorektorSignedAt = undefined;
  doc.prorektorEriSerial = undefined;
  doc.ssvSentBy = undefined;
  doc.ssvSentAt = undefined;
  doc.ssvReceivedAt = undefined;
  doc.ssvResponseFileUrl = "";
  doc.teacherConfirmedAt = undefined;
  doc.dataApprovedBy = undefined;
  doc.dataApprovedAt = undefined;
  doc.dataRejectionReason = "";
  doc.title = "";
  doc.ssvNumber = "";
  doc.ssvDate = "";
  doc.isbn = "";
  doc.publisher = "";
  doc.isbnFileUrl = "";
  doc.rejectionReason = undefined;
  doc.rejectedBy = undefined;
  doc.rejectedByRole = undefined;

  await doc.save();
  return doc;
}

async function ilmiyApprove(user, id) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();

  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Bu bosqich Ilmiy bo'limga tegishli");
  }
  if (doc.status !== "new" || doc.ilmiyApprovedAt) {
    throw new ErrorHandler(409, "Monografiya Ilmiy bo'lim bosqichida emas");
  }

  doc.ilmiyApprovedBy = user._id;
  doc.ilmiyApprovedAt = new Date();
  doc.status = "pending";
  await doc.save();
  return doc;
}

async function sign(user, id, payload, eri) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (doc.status === "rejected") {
    throw new ErrorHandler(409, "Rad etilgan monografiyani imzolab bo'lmaydi");
  }

  const role = roleOf(user);
  const kotibStage = doc.ilmiyApprovedAt && !doc.kotibSignedAt;
  const prorektorStage = doc.kotibSignedAt && !doc.prorektorSignedAt;

  const actAsKotib =
    role === ROLES.ILMIY_KENGASH_KOTIBI || (isAdmin(user) && kotibStage);
  const actAsProrektor =
    role === ROLES.PROREKTOR || (isAdmin(user) && prorektorStage);

  if (actAsKotib && !actAsProrektor) {
    if (!kotibStage) {
      throw new ErrorHandler(409, "Monografiya Kotib bosqichida emas");
    }
    doc.kotibSignedBy = user._id;
    doc.kotibSignedAt = eri.signedAt;
    doc.kotibEriSerial = eri.serialNumber || "";
  } else if (actAsProrektor) {
    if (!prorektorStage) {
      throw new ErrorHandler(409, "Monografiya Prorektor bosqichida emas");
    }
    doc.prorektorSignedBy = user._id;
    doc.prorektorSignedAt = eri.signedAt;
    doc.prorektorEriSerial = eri.serialNumber || "";
  } else {
    throw new ErrorHandler(403, "E-imzo bosqichi sizga tegishli emas");
  }

  await doc.save();
  return doc;
}

async function ssvSend(user, id) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "SSV ga yuborish Ilmiy bo'limga tegishli");
  }
  if (doc.status === "rejected" || !doc.prorektorSignedAt || doc.ssvSentAt) {
    throw new ErrorHandler(409, "Monografiya SSV ga yuborish bosqichida emas");
  }

  doc.ssvSentBy = user._id;
  doc.ssvSentAt = new Date();
  await doc.save();
  return doc;
}

async function ssvDecision(user, id, payload, responseFileUrl) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "SSV javobi qarori Ilmiy bo'limga tegishli");
  }
  if (doc.status === "rejected" || !doc.ssvSentAt || doc.ssvReceivedAt) {
    throw new ErrorHandler(409, "Monografiya SSV javobi bosqichida emas");
  }
  if (!responseFileUrl) {
    throw new ErrorHandler(400, "SSV javobi fayli yuklanishi shart");
  }

  doc.ssvResponseFileUrl = responseFileUrl;
  if (payload.decision === "approve") {
    doc.ssvReceivedAt = new Date();
  } else {
    if (!payload.reason) {
      throw new ErrorHandler(400, "Rad etish sababi majburiy");
    }
    doc.status = "rejected";
    doc.rejectionReason = payload.reason;
    doc.rejectedBy = user._id;
    doc.rejectedByRole = "ssv";
  }
  await doc.save();
  return doc;
}

async function fillData(user, id, payload, isbnFileUrl) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();

  const isOwner = String(doc.author) === String(user._id);
  if (!isOwner && !isAdmin(user)) {
    throw new ErrorHandler(403, "Ma'lumotlarni faqat muallif to'ldiradi");
  }
  if (doc.status === "rejected" || !doc.ssvReceivedAt || doc.teacherConfirmedAt) {
    throw new ErrorHandler(
      409,
      "Monografiya ma'lumot to'ldirish bosqichida emas",
    );
  }
  if (!isbnFileUrl && !doc.isbnFileUrl) {
    throw new ErrorHandler(400, "ISBN pdf ma'lumotnomasi yuklanishi shart");
  }

  doc.title = payload.title;
  doc.ssvNumber = payload.ssvNumber;
  doc.ssvDate = payload.ssvDate;
  doc.isbn = payload.isbn;
  doc.publisher = payload.publisher;
  if (isbnFileUrl) doc.isbnFileUrl = isbnFileUrl;
  doc.teacherConfirmedAt = new Date();
  doc.dataRejectionReason = "";
  await doc.save();
  return doc;
}

async function dataApprove(user, id) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Data-tasdiq Ilmiy bo'limga tegishli");
  }
  if (doc.status === "rejected" || !doc.teacherConfirmedAt || doc.dataApprovedAt) {
    throw new ErrorHandler(409, "Monografiya data-tasdiq bosqichida emas");
  }

  doc.dataApprovedBy = user._id;
  doc.dataApprovedAt = new Date();
  doc.status = "approved";
  await doc.save();
  return doc;
}

async function dataReject(user, id, reason) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Data-rad Ilmiy bo'limga tegishli");
  }
  if (doc.status === "rejected" || !doc.teacherConfirmedAt || doc.dataApprovedAt) {
    throw new ErrorHandler(409, "Monografiya data-tasdiq bosqichida emas");
  }

  doc.teacherConfirmedAt = undefined;
  doc.dataRejectionReason = reason;
  await doc.save();
  return doc;
}

async function reject(user, id, reason) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (["approved", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(409, "Yakunlangan monografiyani rad etib bo'lmaydi");
  }
  if (doc.prorektorSignedAt) {
    throw new ErrorHandler(
      409,
      "Imzolangan monografiya SSV javobi orqali rad etiladi",
    );
  }

  const role = roleOf(user);
  const stageRole =
    doc.status === "new"
      ? ROLES.ILMIY_BOLIM
      : doc.kotibSignedAt
        ? ROLES.PROREKTOR
        : ROLES.ILMIY_KENGASH_KOTIBI;

  if (role !== stageRole && !isAdmin(user)) {
    throw new ErrorHandler(403, "Rad etish bosqichi sizga tegishli emas");
  }

  doc.status = "rejected";
  doc.rejectionReason = reason;
  doc.rejectedBy = user._id;
  doc.rejectedByRole = isAdmin(user) ? stageRole : role;
  await doc.save();
  return doc;
}

async function softDelete(id) {
  const doc = await Monograph.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!["new", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(
      409,
      "Zanjirga o'tgan yoki tasdiqlangan monografiyani o'chirib bo'lmaydi",
    );
  }
  doc.active = false;
  await doc.save();
  return doc;
}

module.exports = {
  list,
  paginate,
  findById,
  create,
  update,
  ilmiyApprove,
  sign,
  ssvSend,
  ssvDecision,
  fillData,
  dataApprove,
  dataReject,
  reject,
  softDelete,
  escapeRegex,
};
