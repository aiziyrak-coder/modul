const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const { resignDocFiles } = require("./fileUrlSign");

function createThreeStagePlanService(Model, { label }) {
  const POPULATE = [
    { path: "department", select: "title" },
    { path: "faculty", select: "title" },
    { path: "academicYear", select: "title" },
    { path: "createdBy", select: "firstName lastName" },
    { path: "dekanApprovedBy", select: "firstName lastName" },
    { path: "prorektorApprovedBy", select: "firstName lastName" },
    { path: "rejectedBy", select: "firstName lastName" },
  ];

  const notFound = () => new ErrorHandler(404, `${label} topilmadi`);

  const mapScope = (scope = {}) => {
    if (scope.user) return { createdBy: scope.user };
    return scope;
  };

  const buildQuery = (query = {}, scope = {}) => {
    const q = { active: true };
    const { status, academicYear, faculty, department, dateFrom, dateTo } = query;
    if (status) q.status = status;
    if (academicYear) q.academicYear = academicYear;
    if (faculty) q.faculty = faculty;
    if (department) q.department = department;
    if (dateFrom || dateTo) {
      q.createdAt = {};
      if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setUTCHours(23, 59, 59, 999);
        q.createdAt.$lte = end;
      }
    }
    return { ...q, ...mapScope(scope) };
  };


  const resignFileUrl = (doc) => resignDocFiles(doc, ["fileUrl"]);
  async function list(query, scope) {
    const docs = await Model.find(buildQuery(query, scope))
      .sort({ createdAt: -1 })
      .populate(POPULATE)
      .lean();
    return docs.map(resignFileUrl);
  }

  async function paginate(query, scope) {
    const { page, limit } = query;
    const res = await Model.paginate(buildQuery(query, scope), {
      page: Number(page),
      limit: Number(limit),
      sort: { createdAt: -1 },
      populate: POPULATE,
      lean: true,
    });
    return { ...res, docs: res.docs.map(resignFileUrl) };
  }

  async function findById(id, scope) {
    const filter = { _id: id, active: true, ...mapScope(scope || {}) };
    const doc = await Model.findOne(filter).populate(POPULATE).lean();
    if (!doc) throw notFound();
    return resignFileUrl(doc);
  }

  async function create(user, payload) {
    const department = user.department?._id || user.department || null;
    const faculty =
      user.department?.faculty?._id || user.department?.faculty || null;
    if (!department) {
      throw new ErrorHandler(403, "Foydalanuvchiga kafedra biriktirilmagan");
    }
    const existing = await Model.findOne({
      department,
      academicYear: payload.academicYear,
      active: true,
    }).lean();
    if (existing) {
      throw new ErrorHandler(
        400,
        `Bu o'quv yili uchun ${label.toLowerCase()} allaqachon yuklangan — mavjudini tahrirlang`,
      );
    }
    if (!payload.fileUrl) {
      throw new ErrorHandler(400, "PDF fayl majburiy");
    }
    return Model.create({
      department,
      faculty,
      createdBy: user._id,
      academicYear: payload.academicYear,
      fileUrl: payload.fileUrl,
      status: "new",
    });
  }

  async function update(user, id, payload) {
    const doc = await Model.findById(id);
    if (!doc || !doc.active) throw notFound();

    const userDept = String(user.department?._id || user.department || "");
    const isOwnDept = userDept && String(doc.department) === userDept;
    const isSuper = user.role?.title === ROLES.SUPER_ADMIN;
    if (!isOwnDept && !isSuper) {
      throw new ErrorHandler(403, "Faqat o'z kafedrangiz hujjatini tahrirlaysiz");
    }
    if (!["new", "rejected"].includes(doc.status)) {
      throw new ErrorHandler(400, "Tasdiqlash jarayonidagi hujjat tahrirlanmaydi");
    }

    if (payload.academicYear !== undefined) doc.academicYear = payload.academicYear;
    if (payload.fileUrl !== undefined) doc.fileUrl = payload.fileUrl;

    doc.status = "new";
    doc.rejectionReason = undefined;
    doc.rejectedBy = undefined;
    doc.rejectedByRole = "";
    doc.dekanApprovedBy = undefined;
    doc.dekanApprovedAt = undefined;
    doc.prorektorApprovedBy = undefined;
    doc.prorektorApprovedAt = undefined;

    await doc.save();
    return doc;
  }

  async function approve(user, id) {
    const doc = await Model.findById(id);
    if (!doc || !doc.active) throw notFound();

    const role = user.role?.title;
    const isAdmin = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;

    if (role === ROLES.DEKAN || (isAdmin && doc.status === "new")) {
      if (doc.status !== "new") {
        throw new ErrorHandler(400, "Dekan faqat 'Yangi' holatda tasdiqlaydi");
      }
      doc.status = "pending";
      doc.dekanApprovedBy = user._id;
      doc.dekanApprovedAt = new Date();
    } else if (role === ROLES.PROREKTOR || (isAdmin && doc.status === "pending")) {
      if (doc.status !== "pending") {
        throw new ErrorHandler(
          400,
          "Prorektor faqat dekan tasdiqlagan hujjatni tasdiqlaydi",
        );
      }
      doc.status = "approved";
      doc.prorektorApprovedBy = user._id;
      doc.prorektorApprovedAt = new Date();
    } else {
      throw new ErrorHandler(403, "Bu bosqichda tasdiqlash sizning vazifangiz emas");
    }

    await doc.save();
    return doc;
  }

  async function reject(user, id, reason) {
    const doc = await Model.findById(id);
    if (!doc || !doc.active) throw notFound();

    const role = user.role?.title;
    const isAdmin = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
    const stageOk =
      (role === ROLES.DEKAN && doc.status === "new") ||
      (role === ROLES.PROREKTOR && doc.status === "pending") ||
      (isAdmin && ["new", "pending"].includes(doc.status));
    if (!stageOk) {
      throw new ErrorHandler(403, "Bu bosqichda rad etish sizning vazifangiz emas");
    }

    const stageRole = doc.status === "new" ? ROLES.DEKAN : ROLES.PROREKTOR;

    doc.status = "rejected";
    doc.rejectionReason = reason;
    doc.rejectedBy = user._id;
    doc.rejectedByRole = isAdmin ? stageRole : role;
    await doc.save();
    return doc;
  }

  return { list, paginate, findById, create, update, approve, reject };
}

module.exports = { createThreeStagePlanService };
