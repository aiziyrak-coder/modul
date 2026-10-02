const { ErrorHandler } = require("#shared/error");
const Applicant = require("./internationalAdmission.model");
const AdmissionDirection = require("../admissionDirection/admissionDirection.model");

const POPULATE = [
  { path: "reviewedBy", select: "firstName lastName" },
  { path: "direction", select: "titleUz titleRu titleEn" },
  { path: "educationForm", select: "titleUz titleRu titleEn" },
  { path: "educationLanguage", select: "titleUz titleRu titleEn" },
  { path: "season", select: "titleUz titleRu titleEn season academicYear" },
];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildQuery({ search, country, status, academicYear, direction, active, dateFrom, dateTo } = {}) {
  const q = {};
  if (search) q.fullName = { $regex: new RegExp(escapeRegex(search), "i") };
  if (country) q.country = country;
  if (status) q.status = status;
  if (academicYear) q.academicYear = academicYear;
  if (direction) q.direction = direction;
  if (dateFrom || dateTo) {
    q.createdAt = {};
    if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      q.createdAt.$lte = end;
    }
  }
  q.active = active === undefined ? true : active === "true" || active === true;
  return q;
}

async function list(query) {
  return Applicant.find(buildQuery(query)).sort({ createdAt: -1 }).populate(POPULATE).lean();
}

async function paginate(query) {
  const { page, limit } = query;
  return Applicant.paginate(buildQuery(query), {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: POPULATE,
    lean: true,
  });
}

async function findById(id) {
  const doc = await Applicant.findById(id).populate(POPULATE).lean();
  if (!doc || !doc.active) throw new ErrorHandler(404, "Ariza topilmadi");
  return doc;
}

async function generateApplicationNumber(now = new Date()) {
  const year = now.getFullYear();
  const prefix = `APP-${year}-`;
  const last = await Applicant.findOne({ applicationNumber: { $regex: `^${prefix}` } })
    .sort({ applicationNumber: -1 })
    .select("applicationNumber")
    .lean();
  const lastSeq = last ? Number(String(last.applicationNumber).slice(prefix.length)) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(5, "0")}`;
}

async function create(payload) {
  const applicationNumber = payload.applicationNumber || (await generateApplicationNumber());
  return Applicant.create({ ...payload, applicationNumber });
}

async function update(id, payload) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Ariza topilmadi");
  if (doc.status !== "new") {
    throw new ErrorHandler(400, "Faqat 'Yangi' holatdagi arizani tahrirlash mumkin");
  }
  Object.assign(doc, payload);
  await doc.save();
  return doc;
}

async function approve(user, id) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Ariza topilmadi");
  if (doc.status !== "new") {
    throw new ErrorHandler(400, "Faqat 'Yangi' holatdagi arizani tasdiqlash mumkin");
  }
  doc.status = "approved";
  doc.rejectionReason = "";
  doc.reviewedBy = user._id;
  doc.reviewedAt = new Date();
  await doc.save();
  return doc;
}

async function reject(user, id, reason) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Ariza topilmadi");
  if (doc.status !== "new") {
    throw new ErrorHandler(400, "Faqat 'Yangi' holatdagi arizani qaytarish mumkin");
  }
  doc.status = "rejected";
  doc.rejectionReason = reason;
  doc.reviewedBy = user._id;
  doc.reviewedAt = new Date();
  await doc.save();
  return doc;
}

async function stats({ from, to, academicYear } = {}) {
  const match = { active: true };
  if (academicYear) match.academicYear = academicYear;
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }

  const [result] = await Applicant.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: "count" }],
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byCountry: [
          { $group: { _id: "$country", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
        byDirection: [
          { $match: { direction: { $ne: null } } },
          { $group: { _id: "$direction", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
        byMonth: [
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const statusCounts = { new: 0, approved: 0, rejected: 0 };
  (result.byStatus || []).forEach((s) => {
    if (s._id in statusCounts) statusCounts[s._id] = s.count;
  });

  const directionBuckets = result.byDirection || [];
  const directionIds = directionBuckets.map((d) => d._id);
  const directions = directionIds.length
    ? await AdmissionDirection.find({ _id: { $in: directionIds } })
        .select("titleUz titleRu titleEn")
        .lean()
    : [];
  const titleById = new Map(directions.map((d) => [String(d._id), d]));

  return {
    total: result.total?.[0]?.count || 0,
    byStatus: statusCounts,
    byCountry: (result.byCountry || [])
      .filter((c) => c._id)
      .map((c) => ({ country: c._id, count: c.count })),
    byDirection: directionBuckets
      .map((d) => {
        const title = titleById.get(String(d._id));
        return title
          ? {
              id: String(d._id),
              titleUz: title.titleUz,
              titleRu: title.titleRu,
              titleEn: title.titleEn,
              count: d.count,
            }
          : null;
      })
      .filter(Boolean),
    byMonth: (result.byMonth || []).map((m) => ({ month: m._id, count: m.count })),
  };
}

async function distinctCountries() {
  const values = await Applicant.distinct("country", { active: true });
  return values.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

async function softDelete(id) {
  const doc = await Applicant.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Ariza topilmadi");
  doc.active = false;
  await doc.save();
  return doc;
}

module.exports = {
  list,
  paginate,
  findById,
  stats,
  distinctCountries,
  generateApplicationNumber,
  create,
  update,
  approve,
  reject,
  softDelete,
  buildQuery,
  escapeRegex,
};
