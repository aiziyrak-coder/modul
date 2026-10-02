const AdmissionOffer = require("./admissionOffer.model");

const POPULATE = [{ path: "updatedBy", select: "firstName lastName" }];

async function getOrCreate() {
  const existing = await AdmissionOffer.findOne({ active: true }).sort({ createdAt: 1 });
  if (existing) return existing;
  return AdmissionOffer.create({ blocks: [] });
}

async function get() {
  const doc = await getOrCreate();
  return AdmissionOffer.findById(doc._id).populate(POPULATE).lean();
}

async function replaceBlocks(user, blocks) {
  const doc = await getOrCreate();
  doc.blocks = blocks.map((b, i) => ({
    order: i + 1,
    titleUz: b.titleUz,
    titleRu: b.titleRu || "",
    titleEn: b.titleEn || "",
    bodyUz: b.bodyUz || "",
    bodyRu: b.bodyRu || "",
    bodyEn: b.bodyEn || "",
  }));
  doc.updatedBy = user._id;
  await doc.save();
  return doc;
}

module.exports = { get, replaceBlocks };
