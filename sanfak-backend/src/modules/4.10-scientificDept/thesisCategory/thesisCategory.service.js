const { ErrorHandler } = require("#shared/error");
const ThesisCategory = require("./thesisCategory.model");

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildQuery = ({ search, type, active } = {}) => {
  const q = { active: active === undefined ? true : active };
  if (type) q.type = type;
  if (search) q.name = { $regex: new RegExp(escapeRegex(search), "i") };
  return q;
};

async function list(query) {
  return ThesisCategory.find(buildQuery(query)).sort({ name: 1 }).lean();
}

async function paginate(query) {
  const { page, limit } = query;
  return ThesisCategory.paginate(buildQuery(query), {
    page: Number(page),
    limit: Number(limit),
    sort: { name: 1 },
    lean: true,
  });
}

async function findById(id) {
  const doc = await ThesisCategory.findById(id).lean();
  if (!doc || !doc.active) throw new ErrorHandler(404, "Toifa topilmadi");
  return doc;
}

async function create(payload) {
  return ThesisCategory.create({ name: payload.name, type: payload.type });
}

async function update(id, payload) {
  const doc = await ThesisCategory.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Toifa topilmadi");
  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.type !== undefined) doc.type = payload.type;
  if (payload.active !== undefined) doc.active = payload.active;
  await doc.save();
  return doc;
}

async function softDelete(id) {
  const doc = await ThesisCategory.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Toifa topilmadi");
  doc.active = false;
  await doc.save();
  return doc;
}

module.exports = { list, paginate, findById, create, update, softDelete };
