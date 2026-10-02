const { ErrorHandler } = require("#shared/error");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const { ROLES } = require("#config/constants");
const Notice = require("./residencyNotice.model");
const { NOTICE_KIND_AUTO } = Notice;
const { allowedResidentIds } = require("../_services/residentScope");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const { applyScopedEquals } = require("../_services/scopeGuard");
const { searchRegex } = require("../_services/searchTerm");
const winston = require("#shared/winston.logger");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const absence = require("../_services/absenceNotice");
const noticeFiles = require("../_services/noticeFiles");
const {
  getOrCreate: getResidencySettings,
} = require("#modules/4.05-residency/residencySetting/residencySetting.service");

const isStaff = (user) => {
  const role = user?.role || {};
  return role.scopeLevel === "global" || role.title === ROLES.MAGISTRATURA_BOLIM;
};

function ownershipError(doc, user) {
  if (doc.kind === NOTICE_KIND_AUTO) {
    return new ErrorHandler(409, "Tizim bildirgisini tahrirlab yoki o'chirib bo'lmaydi", undefined, {
      reason: "auto_notice_readonly",
    });
  }
  if (isStaff(user)) return null;
  if (String(doc.sender) !== String(user._id)) {
    return new ErrorHandler(403, "Faqat o'zingiz yuborgan bildirgini o'zgartira olasiz");
  }
  if (doc.status !== "yangi") {
    return new ErrorHandler(
      400,
      "Ko'rib chiqilayotgan bildirgini o'zgartirib bo'lmaydi",
    );
  }
  return null;
}

const marksNoticeSeen = (doc, user) => doc.kind !== NOTICE_KIND_AUTO || isStaff(user);

const kindFilter = (kind) => (kind === "oddiy" ? { $in: [kind, null] } : kind);

const POP = [
  { path: "sender", select: "firstName lastName middleName" },
  {
    path: "resident",
    select:
      "fullName program courseNumber groupTitle specialtyTitle departmentTitle specialty department group",
    populate: RESIDENT_REF_POPULATE,
  },
  { path: "reviewedBy", select: "firstName lastName middleName" },
];

const fullName = (u) =>
  u ? [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") : null;

async function buildNoticeScope(user) {
  const ids = await allowedResidentIds(user);
  if (ids === null) return {};
  return { $or: [{ resident: { $in: ids } }, { sender: user._id }] };
}


function canAccessNotice(user, doc, ids) {
  const unrestricted = ids === null;
  const idOf = (v) => String((v && v._id) || v || "");
  return Boolean(
    unrestricted ||
      idOf(doc.sender) === String(user._id) ||
      (doc.resident && ids.some((id) => String(id) === idOf(doc.resident))),
  );
}

async function denyNoticeAccess(req, res, doc) {
  const ids = await allowedResidentIds(req.user);
  if (canAccessNotice(req.user, doc, ids)) return false;
  res.status(404).json({ message: "not found" });
  return true;
}

const contentDisposition = (name) => {
  const safe = String(name || "bildirgi.pdf");
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

function buildFilter(query, scope) {
  const { search, program, status, academicYear, resident, active, kind } = query;
  const data = {};
  if (program) data.program = program;
  if (status) data.status = status;
  if (kind) data.kind = kindFilter(kind);
  applyAcademicYearFilter(data, academicYear);
  applyScopedEquals(data, scope, "resident", resident);
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.title = rx;
  return data;
}

module.exports = {
  canAccessNotice,
  marksNoticeSeen,
  buildFilter,
  addNotice: async (req, res, next) => {
    try {
      const payload = {
        ...req.body,
        sender: req.user._id,
        senderName: fullName(req.user),
        status: "yangi",
      };

      if (payload.kind === "davomat") {
        if (!payload.resident) {
          return res
            .status(400)
            .json({ message: "Davomat bildirgisi uchun talaba tanlanishi shart" });
        }

        const ids = await allowedResidentIds(req.user);
        const inScope =
          ids === null || ids.some((id) => String(id) === String(payload.resident));
        if (!inScope) return res.status(404).json({ message: "not found" });

        const resident = await Resident.findById(payload.resident).lean();
        if (!resident) return res.status(404).json({ message: "not found" });

        const settings = await getResidencySettings();
        const { streak, rows } = await absence.residentStreak(resident._id, settings);
        const { eligible, threshold } = absence.checkEligible(streak, settings);
        if (!eligible) {
          return res.status(400).json({ message: absence.notEligibleMessage(streak, threshold) });
        }

        payload.absence = {
          days: streak.days,
          from: streak.from,
          to: streak.to,
          windowDays: streak.windowDays,
          windowFrom: streak.windowFrom,
          windowTo: streak.windowTo,
        };
        payload.document = await absence.buildDocument({
          resident,
          supervisor: {
            fullName: fullName(req.user),
            position: req.user?.position?.title || null,
            department: req.user?.department?.title || null,
          },
          streak,
          rows,
          content: payload.content,
        });

        const doc = await new Notice(payload).save();
        setImmediate(() => {
          absence.notifyOffice(doc, resident).catch((err) => {
            winston.error(
              `[4.5] absenceNotice: bo'limga xabar yuborilmadi — ${err.message}`,
            );
          });
        });
        return res.status(201).json({ message: "successfully created", id: doc._id });
      }

      await new Notice(payload).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Bildirgi yuborishda xato", err.message));
    }
  },

  absenceStreak: async (req, res, next) => {
    try {
      const residentId = req.query.resident;
      const ids = await allowedResidentIds(req.user);
      const inScope = ids === null || ids.some((id) => String(id) === String(residentId));
      if (!inScope) return res.status(404).json({ message: "not found" });

      const settings = await getResidencySettings();
      const { streak } = await absence.residentStreak(residentId, settings);
      const { eligible, threshold } = absence.checkEligible(streak, settings);
      const lastNotice = await absence.lastDavomatNotice(residentId, streak.windowFrom);
      return res.status(200).json({
        resident: residentId,
        days: streak.days,
        from: streak.from,
        to: streak.to,
        threshold,
        eligible,
        windowDays: streak.windowDays,
        windowFrom: streak.windowFrom,
        windowTo: streak.windowTo,
        dayKeys: streak.dayKeys,
        lastNotice,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Qoldirilgan kunlarni hisoblashda xato", err.message));
    }
  },

  downloadPdf: async (req, res, next) => {
    try {
      const doc = await Notice.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (await denyNoticeAccess(req, res, doc)) return undefined;
      if (!doc.document?.storageKey) {
        return res.status(404).json({ message: "Bu bildirgida hujjat yo'q" });
      }

      const stat = await noticeFiles.stat(doc.document.storageKey);
      if (!stat) return res.status(404).json({ message: "Hujjat topilmadi" });

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", contentDisposition(doc.document.fileName));

      const stream = noticeFiles.createReadStream(doc.document.storageKey);
      stream.on("error", (err) => {
        winston.error(
          `[4.5] absenceNotice: hujjat oqimi uzildi (${doc.document.storageKey}): ${err.message}`,
        );
        res.destroy();
      });
      return stream.pipe(res);
    } catch (err) {
      return next(new ErrorHandler(400, "Hujjatni yuklab olishda xato", err.message));
    }
  },

  findAllNotices: async (req, res, next) => {
    try {
      const scope = await buildNoticeScope(req.user);
      const docs = await Notice.find({ ...buildFilter(req.query, scope), ...scope })
        .populate(POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Bildirgilar ro'yxati xatosi", err.message));
    }
  },

  paginateNotices: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const scope = await buildNoticeScope(req.user);
      const doc = await Notice.paginate(
        { ...buildFilter(req.query, scope), ...scope },
        {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: { createdAt: -1 },
          populate: POP,
        },
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Bildirgi sahifalash xatosi", err.message));
    }
  },

  findNotice: async (req, res, next) => {
    try {
      const doc = await Notice.findById(req.params.id).populate(POP);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (await denyNoticeAccess(req, res, doc)) return undefined;
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Bildirgini olishda xato", err.message));
    }
  },

  viewNotice: async (req, res, next) => {
    try {
      const doc = await Notice.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (await denyNoticeAccess(req, res, doc)) return undefined;
      if (doc.status === "yangi" && marksNoticeSeen(doc, req.user)) {
        doc.status = "kutilmoqda";
        await doc.save();
      }
      return res.status(200).json({ message: "successfully updated", status: doc.status });
    } catch (err) {
      return next(new ErrorHandler(400, "Bildirgi holatini yangilashda xato", err.message));
    }
  },

  reviewNotice: async (req, res, next) => {
    try {
      const doc = await Notice.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (doc.status === "korib_chiqilgan") {
        return next(
          new ErrorHandler(400, "Qaror allaqachon tasdiqlangan — o'zgartirib bo'lmaydi"),
        );
      }
      doc.decision = req.body.decision;
      doc.status = "korib_chiqilgan";
      doc.reviewedBy = req.user._id;
      doc.reviewedByName = fullName(req.user);
      doc.reviewedAt = new Date();
      await doc.save();
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Qaror yozishda xato", err.message));
    }
  },

  updateNotice: async (req, res, next) => {
    try {
      const doc = await Notice.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      const denied = ownershipError(doc, req.user);
      if (denied) return next(denied);

      Object.assign(doc, req.body);
      await doc.save();
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Bildirgini yangilashda xato", err.message));
    }
  },

  deleteNotice: async (req, res, next) => {
    try {
      const doc = await Notice.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      const denied = ownershipError(doc, req.user);
      if (denied) return next(denied);

      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Bildirgini o'chirishda xato", err.message));
    }
  },
};
