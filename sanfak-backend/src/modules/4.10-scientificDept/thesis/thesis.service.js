const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const Thesis = require("./thesis.model");
const { fileResigner } = require("#modules/4.10-scientificDept/_shared/fileUrlSign");

const POPULATE = [
  { path: "author", select: "firstName lastName" },
  { path: "department", select: "title" },
  { path: "faculty", select: "title" },
  { path: "rejectedBy", select: "firstName lastName" },
  { path: "approvedBy", select: "firstName lastName" },
];

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mapScope = (scope = {}) => {
  if (scope.user) return { author: scope.user };
  return scope;
};

const buildQuery = (query = {}, scope = {}) => {
  const q = { active: true };
  const {
    search,
    status,
    type,
    academicYear,
    faculty,
    department,
    author,
    year,
    dateFrom,
    dateTo,
  } = query;
  if (status) q.status = status;
  if (type) q.type = type;
  if (academicYear) q.academicYear = academicYear;
  if (faculty) q.faculty = faculty;
  if (department) q.department = department;
  if (author) q.author = author;
  if (year) q.year = Number(year);
  if (dateFrom || dateTo) {
    q.createdAt = {};
    if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      q.createdAt.$lte = end;
    }
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    q.$or = [{ title: rx }, { conferenceName: rx }];
  }
  return { ...q, ...mapScope(scope) };
};

const withFiles = fileResigner(["fileUrl"]);

async function list(query, scope) {
  const docs = await Thesis.find(buildQuery(query, scope))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
  return withFiles(docs);
}

async function paginate(query, scope) {
  const { page, limit } = query;
  const res = await Thesis.paginate(buildQuery(query, scope), {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: POPULATE,
    lean: true,
  });
  return { ...res, docs: withFiles(res.docs) };
}

async function findById(id, scope) {
  const filter = { _id: id, active: true, ...mapScope(scope || {}) };
  const doc = await Thesis.findOne(filter).populate(POPULATE).lean();
  if (!doc) throw new ErrorHandler(404, "Tezis topilmadi");
  return withFiles(doc);
}

const yearFromDate = (d) => {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(String(d || ""));
  return m ? Number(m[1]) : undefined;
};

async function create(user, payload) {
  const department = user.department?._id || user.department || null;
  const faculty =
    user.department?.faculty?._id || user.department?.faculty || null;

  return Thesis.create({
    author: user._id,
    department,
    faculty,
    conferenceName: payload.conferenceName,
    title: payload.title,
    type: payload.type,
    academicYear: payload.academicYear,
    publishedDate: payload.publishedDate || "",
    year: yearFromDate(payload.publishedDate) ?? payload.year,
    pages: payload.pages,
    authorCount: payload.authorCount,
    url: payload.url || undefined,
    fileUrl: payload.fileUrl || undefined,
    status: "new",
  });
}

async function update(user, id, payload) {
  const doc = await Thesis.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Tezis topilmadi");

  const isAuthor = String(doc.author) === String(user._id);
  const isSuper = user.role?.title === ROLES.SUPER_ADMIN;
  if (!isAuthor && !isSuper) {
    throw new ErrorHandler(403, "Faqat tezis muallifi tahrirlashi mumkin");
  }
  if (!["new", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(
      400,
      "Tekshirilayotgan yoki tasdiqlangan tezisni tahrirlab bo'lmaydi",
    );
  }

  [
    "conferenceName",
    "title",
    "type",
    "academicYear",
    "publishedDate",
    "year",
    "pages",
    "authorCount",
    "url",
    "fileUrl",
  ].forEach((k) => {
    if (payload[k] !== undefined) doc[k] = payload[k];
  });

  const derived = yearFromDate(payload.publishedDate);
  if (derived !== undefined) doc.year = derived;

  if (doc.status === "rejected") {
    doc.status = "new";
    doc.rejectionReason = undefined;
    doc.rejectedBy = undefined;
    doc.rejectedByRole = "";
  }

  await doc.save();
  return doc;
}

async function takeToReview(id) {
  const doc = await Thesis.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Tezis topilmadi");
  if (doc.status !== "new") {
    throw new ErrorHandler(400, "Faqat 'Yangi' holatdagi tezis tekshirishga olinadi");
  }
  doc.status = "pending";
  await doc.save();
  return doc;
}

async function approve(user, id) {
  const doc = await Thesis.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Tezis topilmadi");
  if (!["new", "pending"].includes(doc.status)) {
    throw new ErrorHandler(400, "Bu holatdagi tezisni tasdiqlab bo'lmaydi");
  }
  doc.status = "approved";
  doc.approvedBy = user._id;
  doc.approvedAt = new Date();
  await doc.save();
  return doc;
}

async function reject(user, id, reason) {
  const doc = await Thesis.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Tezis topilmadi");
  if (!["new", "pending"].includes(doc.status)) {
    throw new ErrorHandler(400, "Bu holatdagi tezisni rad etib bo'lmaydi");
  }
  doc.status = "rejected";
  doc.rejectionReason = reason;
  doc.rejectedBy = user._id;
  doc.rejectedByRole = user.role?.title || "";
  doc.approvedBy = undefined;
  doc.approvedAt = undefined;
  await doc.save();
  return doc;
}

async function softDelete(id) {
  const doc = await Thesis.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Tezis topilmadi");
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
  takeToReview,
  approve,
  reject,
  softDelete,
  yearFromDate,
};
