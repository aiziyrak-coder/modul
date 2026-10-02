const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const ExamSpecialty = require("../examSpecialty/examSpecialty.model");
const { isRegistrationOpen } = require("../examSpecialty/examSpecialty.status");
const Applicant = require("../qualifyingApplicant/qualifyingApplicant.model");

async function openSpecialties() {
  const docs = await ExamSpecialty.find(
    { active: true, status: "open" },
    { code: 1, name: 1, regStart: 1, regEnd: 1, status: 1, active: 1 },
  )
    .sort({ code: 1 })
    .lean();

  const now = new Date();
  return docs
    .filter((d) => isRegistrationOpen(d, now))
    .map((d) => ({
      code: d.code,
      name: d.name || "",
      regStart: d.regStart || null,
      regEnd: d.regEnd || null,
    }));
}

async function courses() {
  const docs = await mongoose
    .model("course")
    .find({ active: true }, { title: 1 })
    .sort({ title: 1 })
    .lean();
  return docs
    .map((d) => ({ value: parseInt(d.title, 10), label: d.title }))
    .filter((o) => Number.isFinite(o.value));
}

const REQUIRED_SLOTS = Applicant.APPLICANT_DOC_SLOTS;
const SLOT_LABEL = {
  referral: "Tashkilot rahbari tasdiqlagan muhrli xat",
  application: "Ariza (FJSTI rektori nomiga)",
  passport: "Pasport nusxasi",
  diploma: "Diplom nusxasi (ilovasi bilan)",
  objektivka: "Obyektivka (ma'lumotnoma)",
  topic: "OAK byulleteni / Ilmiy kengash e'loni nusxasi",
  order: "Izlanuvchi yoki doktoranturaga kirganlik buyrug'i",
};

async function assertSpecialtyOpen(code) {
  const spec = await ExamSpecialty.findOne({
    code: String(code || "").trim(),
    active: true,
  }).lean();
  if (!isRegistrationOpen(spec)) {
    throw new ErrorHandler(400, "Bu mutaxassislikka hozir ariza qabul qilinmaydi");
  }
  return spec;
}

async function submit(payload) {
  const documents = payload.documents || {};
  const spec = await assertSpecialtyOpen(payload.specialization);

  const missing = REQUIRED_SLOTS.filter((s) => !documents[s]);
  if (missing.length) {
    throw new ErrorHandler(
      400,
      `Quyidagi hujjatlar yuklanmagan: ${missing.map((s) => SLOT_LABEL[s] || s).join(", ")}`,
    );
  }

  const doc = await Applicant.create({
    addedBy: null,
    source: "public",
    name: payload.name,
    specialization: spec.code,
    course: payload.course === "" || payload.course == null ? null : Number(payload.course),
    university: payload.university,
    phone: payload.phone,
    documents,
    status: "new",
  });

  return {
    status: doc.status,
    specialization: doc.specialization,
    submittedAt: doc.createdAt,
  };
}

module.exports = {
  openSpecialties,
  courses,
  submit,
  isRegistrationOpen,
  assertSpecialtyOpen,
};
