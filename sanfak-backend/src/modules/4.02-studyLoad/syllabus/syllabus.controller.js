const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const {
  restrictUnsubmittedVisibility,
} = require("#modules/4.02-studyLoad/_shared/draftVisibility");
const {
  buildChainVisibilityFilter,
  andFilters,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const { safeDispatch } = require("#modules/4.02-studyLoad/_shared/chainNotify");
const {
  issueToken,
  revoke,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { runFinalRevoke } = require("#modules/4.02-studyLoad/_shared/finalStepRevoke");
const Syllabus = require("./syllabus.model");
const { narrowTeacherFilter } = require("./syllabus.scope");
const { authorSetFields } = require("./syllabus.author");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const WorkloadDist = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const {
  generateSyllabusPdf,
  buildSyllabusPdf,
} = require("#modules/4.02-studyLoad/_pdf/syllabus.pdf");
const {
  saveAndUpdatePdf,
  shouldRegeneratePdf,
} = require("#shared/pdfGenerators/pdfHelpers");
const {
  particleValue,
  CANONICAL,
} = require("#shared/particleHelpers");

async function autoSavePdf(doc) {
  if (!shouldRegeneratePdf(null, doc.status)) return null;
  return saveAndUpdatePdf({
    buildFn: buildSyllabusPdf,
    Model: Syllabus,
    id: doc._id,
    prefix: "sillabus",
  });
}

const V142_SYLLABUS_BLOCKED =
  "142-son buyruq bo'yicha fan dasturi va sillabus yagona hujjat — alohida sillabus yaratilmaydi";

const isV142 = (sp) => (sp?.formVersion ?? "v259") === "v142";

const getCurrentStep = (steps = []) =>
  steps.find((s) => s.status === "pending") || null;

const allApproved = (steps = []) => steps.every((s) => s.status === "approved");

const isOwner = (doc, userId) =>
  Boolean(doc.author?.teacher) && doc.author.teacher.toString() === String(userId);

const { STEP_ROLES } = require("./syllabus.chain");

const chainVisibilityFilter = (userRole, userId) =>
  buildChainVisibilityFilter("syllabus", userRole, { userId });

module.exports = {
  getMyAssignedSciences: async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user._id);
      const { year, onlyAccepted } = req.query;

      const matchDist = { "teachers.teacher": userId };

      const acceptanceFilter =
        onlyAccepted === "true"
          ? { "teachers.acceptanceStatus": "accepted" }
          : { "teachers.acceptanceStatus": { $in: ["accepted", "pending"] } };

      const rows = await WorkloadDist.aggregate([
        { $match: matchDist },
        { $unwind: "$teachers" },
        {
          $match: {
            "teachers.teacher": userId,
            "teachers.isVacant": { $ne: true },
            ...acceptanceFilter,
          },
        },
        { $unwind: "$teachers.blocks" },
        {
          $match: {
            "teachers.blocks.type": "lesson",
            "teachers.blocks.science": { $ne: null },
          },
        },
        {
          $lookup: {
            from: "sciences",
            localField: "teachers.blocks.science",
            foreignField: "_id",
            as: "_scienceDoc",
          },
        },
        { $unwind: { path: "$_scienceDoc", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "departments",
            localField: "department",
            foreignField: "_id",
            as: "_deptDoc",
          },
        },
        { $unwind: { path: "$_deptDoc", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            distributionId: "$_id",
            academicYear: 1,
            department: "$_deptDoc.title",
            acceptanceStatus: "$teachers.acceptanceStatus",

            science: "$teachers.blocks.science",
            scienceName: "$_scienceDoc.title",
            scienceCode: "$_scienceDoc.scienceCode",
            course: "$teachers.blocks.course",
            section: "$teachers.blocks.section",
            semester: "$teachers.blocks.studyWork.semester",
            totalHour: "$teachers.blocks.totalHour",
            classTypes: {
              $ifNull: ["$teachers.blocks.studyWork.classTypes", []],
            },
            items: { $ifNull: ["$teachers.blocks.studyWork.items", []] },
            lecture: "$teachers.blocks.studyWork.lecture",
            clinicalPractice: "$teachers.blocks.studyWork.clinicalPractice",
            labTraining: "$teachers.blocks.studyWork.labTraining",
            practicalExercise: "$teachers.blocks.studyWork.practicalExercise",
          },
        },
        { $sort: { course: 1, semester: 1 } },
      ]);

      if (!rows.length) {
        return res
          .status(200)
          .json({
            message: "Sizga biriktirilgan fanlar topilmadi",
            total: 0,
            data: [],
          });
      }

      const scienceIds = [
        ...new Set(rows.map((r) => r.science?.toString()).filter(Boolean)),
      ];

      const existingSyllabuses = await Syllabus.find(
        {
          "author.teacher": req.user._id,
          science: { $in: scienceIds },
          active: true,
          ...(year ? { year: Number(year) } : {}),
        },
        { science: 1, status: 1, year: 1 },
      );

      const syllabusMap = {};
      for (const s of existingSyllabuses) {
        syllabusMap[s.science.toString()] = {
          syllabusId: s._id,
          syllabusStatus: s.status,
        };
      }

      const data = rows.map((row) => {
        const key = row.science?.toString();
        const existing = key ? syllabusMap[key] : null;
        return {
          ...row,
          syllabusExists: !!existing,
          syllabusId: existing?.syllabusId || null,
          syllabusStatus: existing?.syllabusStatus || null,
        };
      });

      return res.status(200).json({ total: data.length, data });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Biriktirilgan fanlarni olishda xatolik",
          err.message,
        ),
      );
    }
  },

  addSyllabus: async (req, res, next) => {
    try {
      const {
        scienceProgram: spId,
        workingPlan: wpId,
        status: _ignoredStatus,
        finalize,
        ...rest
      } = req.body;

      let spAuto = {};
      if (spId) {
        const sp = await ScienceProgram.findById(spId, {
          science: 1,
          directions: 1,
          scienceCode: 1,
          code: 1,
          semester: 1,
          credits: 1,
          hourItems: 1,
          lectureHours: 1,
          seminarHours: 1,
          labHours: 1,
          practicalHours: 1,
          independentHours: 1,
          totalHours: 1,
          status: 1,
          formVersion: 1,
          "learningOutcome.desc": 1,
          "theoretical.topics": 1,
        });

        if (!sp) {
          return next(
            new ErrorHandler(
              400,
              "Ko'rsatilgan fan dasturi topilmadi",
            ),
          );
        }
        if (sp.status !== "approved") {
          return next(
            new ErrorHandler(
              400,
              "Sillabus faqat tasdiqlangan fan dasturi asosida yaratiladi. Avval fan dasturini tasdiqlatib oling",
            ),
          );
        }
        if (isV142(sp)) {
          return next(new ErrorHandler(400, V142_SYLLABUS_BLOCKED));
        }

        if (sp) {
          const spItems = Array.isArray(sp.hourItems) ? sp.hourItems : [];
          const hItems = spItems.length
            ? spItems.map((h) => ({
                slug: h.slug || "",
                title: h.title || "",
                value: Number(h.value) || 0,
              }))
            : [
                {
                  slug: "maruza",
                  title: "Ma'ruza",
                  value: Number(sp.lectureHours) || 0,
                },
                {
                  slug: "amaliy",
                  title: "Amaliy",
                  value: Number(sp.seminarHours) || 0,
                },
                {
                  slug: "laboratoriya",
                  title: "Laboratoriya",
                  value: Number(sp.labHours) || 0,
                },
                {
                  slug: "seminar",
                  title: "Seminar",
                  value: Number(sp.practicalHours) || 0,
                },
                {
                  slug: "mustaqil",
                  title: "Mustaqil",
                  value: Number(sp.independentHours) || 0,
                },
              ].filter((h) => h.value > 0);

          spAuto = {
            science: sp.science,
            directions: sp.directions || [],
            scienceCode: sp.scienceCode || sp.code || null,
            semester: sp.semester || null,
            credits: sp.credits || 0,
            hoursByType: {
              totalHours: sp.totalHours || 0,
              items: hItems,
            },
            "sciencePurpose.desc": sp.learningOutcome?.desc || null,
            "scienceContent.topics": (sp.theoretical?.topics || []).map(
              (t) => ({
                topic: t.title || null,
                hour: 0,
              }),
            ),
          };
        }
      }

      let wpAuto = {};
      const lookupScienceId = rest.science || spAuto.science;
      if (wpId && lookupScienceId) {
        const wp = await WorkingPlan.findById(wpId, { semesters: 1 }).lean();
        if (wp) {
          let foundBlock = null;
          let foundSci = null;
          let foundSemKey = null;

          const semestersObj =
            wp.semesters instanceof Map
              ? Object.fromEntries(wp.semesters)
              : wp.semesters || {};

          const requestedSem = rest.semester || spAuto.semester;
          const semKeysOrdered = requestedSem
            ? [
                String(requestedSem),
                ...Object.keys(semestersObj).filter(
                  (k) => k !== String(requestedSem),
                ),
              ]
            : Object.keys(semestersObj).sort((a, b) => Number(a) - Number(b));

          for (const semKey of semKeysOrdered) {
            const semData = semestersObj[semKey];
            if (!semData) continue;
            for (const block of semData.blocks || []) {
              const s = (block.sciences || []).find(
                (sc) =>
                  sc.science?.toString() === lookupScienceId.toString(),
              );
              if (s) {
                foundBlock = block;
                foundSci = s;
                foundSemKey = semKey;
                break;
              }
            }
            if (foundSci) break;
          }

          if (foundSci) {
            wpAuto = {
              scienceType: foundBlock?.title || null,
              ...(!spAuto.credits && {
                credits: foundSci.totalCredit ?? 0,
              }),
              ...(!spAuto.hoursByType && {
                "hoursByType.totalHours":
                  particleValue(foundSci.particle, CANONICAL.HOUR) ||
                  particleValue(foundSci.particle, "soat") ||
                  particleValue(
                    foundSci.particle,
                    "umumiy_yuklamaning_hajmi_soat",
                  ) ||
                  0,
              }),
              ...(!spAuto.semester &&
                !rest.semester && {
                  semester: foundSemKey,
                }),
            };
          }
        }
      }

      const autoData = { ...wpAuto, ...spAuto };

      const dotFields = {};
      const plainFields = {};
      for (const [k, v] of Object.entries(autoData)) {
        if (k.includes(".")) dotFields[k] = v;
        else plainFields[k] = v;
      }

      const resolvedFaculty =
        rest.faculty || req.user?.department?.faculty || null;

      const doc = new Syllabus({
        ...plainFields,
        ...rest,
        faculty: resolvedFaculty,
        scienceProgram: spId || null,
        "author.teacher": req.user?._id || rest["author.teacher"] || null,
        ...(finalize === true ? { status: "new" } : {}),
      });

      const manualHas = (dotKey) => {
        const [root, ...tail] = dotKey.split(".");
        let cur = rest[root];
        for (const k of tail) {
          if (cur == null || typeof cur !== "object") return false;
          cur = cur[k];
        }
        if (cur == null) return false;
        return Array.isArray(cur) ? cur.length > 0 : true;
      };
      const autoDotFields = Object.fromEntries(
        Object.entries(dotFields).filter(([k]) => !manualHas(k)),
      );
      if (Object.keys(autoDotFields).length) doc.set(autoDotFields);

      await doc.save();

      return res.status(201).json({
        message: "Sillabus yaratildi",
        _id: doc._id,
        status: doc.status,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Sillabus yaratishda xatolik", err.message),
      );
    }
  },

  findAllSyllabuses: async (req, res, next) => {
    try {
      const { science, teacher, direction, year, status } = req.query;
      const filter = { active: true, ...narrowTeacherFilter(req.scope, teacher) };

      if (science) filter.science = science;
      if (direction) filter.directions = direction;
      if (year) filter.year = Number(year);
      if (status) filter.status = status;

      restrictUnsubmittedVisibility(filter, req, [ROLES.OQITUVCHI]);

      const docs = await Syllabus.find(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title, req.user?._id)),
        { createdAt: 0, updatedAt: 0 },
      )
        .populate("science", "name")
        .populate("directions", "title")
        .populate("author.teacher", "firstName lastName middleName")
        .populate("faculty", "title")

        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Sillabus ro'yxatida xatolik", err.message),
      );
    }
  },

  paginateSyllabuses: async (req, res, next) => {
    try {
      const {
        science,
        teacher,
        direction,
        year,
        status,
        page = 1,
        limit = 20,
      } = req.query;
      const filter = { active: true, ...narrowTeacherFilter(req.scope, teacher) };
      if (science) filter.science = science;
      if (direction) filter.directions = direction;
      if (year) filter.year = Number(year);
      if (status) filter.status = status;

      restrictUnsubmittedVisibility(filter, req, [ROLES.OQITUVCHI]);

      const doc = await Syllabus.paginate(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title, req.user?._id)),
        {
          page: parseInt(page),
          limit: parseInt(limit),
          select:
            "-updatedAt -scienceContent -trainingSeminar -independent -primaryLiterature -additionalLiterature",
          populate: [
            { path: "science", select: "title" },
            { path: "directions", select: "title" },
            { path: "author.teacher", select: "firstName lastName" },
          ],
          lean: true,
        },
      );

      doc.docs = (doc.docs || []).map((item) => {
        item.currentStep = getCurrentStep(item.approvalSteps || [])?.step ?? null;
        return item;
      });

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xatolik", err.message));
    }
  },

  findOneSyllabus: async (req, res, next) => {
    try {
      const doc = await Syllabus.findOne(
        {
          _id: req.params.id,
          ...andFilters(
            req.scope,
            chainVisibilityFilter(req.user?.role?.title, req.user?._id),
          ),
        },
        {
          createdAt: 0,
          updatedAt: 0,
        },
      )
        .populate("science", "name")
        .populate("directions", "title")
        .populate("faculty", "title")
        .populate("author.teacher", "firstName lastName middleName")
        .populate("scienceProgram", "scienceCode status")
        .populate("confirmation.viceRector", "firstName lastName")
        .populate("methodicalHead.leader", "firstName lastName")
        .populate("facultyDean.dean", "firstName lastName")
        .populate("departmentHead.manager", "firstName lastName")
        .populate("creator.teacher", "firstName lastName")
        .populate("approvalSteps.approvedBy", "firstName lastName")
        .exec();

      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Sillabusni olishda xatolik", err.message),
      );
    }
  },

  updateSyllabus: async (req, res, next) => {
    try {
      const doc = await Syllabus.findOne(
        { _id: req.params.id, ...req.scope },
        { status: 1, "author.teacher": 1 },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      if (
        req.user?.role?.title !== ROLES.SUPER_ADMIN &&
        !isOwner(doc, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }

      if (doc.status !== "draft" && doc.status !== "new") {
        return res
          .status(400)
          .json({
            message:
              "Faqat 'draft'/'new' holatdagi sillabusni tahrirlash mumkin",
          });
      }

      const {
        status: _s,
        approvalSteps: _a,
        finalize,
        author,
        ...updateData
      } = req.body;
      Object.assign(updateData, authorSetFields(author));

      if (updateData.scienceProgram) {
        const sp = await ScienceProgram.findById(updateData.scienceProgram, {
          status: 1,
          formVersion: 1,
        }).lean();
        if (!sp) {
          return next(
            new ErrorHandler(400, "Ko'rsatilgan fan dasturi topilmadi"),
          );
        }
        if (isV142(sp)) {
          return next(new ErrorHandler(400, V142_SYLLABUS_BLOCKED));
        }
        if (sp.status !== "approved") {
          return next(
            new ErrorHandler(
              400,
              "Sillabus faqat tasdiqlangan fan dasturi asosida yaratiladi. Avval fan dasturini tasdiqlatib oling",
            ),
          );
        }
      }

      if (finalize === true) updateData.status = "new";

      await Syllabus.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { runValidators: true },
      );
      return res.status(200).json({ message: "Sillabus yangilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  deleteSyllabus: async (req, res, next) => {
    try {
      const existing = await Syllabus.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!existing) return res.status(404).json({ message: "Topilmadi" });

      if (
        req.user?.role?.title !== ROLES.SUPER_ADMIN &&
        !isOwner(existing, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }

      if (["approved", "in_review"].includes(existing.status)) {
        return next(
          new ErrorHandler(
            400,
            `Sillabus "${existing.status}" holatida — o'chirish mumkin emas (faqat "draft"/"rejected")`,
          ),
        );
      }

      await existing.softDelete(req.user?._id, req.body?.reason);
      return res
        .status(200)
        .json({ message: "Sillabus o'chirildi", _id: existing._id });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },

  archiveSyllabus: async (req, res, next) => {
    try {
      const doc = await Syllabus.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      if (
        req.user?.role?.title !== ROLES.SUPER_ADMIN &&
        !isOwner(doc, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }

      if (doc.archivedAt) return next(new ErrorHandler(400, "Allaqachon arxivlangan"));

      if (["approved", "in_review"].includes(doc.status)) {
        return next(
          new ErrorHandler(
            400,
            `Sillabus "${doc.status}" holatida — tasdiqlangan yoki ko'rib chiqilayotgan hujjatni arxivlash mumkin emas`,
          ),
        );
      }

      await doc.archive(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "Sillabus arxivlandi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Arxivlashda xatolik", err.message));
    }
  },

  restoreSyllabus: async (req, res, next) => {
    try {
      const doc = await Syllabus.findOneWithDeleted({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      if (
        req.user?.role?.title !== ROLES.SUPER_ADMIN &&
        !isOwner(doc, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }

      if (doc.deletedAt) await doc.restore();
      if (doc.archivedAt) await doc.unarchive();

      return res.status(200).json({ message: "Qaytarildi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Qaytarishda xatolik", err.message));
    }
  },

  approve: async (req, res, next) => {
    try {
      const { signature, eriSignature, eriSerial, protocol } = req.body || {};
      const doc = await Syllabus.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;
      const isTeacher = userRole === ROLES.OQITUVCHI;

      if (doc.status === "draft" || doc.status === "new") {
        if (!isSuper && !isTeacher) {
          return next(
            new ErrorHandler(
              403,
              "Faqat o'qituvchi sillabusni yubora oladi",
            ),
          );
        }
        if (!isSuper && !isOwner(doc, req.user?._id)) {
          return next(
            new ErrorHandler(403, "Bu hujjat sizga tegishli emas"),
          );
        }
        doc.status = "in_review";
        doc.submittedAt = new Date();
        await doc.save();
        await autoSavePdf(doc);
        return res.status(200).json({
          message: "Sillabus ko'rib chiqishga yuborildi",
          action: "submitted",
          status: doc.status,
          nextStep: "kafedra",
        });
      }

      if (doc.status === "in_review") {
        const step = getCurrentStep(doc.approvalSteps);
        if (!step) {
          return next(new ErrorHandler(400, "Pending bosqich topilmadi"));
        }
        const required = STEP_ROLES[step.step];
        if (!isSuper && userRole !== required) {
          return next(
            new ErrorHandler(
              403,
              `"${step.step}" bosqichini faqat "${required}" tasdiqlay oladi`,
            ),
          );
        }
        step.status = "approved";
        step.approvedBy = req.user?._id || null;
        step.date = new Date();
        step.signature = signature || null;
        if (protocol !== undefined) step.protocol = protocol || null;
        if (req.eri) {
          step.eriSignature = req.eri.signature;
          step.eriSerial = req.eri.serialNumber || null;
          step.eriSignedAt = req.eri.signedAt || new Date();
        } else if (eriSignature) {
          step.eriSignature = eriSignature;
          step.eriSerial = eriSerial || null;
          step.eriSignedAt = new Date();
        }
        if (allApproved(doc.approvalSteps)) {
          doc.status = "approved";
          try {
            await issueToken(doc, req.user?._id || null);
          } catch (err) {
            winston.error(`[Syllabus] QR token yaratishda xato: ${err.message}`);
          }
        }
        await doc.save();
        await autoSavePdf(doc);

        if (doc.status === "approved" && doc.author?.teacher) {
          try {
            await safeDispatch({
              userId: doc.author.teacher,
              eventType: "syllabus_approved",
              title: "Sillabus to'liq tasdiqlandi",
              body: `"${doc.scienceLabel || doc.title || "Sillabus"}" barcha bosqichlardan o'tib tasdiqlandi.`,
              link: `/study-load/syllabi/${doc._id}/edit`,
              metadata: { syllabusId: doc._id },
            });
          } catch (notifErr) {
            winston.warn(`[Syllabus] approved notification xato: ${notifErr.message}`);
          }
        }

        const next_ = getCurrentStep(doc.approvalSteps);
        return res.status(200).json({
          message: `'${step.step}' bosqichi tasdiqlandi`,
          action: "approved_step",
          approvedStep: step.step,
          nextStep: next_ ? next_.step : null,
          status: doc.status,
        });
      }

      if (doc.status === "rejected") {
        if (!isSuper && !isTeacher) {
          return next(
            new ErrorHandler(
              403,
              "Faqat o'qituvchi sillabusni qayta ocha oladi",
            ),
          );
        }
        if (!isSuper && !isOwner(doc, req.user?._id)) {
          return next(
            new ErrorHandler(403, "Bu hujjat sizga tegishli emas"),
          );
        }
        doc.approvalSteps.forEach((s) => {
          s.status = "pending";
          s.approvedBy = null;
          s.date = null;
          s.comment = null;
          s.signature = null;
          s.eriSignature = null;
          s.eriSerial = null;
          s.eriSignedAt = null;
        });
        doc.status = "draft";
        doc.file = null;
        doc.submittedAt = null;
        revoke(doc, "Qayta ochildi");
        await doc.save();
        return res.status(200).json({
          message: "Sillabus qayta tahrirlash uchun ochildi",
          action: "reopened",
          status: doc.status,
        });
      }

      return next(
        new ErrorHandler(
          400,
          `Bu holatda harakat qilib bo'lmaydi. Joriy: ${doc.status}`,
        ),
      );
    } catch (err) {
      return next(new ErrorHandler(400, "Tasdiqlashda xatolik", err.message));
    }
  },

  reject: async (req, res, next) => {
    try {
      const { comment } = req.body || {};
      if (!comment) {
        return next(new ErrorHandler(400, "comment majburiy"));
      }

      const doc = await Syllabus.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      if (doc.status === "approved") return await runFinalRevoke({ entity: "syllabus", doc, req, res, next, afterSave: autoSavePdf });

      if (doc.status !== "in_review") {
        return next(
          new ErrorHandler(
            400,
            "Faqat 'in_review' holatdagi sillabusni rad etish mumkin",
          ),
        );
      }

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;

      const step = getCurrentStep(doc.approvalSteps);
      if (!step) {
        return next(new ErrorHandler(400, "Pending bosqich topilmadi"));
      }

      const required = STEP_ROLES[step.step];
      if (!isSuper && userRole !== required) {
        return next(
          new ErrorHandler(
            403,
            `"${step.step}" bosqichini faqat "${required}" rad eta oladi`,
          ),
        );
      }

      step.status = "rejected";
      step.approvedBy = req.user?._id || null;
      step.date = new Date();
      step.comment = comment;

      doc.status = "rejected";
      revoke(doc, "Rad etildi");
      await doc.save();
      await autoSavePdf(doc);

      if (doc.author?.teacher) {
        try {
          await safeDispatch({
            userId: doc.author.teacher,
            eventType: "syllabus_rejected",
            title: `Sillabus rad etildi — "${step.step}" bosqichi`,
            body: comment,
            link: `/study-load/syllabi/${doc._id}/edit`,
            metadata: { syllabusId: doc._id, step: step.step },
          });
        } catch (notifErr) {
          winston.warn(`[Syllabus] rejected notification xato: ${notifErr.message}`);
        }
      }

      return res.status(200).json({
        message: `'${step.step}' bosqichida rad etildi`,
        action: "rejected_step",
        rejectedStep: step.step,
        status: doc.status,
        comment,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Rad etishda xatolik", err.message));
    }
  },

  generatePdf: async (req, res, next) => {
    try {
      const inScope = await Syllabus.exists({
        _id: req.params.id,
        ...andFilters(
          req.scope,
          chainVisibilityFilter(req.user?.role?.title, req.user?._id),
        ),
      });
      if (!inScope) return res.status(404).json({ message: "Topilmadi" });
      return generateSyllabusPdf(req, res, next);
    } catch (err) {
      return next(new ErrorHandler(400, "PDF yaratishda xatolik", err.message));
    }
  },
};
