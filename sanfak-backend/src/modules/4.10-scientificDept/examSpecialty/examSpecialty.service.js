const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const ExamSpecialty = require("./examSpecialty.model");
const { effectiveStatus, isRegistrationOpen, endOfDay } = require("./examSpecialty.status");
const postService = require("../scientificPost/scientificPost.service");
const QualifyingApplicant = require("../qualifyingApplicant/qualifyingApplicant.model");
const ScientificPost = require("../scientificPost/scientificPost.model");

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildQuery = ({ search, status, openNow } = {}) => {
  const q = { active: true };
  if (status) q.status = status;
  if (openNow === true || openNow === "true") {
    const now = new Date();
    q.status = "open";
    q.$and = [
      { $or: [{ regStart: null }, { regStart: { $lte: now } }] },
      { $or: [{ regEnd: null }, { regEnd: { $gte: startOfToday() } }] },
    ];
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    q.$or = [{ code: rx }, { name: rx }];
  }
  return q;
};

const startOfToday = () => {
  const x = new Date();
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

const decorate = (doc) => {
  if (!doc) return doc;
  return { ...doc, effectiveStatus: effectiveStatus(doc), isOpen: isRegistrationOpen(doc) };
};

async function list(query) {
  const docs = await ExamSpecialty.find(buildQuery(query)).sort({ createdAt: -1 }).lean();
  return docs.map(decorate);
}

async function paginate(query) {
  const { page, limit } = query;
  const res = await ExamSpecialty.paginate(buildQuery(query), {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    lean: true,
  });
  return { ...res, docs: (res.docs || []).map(decorate) };
}

async function findById(id) {
  const doc = await ExamSpecialty.findById(id).lean();
  if (!doc || !doc.active) throw new ErrorHandler(404, "Mutaxassislik topilmadi");
  return decorate(doc);
}

async function create(payload, user) {
  const doc = await ExamSpecialty.create({
    code: payload.code,
    name: payload.name || "",
    regStart: payload.regStart || null,
    regEnd: payload.regEnd || null,
    status: payload.status || "open",
  });
  if (doc.status === "open") {
    try {
      const label = doc.name ? `${doc.code} (${doc.name})` : doc.code;
      await postService.create(user, {
        title: `Malakaviy imtihon: ro'yxatdan o'tish ochildi — ${label}`,
        text: `${label} bo'yicha malakaviy imtihonga ro'yxatdan o'tish ochildi. Muddat: ${fmtDate(doc.regStart)} — ${fmtDate(doc.regEnd)}. Ariza topshirish uchun "Malakaviy imtihon" bo'limiga o'ting.`,
        recipients: ["teachers"],
        telegram: true,
        specialtyCode: doc.code,
      });
    } catch (err) {
      winston.error(`[ExamSpecialty] avto-e'lon xato: ${err.message}`);
    }
  }
  return doc;
}

async function cascadeCodeChange(prevCode, nextCode, deps = {}) {
  const Applicant = deps.Applicant || QualifyingApplicant;
  const Post = deps.Post || ScientificPost;
  if (!prevCode || !nextCode || prevCode === nextCode) {
    return { applicants: 0, posts: 0 };
  }
  const [appRes, postRes] = await Promise.all([
    Applicant.updateMany({ specialization: prevCode }, { $set: { specialization: nextCode } }),
    Post.updateMany({ specialtyCode: prevCode }, { $set: { specialtyCode: nextCode } }),
  ]);
  return { applicants: appRes?.modifiedCount || 0, posts: postRes?.modifiedCount || 0 };
}

async function update(id, payload) {
  const doc = await ExamSpecialty.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Mutaxassislik topilmadi");
  const prevCode = doc.code;
  if (payload.code !== undefined) doc.code = payload.code;
  if (payload.name !== undefined) doc.name = payload.name;
  if (payload.regStart !== undefined) doc.regStart = payload.regStart;
  if (payload.regEnd !== undefined) doc.regEnd = payload.regEnd;
  if (payload.status !== undefined) doc.status = payload.status;
  if (payload.active !== undefined) doc.active = payload.active;
  await doc.save();

  if (doc.code !== prevCode) {
    try {
      const moved = await cascadeCodeChange(prevCode, doc.code);
      winston.info(
        `[ExamSpecialty] shifr ${prevCode} → ${doc.code}: ${moved.applicants} ta ariza, ${moved.posts} ta e'lon ko'chirildi`,
      );
    } catch (err) {
      winston.error(`[ExamSpecialty] shifr kaskadi xato: ${err.message}`);
    }
  }
  return doc;
}

async function softDelete(id) {
  const doc = await ExamSpecialty.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "Mutaxassislik topilmadi");
  doc.active = false;
  await doc.save();
  return doc;
}

module.exports = {
  isRegistrationOpen,
  effectiveStatus,
  endOfDay,
  decorate,
  cascadeCodeChange,
  list,
  paginate,
  findById,
  create,
  update,
  softDelete,
  escapeRegex,
};
