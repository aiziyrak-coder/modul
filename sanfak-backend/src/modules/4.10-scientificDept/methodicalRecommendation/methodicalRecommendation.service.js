const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const Methodical = require("./methodicalRecommendation.model");
const {
  zipFileSlots,
  assertAllSlots,
} = require("#modules/4.10-scientificDept/_shared/fileSlots");
const { fileResigner } = require("#modules/4.10-scientificDept/_shared/fileUrlSign");

const { METHODICAL_FILE_SLOTS } = Methodical;

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const POPULATE = [
  { path: "author", select: "firstName lastName" },
  { path: "specialty", select: "code name" },
  { path: "department", select: "title" },
  { path: "faculty", select: "title" },
  { path: "ilmiyApprovedBy", select: "firstName lastName" },
  { path: "kotibSignedBy", select: "firstName lastName" },
  { path: "rektorSignedBy", select: "firstName lastName" },
  { path: "rejectedBy", select: "firstName lastName" },
];

const notFound = () => new ErrorHandler(404, "Uslubiy tavsiyanoma topilmadi");

const roleOf = (user) => user.role?.title;
const isAdmin = (user) =>
  roleOf(user) === ROLES.SUPER_ADMIN || roleOf(user) === ROLES.ADMIN;

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
  if (role === ROLES.REKTOR) {
    return { kotibSignedAt: { $ne: null } };
  }
  return {};
};

const buildQuery = (query = {}, scope = {}, user) => {
  const q = { active: true, ...roleVisibility(user) };
  if (query.status) q.status = query.status;
  if (query.academicYear) q.academicYear = query.academicYear;
  if (query.specialty) q.specialty = query.specialty;
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
    q.title = { $regex: new RegExp(escapeRegex(query.search), "i") };
  }
  return { ...q, ...mapScope(scope) };
};

const withFiles = fileResigner(["files"]);

async function list(query, scope, user) {
  const docs = await Methodical.find(buildQuery(query, scope, user))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
  return withFiles(docs);
}

async function paginate(query, scope, user) {
  const { page, limit } = query;
  const res = await Methodical.paginate(buildQuery(query, scope, user), {
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
  const doc = await Methodical.findOne({ _id: id, active: true, ...visibility })
    .populate(POPULATE)
    .lean();
  if (!doc) throw notFound();
  return withFiles(doc);
}

async function create(user, payload) {
  const files = zipFileSlots(payload, METHODICAL_FILE_SLOTS);
  assertAllSlots(files, METHODICAL_FILE_SLOTS, "Uslubiy tavsiyanoma");

  return Methodical.create({
    author: user._id,
    department: user.department?._id || user.department,
    faculty: user.department?.faculty?._id || user.faculty,
    title: payload.title,
    specialty: payload.specialty,
    academicYear: payload.academicYear,
    files,
    status: "new",
  });
}

async function update(user, id, payload) {
  const doc = await Methodical.findById(id);
  if (!doc || !doc.active) throw notFound();

  const isOwner = String(doc.author) === String(user._id);
  if (!isOwner && !isAdmin(user)) {
    throw new ErrorHandler(403, "Faqat o'z tavsiyanomangizni tahrirlaysiz");
  }
  if (!["new", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(
      409,
      "Zanjirga o'tgan tavsiyanomani tahrirlab bo'lmaydi",
    );
  }

  if (payload.title !== undefined) doc.title = payload.title;
  if (payload.specialty !== undefined) doc.specialty = payload.specialty;
  if (payload.academicYear !== undefined) doc.academicYear = payload.academicYear;

  const files = zipFileSlots(payload, METHODICAL_FILE_SLOTS);
  Object.entries(files).forEach(([slot, url]) => {
    doc.files[slot] = url;
  });

  doc.status = "new";
  doc.ilmiyApprovedBy = undefined;
  doc.ilmiyApprovedAt = undefined;
  doc.kotibSignedBy = undefined;
  doc.kotibSignedAt = undefined;
  doc.kotibEriSerial = undefined;
  doc.rektorSignedBy = undefined;
  doc.rektorSignedAt = undefined;
  doc.rektorEriSerial = undefined;
  doc.registrationNumber = undefined;
  doc.rejectionReason = undefined;
  doc.rejectedBy = undefined;
  doc.rejectedByRole = undefined;

  await doc.save();
  return doc;
}

async function ilmiyApprove(user, id) {
  const doc = await Methodical.findById(id);
  if (!doc || !doc.active) throw notFound();

  const role = roleOf(user);
  if (role !== ROLES.ILMIY_BOLIM && !isAdmin(user)) {
    throw new ErrorHandler(403, "Bu bosqich Ilmiy bo'limga tegishli");
  }
  if (doc.status !== "new" || doc.ilmiyApprovedAt) {
    throw new ErrorHandler(409, "Tavsiyanoma Ilmiy bo'lim bosqichida emas");
  }

  doc.ilmiyApprovedBy = user._id;
  doc.ilmiyApprovedAt = new Date();
  doc.status = "pending";
  await doc.save();
  return doc;
}

async function nextRegistrationNumber() {
  const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
  const prefix = `u-t-${yy}-`;
  const docs = await Methodical.find({
    registrationNumber: { $regex: new RegExp(`^${prefix}\\d+$`) },
  })
    .select("registrationNumber")
    .lean();
  const maxN = docs.reduce(
    (m, d) => Math.max(m, Number(d.registrationNumber.slice(prefix.length)) || 0),
    0,
  );
  return `${prefix}${maxN + 1}`;
}

async function sign(user, id, payload, eri) {
  const doc = await Methodical.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (doc.status === "rejected") {
    throw new ErrorHandler(409, "Rad etilgan tavsiyanomani imzolab bo'lmaydi");
  }

  const role = roleOf(user);
  const kotibStage = doc.ilmiyApprovedAt && !doc.kotibSignedAt;
  const rektorStage = doc.kotibSignedAt && !doc.rektorSignedAt;

  const actAsKotib =
    role === ROLES.ILMIY_KENGASH_KOTIBI || (isAdmin(user) && kotibStage);
  const actAsRektor =
    role === ROLES.REKTOR || (isAdmin(user) && rektorStage);

  if (actAsKotib && !actAsRektor) {
    if (!kotibStage) {
      throw new ErrorHandler(409, "Tavsiyanoma Kotib bosqichida emas");
    }
    doc.kotibSignedBy = user._id;
    doc.kotibSignedAt = eri.signedAt;
    doc.kotibEriSerial = eri.serialNumber || "";
    await doc.save();
    return doc;
  }

  if (actAsRektor) {
    if (!rektorStage) {
      throw new ErrorHandler(409, "Tavsiyanoma Rektor bosqichida emas");
    }
    doc.rektorSignedBy = user._id;
    doc.rektorSignedAt = eri.signedAt;
    doc.rektorEriSerial = eri.serialNumber || "";
    if (payload.academicYear) doc.academicYear = payload.academicYear;
    doc.status = "approved";

    const manual = payload.registrationNumber;
    if (manual) {
      const clash = await Methodical.findOne({
        registrationNumber: manual,
        _id: { $ne: doc._id },
      }).lean();
      if (clash) throw new ErrorHandler(409, `Raqam band: ${manual}`);
      doc.registrationNumber = manual;
      await doc.save();
      return doc;
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      doc.registrationNumber = await nextRegistrationNumber();
      try {
        await doc.save();
        return doc;
      } catch (err) {
        if (err && err.code === 11000 && attempt < 4) continue;
        throw err;
      }
    }
  }

  throw new ErrorHandler(403, "E-imzo bosqichi sizga tegishli emas");
}

async function reject(user, id, reason) {
  const doc = await Methodical.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (["approved", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(409, "Yakunlangan tavsiyanomani rad etib bo'lmaydi");
  }

  const role = roleOf(user);
  const stageRole =
    doc.status === "new"
      ? ROLES.ILMIY_BOLIM
      : doc.kotibSignedAt
        ? ROLES.REKTOR
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
  const doc = await Methodical.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!["new", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(
      409,
      "Zanjirga o'tgan yoki tasdiqlangan tavsiyanomani o'chirib bo'lmaydi",
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
  reject,
  softDelete,
  nextRegistrationNumber,
  escapeRegex,
};
