const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const { withTiebreaker } = require("#shared/paginate");
const StartupType = require("#modules/4.10-scientificDept/startupType/startupType.model");
const Startup = require("./startup.model");
const { zipFileSlots, assertAllSlots } = require("#modules/4.10-scientificDept/_shared/fileSlots");
const { resignDocFiles } = require("#modules/4.10-scientificDept/_shared/fileUrlSign");

const SLOTS = Startup.STARTUP_FILE_SLOTS;
const POPULATE = [
  { path: "author", select: "firstName lastName" },
  { path: "department", select: "title" },
  { path: "faculty", select: "title" },
  { path: "type", select: "name" },
];

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const notFound = () => new ErrorHandler(404, "Startap topilmadi");

const mapScope = (scope = {}) => {
  if (scope.user) return { author: scope.user };
  return scope;
};

const buildQuery = (query = {}, scope = {}) => {
  const q = { active: true };
  const { search, type, faculty, department, author, dateFrom, dateTo } = query;
  if (type) q.type = type;
  if (faculty) q.faculty = faculty;
  if (department) q.department = department;
  if (author) q.author = author;
  if (dateFrom || dateTo) {
    q.createdAt = {};
    if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      q.createdAt.$lte = end;
    }
  }
  if (search) q.title = new RegExp(escapeRegex(search), "i");
  return { ...q, ...mapScope(scope) };
};

const withFiles = (doc) => resignDocFiles(doc, ["files"]);

async function resolveType(typeId) {
  const doc = await StartupType.findById(typeId).lean();
  if (!doc) throw new ErrorHandler(400, "Loyiha turi topilmadi");
  if (doc.active === false) {
    throw new ErrorHandler(400, `"${doc.name}" loyiha turi o'chirilgan`);
  }
  return doc;
}

async function list(query, scope) {
  const docs = await Startup.find(buildQuery(query, scope))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
  return docs.map(withFiles);
}

async function paginate(query, scope) {
  const { page, limit } = query;
  const res = await Startup.paginate(buildQuery(query, scope), {
    page: Number(page),
    limit: Number(limit),
    sort: withTiebreaker({ createdAt: -1 }),
    populate: POPULATE,
    lean: true,
  });
  return { ...res, docs: res.docs.map(withFiles) };
}

async function findById(id, scope) {
  const doc = await Startup.findOne({ _id: id, active: true, ...mapScope(scope || {}) })
    .populate(POPULATE)
    .lean();
  if (!doc) throw notFound();
  return withFiles(doc);
}

async function create(user, payload) {
  const type = await resolveType(payload.type);
  const files = zipFileSlots(payload, SLOTS);
  assertAllSlots(files, SLOTS, "Startap");

  return Startup.create({
    author: user._id,
    department: user.department?._id || user.department || null,
    faculty: user.department?.faculty?._id || user.department?.faculty || null,
    type: type._id,
    title: payload.title,
    files,
  });
}

async function update(user, id, payload) {
  const doc = await Startup.findById(id);
  if (!doc || !doc.active) throw notFound();

  const isAuthor = String(doc.author) === String(user._id);
  const isSuper = user.role?.title === ROLES.SUPER_ADMIN;
  if (!isAuthor && !isSuper) {
    throw new ErrorHandler(403, "Faqat startap muallifi tahrirlashi mumkin");
  }

  if (payload.type !== undefined) {
    const type = await resolveType(payload.type);
    doc.type = type._id;
  }
  if (payload.title !== undefined) doc.title = payload.title;

  const incoming = zipFileSlots(payload, SLOTS);
  SLOTS.forEach((s) => {
    if (incoming[s]) doc.files[s] = incoming[s];
  });

  await doc.save();
  return doc;
}

async function softDelete(user, id) {
  const doc = await Startup.findById(id);
  if (!doc || !doc.active) throw notFound();
  const isAuthor = String(doc.author) === String(user._id);
  const isSuper = user.role?.title === ROLES.SUPER_ADMIN;
  if (!isAuthor && !isSuper) {
    throw new ErrorHandler(403, "Faqat startap muallifi o'chirishi mumkin");
  }
  doc.active = false;
  await doc.save();
  return { message: "O'chirildi" };
}

module.exports = {
  buildQuery,
  list,
  paginate,
  findById,
  create,
  update,
  softDelete,
};
