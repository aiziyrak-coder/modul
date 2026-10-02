const WorkDecision = require("./workDecision.model");

const EXCLUDE = { __v: 0 };

const POPULATE = [
  {
    path: "work",
    select: "title researcher externalAuthor authorType status",
    populate: { path: "researcher", select: "firstName lastName" },
  },
  { path: "signedBy.user", select: "firstName lastName" },
];

module.exports = {
  create: (body) => new WorkDecision(body).save(),

  findByWork: (workId) =>
    WorkDecision.find({ work: workId }, EXCLUDE).populate(POPULATE).exec(),

  findOne: (id) =>
    WorkDecision.findById(id, EXCLUDE).populate(POPULATE).exec(),

  sign: async (id, userId) => {
    const decision = await WorkDecision.findById(id).exec();
    if (!decision) return null;
    decision.signedBy.push({ user: userId, signedAt: new Date() });
    return decision.save();
  },

  remove: (id) => WorkDecision.findByIdAndDelete(id).exec(),
};
