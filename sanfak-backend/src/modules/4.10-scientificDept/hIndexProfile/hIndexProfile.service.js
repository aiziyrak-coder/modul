const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const HIndexProfile = require("./hIndexProfile.model");
const scopus = require("./hIndexProfile.scopus");
const scholar = require("./hIndexProfile.scholar");

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const POPULATE = [
  { path: "teacher", select: "firstName lastName" },
  { path: "department", select: "title" },
  { path: "faculty", select: "title" },
];

const notFound = () => new ErrorHandler(404, "H-indeks profili topilmadi");

const mapScope = (scope = {}) => {
  if (scope.user) return { teacher: scope.user };
  return scope;
};

const buildQuery = (query = {}, scope = {}) => {
  const q = { active: true };
  if (query.faculty) q.faculty = query.faculty;
  if (query.department) q.department = query.department;
  return { ...q, ...mapScope(scope) };
};

async function list(query, scope) {
  const docs = await HIndexProfile.find(buildQuery(query, scope))
    .sort({ updatedAt: -1 })
    .populate(POPULATE)
    .lean();
  if (!query.search) return docs;
  const rx = new RegExp(escapeRegex(query.search), "i");
  return docs.filter((d) => {
    const name = [d.teacher?.lastName, d.teacher?.firstName]
      .filter(Boolean)
      .join(" ");
    return rx.test(name);
  });
}

async function paginate(query, scope) {
  const { page, limit } = query;
  return HIndexProfile.paginate(buildQuery(query, scope), {
    page: Number(page),
    limit: Number(limit),
    sort: { updatedAt: -1 },
    populate: POPULATE,
    lean: true,
  });
}

async function findById(id, scope) {
  const filter = { _id: id, active: true, ...mapScope(scope || {}) };
  const doc = await HIndexProfile.findOne(filter).populate(POPULATE).lean();
  if (!doc) throw notFound();
  return doc;
}

async function getMine(user) {
  return HIndexProfile.findOne({ teacher: user._id, active: true })
    .populate(POPULATE)
    .lean();
}

async function syncScopusInto(doc) {
  if (!doc.scopusUrl) {
    doc.scopusAuthorId = "";
    doc.scopusSyncError = "";
    return doc;
  }

  const authorId = scopus.parseScopusAuthorId(doc.scopusUrl);
  doc.scopusAuthorId = authorId || "";

  if (!authorId) {
    doc.scopusSyncError = "URL dan Scopus muallif ID si ajratilmadi";
    return doc;
  }

  try {
    const m = await scopus.fetchAuthorMetrics(authorId);
    doc.scopusHIndex = m.hIndex;
    doc.scopusCitations = m.citations;
    doc.scopusDocuments = m.documents;
    doc.scopusSyncedAt = new Date();
    doc.scopusSyncError = "";
  } catch (err) {
    doc.scopusSyncError = err.message;
    winston.warn(`[hIndex] Scopus sync xato (AU-ID ${authorId}): ${err.message}`);
  }
  return doc;
}

async function syncScholarInto(doc) {
  if (!doc.scholarUrl) {
    doc.scholarUserId = "";
    doc.scholarSyncError = "";
    return doc;
  }

  const userId = scholar.parseScholarUserId(doc.scholarUrl);
  doc.scholarUserId = userId || "";

  if (!userId) {
    doc.scholarSyncError = "URL dan Scholar profil ID si ajratilmadi";
    return doc;
  }

  try {
    const m = await scholar.fetchScholarMetrics(userId);
    doc.scholarHIndex = m.hIndex;
    doc.scholarCitations = m.citations;
    doc.scholarI10Index = m.i10Index;
    doc.scholarSyncedAt = new Date();
    doc.scholarSyncError = "";
  } catch (err) {
    doc.scholarSyncError = err.message;
    winston.warn(`[hIndex] Scholar sync xato (user ${userId}): ${err.message}`);
  }
  return doc;
}

async function refreshProfile(filter) {
  const doc = await HIndexProfile.findOne({ ...filter, active: true });
  if (!doc) throw notFound();
  await syncScopusInto(doc);
  await syncScholarInto(doc);
  await doc.save();
  return HIndexProfile.findById(doc._id).populate(POPULATE).lean();
}

const refreshMine = (user) => refreshProfile({ teacher: user._id });

const refreshById = (id, scope) => refreshProfile({ _id: id, ...mapScope(scope || {}) });

async function upsertMine(user, payload) {
  let doc = await HIndexProfile.findOne({ teacher: user._id });
  if (!doc) {
    doc = new HIndexProfile({ teacher: user._id });
  }
  if (!doc.active) doc.active = true;
  doc.department = user.department?._id || user.department;
  doc.faculty = user.department?.faculty?._id || user.faculty;

  const fields = ["scopusUrl", "scholarUrl", "scholarHIndex", "scholarCitations"];
  fields.forEach((f) => {
    if (payload[f] !== undefined) doc[f] = payload[f];
  });

  if (payload.scopusUrl !== undefined) await syncScopusInto(doc);
  if (payload.scholarUrl !== undefined) await syncScholarInto(doc);

  await doc.save();
  return doc;
}

const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

async function exportRows(query, scope) {
  const docs = await list(query, scope);
  return docs.map((d, i) => ({
    no: i + 1,
    teacher:
      [d.teacher?.lastName, d.teacher?.firstName].filter(Boolean).join(" ") || "",
    faculty: d.faculty?.title || "",
    department: d.department?.title || "",
    scopusUrl: d.scopusUrl || "",
    scopusHIndex: d.scopusHIndex || 0,
    scopusCitations: d.scopusCitations || 0,
    scopusDocuments: d.scopusDocuments || 0,
    scholarUrl: d.scholarUrl || "",
    scholarHIndex: d.scholarHIndex || 0,
    scholarCitations: d.scholarCitations || 0,
    scholarI10Index: d.scholarI10Index || 0,
    syncedAt: [isoDay(d.scopusSyncedAt), isoDay(d.scholarSyncedAt)]
      .filter(Boolean)
      .sort()
      .pop() || "",
  }));
}

module.exports = {
  list,
  paginate,
  findById,
  getMine,
  upsertMine,
  refreshMine,
  refreshById,
  syncScopusInto,
  syncScholarInto,
  exportRows,
  escapeRegex,
};
