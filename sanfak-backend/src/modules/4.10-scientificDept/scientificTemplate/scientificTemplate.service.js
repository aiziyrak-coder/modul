const { ErrorHandler } = require("#shared/error");
const ScientificTemplate = require("./scientificTemplate.model");
const { fileResigner } = require("#modules/4.10-scientificDept/_shared/fileUrlSign");

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildQuery = ({ search, category, active } = {}) => {
  const q = { active: active === undefined ? true : active };
  if (category) q.category = category;
  if (search) q.name = { $regex: new RegExp(escapeRegex(search), "i") };
  return q;
};

const withFiles = fileResigner(["fileUrl"]);

async function list(query) {
  const docs = await ScientificTemplate.find(buildQuery(query))
    .sort({ updatedAt: -1 })
    .lean();
  return withFiles(docs);
}

async function paginate(query) {
  const { page, limit } = query;
  const res = await ScientificTemplate.paginate(buildQuery(query), {
    page: Number(page),
    limit: Number(limit),
    sort: { updatedAt: -1 },
    lean: true,
  });
  return { ...res, docs: withFiles(res.docs) };
}

async function findById(id) {
  const doc = await ScientificTemplate.findById(id).lean();
  if (!doc || !doc.active) throw new ErrorHandler(404, "Namuna topilmadi");
  return withFiles(doc);
}

async function create(user, payload) {
  if (!payload.fileUrl) {
    throw new ErrorHandler(400, "Namuna fayli yuklanishi shart");
  }
  return ScientificTemplate.create({
    name: payload.name,
    description: payload.description || "",
    category: payload.category,
    fileUrl: payload.fileUrl,
    fileName: payload.fileName || "",
    fileSize: payload.fileSize || "",
    createdBy: user._id,
  });
}

async function update(id, payload) {
  const doc = await ScientificTemplate.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Namuna topilmadi");
  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.description !== undefined) doc.description = payload.description;
  if (payload.category !== undefined) doc.category = payload.category;
  if (payload.fileUrl) {
    doc.fileUrl = payload.fileUrl;
    doc.fileName = payload.fileName || "";
    doc.fileSize = payload.fileSize || "";
  }
  if (payload.active !== undefined) doc.active = payload.active;
  await doc.save();
  return doc;
}

async function softDelete(id) {
  const doc = await ScientificTemplate.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Namuna topilmadi");
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
  softDelete,
  escapeRegex,
};
