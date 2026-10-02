const { ErrorHandler } = require("#shared/error");
const service = require("./scientificWork.service");
const { narrowMemberFilter } = require("./scientificWork.scope");
const {
  safeDispatch,
  safeDispatchMany,
  getKotibUserIds,
} = require("#modules/4.06-scientificCouncil/_shared/scienceCouncilNotify");

const workLink = (id) => `/science-council/works/${id}`;

const notifyResearcher = async (doc, eventType, title, body) => {
  if (!doc.researcher) return;
  await safeDispatch({
    userId: doc.researcher,
    eventType,
    title,
    body,
    link: workLink(doc._id),
    metadata: { workId: doc._id },
  });
};

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addWork: async (req, res, next) => {
    try {
      const isGlobal = req.user?.role?.scopeLevel === "global";
      const payload = { ...req.body };

      if (isGlobal) {
        payload.secretary = req.user._id;
        if ((payload.authorType ?? "internal") === "internal" && !payload.researcher) {
          return next(
            new ErrorHandler(400, "Ichki muallif (tadqiqotchi) ko'rsatilmagan"),
          );
        }
      } else {
        payload.authorType = "internal";
        payload.researcher = req.user._id;
        delete payload.externalAuthor;
        delete payload.secretary;
      }

      const doc = await service.create(payload);

      if (!isGlobal) {
        const kotiblar = await getKotibUserIds();
        await safeDispatchMany({
          userIds: kotiblar,
          eventType: "science_work_submitted",
          title: `Yangi ilmiy ish topshirildi: "${doc.title}"`,
          link: workLink(doc._id),
          metadata: { workId: doc._id },
        });
      }

      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ilmiy ish qo'shishda xatolik", err.message),
      );
    }
  },

  findAllWorks: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        scope: narrowMemberFilter(req.scope, req.query.memberId),
        search: req.query.search,
        status: req.query.status,
        year: req.query.year,
        active: req.query.active,
        step: req.query.step,
        defenseResult: req.query.defenseResult,
        specialty: req.query.specialty,
        specialtyIds: req.query.councilNumber
          ? await service.specialtyIdsOfCouncil(req.query.councilNumber)
          : undefined,
      });
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ilmiy ishlarni olishda xatolik", err.message),
      );
    }
  },

  paginateWorks: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        scope: narrowMemberFilter(req.scope, req.query.memberId),
        search: req.query.search,
        status: req.query.status,
        year: req.query.year,
        active: req.query.active,
        step: req.query.step,
        defenseResult: req.query.defenseResult,
        specialty: req.query.specialty,
        specialtyIds: req.query.councilNumber
          ? await service.specialtyIdsOfCouncil(req.query.councilNumber)
          : undefined,
      });
      const result = await service.paginate(filter, {
        page: req.query.page,
        limit: req.query.limit,
      });
      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ilmiy ishlarni sahifalashda xatolik", err.message),
      );
    }
  },

  findMyWorks: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        scope: { researcher: req.user._id },
        search: req.query.search,
        status: req.query.status,
        year: req.query.year,
        step: req.query.step,
        specialty: req.query.specialty,
      });
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ilmiy ishlarni olishda xatolik", err.message),
      );
    }
  },

  findOneWork: async (req, res, next) => {
    try {
      const isGlobal = req.user?.role?.scopeLevel === "global";
      const doc = await service.findOne(req.params.id, isGlobal);
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ilmiy ishni olishda xatolik", err.message),
      );
    }
  },

  updateWork: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(wrapErr(err, "Ilmiy ishni yangilashda xatolik"));
    }
  },

  deleteWork: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ilmiy ishni o'chirishda xatolik", err.message),
      );
    }
  },

  changeStatus: async (req, res, next) => {
    try {
      const doc = await service.changeStatus(
        req.params.id,
        req.body.status,
        req.user._id,
      );
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));

      await notifyResearcher(
        doc,
        "science_work_status_changed",
        `Ilmiy ish holati o'zgardi: "${doc.title}" — ${doc.status}`,
      );

      return res
        .status(200)
        .json({ message: "successfully updated", status: doc.status });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Holatni o'zgartirishda xatolik", err.message),
      );
    }
  },

  updateSeminarDate: async (req, res, next) => {
    try {
      const doc = await service.updateSeminarDate(
        req.params.id,
        req.body.seminarDate ?? null,
        req.user._id,
      );
      if (!doc) return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({
        message: "successfully updated",
        seminarDate: doc.seminarDate,
      });
    } catch (err) {
      return next(wrapErr(err, "Seminar sanasini belgilashda xatolik"));
    }
  },

  updateSeminarResult: async (req, res, next) => {
    try {
      const doc = await service.updateSeminarResult(
        req.params.id,
        req.body.seminarResult,
        req.body.defenseDate,
        req.user._id,
      );
      if (!doc) return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));

      await notifyResearcher(
        doc,
        "science_seminar_result_set",
        `Seminar natijasi belgilandi: "${doc.title}"`,
      );

      return res.status(200).json({
        message: "successfully updated",
        seminarResult: doc.seminarResult,
        defenseDate: doc.defenseDate,
      });
    } catch (err) {
      return next(wrapErr(err, "Seminar natijasini saqlashda xatolik"));
    }
  },

  updateDefenseDate: async (req, res, next) => {
    try {
      const doc = await service.updateDefenseDate(
        req.params.id,
        req.body.defenseDate ?? null,
        req.user._id,
      );
      if (!doc) return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({
        message: "successfully updated",
        defenseDate: doc.defenseDate,
      });
    } catch (err) {
      return next(wrapErr(err, "Himoya sanasini belgilashda xatolik"));
    }
  },

  updateDefenseResult: async (req, res, next) => {
    try {
      const doc = await service.updateDefenseResult(
        req.params.id,
        req.body.defenseResult,
        req.user._id,
      );
      if (!doc) return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({
        message: "successfully updated",
        defenseResult: doc.defenseResult,
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Himoya natijasini saqlashda xatolik",
          err.message,
        ),
      );
    }
  },

  updateMembers: async (req, res, next) => {
    try {
      const doc = await service.updateMembers(
        req.params.id,
        req.body.memberIds,
        req.user._id,
      );
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(wrapErr(err, "A'zolarni yangilashda xatolik"));
    }
  },

  updateDocAssignments: async (req, res, next) => {
    try {
      const doc = await service.updateDocAssignments(
        req.params.id,
        req.body.assignments,
        req.user._id,
      );
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Hujjat biriktirishni yangilashda xatolik",
          err.message,
        ),
      );
    }
  },

  uploadDocument: async (req, res, next) => {
    try {
      const doc = await service.uploadDocument(req.params.id, req.params.docKey, {
        fileName: req.body.file
          ? req.body.file.split("/").pop()
          : req.body.fileName,
        filePath: req.body.file || req.body.filePath,
        userId: req.user._id,
      });
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({ message: "successfully uploaded" });
    } catch (err) {
      return next(wrapErr(err, "Hujjat yuklashda xatolik"));
    }
  },

  uploadDocumentByBody: async (req, res, next) => {
    try {
      const doc = await service.uploadDocument(req.params.id, req.body.docKey, {
        fileName: req.body.file
          ? req.body.file.split("/").pop()
          : req.body.fileName,
        filePath: req.body.file || req.body.filePath || "",
        userId: req.user._id,
      });
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({ message: "successfully uploaded" });
    } catch (err) {
      return next(wrapErr(err, "Hujjat yuklashda xatolik"));
    }
  },

  uploadWorkFile: async (req, res, next) => {
    try {
      const doc = await service.uploadWorkFile(req.params.id, {
        fileName: req.body.file
          ? req.body.file.split("/").pop()
          : req.body.fileName,
        filePath: req.body.file || req.body.filePath,
        userId: req.user._id,
      });
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res.status(200).json({ message: "successfully uploaded" });
    } catch (err) {
      return next(wrapErr(err, "Ilmiy ish faylini yuklashda xatolik"));
    }
  },

  generateProtocol: async (req, res, next) => {
    try {
      const conclusion = req.body.finalConclusion || req.body.conclusion;
      const doc = await service.generateProtocol(
        req.params.id,
        conclusion,
        req.user._id,
        req.body.intro,
      );
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));
      return res
        .status(200)
        .json({ message: "protocol generated", status: doc.status });
    } catch (err) {
      return next(wrapErr(err, "Dalolatnoma yaratishda xatolik"));
    }
  },

  signProtocol: async (req, res, next) => {
    try {
      const doc = await service.signProtocol(
        req.params.id,
        req.user._id,
        req.body.certData,
      );
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish yoki dalolatnoma topilmadi"));
      return res.status(200).json({ message: "protocol signed" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Dalolatnoma imzolashda xatolik", err.message),
      );
    }
  },

  makeDecision: async (req, res, next) => {
    try {
      const doc = await service.makeDecision(req.params.id, {
        ...req.body,
        userId: req.user._id,
      });
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));

      if (req.body.type === "rejected") {
        await notifyResearcher(
          doc,
          "science_application_rejected",
          `Arizangiz rad etildi: "${doc.title}"`,
          doc.rejectionReason,
        );
      } else {
        await notifyResearcher(
          doc,
          "science_decision_made",
          `Yakuniy qaror qabul qilindi: "${doc.title}" — ${doc.status}`,
        );
      }

      return res
        .status(200)
        .json({ message: "decision applied", status: doc.status });
    } catch (err) {
      return next(wrapErr(err, "Qaror qo'llashda xatolik"));
    }
  },

  memberDecision: async (req, res, next) => {
    try {
      const doc = await service.memberDecision(req.params.id, {
        ...req.body,
        userId: req.user._id,
      });
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));

      if (req.body.type === "rejected") {
        await notifyResearcher(
          doc,
          "science_application_rejected",
          `Arizangiz rad etildi: "${doc.title}"`,
          doc.rejectionReason,
        );
      } else {
        await notifyResearcher(
          doc,
          "science_decision_made",
          `Yakuniy qaror qabul qilindi: "${doc.title}" — ${doc.status}`,
        );
      }

      return res
        .status(200)
        .json({ message: "decision applied", status: doc.status });
    } catch (err) {
      return next(wrapErr(err, "Qaror qo'llashda xatolik"));
    }
  },

  acceptApplication: async (req, res, next) => {
    try {
      const doc = await service.acceptApplication(
        req.params.id,
        req.body.memberIds,
        req.user._id,
      );
      if (!doc)
        return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));

      await notifyResearcher(
        doc,
        "science_application_accepted",
        `Arizangiz qabul qilindi: "${doc.title}"`,
      );

      return res
        .status(200)
        .json({ message: "successfully accepted", status: doc.status });
    } catch (err) {
      return next(wrapErr(err, "Arizani qabul qilishda xatolik"));
    }
  },
};
