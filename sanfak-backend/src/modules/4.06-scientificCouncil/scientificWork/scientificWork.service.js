const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const { ErrorHandler } = require("#shared/error");
const ScientificWork = require("./scientificWork.model");
const WorkReview = require("#modules/4.06-scientificCouncil/workReview/workReview.model");
const {
  specialtyIdsOfCouncil,
  specialtyCondition,
} = require("#modules/4.06-scientificCouncil/_shared/councilSpecialties");
const {
  provisionExternalResearcherAccount,
} = require("#modules/4.06-scientificCouncil/_shared/scienceCouncilNotify");

const assertNotImmutable = (work, message) => {
  if (work.protocol && work.protocol.immutable) {
    throw new ErrorHandler(409, message);
  }
};

const applyDecision = (work, { type, comment, revisionDocs, seminarDate, rejectionReason, userId }) => {
  work.finalDecision = type;
  work.decisionHistory.push({
    decision: type,
    by: userId,
    comment,
    revisionDocs,
    seminarDate,
  });

  if (type === "seminar") {
    work.status = "not_evaluated";
    work.seminarDate = seminarDate;
  } else if (type === "revision") {
    work.status = "revision";
    work.revisionComment = comment;
    work.revisionDocs = revisionDocs || [];
    work.revisionDocsFixed = [];
  } else if (type === "rejected") {
    work.status = "rejected";
    work.rejectionReason = rejectionReason || comment;
  }

  work.auditLog.push({
    action: `decision_${type}`,
    user: userId,
    detail: comment || `Qaror: ${type}`,
  });
};

const EXCLUDE = { __v: 0 };

const REQUIRED_DOC_KEYS = [
  "coverLetter",
  "passport",
  "cv",
  "biography",
  "dissertation",
  "abstract",
  "antiplagiat",
  "supervisorReview",
  "examCertificates",
  "form34",
  "publishedWorks",
  "implementationConclusions",
  "approbation",
  "ssvConclusion",
  "checkAct",
];

const assignedIdsFor = (docAssignments, key) => {
  const val = typeof docAssignments?.get === "function"
    ? docAssignments.get(key)
    : docAssignments?.[key];
  return Array.isArray(val) ? val : [];
};

const allRequiredDocsAssigned = (docAssignments) =>
  REQUIRED_DOC_KEYS.every((key) => assignedIdsFor(docAssignments, key).length > 0);

const isFullyReviewed = (docAssignments, reviews) => {
  const reviewedSet = new Set(reviews.map((r) => `${r.member}:${r.docKey}`));
  return REQUIRED_DOC_KEYS.every((key) => {
    const assigned = assignedIdsFor(docAssignments, key);
    return (
      assigned.length > 0 &&
      assigned.every((mid) => reviewedSet.has(`${mid}:${key}`))
    );
  });
};

const NAME_ONLY = [
  { path: "department", select: "title" },
  { path: "position", select: "title" },
  { path: "academicTitle", select: "title" },
];

const POPULATE = [
  { path: "researcher", select: "firstName lastName photo department position", populate: NAME_ONLY },
  { path: "councilMembers", select: "firstName lastName photo" },
  { path: "secretary", select: "firstName lastName" },
  { path: "supervisor.user", select: "firstName lastName photo department position academicTitle", populate: NAME_ONLY },
  { path: "specialty", select: "title code branch" },
  { path: "decisionHistory.by", select: "firstName lastName" },
  { path: "auditLog.user", select: "firstName lastName" },
];

const STEP_FILTERS = {
  works: { finalDecision: { $ne: "seminar" } },
  seminars: { finalDecision: "seminar", seminarResult: { $ne: "defended" } },
  defenses: { seminarResult: "defended" },
};

const buildFilter = ({
  scope,
  search,
  status,
  year,
  active,
  step,
  defenseResult,
  specialty,
  specialtyIds,
}) => {
  const data = { ...(scope || {}) };
  if (search) data.title = { $regex: new RegExp(search, "i") };
  if (status) data.status = status;
  if (year) data.year = year;
  if (active !== undefined) data.active = active;
  if (step && STEP_FILTERS[step]) Object.assign(data, STEP_FILTERS[step]);
  if (defenseResult) data.defenseResult = defenseResult;
  const specialtyCond = specialtyCondition(specialty, specialtyIds);
  if (specialtyCond !== undefined) data.specialty = specialtyCond;
  return data;
};

const SENSITIVE_FIELDS = [
  "externalAuthor.passportSeries",
  "externalAuthor.passportNumber",
  "externalAuthor.pinfl",
];

const LIST_EXCLUDE = SENSITIVE_FIELDS.reduce((acc, f) => ({ ...acc, [f]: 0 }), {
  ...EXCLUDE,
});

const applyPopulate = (query) => {
  POPULATE.forEach((p) => query.populate(p));
  return query;
};

const isDatePassed = (date, now = new Date()) => {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  return d.getTime() <= endOfToday.getTime();
};

module.exports = {
  buildFilter,
  isDatePassed,

  specialtyIdsOfCouncil,

  create: (body) => new ScientificWork(body).save(),

  findAll: (filter) =>
    applyPopulate(ScientificWork.find(filter, LIST_EXCLUDE)).exec(),

  paginate: async (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    const result = await ScientificWork.paginate(filter, {
      limit,
      page,
      select: SENSITIVE_FIELDS.map((f) => `-${f}`).concat("-__v"),
      populate: POPULATE,
      sort: withTiebreaker({ createdAt: -1 }),
    });

    const ids = result.docs.map((d) => d._id);
    const counts = ids.length
      ? await WorkReview.aggregate([
          { $match: { work: { $in: ids } } },
          { $group: { _id: "$work", count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    result.docs = result.docs.map((d) => {
      const obj = d.toObject();
      obj.reviewCount = countMap.get(String(d._id)) ?? 0;
      return obj;
    });

    return result;
  },

  findOne: (id, includeSensitive = false) =>
    applyPopulate(
      ScientificWork.findById(id, includeSensitive ? EXCLUDE : LIST_EXCLUDE),
    ).exec(),

  update: async (id, body) => {
    const existing = await ScientificWork.findById(id, { protocol: 1 }).exec();
    if (!existing) return null;
    assertNotImmutable(
      existing,
      "Imzolangan ilmiy ishni tahrirlab bo'lmaydi",
    );
    return ScientificWork.findByIdAndUpdate(id, body, { new: true }).exec();
  },

  remove: (id) => ScientificWork.findByIdAndDelete(id).exec(),

  changeStatus: async (id, status, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    work.status = status;
    work.auditLog.push({
      action: `status_changed_to_${status}`,
      user: userId,
      detail: `Status o'zgartirildi: ${status}`,
    });
    return work.save();
  },

  acceptApplication: async (id, memberIds, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    if (work.status !== "new") {
      throw new ErrorHandler(
        409,
        "Faqat \"Yangi\" holatdagi ariza qabul qilinishi mumkin",
      );
    }
    work.status = "accepted";
    work.councilMembers = memberIds;
    work.auditLog.push({
      action: "application_accepted",
      user: userId,
      detail: `Ariza qabul qilindi, ${memberIds.length} ta a'zo biriktirildi`,
    });

    const provisionedUserId = await provisionExternalResearcherAccount(work);
    if (provisionedUserId) {
      work.externalAuthor.provisionedUserId = provisionedUserId;
      work.auditLog.push({
        action: "external_account_provisioned",
        user: userId,
        detail: "Tashqi tadqiqotchi uchun tizim akkaunti biriktirildi",
      });
    }

    return work.save();
  },

  updateSeminarDate: async (id, seminarDate, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    if (work.seminarResult) {
      throw new ErrorHandler(
        409,
        "Natijasi belgilangan seminarning sanasini o'zgartirib bo'lmaydi",
      );
    }
    work.seminarDate = seminarDate ?? null;
    work.auditLog.push({
      action: seminarDate ? "seminar_date_set" : "seminar_date_cleared",
      user: userId,
      detail: seminarDate
        ? `Seminar sanasi belgilandi: ${new Date(seminarDate).toISOString().slice(0, 10)}`
        : "Seminar sanasi tozalandi",
    });
    return work.save();
  },

  updateSeminarResult: async (id, seminarResult, defenseDate, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;

    if (seminarResult) {
      if (!work.seminarDate) {
        throw new ErrorHandler(
          409,
          "Avval seminar sanasini belgilang",
        );
      }
      if (!isDatePassed(work.seminarDate)) {
        throw new ErrorHandler(
          409,
          "Seminar sanasi hali yetib kelmagan — natijani belgilab bo'lmaydi",
        );
      }
    }

    work.seminarResult = seminarResult;
    if (seminarResult === "defended") {
      if (defenseDate !== undefined) work.defenseDate = defenseDate;
    } else {
      work.defenseDate = null;
    }

    if (seminarResult === "not_defended" && work.status === "not_evaluated") {
      work.status = "not_recommended";
    } else if (seminarResult !== "not_defended" && work.status === "not_recommended") {
      work.status = "not_evaluated";
    }

    work.auditLog.push({
      action: `seminar_result_${seminarResult ?? "cleared"}`,
      user: userId,
      detail: `Seminar natijasi: ${seminarResult ?? "tozalandi"}`,
    });
    return work.save();
  },

  updateDefenseDate: async (id, defenseDate, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    if (work.defenseResult) {
      throw new ErrorHandler(
        409,
        "Natijasi belgilangan himoyaning sanasini o'zgartirib bo'lmaydi",
      );
    }
    work.defenseDate = defenseDate ?? null;
    work.auditLog.push({
      action: defenseDate ? "defense_date_set" : "defense_date_cleared",
      user: userId,
      detail: defenseDate
        ? `Himoya sanasi belgilandi: ${new Date(defenseDate).toISOString().slice(0, 10)}`
        : "Himoya sanasi tozalandi",
    });
    return work.save();
  },

  updateDefenseResult: async (id, defenseResult, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    work.defenseResult = defenseResult;

    if (defenseResult && work.status === "not_evaluated") {
      work.status = "not_recommended";
    } else if (!defenseResult && work.status === "not_recommended") {
      work.status = "not_evaluated";
    }

    work.auditLog.push({
      action: `defense_result_${defenseResult ?? "cleared"}`,
      user: userId,
      detail: `Himoya natijasi: ${defenseResult ?? "tozalandi"}`,
    });
    return work.save();
  },

  updateMembers: async (id, memberIds, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;

    const newIds = new Set(memberIds.map(String));
    const removedIds = work.councilMembers
      .map((m) => String(m))
      .filter((mid) => !newIds.has(mid));

    if (removedIds.length > 0) {
      const orphanedDocs = REQUIRED_DOC_KEYS.filter((key) => {
        const assigned = assignedIdsFor(work.docAssignments, key).map(String);
        return assigned.length > 0 && assigned.every((mid) => removedIds.includes(mid));
      });
      if (orphanedDocs.length > 0) {
        throw new ErrorHandler(
          409,
          `Olib tashlab bo'lmaydi: ${orphanedDocs.length} ta majburiy hujjat boshqa mas'ulsiz qoladi. Avval o'sha hujjat(lar)ga boshqa a'zo biriktiring.`,
        );
      }

      const cleanedAssignments = {};
      const keys = typeof work.docAssignments?.keys === "function"
        ? [...work.docAssignments.keys()]
        : Object.keys(work.docAssignments || {});
      keys.forEach((key) => {
        cleanedAssignments[key] = assignedIdsFor(work.docAssignments, key)
          .filter((mid) => !removedIds.includes(String(mid)));
      });
      work.docAssignments = cleanedAssignments;
    }

    work.councilMembers = memberIds;
    work.auditLog.push({
      action: "members_updated",
      user: userId,
      detail: removedIds.length > 0
        ? `Kengash a'zolari yangilandi (${memberIds.length} ta a'zo, ${removedIds.length} ta olib tashlandi)`
        : `Kengash a'zolari yangilandi (${memberIds.length} ta a'zo)`,
    });
    return work.save();
  },

  updateDocAssignments: async (id, assignments, userId) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    work.docAssignments = assignments;

    if (work.status === "accepted" && allRequiredDocsAssigned(work.docAssignments)) {
      work.status = "pending";
      work.auditLog.push({
        action: "status_changed_to_pending",
        user: userId,
        detail: "Barcha majburiy hujjatga a'zo biriktirildi — status avtomatik \"Tekshirilmoqda\"ga o'zgardi",
      });
    }

    return work.save();
  },

  markReviewedIfComplete: async (workId, userId) => {
    const work = await ScientificWork.findById(workId).exec();
    if (!work || work.status !== "pending") return null;

    const reviews = await WorkReview.find({ work: workId })
      .select("member docKey")
      .lean();
    if (!isFullyReviewed(work.docAssignments, reviews)) return null;

    work.status = "reviewed";
    work.auditLog.push({
      action: "status_changed_to_reviewed",
      user: userId,
      detail:
        "Barcha kengash a'zolari tegishli xulosalarni berdi — dalolatnoma yaratishga tayyor",
    });
    return work.save();
  },

  revertToPendingIfIncomplete: async (workId, userId) => {
    const work = await ScientificWork.findById(workId).exec();
    if (!work || work.status !== "reviewed") return null;

    const reviews = await WorkReview.find({ work: workId })
      .select("member docKey")
      .lean();
    if (isFullyReviewed(work.docAssignments, reviews)) return null;

    work.status = "pending";
    work.auditLog.push({
      action: "status_changed_to_pending",
      user: userId,
      detail:
        "Xulosa o'chirildi — ko'rib chiqish endi to'liq emas, status \"Tekshirilmoqda\"ga qaytdi",
    });
    return work.save();
  },

  uploadDocument: async (id, docKey, fileData) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    assertNotImmutable(
      work,
      "Imzolangan ilmiy ishga hujjat yuklab bo'lmaydi",
    );
    const existing = work.documents.get(docKey);
    const version = existing ? (existing.version || 0) + 1 : 1;
    work.documents.set(docKey, {
      uploaded: true,
      fileName: fileData.fileName,
      filePath: fileData.filePath,
      uploadedAt: new Date(),
      version,
    });
    work.auditLog.push({
      action: "document_uploaded",
      user: fileData.userId,
      detail: `Hujjat yuklandi: ${docKey} (v${version})`,
    });
    if (work.status === "revision" && work.revisionDocs.includes(docKey)) {
      if (!work.revisionDocsFixed.includes(docKey)) {
        work.revisionDocsFixed.push(docKey);
      }
      const allFixed = work.revisionDocs.every((dk) =>
        work.revisionDocsFixed.includes(dk),
      );
      if (allFixed) {
        work.status = "pending";
        work.revisionDocs = [];
        work.revisionDocsFixed = [];
        work.auditLog.push({
          action: "auto_status_pending",
          user: fileData.userId,
          detail:
            "Barcha qayta ishlash hujjatlari yuklandi — holat avtomatik pendingga o'tdi",
        });
      }
    }
    return work.save();
  },

  uploadWorkFile: async (id, fileData) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    assertNotImmutable(
      work,
      "Imzolangan ilmiy ishga fayl yuklab bo'lmaydi",
    );
    const version = work.workFile ? (work.workFile.version || 0) + 1 : 1;
    work.workFile = {
      uploaded: true,
      fileName: fileData.fileName,
      filePath: fileData.filePath,
      uploadedAt: new Date(),
      version,
    };
    work.auditLog.push({
      action: "work_file_uploaded",
      user: fileData.userId,
      detail: `Ilmiy ish fayli yuklandi (v${version})`,
    });
    return work.save();
  },

  generateProtocol: async (id, finalConclusion, userId, intro) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    assertNotImmutable(
      work,
      "Imzolangan dalolatnomani qayta yaratib bo'lmaydi",
    );

    const reviews = await WorkReview.find({ work: id }).select("type").lean();
    const positive = reviews.filter((r) => r.type === "positive").length;
    const neutral = reviews.filter((r) => r.type === "neutral").length;
    const negative = reviews.filter((r) => r.type === "negative").length;
    const recommended = negative === 0;

    work.protocol = {
      ...work.protocol,
      generatedAt: new Date(),
      intro: intro !== undefined ? intro : work.protocol?.intro,
      finalConclusion,
      immutable: false,
      eImzoSigned: false,
    };

    if (recommended) {
      work.status = "not_evaluated";
      work.finalDecision = "seminar";
      work.decisionHistory.push({
        decision: "seminar",
        by: userId,
        comment: finalConclusion,
      });
    } else {
      work.status = "not_recommended";
    }

    work.auditLog.push({
      action: "protocol_generated",
      user: userId,
      detail: recommended
        ? `Dalolatnoma yaratildi — seminarga tavsiya etildi (${positive} ijobiy, ${neutral} neytral, ${negative} salbiy)`
        : `Dalolatnoma yaratildi — seminarga tavsiya etilmadi (${positive} ijobiy, ${neutral} neytral, ${negative} salbiy)`,
    });

    return work.save();
  },

  signProtocol: async (id, userId, certData) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work || !work.protocol || !work.protocol.generatedAt) return null;
    work.protocol.signedAt = new Date();
    work.protocol.signedBy = userId;
    work.protocol.eImzoSigned = true;
    work.protocol.eImzoCert = certData;
    work.protocol.immutable = true;
    work.auditLog.push({
      action: "protocol_signed",
      user: userId,
      detail: "Dalolatnoma E-imzo bilan tasdiqlandi",
    });
    return work.save();
  },

  makeDecision: async (id, { type, comment, revisionDocs, seminarDate, rejectionReason, userId }) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    applyDecision(work, { type, comment, revisionDocs, seminarDate, rejectionReason, userId });
    return work.save();
  },

  memberDecision: async (id, { type, comment, revisionDocs, rejectionReason, userId }) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    if (work.status !== "pending") {
      throw new ErrorHandler(
        409,
        "Faqat \"Tekshirilmoqda\" holatidagi ishga qaror qabul qilish mumkin",
      );
    }
    const isAssigned = work.councilMembers.some(
      (m) => String(m) === String(userId),
    );
    if (!isAssigned) {
      throw new ErrorHandler(403, "Siz bu ilmiy ishga biriktirilmagansiz");
    }
    applyDecision(work, { type, comment, revisionDocs, rejectionReason, userId });
    return work.save();
  },

  addAuditEntry: async (id, entry) => {
    const work = await ScientificWork.findById(id).exec();
    if (!work) return null;
    work.auditLog.push(entry);
    return work.save();
  },
};
