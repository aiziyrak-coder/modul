const { ErrorHandler } = require("#shared/error");
const StartupType = require("./startupType.model");

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildQuery({ search, active } = {}) {
  const q = { active: active === undefined ? true : active };
  if (search) q.name = new RegExp(escapeRegex(search), "i");
  return q;
}

const notFound = () => new ErrorHandler(404, "Loyiha turi topilmadi");

async function assertNameFree(name, exceptId) {
  const rx = new RegExp(`^${escapeRegex(String(name).trim())}$`, "i");
  const q = { name: rx };
  if (exceptId) q._id = { $ne: exceptId };
  const clash = await StartupType.findOne(q).lean();
  if (clash) throw new ErrorHandler(400, `"${name}" loyiha turi allaqachon mavjud`);
}

async function list(query) {
  return StartupType.find(buildQuery(query)).sort({ name: 1 }).lean();
}

async function paginate(query) {
  const { page, limit } = query;
  return StartupType.paginate(buildQuery(query), {
    page: Number(page),
    limit: Number(limit),
    sort: { name: 1 },
    lean: true,
  });
}

async function findById(id) {
  const doc = await StartupType.findById(id).lean();
  if (!doc) throw notFound();
  return doc;
}

async function create(payload) {
  await assertNameFree(payload.name);
  return StartupType.create({ name: payload.name, active: payload.active !== false });
}

async function update(id, payload) {
  const doc = await StartupType.findById(id);
  if (!doc) throw notFound();
  if (payload.name !== undefined) {
    await assertNameFree(payload.name, doc._id);
    doc.name = payload.name;
  }
  if (payload.active !== undefined) doc.active = payload.active;
  await doc.save();
  return doc;
}

async function remove(id) {
  const doc = await StartupType.findById(id);
  if (!doc) throw notFound();
  doc.active = false;
  await doc.save();
  return { message: "O'chirildi" };
}

module.exports = { buildQuery, list, paginate, findById, create, update, remove };
