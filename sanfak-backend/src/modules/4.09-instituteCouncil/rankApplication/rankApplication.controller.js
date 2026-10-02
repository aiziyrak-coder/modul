const { ErrorHandler } = require("#shared/error");
const {
  dispatchInBackground,
} = require("#modules/4.09-instituteCouncil/_shared/councilNotify");
const service = require("./rankApplication.service");

const hasPerm = (req, section, action) =>
  (req.user?.role?.permissions || []).some(
    (p) => p.section === section && (p.actionKeys || []).includes(action),
  );

const isTeacher = (req) =>
  hasPerm(req, "rankApplication", "create") &&
  !hasPerm(req, "rankApplication", "approve");

const ownScope = (req) => (isTeacher(req) ? { applicant: req.user._id } : {});

const isForeignForTeacher = (req, doc) => {
  if (!isTeacher(req)) return false;
  const applicantId = doc.applicant?._id || doc.applicant;
  return String(applicantId) !== String(req.user._id);
};

const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  return [];
};

const normalizeSubmittedDocs = (body) => {
  const mediaUrls = Array.isArray(body.media)
    ? body.media.map((m) => m && m.image).filter(Boolean)
    : [];
  if (mediaUrls.length) {
    const names = parseArray(body.docNames);
    return mediaUrls.map((fileUrl, i) => ({
      name: names[i] || `Hujjat ${i + 1}`,
      fileUrl,
    }));
  }
  return parseArray(body.submittedDocs);
};

module.exports = {
  addApplication: async (req, res, next) => {
    try {
      req.body.applicant = req.user._id;
      req.body.status = "new";
      req.body.submittedDocs = normalizeSubmittedDocs(req.body);
      delete req.body.media;
      delete req.body.docNames;
      const doc = await service.create(req.body);
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(
        new ErrorHandler(400, "Failed to add rank application", err.message),
      );
    }
  },

  findAllApplications: async (req, res, next) => {
    try {
      const filter = {
        ...(await service.buildFilter(req.query)),
        ...ownScope(req),
      };
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find rank applications", err.message),
      );
    }
  },

  paginateApplications: async (req, res, next) => {
    try {
      const filter = {
        ...(await service.buildFilter(req.query)),
        ...ownScope(req),
      };
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate rank applications",
          err.message,
        ),
      );
    }
  },

  tabsCount: async (req, res, next) => {
    try {
      const filter = {
        ...(await service.buildFilter(req.query)),
        ...ownScope(req),
      };
      const doc = await service.tabsCount(filter);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to count tabs", err.message),
      );
    }
  },

  findOneApplication: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (isForeignForTeacher(req, doc)) {
        return res
          .status(403)
          .json({ message: "Bu ariza sizga tegishli emas!" });
      }
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find rank application", err.message),
      );
    }
  },

  updateApplication: async (req, res, next) => {
    try {
      const existing = await service.findOne(req.params.id);
      if (!existing) return res.status(404).json({ message: "not found" });
      if (isForeignForTeacher(req, existing)) {
        return res
          .status(403)
          .json({ message: "Bu ariza sizga tegishli emas!" });
      }
      if (existing.status !== "new" && existing.status !== "returned") {
        return res.status(400).json({
          message: "Faqat 'new' yoki 'returned' holatidagi arizani tahrirlash mumkin",
        });
      }
      const docs = normalizeSubmittedDocs(req.body);
      const isMultipart = Array.isArray(req.body.media) && req.body.media.length;
      if (docs.length && isMultipart) {
        const replaced = new Set(docs.map((d) => d.name));
        const kept = (existing.submittedDocs || [])
          .filter((d) => !replaced.has(d.name))
          .map((d) => ({ name: d.name, fileUrl: d.fileUrl }));
        req.body.submittedDocs = [...kept, ...docs];
      } else if (docs.length) {
        req.body.submittedDocs = docs;
      }
      delete req.body.media;
      delete req.body.docNames;
      if (existing.status === "returned") {
        req.body.status = "new";
        req.body.returnReason = null;
        req.body.submittedAt = new Date();
        req.body.$push = {
          history: {
            at: new Date(),
            actor: req.user?.fullName || req.user?.username,
            action: "resubmitted",
          },
        };
      }
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      if (err.statusCode) return next(err);
      return next(
        new ErrorHandler(400, "Failed to update rank application", err.message),
      );
    }
  },

  deleteApplication: async (req, res, next) => {
    try {
      const existing = await service.findOne(req.params.id);
      if (!existing) return res.status(404).json({ message: "not found" });
      if (isForeignForTeacher(req, existing)) {
        return res
          .status(403)
          .json({ message: "Bu ariza sizga tegishli emas!" });
      }
      if (existing.status !== "new") {
        return res.status(400).json({
          message:
            "Faqat yangi arizani o'chirish mumkin. Tasdiqlangan ariza arxivga ko'chiriladi, qaytarilgani esa tarixda qoladi.",
        });
      }
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete rank application", err.message),
      );
    }
  },

  archiveApplication: async (req, res, next) => {
    try {
      const actorName = req.user?.fullName || req.user?.username;
      const doc = await service.archive(req.params.id, actorName);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully archived" });
    } catch (err) {
      if (err instanceof ErrorHandler) return next(err);
      return next(
        new ErrorHandler(400, "Failed to archive rank application", err.message),
      );
    }
  },

  acceptApplication: async (req, res, next) => {
    try {
      const actorName = req.user?.fullName || req.user?.username;
      let officialDocs = req.body.officialDocs;
      const mediaUrls = Array.isArray(req.body.media)
        ? req.body.media.map((m) => m && m.image).filter(Boolean)
        : [];
      if (!officialDocs && mediaUrls.length) {
        const keys = parseArray(req.body.docKeys);
        officialDocs = {};
        keys.forEach((key, i) => {
          if (mediaUrls[i]) officialDocs[key] = mediaUrls[i];
        });
      }
      const doc = await service.accept(
        req.params.id,
        officialDocs || req.body,
        actorName,
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      dispatchInBackground({
        userId: doc.applicant,
        eventType: "council_rank_accepted",
        title: "U: Unvon arizangiz qabul qilindi",
        link: "/kengash/unvonlar",
        metadata: { applicationId: doc._id, code: "U" },
      });
      return res.status(200).json({ message: "successfully accepted" });
    } catch (err) {
      return next(
        new ErrorHandler(
          err.statusCode || 400,
          "Failed to accept rank application",
          err.message,
        ),
      );
    }
  },

  setDiploma: async (req, res, next) => {
    try {
      const actorName = req.user?.fullName || req.user?.username;
      const mediaUrl = Array.isArray(req.body.media)
        ? (req.body.media[0] && req.body.media[0].image) || null
        : null;
      const fileUrl = mediaUrl ?? req.body.fileUrl ?? "";
      const doc = await service.setDiploma(
        req.params.id,
        { fileUrl, date: req.body.date },
        actorName,
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      if (fileUrl) {
        dispatchInBackground({
          userId: doc.applicant,
          eventType: "council_rank_accepted",
          title: "U: Unvon diplomingiz biriktirildi",
          link: "/kengash/unvonlar",
          metadata: { applicationId: doc._id, code: "U" },
        });
      }
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(
          err.statusCode || 400,
          "Failed to set diploma",
          err.message,
        ),
      );
    }
  },

  returnApplication: async (req, res, next) => {
    try {
      const actorName = req.user?.fullName || req.user?.username;
      const doc = await service.returnApp(
        req.params.id,
        req.body.reason,
        actorName,
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      dispatchInBackground({
        userId: doc.applicant,
        eventType: "council_rank_returned",
        title: "U: Unvon arizangiz qaytarildi",
        body: req.body.reason,
        link: "/kengash/unvonlar",
        metadata: { applicationId: doc._id, code: "U" },
      });
      return res.status(200).json({ message: "successfully returned" });
    } catch (err) {
      return next(
        new ErrorHandler(
          err.statusCode || 400,
          "Failed to return rank application",
          err.message,
        ),
      );
    }
  },
};
