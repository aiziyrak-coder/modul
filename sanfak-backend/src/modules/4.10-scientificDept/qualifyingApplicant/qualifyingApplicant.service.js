const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const { dispatch } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const { zipFileSlots, assertAllSlots } = require("../_shared/fileSlots");
const Applicant = require("./qualifyingApplicant.model");
const ExamSpecialty = require("../examSpecialty/examSpecialty.model");
const { isRegistrationOpen } = require("../examSpecialty/examSpecialty.status");
const { fileResigner } = require("../_shared/fileUrlSign");

const EXAM_LINK = "/scientific-department/qualification-exam";
const INSTITUTE_NAME = "Farg'ona jamoat salomatligi tibbiyot instituti";

const notifyAuthor = async (doc, title, body) => {
  try {
    if (!doc.addedBy) return;
    await dispatch({
      userId: doc.addedBy,
      eventType: "qualifying_applicant",
      title,
      body,
      link: EXAM_LINK,
      metadata: { applicantId: String(doc._id) },
    });
  } catch (err) {
    winston.error(`[QualifyingApplicant] bildirishnoma xato: ${err.message}`);
  }
};

const POPULATE = [
  { path: "addedBy", select: "firstName lastName" },
  { path: "department", select: "title" },
  { path: "faculty", select: "title" },
  { path: "reviewedBy", select: "firstName lastName" },
  { path: "resultBy", select: "firstName lastName" },
];

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const roleOf = (user) => user.role?.title;
const isAdmin = (user) =>
  roleOf(user) === ROLES.SUPER_ADMIN || roleOf(user) === ROLES.ADMIN;
const isIlmiy = (user) => roleOf(user) === ROLES.ILMIY_BOLIM || isAdmin(user);
const isKotib = (user) =>
  roleOf(user) === ROLES.ILMIY_KENGASH_KOTIBI || isAdmin(user);
const sameUser = (a, b) => String(a) === String(b);

const roleVisibility = (user) => {
  if (isIlmiy(user) || isKotib(user)) return {};
  return { addedBy: user._id };
};

const buildQuery = (query = {}, user) => {
  const q = { active: true, ...roleVisibility(user) };
  if (query.status) q.status = query.status;
  if (query.specialization) q.specialization = query.specialization;
  if (query.course) q.course = Number(query.course);
  if (query.examDate === "assigned") q.examDate = { $ne: null };
  if (query.examDate === "unassigned") q.examDate = null;
  const { dateFrom, dateTo } = query;
  if (dateFrom || dateTo) {
    q.createdAt = {};
    if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      q.createdAt.$lte = end;
    }
  }
  if (query.search) {
    q.name = { $regex: new RegExp(escapeRegex(query.search), "i") };
  }
  return q;
};

const withFiles = fileResigner(["documents", "certificateFileUrl"]);

async function list(query, user) {
  const docs = await Applicant.find(buildQuery(query, user))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
  return withFiles(docs);
}

async function paginate(query, user) {
  const { page, limit } = query;
  const res = await Applicant.paginate(buildQuery(query, user), {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: POPULATE,
    lean: true,
  });
  return { ...res, docs: withFiles(res.docs) };
}

async function findById(id, user) {
  const doc = await Applicant.findOne({ _id: id, active: true, ...roleVisibility(user) })
    .populate(POPULATE)
    .lean();
  if (!doc) throw new ErrorHandler(404, "Talabgor topilmadi");
  return withFiles(doc);
}

const pickFields = (payload) => {
  const out = {};
  ["name", "researcherType", "specialization", "university", "phone"].forEach((k) => {
    if (payload[k] !== undefined && payload[k] !== "") out[k] = payload[k];
  });
  if (payload.course !== undefined && payload.course !== "") {
    out.course = Number(payload.course);
  }
  return out;
};

async function create(user, payload) {
  const files = zipFileSlots(payload, Applicant.APPLICANT_DOC_SLOTS);
  assertAllSlots(files, Applicant.APPLICANT_DOC_SLOTS, "Malakaviy imtihon hujjatlari");
  const fields = pickFields(payload);
  const isSelfSubmission = roleOf(user) === ROLES.OQITUVCHI;
  if (isSelfSubmission) {
    const spec = await ExamSpecialty.findOne({
      code: fields.specialization,
      active: true,
    }).lean();
    if (!isRegistrationOpen(spec)) {
      throw new ErrorHandler(
        400,
        "Ushbu mutaxassislikka ro'yxatdan o'tish muddati tugagan yoki yopiq",
      );
    }
    fields.university = INSTITUTE_NAME;
    const u = await mongoose
      .model("user")
      .findById(user._id)
      .select("firstName lastName phone")
      .lean();
    if (u) {
      fields.name = [u.lastName, u.firstName].filter(Boolean).join(" ").trim();
      fields.phone = u.phone || "";
    }
  }
  return Applicant.create({
    addedBy: user._id,
    department: user.department?._id || user.department || null,
    faculty: user.department?.faculty?._id || user.department?.faculty || null,
    ...fields,
    documents: files,
    status: isSelfSubmission ? "new" : "approved",
  });
}

async function update(user, id, payload) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Talabgor topilmadi");
  if (!isAdmin(user) && !sameUser(doc.addedBy, user._id)) {
    throw new ErrorHandler(403, "Bu arizani tahrirlash huquqingiz yo'q");
  }
  const editable = isIlmiy(user) ? ["new", "approved"] : ["new"];
  if (!editable.includes(doc.status)) {
    throw new ErrorHandler(400, "Bu holatdagi arizani tahrirlab bo'lmaydi");
  }
  Object.assign(doc, pickFields(payload));
  const files = zipFileSlots(payload, Applicant.APPLICANT_DOC_SLOTS);
  Object.entries(files).forEach(([slot, url]) => {
    doc.documents[slot] = url;
  });
  await doc.save();
  return doc;
}

async function approve(user, id) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Talabgor topilmadi");
  if (doc.status !== "new") {
    throw new ErrorHandler(400, "Faqat 'Yangi' holatdagi arizani tasdiqlash mumkin");
  }
  if (!isAdmin(user) && sameUser(doc.addedBy, user._id)) {
    throw new ErrorHandler(403, "O'zingiz qo'shgan arizani tasdiqlay olmaysiz");
  }
  doc.status = "approved";
  doc.reviewedBy = user._id;
  doc.rejectionReason = "";
  await doc.save();
  await notifyAuthor(
    doc,
    "Ariza tasdiqlandi",
    "Malakaviy imtihon arizangiz tasdiqlandi. Imtihon sanasi belgilanishini kuting.",
  );
  return doc;
}

async function reject(user, id, reason) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Talabgor topilmadi");
  if (doc.status !== "new") {
    throw new ErrorHandler(400, "Faqat 'Yangi' holatdagi arizani rad etish mumkin");
  }
  if (!isAdmin(user) && sameUser(doc.addedBy, user._id)) {
    throw new ErrorHandler(403, "O'zingiz qo'shgan arizani rad eta olmaysiz");
  }
  doc.status = "rejected";
  doc.reviewedBy = user._id;
  doc.rejectionReason = reason;
  await doc.save();
  await notifyAuthor(doc, "Ariza rad etildi", `Sabab: ${reason}`);
  return doc;
}

async function setExamDate(user, ids, examDate) {
  const docs = await Applicant.find({ _id: { $in: ids }, active: true });
  if (!docs.length) throw new ErrorHandler(404, "Talabgor topilmadi");
  const notApproved = docs.filter((d) => d.status !== "approved");
  if (notApproved.length) {
    throw new ErrorHandler(
      400,
      "Faqat tasdiqlangan talabgorlarga imtihon sanasi belgilanadi",
    );
  }
  await Applicant.updateMany(
    { _id: { $in: ids } },
    { $set: { examDate } },
  );
  const dateStr = new Date(examDate).toISOString().slice(0, 10);
  await Promise.all(
    docs.map((d) =>
      notifyAuthor(d, "Imtihon sanasi belgilandi", `Imtihon sanasi: ${dateStr}`),
    ),
  );
  return { updated: docs.length };
}

async function setResult(user, id, payload) {
  if (!isKotib(user)) {
    throw new ErrorHandler(403, "Natijani faqat Ilmiy kengash kotibi kiritadi");
  }
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Talabgor topilmadi");
  if (doc.status !== "approved" || !doc.examDate) {
    throw new ErrorHandler(
      400,
      "Natija faqat imtihon sanasi belgilangan tasdiqlangan talabgorga kiritiladi",
    );
  }
  const files = zipFileSlots(payload, ["certificate"]);
  if (payload.result === "passed") {
    if (!files.certificate) {
      throw new ErrorHandler(400, "O'tgan talabgor uchun sertifikat majburiy");
    }
    doc.status = "passed";
    doc.certificateFileUrl = files.certificate;
  } else if (payload.result === "failed") {
    doc.status = "failed";
    doc.certificateFileUrl = "";
  } else {
    throw new ErrorHandler(400, "Natija 'passed' yoki 'failed' bo'lishi kerak");
  }
  doc.resultBy = user._id;
  await doc.save();
  await notifyAuthor(
    doc,
    "Imtihon natijasi",
    doc.status === "passed"
      ? "Tabriklaymiz! Malakaviy imtihondan muvaffaqiyatli o'tdingiz."
      : "Afsuski, malakaviy imtihondan o'ta olmadingiz.",
  );
  return doc;
}

async function resubmit(user, id, payload) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Talabgor topilmadi");
  if (!isAdmin(user) && !sameUser(doc.addedBy, user._id)) {
    throw new ErrorHandler(403, "Bu arizani qayta yuborish huquqingiz yo'q");
  }
  if (doc.status !== "rejected") {
    throw new ErrorHandler(400, "Faqat rad etilgan arizani qayta yuborish mumkin");
  }
  Object.assign(doc, pickFields(payload));
  const files = zipFileSlots(payload, Applicant.APPLICANT_DOC_SLOTS);
  Object.entries(files).forEach(([slot, url]) => {
    doc.documents[slot] = url;
  });
  doc.status = "new";
  doc.rejectionReason = "";
  doc.reviewedBy = null;
  await doc.save();
  return doc;
}

async function softDelete(user, id) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Talabgor topilmadi");
  if (!isAdmin(user) && !sameUser(doc.addedBy, user._id)) {
    throw new ErrorHandler(403, "Bu arizani o'chirish huquqingiz yo'q");
  }
  const deletable = isIlmiy(user)
    ? ["new", "approved", "rejected"]
    : ["new", "rejected"];
  if (!deletable.includes(doc.status)) {
    throw new ErrorHandler(400, "Bu holatdagi arizani o'chirib bo'lmaydi");
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
  approve,
  reject,
  setExamDate,
  setResult,
  resubmit,
  softDelete,
  escapeRegex,
};
