const { ErrorHandler } = require("#shared/error");
const MethodicalSpecialty = require("./methodicalSpecialty.model");

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildQuery({ search, active } = {}) {
  const q = { active: active === undefined ? true : active };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    q.$or = [{ code: rx }, { name: rx }];
  }
  return q;
}

const notFound = () => new ErrorHandler(404, "Ixtisoslik topilmadi");

async function assertCodeFree(code, exceptId) {
  const rx = new RegExp(`^${escapeRegex(String(code).trim())}$`, "i");
  const q = { code: rx };
  if (exceptId) q._id = { $ne: exceptId };
  const clash = await MethodicalSpecialty.findOne(q).lean();
  if (clash) {
    throw new ErrorHandler(400, `"${code}" shifri allaqachon mavjud`);
  }
}

async function list(query) {
  return MethodicalSpecialty.find(buildQuery(query)).sort({ code: 1 }).lean();
}

async function paginate(query) {
  const { page, limit } = query;
  return MethodicalSpecialty.paginate(buildQuery(query), {
    page: Number(page),
    limit: Number(limit),
    sort: { code: 1 },
    lean: true,
  });
}

async function findById(id) {
  const doc = await MethodicalSpecialty.findById(id).lean();
  if (!doc) throw notFound();
  return doc;
}

async function create(payload) {
  await assertCodeFree(payload.code);
  return MethodicalSpecialty.create({
    code: payload.code,
    name: payload.name,
    active: payload.active === undefined ? true : payload.active,
  });
}

async function update(id, payload) {
  const doc = await MethodicalSpecialty.findById(id);
  if (!doc) throw notFound();
  if (payload.code !== undefined && payload.code !== doc.code) {
    await assertCodeFree(payload.code, id);
    doc.code = payload.code;
  }
  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.active !== undefined) doc.active = payload.active;
  await doc.save();
  return doc;
}

async function remove(id) {
  const doc = await MethodicalSpecialty.findById(id);
  if (!doc) throw notFound();
  doc.active = false;
  await doc.save();
  return { _id: doc._id };
}

module.exports = {
  escapeRegex,
  buildQuery,
  assertCodeFree,
  list,
  paginate,
  findById,
  create,
  update,
  remove,
};
