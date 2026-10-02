const Contract = require("./practice.model");
const { ROLES } = require("#config/constants");
const { ErrorHandler } = require("#shared/error");
const { escapeRegex } = require("#shared/searchFilter");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const {
  notifyRoles,
  notifyOrgResponsibleUsers,
} = require("#modules/4.13-practice/_shared/practiceNotify");
const MedicalOrganization = require("#modules/4.13-practice/medicalOrganization/medicalOrganization.model");

const EXCLUDE = { updatedAt: 0 };
const POPULATE = [
  { path: "organization", select: "title stir region district", populate: [
    { path: "region", select: "title" },
    { path: "district", select: "title" },
  ] },
  { path: "direction", select: "title" },
  { path: "academicYear", select: "title" },
  { path: "students", select: "fish group course" },
  { path: "createdBy", select: "firstName lastName" },
  { path: "rector.signer", select: "firstName lastName" },
  { path: "orgHead.signer", select: "firstName lastName" },
];

const ALLOWED = [
  "organization",
  "direction",
  "academicYear",
  "course",
  "group",
  "students",
  "startDate",
  "endDate",
  "note",
];

const pick = (body = {}) => {
  const out = {};
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k];
  return out;
};

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

const isPrivileged = (user) => {
  const rt = user?.role?.title;
  return rt === ROLES.SUPER_ADMIN || rt === ROLES.ADMIN;
};

const assertOrgOwnership = async (user, organizationRef) => {
  if (isPrivileged(user)) return;
  if (user?.role?.title !== ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI) return;
  const organizationId =
    organizationRef && organizationRef._id ? organizationRef._id : organizationRef;
  const org = await MedicalOrganization.findOne({
    _id: organizationId,
    responsibleUsers: user._id,
  })
    .select("_id")
    .lean();
  if (!org) {
    throw new ErrorHandler(
      403,
      "Bu tashkilotga biriktirilmagansiz — faqat o'z tashkilotingizga tegishli shartnomaga ruxsatingiz bor",
    );
  }
};

const resolveUserOrgIds = async (user) => {
  if (!user || user.role?.title !== ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI) return [];
  const docs = await MedicalOrganization.find({ responsibleUsers: user._id })
    .select("_id")
    .lean();
  return docs.map((d) => d._id);
};

const roleScope = (roleTitle, userOrgIds = []) => {
  if (roleTitle === ROLES.REKTOR) {
    return { status: { $ne: "draft" } };
  }
  if (roleTitle === ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI) {
    return {
      status: { $in: ["rektor_approved", "both_approved", "rejected"] },
      organization: { $in: userOrgIds },
    };
  }
  return {};
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

const filterStatusesByScope = (statuses, scope) => {
  const s = scope.status;
  if (!s) return statuses;
  if (s.$ne) return statuses.filter((status) => status !== s.$ne);
  if (s.$in) return statuses.filter((status) => s.$in.includes(status));
  return statuses;
};

const narrowOrganizationFilter = (scope = {}, organizationQuery) => {
  if (!organizationQuery) return {};
  const allowed = scope.organization?.$in;
  if (!Array.isArray(allowed)) return { organization: organizationQuery };
  const permitted = allowed.some((id) => String(id) === String(organizationQuery));
  return { organization: permitted ? organizationQuery : { $in: [] } };
};

const findOrganizationIdsByTitle = async (search) => {
  if (!search) return [];
  const docs = await MedicalOrganization.find({
    title: { $regex: new RegExp(escapeRegex(search), "i") },
  })
    .select("_id")
    .lean();
  return docs.map((d) => d._id);
};

const buildFilter = ({
  search,
  active,
  status,
  academicYear,
  direction,
  organization,
  course,
  group,
  organizationIds,
  roleTitle,
  userOrgIds,
}) => {
  const scope = roleScope(roleTitle, userOrgIds);
  const data = { ...scope };
  if (search) {
    const numberMatch = { number: { $regex: new RegExp(escapeRegex(search), "i") } };
    if (Array.isArray(organizationIds) && organizationIds.length > 0) {
      data.$or = [numberMatch, { organization: { $in: organizationIds } }];
    } else {
      data.number = numberMatch.number;
    }
  }
  if (active !== undefined) data.active = active;
  const statusList = filterStatusesByScope(normalizeStatusList(status), scope);
  if (statusList.length === 1) data.status = statusList[0];
  else if (statusList.length > 1) data.status = { $in: statusList };
  if (academicYear) data.academicYear = academicYear;
  if (direction) data.direction = direction;
  Object.assign(data, narrowOrganizationFilter(scope, organization));
  if (course) data.course = Number(course);
  if (group) data.group = group;
  return data;
};

const generateNumber = async () => {
  const year = new Date().getFullYear();
  const last = await Contract.findOne({ number: new RegExp(`/${year}$`) })
    .sort({ number: -1 })
    .select("number")
    .lean();
  let seq = 1;
  if (last) {
    const m = String(last.number).match(/^AM-(\d+)\//);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `AM-${String(seq).padStart(4, "0")}/${year}`;
};

const pushHistory = (doc, actor, action, reason) => {
  doc.history.push({ at: new Date(), actor, action, reason });
};

module.exports = {
  pick,
  buildFilter,
  findOrganizationIdsByTitle,
  resolveUserOrgIds,
  assertOrgOwnership,
  narrowOrganizationFilter,

  create: async (body, userId) => {
    const data = pick(body);
    data.studentsCount = Array.isArray(data.students) ? data.students.length : 0;
    data.createdBy = userId;
    data.status = "draft";
    data.history = [
      { at: new Date(), actor: "Amaliyot bo'limi", action: "Shartnoma yaratildi" },
    ];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        data.number = await generateNumber();
        return await new Contract(data).save();
      } catch (err) {
        if (err && err.code === 11000 && attempt < 2) continue;
        throw err;
      }
    }
    return null;
  },

  findAll: (filter) =>
    applyPopulate(Contract.find(filter, EXCLUDE)).sort({ createdAt: -1 }).exec(),

  paginate: (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    return Contract.paginate(filter, {
      limit,
      page,
      select: "-updatedAt",
      populate: POPULATE,
      sort: withTiebreaker({ createdAt: -1 }),
    });
  },

  findOne: (id) => applyPopulate(Contract.findById(id, EXCLUDE)).exec(),

  update: async (id, body) => {
    const doc = await Contract.findById(id);
    if (!doc) return null;
    if (!["draft", "rejected"].includes(doc.status)) {
      return { invalid: "Faqat 'Yangi' yoki 'Rad etilgan' shartnomani tahrirlash mumkin" };
    }
    const data = pick(body);
    Object.assign(doc, data);
    if (Array.isArray(data.students)) doc.studentsCount = data.students.length;

    if (doc.status === "rejected") {
      doc.status = "draft";
      doc.rector = { signed: false };
      doc.orgHead = { signed: false };
      doc.rejectReason = null;
      doc.rejectedBy = null;
      pushHistory(doc, "Amaliyot bo'limi", "Tahrirlanib qayta 'Yangi' holatiga keltirildi");
    }
    await doc.save();
    return doc;
  },

  remove: async (id) => {
    const doc = await Contract.findById(id);
    if (!doc) return null;
    if (!["draft", "rejected"].includes(doc.status)) {
      return { invalid: "Faqat 'Yangi' yoki 'Rad etilgan' shartnomani o'chirish mumkin" };
    }
    await Contract.findByIdAndDelete(id);
    return doc;
  },

  sendToRector: async (id) => {
    const doc = await Contract.findById(id);
    if (!doc) return null;
    if (doc.status !== "draft") {
      return { invalid: "Faqat 'Yangi' holatidagi shartnomani rektorga yuborish mumkin" };
    }
    doc.status = "in_progress";
    pushHistory(doc, "Amaliyot bo'limi", "Rektorga tasdiqlashga yuborildi");
    await doc.save();
    await notifyRoles(ROLES.REKTOR, {
      eventType: "contract_sent_to_rector",
      title: "Yangi shartnoma tasdiqlashga keldi",
      body: `${doc.number} — rektor imzosi kutilmoqda`,
      link: `/shartnomalar/${doc._id}`,
      metadata: { contractId: doc._id },
    });
    return doc;
  },

  rectorSign: async (id, eri, signerId) => {
    const doc = await Contract.findById(id);
    if (!doc) return null;
    if (doc.status !== "in_progress") {
      return { invalid: "Shartnoma 'Jarayonda' holatida bo'lishi kerak" };
    }
    doc.rector = {
      signed: true,
      signer: signerId,
      signedAt: eri.signedAt || new Date(),
      certInfo: {
        serialNumber: eri.serialNumber || eri.cert?.serialNumber || null,
        subject: eri.cert?.subject || null,
        validFrom: eri.cert?.validFrom || null,
        validTo: eri.cert?.validTo || null,
      },
      signature: eri.signature || null,
    };
    doc.status = "rektor_approved";
    pushHistory(doc, "Rektor", "Rektor ERI bilan tasdiqladi");
    await doc.save();
    await notifyOrgResponsibleUsers(doc.organization, {
      eventType: "contract_rektor_approved",
      title: "Rektor tasdiqlagan shartnoma imzo kutmoqda",
      body: `${doc.number} — rahbar imzosi kutilmoqda`,
      link: `/shartnomalar/${doc._id}`,
      metadata: { contractId: doc._id },
    });
    return doc;
  },

  orgSign: async (id, eri, actorUser) => {
    const doc = await Contract.findById(id);
    if (!doc) return null;
    if (doc.status !== "rektor_approved") {
      return { invalid: "Shartnoma 'Rektor tasdiqlagan' holatida bo'lishi kerak" };
    }
    await assertOrgOwnership(actorUser, doc.organization);
    const signerId = actorUser?._id;
    doc.orgHead = {
      signed: true,
      signer: signerId,
      signedAt: eri.signedAt || new Date(),
      certInfo: {
        serialNumber: eri.serialNumber || eri.cert?.serialNumber || null,
        subject: eri.cert?.subject || null,
        validFrom: eri.cert?.validFrom || null,
        validTo: eri.cert?.validTo || null,
      },
      signature: eri.signature || null,
    };
    doc.status = "both_approved";
    pushHistory(doc, "Tibbiyot birlashmasi rahbari", "Rahbar ERI bilan tasdiqladi (yakuniy)");
    await doc.save();
    await notifyRoles([ROLES.AMALIYOT_BOLIMI, ROLES.REKTOR], {
      eventType: "contract_both_approved",
      title: "Shartnoma ikki tomon tomonidan tasdiqlandi",
      body: `${doc.number} — yakuniy hujjat tayyor`,
      link: `/shartnomalar/${doc._id}`,
      metadata: { contractId: doc._id },
    });
    return doc;
  },

  reject: async (id, reason, rejectedBy, actorUser) => {
    const doc = await Contract.findById(id);
    if (!doc) return null;
    if (!["in_progress", "rektor_approved"].includes(doc.status)) {
      return { invalid: "Faqat imzo kutilayotgan shartnomani rad etish mumkin" };
    }
    if (rejectedBy === "org_head") {
      await assertOrgOwnership(actorUser, doc.organization);
    }
    doc.status = "rejected";
    doc.rejectReason = reason;
    doc.rejectedBy = rejectedBy;
    const actor = rejectedBy === "rektor" ? "Rektor" : "Tibbiyot birlashmasi rahbari";
    pushHistory(doc, actor, "Rad etildi (sabab bilan)", reason);
    await doc.save();
    await notifyRoles(ROLES.AMALIYOT_BOLIMI, {
      eventType: "contract_rejected",
      title: "Shartnoma rad etildi",
      body: `${doc.number} — sabab: ${reason}`,
      link: `/shartnomalar/${doc._id}`,
      metadata: { contractId: doc._id },
    });
    return doc;
  },

  tabsCount: async (baseFilter = {}) => {
    const agg = await Contract.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = { all: 0 };
    agg.forEach((s) => {
      byStatus[s._id] = s.count;
      byStatus.all += s.count;
    });
    return byStatus;
  },

  report: async ({ academicYear, organization, roleTitle, userOrgIds }) => {
    const scope = roleScope(roleTitle, userOrgIds);
    const filter = { ...scope };
    if (academicYear) filter.academicYear = academicYear;
    Object.assign(filter, narrowOrganizationFilter(scope, organization));
    const total = await Contract.countDocuments(filter);
    const agg = await Contract.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = {};
    agg.forEach((s) => {
      byStatus[s._id] = s.count;
    });
    const contracts = await applyPopulate(Contract.find(filter, EXCLUDE)).exec();
    return { total, byStatus, contracts };
  },

  getForDocument: (id) => applyPopulate(Contract.findById(id, EXCLUDE)).exec(),
};
