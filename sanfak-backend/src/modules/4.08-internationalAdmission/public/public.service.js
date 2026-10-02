const { ErrorHandler } = require("#shared/error");
const AdmissionCountry = require("../admissionCountry/admissionCountry.model");
const AdmissionOffer = require("../admissionOffer/admissionOffer.model");
const seasonService = require("../admissionSeason/admissionSeason.service");
const applicantService = require("../internationalAdmission/internationalAdmission.service");
const Applicant = require("../internationalAdmission/internationalAdmission.model");

const SUFFIX = { uz: "Uz", ru: "Ru", en: "En" };

const pick = (doc, base, lang) => doc[`${base}${SUFFIX[lang]}`] || doc[`${base}Uz`] || "";

function langFields(doc, bases, lang) {
  const out = {};
  for (const base of bases) {
    if (lang) {
      out[base] = pick(doc, base, lang);
    } else {
      out[`${base}Uz`] = doc[`${base}Uz`];
      out[`${base}Ru`] = doc[`${base}Ru`];
      out[`${base}En`] = doc[`${base}En`];
    }
  }
  return out;
}

const shapeRef = (d, lang) => ({ id: String(d._id), ...langFields(d, ["title"], lang) });

const SORT = { titleUz: 1 };

const seasonItems = (season) => (season?.items || []).filter((i) => i.direction);

function collectRefs(items, key, directionId) {
  const rows = directionId
    ? items.filter((i) => String(i.direction._id) === String(directionId))
    : items;
  const seen = new Map();
  for (const item of rows) {
    for (const ref of item[key] || []) {
      if (ref && !seen.has(String(ref._id))) seen.set(String(ref._id), ref);
    }
  }
  return [...seen.values()];
}

function collectDirections(items) {
  const seen = new Map();
  for (const item of items) {
    const d = item.direction;
    if (d && !seen.has(String(d._id))) seen.set(String(d._id), d);
  }
  return [...seen.values()];
}

const byTitle = (a, b) => String(a.titleUz || "").localeCompare(String(b.titleUz || ""));

async function directions(lang) {
  const season = await seasonService.findOpenSeason();
  return collectDirections(seasonItems(season))
    .sort(byTitle)
    .map((d) => shapeRef(d, lang));
}

async function educationForms(lang, directionId) {
  const season = await seasonService.findOpenSeason();
  return collectRefs(seasonItems(season), "educationForms", directionId)
    .sort(byTitle)
    .map((d) => ({
      id: String(d._id),
      ...langFields(d, ["title", "description"], lang),
    }));
}

async function educationLanguages(lang, directionId) {
  const season = await seasonService.findOpenSeason();
  return collectRefs(seasonItems(season), "educationLanguages", directionId)
    .sort(byTitle)
    .map((d) => shapeRef(d, lang));
}

async function countries(lang) {
  const docs = await AdmissionCountry.find({ active: true }).sort(SORT).lean();
  return docs.map((d) => ({
    id: String(d._id),
    ...langFields(d, ["title"], lang),
    flagUrl: d.flagUrl,
    passportSample: d.passportSample,
    phoneSample: d.phoneSample,
  }));
}

async function offer(lang) {
  const doc = await AdmissionOffer.findOne({ active: true }).sort({ createdAt: 1 }).lean();
  const blocks = (doc?.blocks || []).slice().sort((a, b) => a.order - b.order);
  return {
    blocks: blocks.map((b) => ({
      order: b.order,
      ...langFields(b, ["title", "body"], lang),
    })),
    updatedAt: doc?.updatedAt,
  };
}

async function openSeason(lang) {
  const doc = await seasonService.findOpenSeason();
  if (!doc) return null;
  return {
    id: String(doc._id),
    ...langFields(doc, ["title", "description"], lang),
    academicYear: doc.academicYear,
    season: doc.season,
    openDate: doc.openDate,
    closeDate: doc.closeDate,
    items: (doc.items || [])
      .filter((i) => i.direction)
      .map((i) => ({
        direction: shapeRef(i.direction, lang),
        educationForms: (i.educationForms || []).filter(Boolean).map((f) => shapeRef(f, lang)),
        educationLanguages: (i.educationLanguages || [])
          .filter(Boolean)
          .map((l) => shapeRef(l, lang)),
      })),
  };
}

async function resolveCountryName(countryId) {
  const c = await AdmissionCountry.findById(countryId).select("titleUz").lean();
  if (!c) throw new ErrorHandler(400, "Bunday davlat topilmadi");
  return c.titleUz;
}

function assertSeasonAllows(season, payload) {
  const items = seasonItems(season);
  const item = items.find((i) => String(i.direction._id) === String(payload.direction));
  if (!item) {
    throw new ErrorHandler(400, "Bu yo'nalishga hozirda qabul e'lon qilinmagan");
  }
  const allowed = (list, id) =>
    !id || (list || []).some((r) => r && String(r._id) === String(id));
  if (!allowed(item.educationForms, payload.educationForm)) {
    throw new ErrorHandler(400, "Tanlangan ta'lim shakli bu yo'nalish uchun ochiq emas");
  }
  if (!allowed(item.educationLanguages, payload.educationLanguage)) {
    throw new ErrorHandler(400, "Tanlangan ta'lim tili bu yo'nalish uchun ochiq emas");
  }
  return item;
}

async function submitApplication(payload) {
  const season = await seasonService.findOpenSeason();
  if (!season) {
    throw new ErrorHandler(400, "Hozirda ochiq qabul mavsumi yo'q — ariza qabul qilinmaydi");
  }

  assertSeasonAllows(season, payload);

  const documents = payload.documents || {};
  if (!documents.passport || !documents.passport.fileUrl) {
    throw new ErrorHandler(400, "Pasport nusxasi majburiy");
  }
  if (!documents.diploma || !documents.diploma.fileUrl) {
    throw new ErrorHandler(400, "Diplom / shahodatnoma nusxasi majburiy");
  }

  const countryName = await resolveCountryName(payload.country);

  const existing = await Applicant.findOne({
    passportNumber: payload.passportNumber,
    active: true,
    status: { $ne: "rejected" },
  })
    .select("applicationNumber")
    .lean();
  if (existing) {
    throw new ErrorHandler(
      409,
      "Ushbu pasport egasining amaldagi arizasi mavjud",
      existing.applicationNumber,
    );
  }

  const doc = await applicantService.create({
    ...payload,
    country: countryName,
    season: season._id,
    academicYear: season.academicYear,
    status: "new",
  });

  return {
    applicationNumber: doc.applicationNumber,
    fullName: doc.fullName,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

const STATUS_FIELDS = "applicationNumber fullName status rejectionReason createdAt reviewedAt";

const shapeStatus = (doc) => ({
  applicationNumber: doc.applicationNumber,
  fullName: doc.fullName,
  status: doc.status,
  rejectionReason: doc.rejectionReason || undefined,
  createdAt: doc.createdAt,
  reviewedAt: doc.reviewedAt,
});

async function applicationStatus(applicationNumber) {
  const doc = await Applicant.findOne({ applicationNumber, active: true })
    .select(STATUS_FIELDS)
    .lean();
  if (!doc) throw new ErrorHandler(404, "Bunday raqamli ariza topilmadi");
  return shapeStatus(doc);
}

async function lookupStatus({ applicationNumber, country, passportNumber }) {
  let doc;
  if (applicationNumber) {
    doc = await Applicant.findOne({ applicationNumber, active: true })
      .select(STATUS_FIELDS)
      .lean();
  } else {
    const countryName = await resolveCountryName(country);
    doc = await Applicant.findOne({ country: countryName, passportNumber, active: true })
      .sort({ createdAt: -1 })
      .select(STATUS_FIELDS)
      .lean();
  }
  if (!doc) throw new ErrorHandler(404, "Bunday ma'lumotli ariza topilmadi");
  return shapeStatus(doc);
}

module.exports = {
  collectRefs,
  collectDirections,
  assertSeasonAllows,
  directions,
  educationForms,
  educationLanguages,
  countries,
  offer,
  openSeason,
  submitApplication,
  applicationStatus,
  lookupStatus,
  pick,
  langFields,
};
