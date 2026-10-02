const { ErrorHandler } = require("#shared/error");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const winston = require("#shared/winston.logger");
const {
  denyActForResident,
} = require("#modules/4.05-residency/_services/residentScope");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { APPROVAL_ROLES } = require("./workPlanSchemas");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  applyScopedEquals,
} = require("#modules/4.05-residency/_services/scopeGuard");
const { searchRegex } = require("./searchTerm");

const { isSameUzDay } = require("#modules/4.05-residency/_services/uzDay");
const RESIDENT_POP = {
  path: "resident",
  select:
    "fullName program specialtyTitle departmentTitle courseNumber group groupTitle user specialty department",
    populate: RESIDENT_REF_POPULATE,
};
const SUP_POP = {
  path: "supervisor",
  select: "firstName lastName middleName position",
};

const canEdit = (doc) => doc.status === "yangi" || doc.status === "rad_etilgan";
const isTaskDone = (t) =>
  (t.proofs || []).filter((p) => p.status === "approved").length >=
  (t.targetCount || 1);
const isPlanComplete = (doc) =>
  doc.tasks.length > 0 && doc.tasks.every(isTaskDone);

const ownedResidentIds = (user, title) =>
  Resident.find(
    title === "ilmiy_rahbar" ? { supervisor: user._id } : { user: user._id },
  ).distinct("_id");

async function buildPlanScope(user) {
  const role = user?.role || {};
  const scopeLevel = role.scopeLevel || "self";
  const title = role.title;
  if (
    scopeLevel === "global" ||
    title === "magistratura_bolim" ||
    title === "kafedra_mudiri"
  ) {
    return {};
  }
  return { resident: { $in: await ownedResidentIds(user, title) } };
}

async function canAccessPlan(user, doc) {
  if (!user || !doc) return false;
  const role = user.role || {};
  const title = role.title;
  const scopeLevel = role.scopeLevel || "self";
  const idOf = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

  if (
    scopeLevel === "global" ||
    title === "magistratura_bolim" ||
    title === "kafedra_mudiri"
  )
    return true;

  const ids = await ownedResidentIds(user, title);
  return ids.some((id) => String(id) === idOf(doc.resident));
}

async function guardPlan(req, res, doc) {
  if (await canAccessPlan(req.user, doc)) return true;
  res.status(404).json({ message: "not found" });
  return false;
}

async function notifyMagistrant(doc, { title, body, link }) {
  try {
    const r = await Resident.findById(doc.resident).select("user");
    if (!r?.user) return;
    await dispatch({
      userId: r.user,
      eventType: "residency_plan_reviewed",
      title,
      body,
      link,
    });
  } catch (err) {
    winston.warn(`[WorkPlanService] notifyMagistrant xato: ${err.message}`);
  }
}

function makeController(Model, { categories, linkPrefix, label }) {
  const validCategory = (c) => categories.includes(c);

  function buildFilter(query, scope) {
    const { status, academicYear, resident, search } = query;
    const data = { ...scope };
    if (status) data.status = status;
    applyAcademicYearFilter(data, academicYear);
    applyScopedEquals(data, scope, "resident", resident);
    const rx = searchRegex(search);
    if (rx) data.title = rx;
    return data;
  }

  return {
    addPlan: async (req, res, next) => {
      try {
        let residentId = req.body.resident;
        if (residentId) {
          if (await denyActForResident(req, res, residentId)) return undefined;
        } else {
          const mine = await Resident.findOne({ user: req.user._id }).select("_id");
          if (!mine)
            return res
              .status(400)
              .json({ message: "Sizga bog'langan talaba yozuvi topilmadi" });
          residentId = mine._id;
        }
        const r = await Resident.findById(residentId).select("supervisor");
        const tasks = (req.body.tasks || []).filter((t) => validCategory(t.category));
        await new Model({
          resident: residentId,
          supervisor: r?.supervisor || null,
          title: req.body.title,
          academicYear: req.body.academicYear || null,
          tasks,
          status: "yangi",
        }).save();
        return res.status(201).json({ message: "successfully created" });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: qo'shishda xato`, err.message));
      }
    },

    findAll: async (req, res, next) => {
      try {
        const scope = await buildPlanScope(req.user);
        const docs = await Model.find(buildFilter(req.query, scope), { updatedAt: 0 })
          .populate(RESIDENT_POP)
          .populate(SUP_POP)
          .sort({ createdAt: -1 });
        return res.status(200).json(docs);
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: ro'yxat xatosi`, err.message));
      }
    },

    paginate: async (req, res, next) => {
      try {
        const { page = 1, limit = 12 } = req.query;
        const scope = await buildPlanScope(req.user);
        const doc = await Model.paginate(buildFilter(req.query, scope), {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: { createdAt: -1 },
          select: "-updatedAt",
          populate: [RESIDENT_POP, SUP_POP],
        });
        return res.status(200).json(doc);
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: sahifalash xatosi`, err.message));
      }
    },

    findOne: async (req, res, next) => {
      try {
        const doc = await Model.findById(req.params.id)
          .populate(RESIDENT_POP)
          .populate(SUP_POP);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        return res.status(200).json(doc);
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: topishda xato`, err.message));
      }
    },

    updatePlan: async (req, res, next) => {
      try {
        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        if (!canEdit(doc))
          return res.status(400).json({ message: "Bu holatda tahrirlab bo'lmaydi" });
        if (req.body.title !== undefined) doc.title = req.body.title;
        if (req.body.academicYear !== undefined) doc.academicYear = req.body.academicYear;
        if (req.body.tasks !== undefined)
          doc.tasks = req.body.tasks.filter((t) => validCategory(t.category));
        await doc.save();
        return res.status(200).json({ message: "successfully updated" });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: yangilashda xato`, err.message));
      }
    },

    submit: async (req, res, next) => {
      try {
        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        if (!canEdit(doc))
          return res.status(400).json({ message: "Faqat yangi/rad etilgan reja yuboriladi" });
        doc.status = "yuborilgan";
        doc.approvals = [];
        doc.rejectionReason = null;
        await doc.save();
        return res.status(200).json({ message: "successfully submitted" });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: yuborishda xato`, err.message));
      }
    },

    approve: async (req, res, next) => {
      try {
        const roleTitle = req.user.role?.title;
        if (!APPROVAL_ROLES.includes(roleTitle))
          return res.status(403).json({ message: "Bu rol tasdiqlay olmaydi" });

        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        if (doc.status !== "yuborilgan")
          return res.status(400).json({ message: "Faqat yuborilgan reja tasdiqlanadi" });

        doc.approvals = (doc.approvals || []).filter((a) => a.role !== roleTitle);
        doc.approvals.push({
          role: roleTitle,
          user: req.user._id,
          signedAt: new Date(),
          eriKey: req.body.eriKey || null,
          eriSerialNumber: req.eri?.serialNumber || null,
          eriSignedAt: req.eri?.signedAt || null,
        });
        const signed = new Set(doc.approvals.map((a) => a.role));
        const allSigned = APPROVAL_ROLES.every((r) => signed.has(r));
        if (allSigned) doc.status = "jarayonda";
        await doc.save();
        return res
          .status(200)
          .json({ message: "successfully approved", status: doc.status });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: tasdiqlashda xato`, err.message));
      }
    },

    reject: async (req, res, next) => {
      try {
        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        if (doc.status !== "yuborilgan")
          return res.status(400).json({ message: "Faqat yuborilgan reja qaytariladi" });
        doc.status = "rad_etilgan";
        doc.rejectionReason = req.body.reason;
        await doc.save();
        return res.status(200).json({ message: "successfully rejected" });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: qaytarishda xato`, err.message));
      }
    },

    addProof: async (req, res, next) => {
      try {
        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        if (doc.status !== "jarayonda")
          return res.status(400).json({ message: "Faqat jarayondagi rejaga bajaruv qo'shiladi" });
        const idx = parseInt(req.params.taskIndex);
        if (!doc.tasks[idx])
          return res.status(404).json({ message: "Vazifa topilmadi" });
        const now = new Date();
        const workDate = req.body.workDate ? new Date(req.body.workDate) : now;

        doc.tasks[idx].proofs.push({
          fileUrl: req.body.fileUrl || null,
          url: req.body.url || null,
          comment: req.body.comment || null,
          workDate,
          lateUpload: !isSameUzDay(workDate, now),
          status: "pending",
        });
        doc.markModified("tasks");
        await doc.save();
        return res.status(200).json({ message: "successfully added proof" });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: bajaruv qo'shishda xato`, err.message));
      }
    },

    reviewProof: async (req, res, next) => {
      try {
        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        const tIdx = parseInt(req.params.taskIndex);
        const pIdx = parseInt(req.params.proofIndex);
        const proof = doc.tasks[tIdx]?.proofs[pIdx];
        if (!proof) return res.status(404).json({ message: "Bajaruv topilmadi" });

        const decision = req.body.decision === "approved" ? "approved" : "rejected";
        proof.status = decision;
        proof.reviewedBy = req.user._id;
        proof.reviewedAt = new Date();
        proof.reviewComment = req.body.comment || null;
        if (isPlanComplete(doc)) doc.status = "bajarilgan";
        doc.markModified("tasks");
        await doc.save();

        const taskTitle = doc.tasks[tIdx]?.title || "";
        await notifyMagistrant(doc, {
          title: `${label}: bajaruv ${decision === "approved" ? "tasdiqlandi" : "qaytarildi"}`,
          body:
            decision === "rejected" && proof.reviewComment
              ? `${taskTitle} — ${proof.reviewComment}`
              : taskTitle,
          link: `${linkPrefix}/${doc._id}`,
        });
        return res.status(200).json({ message: "successfully reviewed", status: doc.status });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: bajaruvni ko'rishda xato`, err.message));
      }
    },

    remove: async (req, res, next) => {
      try {
        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "not found" });
        if (!(await guardPlan(req, res, doc))) return undefined;
        if (doc.status !== "yangi")
          return res.status(400).json({ message: "Faqat yangi reja o'chiriladi" });
        await doc.softDelete(req.user?._id, req.body?.reason);
        return res.status(200).json({ message: "successfully deleted" });
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: o'chirishda xato`, err.message));
      }
    },

    stats: async (req, res, next) => {
      try {
        const scope = await buildPlanScope(req.user);
        const rows = await Model.aggregate([
          { $match: { active: true, ...scope } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);
        const out = {
          total: 0,
          yangi: 0,
          yuborilgan: 0,
          jarayonda: 0,
          rad_etilgan: 0,
          bajarilgan: 0,
        };
        for (const r of rows) {
          if (r._id in out) out[r._id] = r.count;
          out.total += r.count;
        }
        return res.status(200).json(out);
      } catch (err) {
        return next(new ErrorHandler(400, `${label}: statistika xatosi`, err.message));
      }
    },
  };
}

module.exports = { makeController, buildPlanScope, canAccessPlan, guardPlan };
