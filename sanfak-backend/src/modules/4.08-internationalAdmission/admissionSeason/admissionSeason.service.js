const { ErrorHandler } = require("#shared/error");
const { createCrudService } = require("../lib/crudService");
const AdmissionSeason = require("./admissionSeason.model");

const POPULATE = [
  { path: "items.direction", select: "titleUz titleRu titleEn" },
  { path: "items.educationForms", select: "titleUz titleRu titleEn" },
  { path: "items.educationLanguages", select: "titleUz titleRu titleEn" },
  { path: "closedBy", select: "firstName lastName" },
];

const base = createCrudService({
  model: AdmissionSeason,
  notFound: "Qabul mavsumi topilmadi",
  searchFields: ["titleUz", "titleRu", "titleEn"],
  filterFields: ["academicYear", "season", "status"],
  populate: POPULATE,
  sort: { openDate: -1 },
});

function computeStatus(openDate, closeDate, now = new Date()) {
  if (now < new Date(openDate)) return "rejada";
  if (now > new Date(closeDate)) return "yopiq";
  return "ochiq";
}

function assertDateOrder(openDate, closeDate) {
  if (new Date(closeDate) <= new Date(openDate)) {
    throw new ErrorHandler(
      400,
      "Yopilish sanasi ochilish sanasidan keyin bo'lishi kerak",
    );
  }
}

async function assertNoOverlap(openDate, closeDate, excludeId = null) {
  const query = {
    active: true,
    status: { $ne: "yopiq" },
    openDate: { $lte: new Date(closeDate) },
    closeDate: { $gte: new Date(openDate) },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const clash = await AdmissionSeason.findOne(query).select("titleUz openDate closeDate").lean();
  if (clash) {
    throw new ErrorHandler(
      400,
      `Bu sanalarda boshqa qabul mavsumi mavjud: "${clash.titleUz}". ` +
        "Bir vaqtda faqat bitta qabul ochiq bo'lishi mumkin.",
    );
  }
}

function withComputedStatus(doc, now = new Date()) {
  if (!doc) return doc;
  if (doc.closedAt) return { ...doc, status: "yopiq" };
  return { ...doc, status: computeStatus(doc.openDate, doc.closeDate, now) };
}

async function create(payload) {
  assertDateOrder(payload.openDate, payload.closeDate);
  await assertNoOverlap(payload.openDate, payload.closeDate);
  return AdmissionSeason.create({
    ...payload,
    status: computeStatus(payload.openDate, payload.closeDate),
  });
}

async function update(id, payload) {
  const doc = await base.getDoc(id);
  if (doc.status === "yopiq") {
    throw new ErrorHandler(400, "Yopilgan qabul mavsumini tahrirlab bo'lmaydi");
  }

  const openDate = payload.openDate ?? doc.openDate;
  const closeDate = payload.closeDate ?? doc.closeDate;
  assertDateOrder(openDate, closeDate);
  await assertNoOverlap(openDate, closeDate, doc._id);

  Object.assign(doc, payload);
  doc.status = computeStatus(openDate, closeDate);
  await doc.save();
  return doc;
}

async function close(user, id) {
  const doc = await base.getDoc(id);
  if (doc.status === "yopiq") {
    throw new ErrorHandler(400, "Qabul mavsumi allaqachon yopilgan");
  }
  doc.status = "yopiq";
  doc.closeDate = new Date();
  doc.closedBy = user._id;
  doc.closedAt = new Date();
  await doc.save();
  return doc;
}

async function softDelete(id) {
  const doc = await base.getDoc(id);
  if (doc.status === "yopiq") {
    throw new ErrorHandler(400, "Yopilgan qabul mavsumini o'chirib bo'lmaydi");
  }
  doc.active = false;
  await doc.save();
  return doc;
}

async function findOpenSeason(now = new Date()) {
  return AdmissionSeason.findOne({
    active: true,
    status: { $ne: "yopiq" },
    openDate: { $lte: now },
    closeDate: { $gte: now },
  })
    .populate(POPULATE)
    .lean();
}

async function distinctAcademicYears() {
  const values = await AdmissionSeason.distinct("academicYear", { active: true });
  return values.filter(Boolean).sort((a, b) => b.localeCompare(a));
}

async function list(query) {
  const docs = await base.list(query);
  return docs.map((d) => withComputedStatus(d));
}

async function paginate(query) {
  const res = await base.paginate(query);
  return { ...res, docs: (res.docs || []).map((d) => withComputedStatus(d)) };
}

async function findById(id) {
  return withComputedStatus(await base.findById(id));
}

module.exports = {
  ...base,
  list,
  paginate,
  findById,
  withComputedStatus,
  distinctAcademicYears,
  create,
  update,
  close,
  softDelete,
  findOpenSeason,
  computeStatus,
};
