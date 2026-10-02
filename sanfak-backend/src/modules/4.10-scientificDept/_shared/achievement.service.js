const { ErrorHandler } = require("#shared/error");
const { resignDocFiles } = require("./fileUrlSign");
const { ROLES } = require("#config/constants");
const MethodicalSpecialty = require("#modules/4.10-scientificDept/methodicalSpecialty/methodicalSpecialty.model");

function createAchievementService(Model, { label, fields, searchFields }) {
  const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const notFound = () => new ErrorHandler(404, `${label} topilmadi`);

  const roleOf = (user) => user.role?.title;
  const isAdmin = (user) =>
    roleOf(user) === ROLES.SUPER_ADMIN || roleOf(user) === ROLES.ADMIN;
  const isIlmiy = (user) => roleOf(user) === ROLES.ILMIY_BOLIM || isAdmin(user);

  const mapScope = (scope = {}) =>
    scope.user ? { author: scope.user } : scope;

  const POPULATE = [
    { path: "author", select: "firstName lastName" },
    { path: "department", select: "title" },
    { path: "faculty", select: "title" },
    { path: "approvedBy", select: "firstName lastName" },
    { path: "rejectedBy", select: "firstName lastName" },
  ];

  const buildQuery = (query = {}, scope = {}) => {
    const q = { active: true };
    if (query.status) q.status = query.status;
    if (query.academicYear) q.academicYear = query.academicYear;
    if (query.faculty) q.faculty = query.faculty;
    if (query.department) q.department = query.department;
    if (query.author) q.author = query.author;
    if (query.dateFrom || query.dateTo) {
      q.createdAt = {};
      if (query.dateFrom) q.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setUTCHours(23, 59, 59, 999);
        q.createdAt.$lte = end;
      }
    }
    if (query.search && searchFields && searchFields.length) {
      const rx = new RegExp(escapeRegex(query.search), "i");
      q.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    return { ...q, ...mapScope(scope) };
  };

  const FILE_FIELDS = ["fileUrl", "autoAbstractUrl"];
  const withFiles = (doc) => resignDocFiles(doc, FILE_FIELDS);

  const hasSpecialty = Array.isArray(fields) && fields.includes("specialty");
  const normName = (s) => String(s || "").trim().toLowerCase();

  async function specialtyCodeMap() {
    if (!hasSpecialty) return null;
    const rows = await MethodicalSpecialty.find({}, { code: 1, name: 1 }).lean();
    return new Map(rows.map((r) => [normName(r.name), r.code]));
  }

  const withSpecialtyCode = (map) => (doc) =>
    map ? { ...doc, specialtyCode: map.get(normName(doc.specialty)) || "" } : doc;

  async function list(query, scope) {
    const [docs, codes] = await Promise.all([
      Model.find(buildQuery(query, scope))
        .sort({ createdAt: -1 })
        .populate(POPULATE)
        .lean(),
      specialtyCodeMap(),
    ]);
    return docs.map(withFiles).map(withSpecialtyCode(codes));
  }

  async function paginate(query, scope) {
    const { page, limit } = query;
    const [res, codes] = await Promise.all([
      Model.paginate(buildQuery(query, scope), {
        page: Number(page),
        limit: Number(limit),
        sort: { createdAt: -1 },
        populate: POPULATE,
        lean: true,
      }),
      specialtyCodeMap(),
    ]);
    return { ...res, docs: res.docs.map(withFiles).map(withSpecialtyCode(codes)) };
  }

  async function findById(id, scope) {
    const filter = { _id: id, active: true, ...mapScope(scope || {}) };
    const [doc, codes] = await Promise.all([
      Model.findOne(filter).populate(POPULATE).lean(),
      specialtyCodeMap(),
    ]);
    if (!doc) throw notFound();
    return withSpecialtyCode(codes)(withFiles(doc));
  }

  const assignFields = (doc, payload) => {
    fields.forEach((f) => {
      if (payload[f] !== undefined) doc[f] = payload[f];
    });
    if (payload.fileUrl) doc.fileUrl = payload.fileUrl;
    if (payload.autoAbstractUrl && doc.schema.path("autoAbstractUrl")) {
      doc.autoAbstractUrl = payload.autoAbstractUrl;
    }
  };

  async function create(user, payload) {
    const doc = new Model({
      author: user._id,
      department: user.department?._id || user.department,
      faculty: user.department?.faculty?._id || user.faculty,
      status: "new",
    });
    assignFields(doc, payload);
    await doc.save();
    return doc;
  }

  async function update(user, id, payload) {
    const doc = await Model.findById(id);
    if (!doc || !doc.active) throw notFound();
    if (String(doc.author) !== String(user._id) && !isAdmin(user)) {
      throw new ErrorHandler(403, `Faqat o'z ${label.toLowerCase()}ingizni tahrirlaysiz`);
    }
    if (!["new", "rejected"].includes(doc.status)) {
      throw new ErrorHandler(409, `Tasdiqlangan ${label.toLowerCase()}ni tahrirlab bo'lmaydi`);
    }
    assignFields(doc, payload);
    doc.status = "new";
    doc.approvedBy = undefined;
    doc.approvedAt = undefined;
    doc.rejectionReason = undefined;
    doc.rejectedBy = undefined;
    doc.rejectedByRole = "";
    await doc.save();
    return doc;
  }

  const assertNotSelf = (doc, user) => {
    if (String(doc.author) === String(user._id)) {
      throw new ErrorHandler(403, `O'z ${label.toLowerCase()}ingizni tasdiqlay/rad eta olmaysiz`);
    }
  };

  async function approve(user, id) {
    const doc = await Model.findById(id);
    if (!doc || !doc.active) throw notFound();
    if (!isIlmiy(user)) {
      throw new ErrorHandler(403, "Tasdiqlash Ilmiy bo'limga tegishli");
    }
    assertNotSelf(doc, user);
    if (doc.status !== "new") {
      throw new ErrorHandler(409, `${label} tasdiqlash bosqichida emas`);
    }
    doc.status = "approved";
    doc.approvedBy = user._id;
    doc.approvedAt = new Date();
    await doc.save();
    return doc;
  }

  async function reject(user, id, reason) {
    const doc = await Model.findById(id);
    if (!doc || !doc.active) throw notFound();
    if (!isIlmiy(user)) {
      throw new ErrorHandler(403, "Rad etish Ilmiy bo'limga tegishli");
    }
    assertNotSelf(doc, user);
    if (doc.status !== "new") {
      throw new ErrorHandler(409, `${label} tasdiqlash bosqichida emas`);
    }
    doc.status = "rejected";
    doc.rejectionReason = reason;
    doc.rejectedBy = user._id;
    doc.rejectedByRole = user.role?.title || "";
    await doc.save();
    return doc;
  }

  async function softDelete(user, id) {
    const doc = await Model.findById(id);
    if (!doc || !doc.active) throw notFound();
    if (String(doc.author) !== String(user._id) && !isAdmin(user)) {
      throw new ErrorHandler(403, `Faqat o'z ${label.toLowerCase()}ingizni o'chirasiz`);
    }
    if (!["new", "rejected"].includes(doc.status)) {
      throw new ErrorHandler(409, `Tasdiqlangan ${label.toLowerCase()}ni o'chirib bo'lmaydi`);
    }
    doc.active = false;
    await doc.save();
    return doc;
  }

  return {
    list,
    paginate,
    findById,
    create,
    update,
    approve,
    reject,
    softDelete,
    escapeRegex,
  };
}

module.exports = { createAchievementService };
