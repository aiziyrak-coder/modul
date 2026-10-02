const WorkReview = require("./workReview.model");
const ScientificWork = require("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");
const { ErrorHandler } = require("#shared/error");

const EXCLUDE = { __v: 0 };

const POPULATE = [
  { path: "member", select: "firstName lastName photo" },
  { path: "work", select: "title status" },
];

const buildFilter = ({ scope, workId, memberId, docKey, active }) => {
  const data = { ...(scope || {}) };
  if (workId) data.work = workId;
  if (memberId) data.member = memberId;
  if (docKey) data.docKey = docKey;
  if (active !== undefined) data.active = active;
  return data;
};

module.exports = {
  buildFilter,

  assertAssigned: async (workId, docKey, userId) => {
    const work = await ScientificWork.findById(workId)
      .select("docAssignments")
      .lean();
    if (!work) throw new ErrorHandler(404, "Ilmiy ish topilmadi");
    const assigned = work.docAssignments?.[docKey] ?? [];
    const ok = assigned.some((id) => String(id) === String(userId));
    if (!ok) {
      throw new ErrorHandler(
        403,
        "Bu hujjat sizga biriktirilmagan — unga xulosa yoza olmaysiz",
      );
    }
  },

  create: async (body) => {
    const existing = await WorkReview.findOne({
      work: body.work,
      member: body.member,
      docKey: body.docKey,
    }).exec();
    if (existing) {
      throw new ErrorHandler(
        409,
        "Siz bu hujjatga allaqachon xulosa yozgansiz — mavjud xulosani tahrirlang",
      );
    }
    return new WorkReview(body).save();
  },

  findByWork: (workId, ownMemberId) => {
    const filter = { work: workId };
    if (ownMemberId) filter.member = ownMemberId;
    return WorkReview.find(filter, EXCLUDE).populate(POPULATE).exec();
  },

  findByMember: (memberId) =>
    WorkReview.find({ member: memberId }, EXCLUDE).populate(POPULATE).exec(),

  findOne: (id) =>
    WorkReview.findById(id, EXCLUDE).populate(POPULATE).exec(),

  update: async (id, body) => {
    const review = await WorkReview.findById(id).exec();
    if (!review) return null;
    if (body.type !== undefined) review.type = body.type;
    if (body.text !== undefined) review.text = body.text;
    review.edited = true;
    review.reviewedAt = new Date();
    return review.save();
  },

  remove: (id) => WorkReview.findByIdAndDelete(id).exec(),
};
