const mongoose = require("mongoose");
const VotingSession = require("./votingSession.model");
const AnonymousVote = require("#modules/4.09-instituteCouncil/anonymousVote/anonymousVote.model");
const CouncilMember = require("#modules/4.09-instituteCouncil/councilMember/councilMember.model");
const docSettingService = require("#modules/4.09-instituteCouncil/docSetting/docSetting.service");
const { escapeRegex } = require("#shared/searchFilter");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const winston = require("#shared/winston.logger");
const {
  dispatchManyInBackground,
  getKotibUserIds,
  getMemberUserIds,
} = require("#modules/4.09-instituteCouncil/_shared/councilNotify");

const AUTO_FINALIZE_BATCH = 20;

const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = [
  "candidates.user",
  "department",
  "createdBy",
  "results.winner",
];

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

const buildFilter = async ({ search, status, department }) => {
  const data = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const users = await mongoose
      .model("user")
      .find({ $or: [{ firstName: rx }, { lastName: rx }, { middleName: rx }] })
      .select("_id")
      .lean();
    data.$or = [
      { title: { $regex: rx } },
      { rankType: { $regex: rx } },
      { "candidates.user": { $in: users.map((u) => u._id) } },
    ];
  }
  if (status) data.status = status;
  if (department) data.department = department;
  return data;
};

module.exports = {
  buildFilter,

  create: async (body) => {
    const mode =
      Array.isArray(body.candidates) && body.candidates.length >= 2
        ? "choice"
        : "single";
    if (body.passingPercent === undefined || body.passingPercent === null) {
      const setting = await docSettingService.getOrCreate();
      body.passingPercent = setting.passingPercent;
    }
    let scope = "Institut";
    if (body.department) {
      const dept = await mongoose
        .model("department")
        .findById(body.department)
        .select("title")
        .lean();
      if (dept?.title) scope = dept.title;
    }
    const title = `${body.rankType} — ${scope}`;
    return new VotingSession({ ...body, title, mode, status: "active" }).save();
  },

  findAll: (filter) => applyPopulate(VotingSession.find(filter, EXCLUDE)).exec(),

  paginate: (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    return VotingSession.paginate(filter, {
      limit,
      page,
      select: ["-createdAt", "-updatedAt"],
      populate: POPULATE,
    });
  },

  findOne: (id) => applyPopulate(VotingSession.findById(id, EXCLUDE)).exec(),

  update: (id, body) =>
    VotingSession.findByIdAndUpdate(id, body, { new: true }),

  setCandidateDiploma: (sessionId, userId, { diplomaFile, diplomaDate }) =>
    VotingSession.findOneAndUpdate(
      { _id: sessionId, "candidates.user": userId },
      {
        $set: {
          "candidates.$.diplomaFile": diplomaFile,
          "candidates.$.diplomaDate": diplomaDate,
        },
      },
      { new: true },
    ),

  remove: (id) => VotingSession.findByIdAndDelete(id),

  reportList: () =>
    applyPopulate(
      VotingSession.find(
        { status: { $in: ["approved", "rejected"] }, active: true },
        { updatedAt: 0 },
      ),
    ).exec(),

  buildTanlovReport: async (filter = {}) => {
    const sessions = await VotingSession.find(filter, EXCLUDE)
      .populate({
        path: "candidates.user",
        populate: { path: "department", select: "title" },
      })
      .populate("department")
      .populate("results.winner")
      .exec();
    if (!sessions.length) return [];

    const eligible = await CouncilMember.countDocuments({
      canVote: true,
      active: true,
    });
    const votes = await AnonymousVote.find({
      session: { $in: sessions.map((s) => s._id) },
    })
      .select("session candidate choice")
      .lean();

    const bySession = new Map();
    for (const v of votes) {
      const key = String(v.session);
      let bucket = bySession.get(key);
      if (!bucket) {
        bucket = { total: 0, for: 0, against: 0, perCandidate: new Map() };
        bySession.set(key, bucket);
      }
      bucket.total += 1;
      if (v.choice === "for") bucket.for += 1;
      else if (v.choice === "against") bucket.against += 1;
      if (v.candidate) {
        const c = String(v.candidate);
        bucket.perCandidate.set(c, (bucket.perCandidate.get(c) || 0) + 1);
      }
    }
    const EMPTY_BUCKET = {
      total: 0,
      for: 0,
      against: 0,
      perCandidate: new Map(),
    };

    const byGroup = new Map();
    for (const s of sessions) {
      const mine = bySession.get(String(s._id)) || EMPTY_BUCKET;
      const voted = mine.total;
      const position = s.rankType || "Boshqa";
      const key = position.trim().toLowerCase();
      if (!byGroup.has(key)) byGroup.set(key, { label: position, rows: [] });
      const grp = byGroup.get(key);
      if (grp.label[0] === grp.label[0].toLowerCase() && position[0] !== position[0].toLowerCase()) {
        grp.label = position;
      }
      for (const c of s.candidates || []) {
        const u = c.user || {};
        const isChoice = s.mode === "choice";
        grp.rows.push({
          fullName:
            [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") ||
            "—",
          department: s.department?.title || u.department?.title || "—",
          position: grp.label,
          for: isChoice
            ? mine.perCandidate.get(String(u._id || c.user)) || 0
            : mine.for,
          against: isChoice ? 0 : mine.against,
          abstain: Math.max(0, eligible - voted),
        });
      }
    }
    return [...byGroup.values()].map(({ label, rows }) => ({
      position: label,
      rows: rows.map((r) => ({ ...r, position: label })),
    }));
  },

  buildReportFilter: ({ status, rankType, department } = {}) => {
    const data = { status: { $in: ["approved", "rejected"] }, active: true };
    if (status && ["approved", "rejected"].includes(status)) data.status = status;
    if (rankType) data.rankType = rankType;
    if (department) data.department = department;
    return data;
  },

  paginateReport: (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    return VotingSession.paginate(filter, {
      limit,
      page,
      select: "-updatedAt",
      populate: POPULATE,
      sort: withTiebreaker({ createdAt: -1 }),
    });
  },

  tabsCount: async () => {
    const [active, approved, rejected] = await Promise.all([
      VotingSession.countDocuments({ status: "active", active: true }),
      VotingSession.countDocuments({ status: "approved", active: true }),
      VotingSession.countDocuments({ status: "rejected", active: true }),
    ]);
    return { active, approved, rejected };
  },

  finalize: async (id) => {
    const session = await VotingSession.findById(id).exec();
    if (!session) return null;

    const eligible = await CouncilMember.countDocuments({
      canVote: true,
      active: true,
    });
    const votes = await AnonymousVote.find({ session: id, active: true }).exec();
    const voted = votes.length;
    const abstain = Math.max(0, eligible - voted);

    if (session.mode === "single") {
      const cand = session.candidates[0] ? session.candidates[0].user : null;
      const forV = votes.filter((v) => v.choice === "for").length;
      const againstV = votes.filter((v) => v.choice === "against").length;
      const passed =
        eligible > 0 && (forV * 100) / eligible >= session.passingPercent;
      session.results = {
        for: forV,
        against: againstV,
        abstain,
        winner: passed ? cand : null,
        passed,
      };
      session.status = passed ? "approved" : "rejected";
    } else {
      let winnerUser = null;
      let winnerFor = -1;
      session.candidates.forEach((cand) => {
        const forCount = votes.filter(
          (v) =>
            String(v.candidate) === String(cand.user) && v.choice === "for",
        ).length;
        if (forCount > winnerFor) {
          winnerFor = forCount;
          winnerUser = cand.user;
        }
      });
      const maxFor = Math.max(0, winnerFor);
      const passed = maxFor >= 1;
      session.results = {
        for: maxFor,
        against: voted - maxFor,
        abstain,
        winner: passed ? winnerUser : null,
        passed,
      };
      session.status = passed ? "approved" : "rejected";
    }

    await session.save();
    return applyPopulate(VotingSession.findById(id, EXCLUDE)).exec();
  },

  autoFinalizeExpired: async () => {
    const expired = await VotingSession.find({
      status: "active",
      active: true,
      endDate: { $lt: new Date() },
      autoFinalizedAt: null,
    })
      .select("_id title")
      .limit(AUTO_FINALIZE_BATCH)
      .lean();
    if (!expired.length) return [];

    const settled = await Promise.allSettled(
      expired.map(async (s) => {
        const claimed = await VotingSession.findOneAndUpdate(
          { _id: s._id, status: "active", autoFinalizedAt: null },
          { $set: { autoFinalizedAt: new Date() } },
        );
        if (!claimed) return null;
        try {
          return await module.exports.finalize(s._id);
        } catch (err) {
          await VotingSession.updateOne(
            { _id: s._id },
            { $set: { autoFinalizedAt: null } },
          );
          throw err;
        }
      }),
    );

    const failed = settled.filter((r) => r.status === "rejected");
    if (failed.length) {
      winston.warn(
        `[votingSession.autoFinalizeExpired] ${failed.length}/${settled.length} ta ` +
          `so'rovnoma yakunlanmadi: ${failed[0].reason?.message || failed[0].reason}`,
      );
    }

    const finalized = settled
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);
    if (!finalized.length) return [];

    try {
      const [kotibIds, memberIds] = await Promise.all([
        getKotibUserIds(),
        getMemberUserIds(),
      ]);
      const kotibSet = new Set(kotibIds.map((id) => String(id)));
      const seenMember = new Set();
      const memberOnlyIds = [];
      for (const id of memberIds) {
        const key = String(id);
        if (kotibSet.has(key) || seenMember.has(key)) continue;
        seenMember.add(key);
        memberOnlyIds.push(id);
      }
      finalized.forEach((doc) => {
        const title = `V: "${doc.title}" ovoz berish muddati tugadi`;
        const body =
          "Avtomatik yakunlandi. Natija: " +
          (doc.status === "approved" ? "tasdiqlandi" : "rad etildi");
        dispatchManyInBackground({
          userIds: kotibIds,
          eventType: "council_voting_finished",
          title,
          body,
          link: "/kengash/hisobotlar",
        });
        dispatchManyInBackground({
          userIds: memberOnlyIds,
          eventType: "council_voting_finished",
          title,
          body,
          link: "/kengash/ovoz-berish",
        });
      });
    } catch (err) {
      winston.warn(
        `[votingSession.autoFinalizeExpired] bildirishnoma yuborilmadi: ${err.message}`,
      );
    }

    winston.info(
      `[votingSession.autoFinalizeExpired] ${finalized.length} ta so'rovnoma ` +
        `muddati tugagani uchun avtomatik yakunlandi`,
    );
    return finalized;
  },
};
