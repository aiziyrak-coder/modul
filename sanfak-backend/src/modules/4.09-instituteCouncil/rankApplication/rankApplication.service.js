const mongoose = require("mongoose");
const RankApplication = require("./rankApplication.model");
const { ErrorHandler } = require("#shared/error");
const { escapeRegex } = require("#shared/searchFilter");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const docSettingService = require("#modules/4.09-instituteCouncil/docSetting/docSetting.service");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = [
  {
    path: "applicant",
    populate: [
      { path: "position", select: "title" },
      { path: "academicTitle", select: "title" },
    ],
  },
  "department",
  "reviewedBy",
];

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

const resolveRankType = async (rankType, category = "rank") => {
  const isPosition = category === "position";
  const label = isPosition ? "Lavozim turi" : "Unvon turi";
  const raw = String(rankType ?? "").trim();
  if (!raw) throw new ErrorHandler(400, `${label} majburiy`);

  const setting = await docSettingService.getOrCreate();
  const source = isPosition ? setting?.positionTypes : setting?.rankTypes;
  const allowed = Array.isArray(source) ? source : [];
  const canonical = allowed.find(
    (item) => String(item).toLowerCase() === raw.toLowerCase(),
  );
  if (!canonical) {
    throw new ErrorHandler(
      400,
      `${label} noto'g'ri. Ruxsat etilgan: ${allowed.join(", ")}`,
    );
  }
  return canonical;
};

const normalizeStatusList = (status) => {
  if (status === undefined || status === null || status === "") return [];
  const list = Array.isArray(status)
    ? status
    : String(status)
        .split(",")
        .map((s) => s.trim());
  return list.filter(Boolean);
};

const TAB_FILTER = {
  documents: { status: "new" },
  accepted: { status: "accepted", archived: { $ne: true } },
  archive: { $or: [{ status: "returned" }, { archived: true }] },
};

const andPush = (data, cond) => {
  if (!data.$and) data.$and = [];
  data.$and.push(cond);
};

const buildFilter = async ({
  search,
  status,
  rankType,
  category,
  department,
  applicant,
  hasDiploma,
  tab,
}) => {
  const data = {};
  if (tab && TAB_FILTER[tab]) Object.assign(data, TAB_FILTER[tab]);
  if (search) {
    const rx = { $regex: new RegExp(escapeRegex(search), "i") };
    const users = await mongoose
      .model("user")
      .find({
        $or: [{ firstName: rx }, { lastName: rx }, { middleName: rx }],
      })
      .select("_id")
      .lean();
    const searchOr = [
      { returnReason: rx },
      { applicant: { $in: users.map((u) => u._id) } },
    ];
    if (data.$or) {
      andPush(data, { $or: data.$or });
      andPush(data, { $or: searchOr });
      delete data.$or;
    } else {
      data.$or = searchOr;
    }
  }
  const statusList = normalizeStatusList(status);
  if (statusList.length) {
    const wanted = statusList.length === 1 ? statusList[0] : { $in: statusList };
    if (data.status === undefined) data.status = wanted;
    else andPush(data, { status: wanted });
  }
  if (rankType) {
    data.rankType = {
      $regex: new RegExp(`^${escapeRegex(String(rankType).trim())}$`, "i"),
    };
  }
  if (category === "rank") {
    andPush(data, { $or: [{ category: "rank" }, { category: { $exists: false } }] });
  } else if (category) {
    data.category = category;
  }
  if (hasDiploma === true || hasDiploma === "true") {
    andPush(data, { "diploma.fileUrl": { $nin: [null, ""] } });
  } else if (hasDiploma === false || hasDiploma === "false") {
    andPush(data, { $or: [{ "diploma.fileUrl": { $in: [null, ""] } }, { diploma: { $exists: false } }] });
  }
  if (department) data.department = department;
  if (applicant) data.applicant = applicant;
  return data;
};

module.exports = {
  buildFilter,

  resolveRankType,

  create: async (body) =>
    new RankApplication({
      ...body,
      rankType: await resolveRankType(body.rankType, body.category),
    }).save(),

  findAll: (filter) =>
    applyPopulate(RankApplication.find(filter, EXCLUDE)).exec(),

  paginate: (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    return RankApplication.paginate(filter, {
      limit,
      page,
      select: ["-createdAt", "-updatedAt"],
      populate: POPULATE,
      sort: withTiebreaker({ createdAt: -1 }),
    });
  },

  findOne: (id) => applyPopulate(RankApplication.findById(id, EXCLUDE)).exec(),

  update: async (id, body) => {
    const payload = { ...body };
    if (payload.rankType !== undefined) {
      let category = payload.category;
      if (!category) {
        const existing = await RankApplication.findById(id)
          .select("category")
          .lean();
        category = existing?.category;
      }
      payload.rankType = await resolveRankType(payload.rankType, category);
    }
    return RankApplication.findByIdAndUpdate(id, payload, { new: true });
  },

  remove: (id) => RankApplication.findByIdAndDelete(id),

  accept: async (id, officialDocs = {}, actorName) => {
    const { organizationLetter, guaranteeLetter, councilApproval } =
      officialDocs || {};
    const update = {
      status: "accepted",
      $push: {
        history: { at: new Date(), actor: actorName, action: "accepted" },
      },
    };
    const docs = {};
    if (organizationLetter) docs.organizationLetter = organizationLetter;
    if (guaranteeLetter) docs.guaranteeLetter = guaranteeLetter;
    if (councilApproval) docs.councilApproval = councilApproval;
    if (Object.keys(docs).length) {
      Object.entries(docs).forEach(([k, v]) => {
        update[`officialDocs.${k}`] = v;
      });
    }
    return RankApplication.findByIdAndUpdate(id, update, { new: true });
  },

  setDiploma: async (id, { fileUrl, date }, actorName) => {
    const existing = await RankApplication.findById(id).select("status").lean();
    if (!existing) return null;
    if (existing.status !== "accepted") {
      throw new ErrorHandler(
        400,
        "Diplom faqat tasdiqlangan arizaga biriktiriladi",
      );
    }
    const update = fileUrl
      ? { diploma: { fileUrl, date: date || null } }
      : { $unset: { diploma: "" } };
    return RankApplication.findByIdAndUpdate(
      id,
      {
        ...update,
        $push: {
          history: {
            at: new Date(),
            actor: actorName,
            action: fileUrl ? "diploma_set" : "diploma_removed",
          },
        },
      },
      { new: true },
    );
  },

  returnApp: async (id, reason, actorName) => {
    if (!reason || !String(reason).trim()) {
      throw new ErrorHandler(400, "Qaytarish sababi majburiy");
    }
    return RankApplication.findByIdAndUpdate(
      id,
      {
        status: "returned",
        returnReason: reason,
        $push: {
          history: {
            at: new Date(),
            actor: actorName,
            action: "returned",
            reason,
          },
        },
      },
      { new: true },
    );
  },

  archive: async (id, actorName) => {
    const existing = await RankApplication.findById(id).select("status archived").lean();
    if (!existing) return null;
    if (existing.status !== "accepted") {
      throw new ErrorHandler(400, "Faqat qabul qilingan arizani arxivlash mumkin");
    }
    if (existing.archived) return existing;
    return RankApplication.findByIdAndUpdate(
      id,
      {
        archived: true,
        $push: { history: { at: new Date(), actor: actorName, action: "archived" } },
      },
      { new: true },
    );
  },

  tabsCount: async (filter = {}) => {
    const count = (tab) =>
      RankApplication.countDocuments({ $and: [filter, TAB_FILTER[tab]] });
    const [newCount, acceptedCount, archiveCount] = await Promise.all([
      count("documents"),
      count("accepted"),
      count("archive"),
    ]);
    return { new: newCount, accepted: acceptedCount, archive: archiveCount };
  },
};
