const { ErrorHandler } = require("#shared/error");
const service = require("./votingSession.service");
const {
  buildTanlovPdf,
} = require("#modules/4.09-instituteCouncil/_pdf/tanlovReport.pdf");
const {
  dispatchManyInBackground,
  getKotibUserIds,
  getVoterUserIds,
  getMemberUserIds,
} = require("#modules/4.09-instituteCouncil/_shared/councilNotify");

const DEFAULT_PDF_INTRO =
  "Farg'ona jamoat salomatligi tibbiyot institutining kafedra mudirlari, " +
  "fanlar bo'yicha professor-o'qituvchilar, dotsentlik, assistentlik " +
  "lavozimiga hujjat topshirgan professor-o'qituvchilar to'g'risida";

module.exports = {
  addSession: async (req, res, next) => {
    try {
      req.body.createdBy = req.user._id;
      const doc = await service.create(req.body);
      if (!doc) return res.status(404).json({ message: "Failed to save" });

      dispatchManyInBackground({
        userIds: await getVoterUserIds(),
        eventType: "council_voting_started",
        title: `V: "${doc.title}" ovoz berish boshlandi`,
        link: "/kengash/ovoz-berish",
        metadata: { sessionId: doc._id, code: "V" },
      });

      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add voting session", err.message),
      );
    }
  },

  findAllSessions: async (req, res, next) => {
    try {
      await service.autoFinalizeExpired();
      const filter = await service.buildFilter(req.query);
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find voting sessions", err.message),
      );
    }
  },

  paginateSessions: async (req, res, next) => {
    try {
      await service.autoFinalizeExpired();
      const filter = await service.buildFilter(req.query);
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate voting sessions", err.message),
      );
    }
  },

  tabsCount: async (req, res, next) => {
    try {
      await service.autoFinalizeExpired();
      const counts = await service.tabsCount();
      return res.status(200).json(counts);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to count voting sessions", err.message),
      );
    }
  },

  findOneSession: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find voting session", err.message),
      );
    }
  },

  setDiploma: async (req, res, next) => {
    try {
      const mediaUrl = Array.isArray(req.body.media)
        ? (req.body.media[0] && req.body.media[0].image) || null
        : null;
      const diplomaFile = mediaUrl || req.body.diplomaFile;
      if (!diplomaFile) {
        return res
          .status(400)
          .json({ message: "Diplom fayli (yoki URL) majburiy" });
      }
      const doc = await service.setCandidateDiploma(
        req.params.id,
        req.params.userId,
        { diplomaFile, diplomaDate: req.body.diplomaDate },
      );
      if (!doc) {
        return res
          .status(404)
          .json({ message: "Sessiya yoki nomzod topilmadi" });
      }
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to set candidate diploma", err.message),
      );
    }
  },

  updateSession: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update voting session", err.message),
      );
    }
  },

  deleteSession: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete voting session", err.message),
      );
    }
  },

  finalize: async (req, res, next) => {
    try {
      const doc = await service.finalize(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });

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

      const title = `V: "${doc.title}" ovoz berish yakunlandi`;
      const body =
        "Natija: " + (doc.status === "approved" ? "tasdiqlandi" : "rad etildi");

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

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to finalize voting session", err.message),
      );
    }
  },

  reportList: async (req, res, next) => {
    try {
      const docs = await service.reportList();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to list voting reports", err.message),
      );
    }
  },

  paginateReport: async (req, res, next) => {
    try {
      const filter = service.buildReportFilter(req.query);
      const doc = await service.paginateReport(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate voting reports", err.message),
      );
    }
  },

  reportPdf: async (req, res, next) => {
    try {
      const filter = service.buildReportFilter(req.query);
      const groups = await service.buildTanlovReport(filter);
      const intro =
        typeof req.query.intro === "string" && req.query.intro.trim()
          ? req.query.intro.trim()
          : DEFAULT_PDF_INTRO;
      return await buildTanlovPdf({ intro, groups }, res, "tanlov-royxati");
    } catch (err) {
      return next(new ErrorHandler(400, "PDF yaratishda xatolik", err.message));
    }
  },

  getReport: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to build report", err.message),
      );
    }
  },
};
