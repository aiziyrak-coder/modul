const { ErrorHandler } = require("#shared/error");
const ScientificWork = require("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");
const CouncilSpecialty = require("#modules/4.06-scientificCouncil/councilSpecialty/councilSpecialty.model");
const ApplicationTemplate = require("#modules/4.06-scientificCouncil/applicationTemplate/applicationTemplate.model");
const AcademicTitle = require("#references/academicTitle/academicTitle.model");
const AcademicLevel = require("#references/academicLevel/academicLevel.model");

const ACADEMIC_YEAR_START_MONTH = 8;
const YEAR_RE = /^\d{4}-\d{4}$/;

const computeYears = (now = new Date()) => {
  const y = now.getFullYear();
  const start = now.getMonth() >= ACADEMIC_YEAR_START_MONTH ? y : y - 1;
  return [start + 1, start, start - 1].map((s) => s + "-" + (s + 1));
};

const readAcademicYears = async () => {
  try {
    const AcademicYear = require("#references/academicYear/academicYear.model");
    return await AcademicYear.find({ active: true }, { title: 1 }).lean().exec();
  } catch {
    return [];
  }
};

const listYears = async () => {
  const docs = await readAcademicYears();
  const fromRef = docs
    .map((d) => String(d.title).replace("/", "-"))
    .filter((v) => YEAR_RE.test(v));
  const years = fromRef.length > 0 ? fromRef : computeYears();
  return [...new Set(years)].sort().reverse();
};

const refTitles = async (Model) => {
  const docs = await Model.find({ active: true }, { title: 1 })
    .sort({ title: 1 })
    .lean()
    .exec();
  return docs.map((d) => d.title).filter(Boolean);
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const emptyToUndefined = (v) => {
  const s = typeof v === "string" ? v.trim() : v;
  return s || undefined;
};

const service = {
  computeYears,
  listYears,

  getFormRefs: async () => {
    const [specialties, academicTitles, academicLevels, years, template] =
      await Promise.all([
        CouncilSpecialty.find({ active: true }, { title: 1, code: 1, branch: 1 })
          .sort({ code: 1 })
          .lean()
          .exec(),
        refTitles(AcademicTitle),
        refTitles(AcademicLevel),
        listYears(),
        ApplicationTemplate.findOne({ key: "application" }).lean().exec(),
      ]);

    return {
      specialties: specialties.map((s) => ({
        _id: String(s._id),
        title: s.title,
        code: s.code,
        branch: s.branch ?? null,
      })),
      academicTitles,
      academicLevels,
      years,
      template: template
        ? {
            _id: String(template._id),
            fileName: template.fileName,
            filePath: template.filePath,
            size: template.size ?? null,
            unit: template.unit ?? null,
            updatedAt: template.updatedAt ?? null,
          }
        : null,
    };
  },

  submitApplication: async (data) => {
    const specialty = await CouncilSpecialty.findOne({
      _id: data.specialty,
      active: true,
    })
      .lean()
      .exec();
    if (!specialty) {
      throw new ErrorHandler(400, "Tanlangan ixtisoslik topilmadi yoki faol emas");
    }

    const years = await listYears();
    if (!years.includes(data.year)) {
      throw new ErrorHandler(400, "O'quv yili noto'g'ri");
    }

    const duplicate = await ScientificWork.findOne({
      "externalAuthor.pinfl": data.pinfl.trim(),
      status: "new",
      active: true,
      title: new RegExp("^" + escapeRegex(data.title.trim()) + "$", "i"),
    })
      .lean()
      .exec();
    if (duplicate) {
      throw new ErrorHandler(
        409,
        "Bu ilmiy ish bo'yicha arizangiz allaqachon qabul qilingan va ko'rib chiqilmoqda",
      );
    }

    const work = new ScientificWork({
      title: data.title.trim(),
      year: data.year,
      specialty: specialty._id,
      authorType: "external",
      externalAuthor: {
        name: data.fullName.trim(),
        workplace: data.workplace.trim(),
        position: data.position.trim(),
        passportSeries: data.passportSeries.trim().toUpperCase(),
        passportNumber: data.passportNumber.trim(),
        pinfl: data.pinfl.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
      },
      supervisor: {
        type: "external",
        name: data.supervisorName.trim(),
        workplace: data.supervisorWorkplace.trim(),
        position: data.supervisorPosition.trim(),
        academicTitle: emptyToUndefined(data.supervisorAcademicTitle),
        degree: emptyToUndefined(data.supervisorDegree),
        email: emptyToUndefined(data.supervisorEmail),
        phone: emptyToUndefined(data.supervisorPhone),
      },
      workFile: data.workFile,
      status: "new",
      active: true,
      auditLog: [
        {
          action: "public_application_submitted",
          role: "tashqi_tadqiqotchi",
          detail: "Ochiq forma orqali ariza topshirildi: " + data.fullName.trim(),
        },
      ],
    });

    await work.save();
    return work;
  },
};

module.exports = service;
