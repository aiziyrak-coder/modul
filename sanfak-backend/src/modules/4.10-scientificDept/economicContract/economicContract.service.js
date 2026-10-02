const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const EconomicContract = require("./economicContract.model");
const {
  zipFileSlots,
} = require("#modules/4.10-scientificDept/_shared/fileSlots");
const { fileResigner } = require("#modules/4.10-scientificDept/_shared/fileUrlSign");

const { CONTRACT_FILE_SLOTS } = EconomicContract;

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const POPULATE = [
  { path: "teacher", select: "firstName lastName" },
  { path: "department", select: "title" },
  { path: "faculty", select: "title" },
  { path: "createdBy", select: "firstName lastName" },
  { path: "academicYear", select: "title" },
  { path: "approvedBy", select: "firstName lastName" },
  { path: "rejectedBy", select: "firstName lastName" },
];

const notFound = () => new ErrorHandler(404, "Xo'jalik shartnomasi topilmadi");

const roleOf = (user) => user.role?.title;
const isAdmin = (user) =>
  roleOf(user) === ROLES.SUPER_ADMIN || roleOf(user) === ROLES.ADMIN;
const isIlmiy = (user) => roleOf(user) === ROLES.ILMIY_BOLIM || isAdmin(user);

const mapScope = (scope = {}) => {
  if (scope.user) return { createdBy: scope.user };
  return scope;
};

const buildQuery = (query = {}, scope = {}) => {
  const q = { active: true };
  if (query.status) q.status = query.status;
  if (query.academicYear) q.academicYear = query.academicYear;
  if (query.department) q.department = query.department;
  if (query.dateFrom || query.dateTo) {
    q.contractDate = {};
    if (query.dateFrom) q.contractDate.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setUTCHours(23, 59, 59, 999);
      q.contractDate.$lte = end;
    }
  }
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    q.$or = [{ title: rx }, { partnerOrganization: rx }];
  }
  return { ...q, ...mapScope(scope) };
};

const withFiles = fileResigner(["files"]);

async function list(query, scope) {
  const docs = await EconomicContract.find(buildQuery(query, scope))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
  return withFiles(docs);
}

async function paginate(query, scope) {
  const { page, limit } = query;
  const res = await EconomicContract.paginate(buildQuery(query, scope), {
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
  const doc = await EconomicContract.findOne(filter).populate(POPULATE).lean();
  if (!doc) throw notFound();
  return withFiles(doc);
}

const applyFiles = (doc, payload) => {
  const files = zipFileSlots(payload, CONTRACT_FILE_SLOTS);
  Object.entries(files).forEach(([slot, url]) => {
    doc.files[slot] = url;
  });
};

async function create(user, payload) {
  const doc = new EconomicContract({
    teacher: payload.teacher || undefined,
    department: user.department?._id || user.department,
    faculty: user.department?.faculty?._id || user.faculty,
    createdBy: user._id,
    title: payload.title,
    partnerOrganization: payload.partnerOrganization,
    contractDate: payload.contractDate,
    amount: payload.amount,
    currentYearAmount: payload.currentYearAmount || 0,
    academicYear: payload.academicYear || null,
    status: "new",
  });
  applyFiles(doc, payload);
  await doc.save();
  return doc;
}

async function update(user, id, payload) {
  const doc = await EconomicContract.findById(id);
  if (!doc || !doc.active) throw notFound();

  const userDept = String(user.department?._id || user.department || "");
  const isOwnDept = userDept && String(doc.department) === userDept;
  if (!isOwnDept && !isAdmin(user)) {
    throw new ErrorHandler(403, "Faqat o'z kafedrangiz shartnomasini tahrirlaysiz");
  }
  if (!["new", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(409, "Tasdiqlangan shartnomani tahrirlab bo'lmaydi");
  }

  const fields = [
    "teacher",
    "title",
    "partnerOrganization",
    "contractDate",
    "amount",
    "currentYearAmount",
    "academicYear",
  ];
  fields.forEach((f) => {
    if (payload[f] !== undefined) doc[f] = payload[f];
  });
  applyFiles(doc, payload);

  doc.status = "new";
  doc.approvedBy = undefined;
  doc.approvedAt = undefined;
  doc.rejectionReason = undefined;
  doc.rejectedBy = undefined;
  doc.rejectedByRole = "";
  await doc.save();
  return doc;
}

async function approve(user, id) {
  const doc = await EconomicContract.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Tasdiqlash Ilmiy bo'limga tegishli");
  }
  if (doc.status !== "new") {
    throw new ErrorHandler(409, "Shartnoma tasdiqlash bosqichida emas");
  }
  doc.status = "approved";
  doc.approvedBy = user._id;
  doc.approvedAt = new Date();
  await doc.save();
  return doc;
}

async function reject(user, id, reason) {
  const doc = await EconomicContract.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Rad etish Ilmiy bo'limga tegishli");
  }
  if (doc.status !== "new") {
    throw new ErrorHandler(409, "Shartnoma tasdiqlash bosqichida emas");
  }
  doc.status = "rejected";
  doc.rejectionReason = reason;
  doc.rejectedBy = user._id;
  doc.rejectedByRole = roleOf(user) || "";
  await doc.save();
  return doc;
}

async function softDelete(user, id) {
  const doc = await EconomicContract.findById(id);
  if (!doc || !doc.active) throw notFound();

  const userDept = String(user.department?._id || user.department || "");
  const isOwnDept = userDept && String(doc.department) === userDept;
  if (!isOwnDept && !isAdmin(user)) {
    throw new ErrorHandler(403, "Faqat o'z kafedrangiz shartnomasini o'chirasiz");
  }
  if (!["new", "rejected"].includes(doc.status)) {
    throw new ErrorHandler(409, "Tasdiqlangan shartnomani o'chirib bo'lmaydi");
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
  softDelete,
  escapeRegex,
};
