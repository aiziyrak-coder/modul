const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const { appendSignature } = require("#shared/fileAccess");
const Methodical = require("../methodicalRecommendation/methodicalRecommendation.model");
const ScientificTemplate = require("../scientificTemplate/scientificTemplate.model");
const MethodicalSpecialty = require("../methodicalSpecialty/methodicalSpecialty.model");

const SLOT_LABEL = {
  methodical: "Uslubiy tavsiyanoma (.docx)",
  protocol: "Kafedra bayonnomasi (.pdf)",
  titul: "Titul varag'i (.docx)",
  external: "Tashqi taqriz (.pdf)",
  internal: "Ichki taqriz (.pdf)",
  antiplagiat: "Antiplagiat to'liq hisoboti (.pdf)",
};

async function specialties() {
  const docs = await MethodicalSpecialty.find({ active: true }, { code: 1, name: 1 })
    .sort({ code: 1 })
    .lean();
  return docs.map((d) => ({
    value: String(d._id),
    label: `${d.code} — ${d.name}`,
    code: d.code,
    name: d.name,
  }));
}

async function academicYears() {
  const docs = await mongoose
    .model("academicYear")
    .find({ active: true }, { title: 1 })
    .lean();
  return docs
    .map((d) => String(d.title || "").trim())
    .filter((t) => /^\d{4}\/\d{4}$/.test(t))
    .sort((a, b) => b.localeCompare(a))
    .map((t) => ({ value: t, label: t }));
}

async function templates() {
  const docs = await ScientificTemplate.find(
    { active: true, category: "methodical" },
    { name: 1, description: 1, fileUrl: 1, fileName: 1, fileSize: 1 },
  )
    .sort({ createdAt: -1 })
    .lean();

  return docs.map((d) => ({
    name: d.name,
    description: d.description || "",
    fileName: d.fileName || "",
    fileSize: d.fileSize || "",
    downloadUrl: d.fileUrl ? appendSignature(d.fileUrl) : "",
  }));
}

async function assertSpecialty(value) {
  const doc = await MethodicalSpecialty.findOne({ _id: value, active: true })
    .select("_id")
    .lean()
    .catch(() => null);
  if (!doc) throw new ErrorHandler(400, "Tanlangan ixtisoslik topilmadi");
  return doc._id;
}

async function assertAcademicYear(value) {
  const v = String(value || "").trim();
  const list = await academicYears();
  if (!list.some((o) => o.value === v)) {
    throw new ErrorHandler(400, "Tanlangan o'quv yili topilmadi");
  }
  return v;
}

async function submit(payload) {
  const files = payload.files || {};
  const specialty = await assertSpecialty(payload.specialty);
  const academicYear = await assertAcademicYear(payload.academicYear);

  const missing = Methodical.METHODICAL_FILE_SLOTS.filter((s) => !files[s]);
  if (missing.length) {
    throw new ErrorHandler(
      400,
      `Quyidagi hujjatlar yuklanmadi: ${missing.map((s) => SLOT_LABEL[s] || s).join(", ")}`,
    );
  }

  const doc = await Methodical.create({
    author: null,
    source: "public",
    title: payload.title,
    specialty,
    academicYear,
    submitterName: payload.authorName,
    submitterPhone: payload.authorPhone,
    submitterEmail: payload.authorEmail || "",
    submitterOrganization: payload.organization,
    submitterDepartment: payload.departmentName || "",
    files,
    status: "new",
  });

  return {
    title: doc.title,
    specialty: payload.specialtyLabel || String(doc.specialty),
    academicYear: doc.academicYear,
    status: doc.status,
    submittedAt: doc.createdAt,
  };
}

module.exports = {
  specialties,
  academicYears,
  templates,
  assertSpecialty,
  assertAcademicYear,
  submit,
  SLOT_LABEL,
};
