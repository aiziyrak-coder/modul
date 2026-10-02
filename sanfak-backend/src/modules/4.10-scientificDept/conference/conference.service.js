const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const Conference = require("./conference.model");
const {
  zipFileSlots,
  assertAllSlots,
} = require("#modules/4.10-scientificDept/_shared/fileSlots");
const { fileResigner } = require("../_shared/fileUrlSign");

const { CONF_DOC_SLOTS } = Conference;

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const POPULATE = [
  { path: "createdBy", select: "firstName lastName" },
  { path: "kafedras.department", select: "title" },
  { path: "kafedras.acceptedBy", select: "firstName lastName" },
];

const notFound = () => new ErrorHandler(404, "Konferensiya topilmadi");

const roleOf = (user) => user.role?.title;
const isAdmin = (user) =>
  roleOf(user) === ROLES.SUPER_ADMIN || roleOf(user) === ROLES.ADMIN;
const isIlmiy = (user) => roleOf(user) === ROLES.ILMIY_BOLIM || isAdmin(user);

const mapScope = (scope = {}) => {
  if (scope.department) return { "kafedras.department": scope.department };
  if (scope.user) return { createdBy: scope.user };
  return scope;
};

const buildQuery = (query = {}, scope = {}) => {
  const q = { active: true };
  if (query.type) q.type = query.type;
  if (query.status) q.status = query.status;
  if (query.dateFrom || query.dateTo) {
    q.createdAt = {};
    if (query.dateFrom) q.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setUTCHours(23, 59, 59, 999);
      q.createdAt.$lte = end;
    }
  }
  if (query.search) {
    q.title = { $regex: new RegExp(escapeRegex(query.search), "i") };
  }
  return { ...q, ...mapScope(scope) };
};

const withAcceptedByMe = (docs, user) => {
  const deptId = user?.department?._id || user?.department;
  if (!deptId) return docs;
  const d = String(deptId);
  const mine = (c) =>
    (c.kafedras || []).find((k) => String(k.department?._id || k.department) === d) || null;
  return docs.map((c) => {
    const my = mine(c);
    return {
      ...c,
      acceptedByMe: my?.status === "accepted",
      myKafedra: my,
    };
  });
};

const withFiles = fileResigner(["files", "kafedras"]);

async function list(query, scope, user) {
  const docs = await Conference.find(buildQuery(query, scope))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
  return withAcceptedByMe(withFiles(docs), user);
}

async function paginate(query, scope, user) {
  const { page, limit } = query;
  const res = await Conference.paginate(buildQuery(query, scope), {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: POPULATE,
    lean: true,
  });
  res.docs = withAcceptedByMe(withFiles(res.docs), user);
  return res;
}

async function findById(id, scope, user) {
  const filter = { _id: id, active: true, ...mapScope(scope || {}) };
  const doc = await Conference.findOne(filter).populate(POPULATE).lean();
  if (!doc) throw notFound();
  return withAcceptedByMe([withFiles(doc)], user)[0];
}

async function create(user, payload) {
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Konferensiya yaratish Ilmiy bo'limga tegishli");
  }
  const kafedraIds = Array.isArray(payload.kafedras) ? payload.kafedras : [];
  return Conference.create({
    title: payload.title,
    type: payload.type || "national",
    description: payload.description || "",
    deadline: payload.deadline,
    beforeDeadline: payload.beforeDeadline || undefined,
    afterDeadline: payload.afterDeadline || undefined,
    requiredInfo: Array.isArray(payload.requiredInfo) ? payload.requiredInfo : [],
    requiredDocs: Array.isArray(payload.requiredDocs) ? payload.requiredDocs : [],
    kafedras: kafedraIds.map((department) => ({ department, status: "pending" })),
    createdBy: user._id,
    status: "active",
  });
}

async function update(user, id, payload) {
  const doc = await Conference.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Konferensiyani tahrirlash Ilmiy bo'limga tegishli");
  }

  const scalars = [
    "title",
    "type",
    "description",
    "deadline",
    "beforeDeadline",
    "afterDeadline",
    "status",
  ];
  scalars.forEach((f) => {
    if (payload[f] !== undefined) doc[f] = payload[f];
  });
  if (payload.requiredDocs !== undefined) {
    doc.requiredDocs = Array.isArray(payload.requiredDocs)
      ? payload.requiredDocs
      : [];
  }

  if (payload.requiredInfo !== undefined) {
    doc.requiredInfo = Array.isArray(payload.requiredInfo)
      ? payload.requiredInfo
      : [];
  }
  if (Array.isArray(payload.kafedras)) {
    const wanted = payload.kafedras.map(String);
    const existing = new Map(doc.kafedras.map((k) => [String(k.department), k]));
    const next = wanted.map(
      (dep) => existing.get(dep) || { department: dep, status: "pending" },
    );
    const wantedSet = new Set(wanted);
    doc.kafedras.forEach((k) => {
      if (k.status === "accepted" && !wantedSet.has(String(k.department))) {
        next.push(k);
      }
    });
    doc.kafedras = next;
  }
  await doc.save();
  return doc;
}

async function accept(user, id, payload) {
  const doc = await Conference.findById(id);
  if (!doc || !doc.active) throw notFound();

  const userDept = String(user.department?._id || user.department || "");
  if (!userDept) {
    throw new ErrorHandler(403, "Kafedrangiz aniqlanmadi");
  }
  const row = doc.kafedras.find((k) => String(k.department) === userDept);
  if (!row) {
    throw new ErrorHandler(403, "Konferensiya sizning kafedrangizga yo'naltirilmagan");
  }
  if (row.status === "accepted") {
    throw new ErrorHandler(409, "Konferensiya allaqachon qabul qilingan");
  }

  const required = Array.isArray(doc.requiredDocs) ? doc.requiredDocs : [];

  row.status = "accepted";
  row.acceptedBy = user._id;
  row.acceptedAt = new Date();

  if (required.length) {
    const slots = required.map((_, i) => `doc${i}`);
    const files = zipFileSlots(payload, slots);
    assertAllSlots(files, slots, "Konferensiya hujjatlari");
    row.docs = required.map((d, i) => ({
      label: d.label,
      fileType: d.fileType,
      fileUrl: files[`doc${i}`],
    }));
  } else {
    const files = zipFileSlots(payload, CONF_DOC_SLOTS);
    assertAllSlots(files, CONF_DOC_SLOTS, "Konferensiya hujjatlari");
    row.documents = files;
  }
  await doc.save();
  return doc;
}

async function softDelete(user, id) {
  const doc = await Conference.findById(id);
  if (!doc || !doc.active) throw notFound();
  if (!isIlmiy(user)) {
    throw new ErrorHandler(403, "Konferensiyani o'chirish Ilmiy bo'limga tegishli");
  }
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
  accept,
  softDelete,
  escapeRegex,
};
