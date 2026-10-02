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
const {
  resolveAcademicYearId,
} = require("#references/_services/academicYearResolver");
const {
  findScienceInPlan,
  buildScienceProgramMeta,
  buildPlanHours,
} = require("#modules/4.02-studyLoad/_services/scienceProgramMeta");
const ScienceProgram = require("./scienceProgram.model");
const { buildChainSteps } = ScienceProgram;
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkloadDistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const {
  generateScienceProgramPdf,
  buildScienceProgramPdf,
} = require("#modules/4.02-studyLoad/_pdf/scienceProgram.pdf");
const {
  saveAndUpdatePdf,
  shouldRegeneratePdf,
} = require("#shared/pdfGenerators/pdfHelpers");
const { translaterLanguage } = require("#shared/translate");

const WP_SCHEDULE_POPULATE = {
  path: "workingSchedule",
  select: ["academicYear", "direction", "year"],
};

const resolveWorkingPlan = async ({ workingPlanId, science, academicYear }) => {
  if (workingPlanId) {
    return WorkingPlan.findOne({ _id: workingPlanId })
      .populate(WP_SCHEDULE_POPULATE)
      .exec();
  }

  const approvedScheduleIds = await WorkingScheduleModel.find({
    status: "approved",
  }).distinct("_id");
  if (!approvedScheduleIds.length) return null;

  const candidates = await WorkingPlan.find({
    workingSchedule: { $in: approvedScheduleIds },
  })
    .sort({ createdAt: -1, _id: -1 })
    .populate(WP_SCHEDULE_POPULATE)
    .exec();

  const matches = candidates.filter((cand) => findScienceInPlan(cand, science));
  if (!academicYear) return matches[0] || null;

  const wanted = String(academicYear);
  return (
    matches.find((cand) => {
      const ay = cand?.workingSchedule?.academicYear;
      return String(ay?._id || ay || "") === wanted;
    }) || null
  );
};

const resolvePlanMeta = async ({ workingPlanId, science, academicYear }) => {
  const wp = await resolveWorkingPlan({ workingPlanId, science, academicYear });
  const hit = wp ? findScienceInPlan(wp, science) : null;

  return {
    autoFields: hit
      ? buildScienceProgramMeta({
          workingPlan: wp,
          foundSci: hit.foundSci,
          foundBlock: hit.foundBlock,
          semesterKey: hit.firstSemester,
        })
      : {},
    planWarning: hit
      ? null
      : academicYear
        ? YEAR_META_WARNING
        : EMPTY_META_WARNING,
    planDirection: (wp && wp.workingSchedule && wp.workingSchedule.direction) || null,
  };
};

const EMPTY_META_WARNING =
  "Bu fan bo'yicha tasdiqlangan ishchi o'quv reja topilmadi. Hujjatdagi " +
  '"Fan ma\'lumotlari" jadvali (fan kodi, kredit, haftadagi soat, auditoriya ' +
  "va mustaqil ta'lim soatlari) bo'sh qoladi. Avval o'quv jarayoni jadvalini " +
  "tasdiqlatib oling.";

const YEAR_META_WARNING =
  "Tanlangan o'quv yili uchun tasdiqlangan ishchi o'quv reja topilmadi " +
  "(boshqa o'quv yilining rejasidan ma'lumot OLINMAYDI). Hujjatdagi " +
  '"Fan ma\'lumotlari" jadvali (fan kodi, kredit, haftadagi soat, auditoriya ' +
  "va mustaqil ta'lim soatlari) bo'sh qoladi. Avval shu o'quv yili uchun " +
  "o'quv jarayoni jadvalini tasdiqlatib oling.";

async function autoSavePdf(doc) {
  if (!shouldRegeneratePdf(null, doc.status)) return null;
  return saveAndUpdatePdf({
    buildFn: buildScienceProgramPdf,
    Model: ScienceProgram,
    id: doc._id,
    prefix: "fan-dasturi",
  });
}

const getCurrentStep = (steps = []) =>
  steps.find((s) => s.status === "pending") || null;

const allApproved = (steps = []) => steps.every((s) => s.status === "approved");

const isOwner = (doc, userId) =>
  Boolean(doc.user) && doc.user.toString() === String(userId);

const genBarcode = (id) => `SP-${Date.now()}-${id.toString().slice(-4)}`;

const { STEP_ROLES, PROTOCOL_STEPS } = require("./scienceProgram.chain");

const chainVisibilityFilter = (userRole) =>
  buildChainVisibilityFilter("scienceProgram", userRole);

module.exports = {
  getMyAssignedSciences: async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user._id);
      const { academicYear, onlyAccepted } = req.query;

      const matchDist = { "teachers.teacher": userId };
      if (academicYear) {
        if (!mongoose.Types.ObjectId.isValid(academicYear)) {
          return next(new ErrorHandler(400, "academicYear noto'g'ri formatda"));
        }
        matchDist.academicYear = new mongoose.Types.ObjectId(academicYear);
      }

      const acceptanceFilter =
        onlyAccepted === "true"
          ? { "teachers.acceptanceStatus": "accepted" }
          : { "teachers.acceptanceStatus": { $in: ["accepted", "pending"] } };

      const rows = await WorkloadDistModel.aggregate([
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
            hoursByType: {
              lecture: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        it: {
                          $first: {
                            $filter: {
                              input: {
                                $ifNull: [
                                  "$teachers.blocks.studyWork.classTypes",
                                  [],
                                ],
                              },
                              as: "c",
                              cond: { $eq: ["$$c.slug", "maruza"] },
                            },
                          },
                        },
                      },
                      in: "$$it.stream",
                    },
                  },
                  "$teachers.blocks.studyWork.lecture.stream",
                ],
              },
              seminar: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        it: {
                          $first: {
                            $filter: {
                              input: {
                                $ifNull: [
                                  "$teachers.blocks.studyWork.classTypes",
                                  [],
                                ],
                              },
                              as: "c",
                              cond: { $eq: ["$$c.slug", "amaliy"] },
                            },
                          },
                        },
                      },
                      in: "$$it.stream",
                    },
                  },
                  "$teachers.blocks.studyWork.practicalExercise.stream",
                ],
              },
              laboratory: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        it: {
                          $first: {
                            $filter: {
                              input: {
                                $ifNull: [
                                  "$teachers.blocks.studyWork.classTypes",
                                  [],
                                ],
                              },
                              as: "c",
                              cond: { $eq: ["$$c.slug", "laboratoriya"] },
                            },
                          },
                        },
                      },
                      in: "$$it.stream",
                    },
                  },
                  "$teachers.blocks.studyWork.labTraining.stream",
                ],
              },
              practical: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        it: {
                          $first: {
                            $filter: {
                              input: {
                                $ifNull: [
                                  "$teachers.blocks.studyWork.classTypes",
                                  [],
                                ],
                              },
                              as: "c",
                              cond: { $eq: ["$$c.slug", "klinik_amaliyot"] },
                            },
                          },
                        },
                      },
                      in: "$$it.stream",
                    },
                  },
                  "$teachers.blocks.studyWork.clinicalPractice.stream",
                ],
              },
              independent: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        it: {
                          $first: {
                            $filter: {
                              input: {
                                $ifNull: [
                                  "$teachers.blocks.studyWork.items",
                                  [],
                                ],
                              },
                              as: "c",
                              cond: { $eq: ["$$c.slug", "on"] },
                            },
                          },
                        },
                      },
                      in: "$$it.value",
                    },
                  },
                  "$teachers.blocks.studyWork.student",
                ],
              },
            },
          },
        },

        {
          $group: {
            _id: {
              science: "$science",
              academicYear: "$academicYear",
              semester: "$semester",
              course: "$course",
              totalHour: "$totalHour",
            },
            distributionId: { $first: "$distributionId" },
            academicYear: { $first: "$academicYear" },
            department: { $first: "$department" },
            acceptanceStatus: { $first: "$acceptanceStatus" },
            science: { $first: "$science" },
            scienceName: { $first: "$scienceName" },
            scienceCode: { $first: "$scienceCode" },
            course: { $first: "$course" },
            section: { $first: "$section" },
            semester: { $first: "$semester" },
            totalHour: { $first: "$totalHour" },
            hoursByType: { $first: "$hoursByType" },
          },
        },
        { $project: { _id: 0 } },

        { $sort: { course: 1, semester: 1 } },
      ]);

      if (!rows.length) {
        return res.status(200).json({
          message: "Sizga biriktirilgan fanlar topilmadi",
          total: 0,
          data: [],
        });
      }

      const scienceIds = [
        ...new Set(rows.map((r) => r.science?.toString()).filter(Boolean)),
      ];

      const existingPrograms = await ScienceProgram.find(
        {
          science: { $in: scienceIds },
          active: true,
          ...(academicYear ? { academicYear } : {}),
        },
        { science: 1, status: 1, academicYear: 1, code: 1 },
      );

      const programMap = {};
      for (const sp of existingPrograms) {
        programMap[sp.science.toString()] = {
          programId: sp._id,
          programStatus: sp.status,
          programCode: sp.code,
        };
      }

      const data = rows.map((row) => {
        const key = row.science?.toString();
        const existing = key ? programMap[key] : null;
        return {
          ...row,
          programExists: !!existing,
          programId: existing?.programId || null,
          programStatus: existing?.programStatus || null,
          programCode: existing?.programCode || null,
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

  getWorkingPlanStatus: async (req, res, next) => {
    try {
      const { science, academicYear } = req.query;
      if (!science || !mongoose.Types.ObjectId.isValid(science)) {
        return next(
          new ErrorHandler(400, "science (fan ID) noto'g'ri formatda"),
        );
      }
      const yearId = academicYear ? resolveAcademicYearId(academicYear) : null;

      const wp = await resolveWorkingPlan({ science, academicYear: yearId });
      const hit = wp ? findScienceInPlan(wp, science) : null;

      return res.status(200).json({
        hasWorkingPlan: Boolean(hit),
        warning: hit ? null : yearId ? YEAR_META_WARNING : EMPTY_META_WARNING,
        planHours: hit
          ? buildPlanHours({
              workingPlan: wp,
              foundSci: hit.foundSci,
              foundBlock: hit.foundBlock,
              semesterKey: hit.firstSemester,
            })
          : null,
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Ishchi o'quv reja holatini aniqlashda xatolik",
          err.message,
        ),
      );
    }
  },

  addScienceProgram: async (req, res, next) => {
    try {
      const {
        science,
        workingPlanId,
        sciencePurpose,
        scienceTasks,
        topics,
        academicYear,
        formVersion,
        ...rest
      } = req.body;

      if (!science) {
        return res.status(400).json({ message: "science (fan ID) majburiy" });
      }

      const isSuper = req.user?.role?.title === ROLES.SUPER_ADMIN;
      if (!isSuper) {
        const accepted = await WorkloadDistModel.findOne({
          teachers: {
            $elemMatch: {
              teacher: req.user._id,
              acceptanceStatus: "accepted",
              blocks: { $elemMatch: { science, type: "lesson" } },
            },
          },
        })
          .select("_id")
          .lean();

        if (!accepted) {
          return next(
            new ErrorHandler(
              400,
              "Fan dasturi faqat siz QABUL QILGAN yuklamadagi fan uchun yaratiladi. Avval yuklama taqsimotini qabul qiling",
            ),
          );
        }
      }

      let academicYearId = null;
      if (academicYear) {
        academicYearId = resolveAcademicYearId(academicYear);
        if (!academicYearId) {
          return next(
            new ErrorHandler(404, `O'quv yili topilmadi: ${academicYear}`),
          );
        }
      }

      const nestedFields = {};
      if (sciencePurpose?.desc != null) {
        nestedFields["scienceEssence.sciencePurpose.desc"] =
          sciencePurpose.desc;
      }
      if (scienceTasks?.desc != null) {
        nestedFields["scienceEssence.scienceTasks.desc"] = scienceTasks.desc;
      }
      if (Array.isArray(topics) && topics.length > 0) {
        nestedFields["theoretical.topics"] = topics;
      }

      const { autoFields, planWarning, planDirection } = await resolvePlanMeta({
        workingPlanId,
        science,
        academicYear: academicYearId,
      });

      const hasDirections = Array.isArray(rest.directions) && rest.directions.length > 0;
      if (!hasDirections && planDirection) {
        rest.directions = [planDirection];
      }

      const resolvedFormVersion = formVersion ?? "v259";

      const doc = new ScienceProgram({
        science,
        ...rest,
        ...autoFields,
        ...(academicYearId ? { academicYear: academicYearId } : {}),
        formVersion: resolvedFormVersion,
        approvalSteps: buildChainSteps(resolvedFormVersion),
        user: req?.user?._id,
      });

      if (Object.keys(nestedFields).length) {
        doc.set(nestedFields);
      }

      await doc.save();

      return res.status(201).json({
        message: "Fan dasturi yaratildi",
        _id: doc._id,
        status: doc.status,
        ...(planWarning ? { warning: planWarning } : {}),
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fan dasturi yaratishda xatolik", err.message),
      );
    }
  },

  findAllSciencePrograms: async (req, res, next) => {
    try {
      const { science, direction, year, status } = req.query;

      const filter = { active: true, ...req.scope };
      if (science) filter.science = science;
      if (direction) filter.directions = direction;
      if (year) {
        filter.academicYear =
          resolveAcademicYearId(year) || new mongoose.Types.ObjectId();
      }
      if (status) filter.status = status;

      restrictUnsubmittedVisibility(filter, req, [ROLES.OQITUVCHI]);

      const docs = await ScienceProgram.find(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title)),
      )
        .select("title academicYear semester createdAt status formVersion")
        .populate("science", "title")
        .populate("directions", "title")
        .populate("academicYear", "title")
        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fan dasturlari ro'yxatida xatolik", err.message),
      );
    }
  },
  paginateSciencePrograms: async (req, res, next) => {
    try {
      const { science, direction, year, status, page, limit } = req.query;

      if (!page || !limit) {
        return res.status(400).json({ message: "page and mimit required" });
      }
      const filter = { active: true, ...req.scope };
      if (science) filter.science = science;
      if (direction) filter.directions = direction;
      if (year) {
        filter.academicYear =
          resolveAcademicYearId(year) || new mongoose.Types.ObjectId();
      }
      if (status) filter.status = status;

      restrictUnsubmittedVisibility(filter, req, [ROLES.OQITUVCHI]);

      const doc = await ScienceProgram.paginate(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title)),
        {
          page: parseInt(page),
          limit: parseInt(limit),
          select:
            "title science academicYear semester createdAt status comment approvalSteps formVersion",
          populate: [
            { path: "academicYear", select: "title" },
            { path: "science", select: "title" },
          ],
          lean: true,
        },
      );

      doc.docs = (doc.docs || []).map((item) => {
        item.currentStep = getCurrentStep(item.approvalSteps || [])?.step ?? null;
        delete item.approvalSteps;
        item.formVersion = item.formVersion ?? "v259";
        return item;
      });

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xatolik", err.message));
    }
  },

  findOneScienceProgram: async (req, res, next) => {
    try {
      const { language } = req.query;
      let doc = await ScienceProgram.findOne(
        {
          _id: req.params.id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        {
          createdAt: 0,
          updatedAt: 0,
        },
      )
        .populate([
          {
            path: "science",
            select: "title scienceCode",
            strictPopulate: true,
          },
        ])
        .populate("directions", "title directionCode")
        .populate("approvalSteps.approvedBy", "firstName lastName")
        .populate("academicYear", "title")
        .exec();

      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fan dasturini olishda xatolik", err.message),
      );
    }
  },

  updateScienceProgram: async (req, res, next) => {
    try {
      const doc = await ScienceProgram.findOne(
        { _id: req.params.id, ...req.scope },
        { status: 1, user: 1, formVersion: 1 },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      if (
        req.user?.role?.title !== ROLES.SUPER_ADMIN &&
        !isOwner(doc, req.user?._id)
      ) {
        return next(new ErrorHandler(403, "Bu hujjat sizga tegishli emas"));
      }

      if (doc.status !== "draft") {
        return res.status(400).json({
          message: "Faqat 'draft' holatdagi fan dasturini tahrirlash mumkin",
        });
      }

      if (req.body.v142 && doc.formVersion !== "v142") {
        return next(new ErrorHandler(400, "Bu hujjat 142-son shaklida emas"));
      }

      const {
        status: _s,
        approvalSteps: _a,
        barcode: _b,
        formVersion: _fv,
        sciencePurpose,
        scienceTasks,
        topics,
        academicYear,
        ...updateData
      } = req.body;

      const $set = { ...updateData };

      if (academicYear !== undefined) {
        if (!academicYear) {
          $set.academicYear = null;
        } else {
          const academicYearId = resolveAcademicYearId(academicYear);
          if (!academicYearId) {
            return next(
              new ErrorHandler(404, `O'quv yili topilmadi: ${academicYear}`),
            );
          }
          $set.academicYear = academicYearId;
        }
      }
      if (sciencePurpose?.desc != null) {
        $set["scienceEssence.sciencePurpose.desc"] = sciencePurpose.desc;
      }
      if (scienceTasks?.desc != null) {
        $set["scienceEssence.scienceTasks.desc"] = scienceTasks.desc;
      }
      if (Array.isArray(topics)) {
        $set["theoretical.topics"] = topics;
      }

      await ScienceProgram.findByIdAndUpdate(
        req.params.id,
        { $set },
        { runValidators: true },
      );
      return res.status(200).json({ message: "Fan dasturi yangilandi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fan dasturini yangilashda xatolik", err.message),
      );
    }
  },

  deleteScienceProgram: async (req, res, next) => {
    try {
      const existing = await ScienceProgram.findOne({
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
            `Fan dasturi "${existing.status}" holatida — o'chirish mumkin emas (faqat "draft"/"rejected")`,
          ),
        );
      }

      await existing.softDelete(req.user?._id, req.body?.reason);
      return res
        .status(200)
        .json({ message: "Fan dasturi o'chirildi", _id: existing._id });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },

  archiveScienceProgram: async (req, res, next) => {
    try {
      const doc = await ScienceProgram.findOne({
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
            `Fan dasturi "${doc.status}" holatida — tasdiqlangan yoki ko'rib chiqilayotgan hujjatni arxivlash mumkin emas`,
          ),
        );
      }

      await doc.archive(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "Fan dasturi arxivlandi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Arxivlashda xatolik", err.message));
    }
  },

  restoreScienceProgram: async (req, res, next) => {
    try {
      const doc = await ScienceProgram.findOneWithDeleted({
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
      const doc = await ScienceProgram.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;
      const isTeacher = userRole === ROLES.OQITUVCHI;

      if (doc.status === "draft") {
        if (!isSuper && !isTeacher) {
          return next(
            new ErrorHandler(
              403,
              "Faqat o'qituvchi fan dasturini yubora oladi",
            ),
          );
        }
        if (!isSuper && !isOwner(doc, req.user?._id)) {
          return next(
            new ErrorHandler(403, "Bu hujjat sizga tegishli emas"),
          );
        }
        const t = doc.approvalSteps.find((s) => s.step === "teacher");
        if (t) {
          t.status = "approved";
          t.approvedBy = req.user?._id || null;
          t.date = new Date();
        }
        doc.status = "in_review";
        await doc.save();
        await autoSavePdf(doc);
        const firstPending = getCurrentStep(doc.approvalSteps);
        return res.status(200).json({
          message: "Fan dasturi ko'rib chiqishga yuborildi",
          action: "submitted",
          status: doc.status,
          nextStep: firstPending ? firstPending.step : null,
        });
      }

      if (doc.status === "in_review") {
        const step = getCurrentStep(doc.approvalSteps);
        if (!step) {
          return next(
            new ErrorHandler(400, "Barcha bosqichlar allaqachon yakunlangan"),
          );
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
        if (protocol !== undefined && PROTOCOL_STEPS.includes(step.step)) {
          step.protocol = protocol || null;
        }
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
          doc.barcode = genBarcode(doc._id);
          try {
            await issueToken(doc, req.user?._id || null);
          } catch (err) {
            winston.error(
              `[ScienceProgram] QR token yaratishda xato: ${err.message}`,
            );
          }
        }
        await doc.save();
        await autoSavePdf(doc);

        if (doc.status === "approved" && doc.user) {
          try {
            await safeDispatch({
              userId: doc.user,
              eventType: "scienceProgram_approved",
              title: "Fan dasturi to'liq tasdiqlandi",
              body: `"${doc.title || doc.label || "Fan dasturi"}" barcha bosqichlardan o'tib tasdiqlandi.`,
              link: `/study-load/science-programs/${doc._id}/edit`,
              metadata: { scienceProgramId: doc._id },
            });
          } catch (notifErr) {
            winston.warn(`[ScienceProgram] approved notification xato: ${notifErr.message}`);
          }
        }

        const next_ = getCurrentStep(doc.approvalSteps);
        return res.status(200).json({
          message: `'${step.step}' bosqichi tasdiqlandi`,
          action: "approved_step",
          approvedStep: step.step,
          nextStep: next_ ? next_.step : null,
          status: doc.status,
          barcode: doc.barcode || undefined,
        });
      }

      if (doc.status === "rejected") {
        if (!isSuper && !isTeacher) {
          return next(
            new ErrorHandler(
              403,
              "Faqat o'qituvchi fan dasturini qayta ocha oladi",
            ),
          );
        }
        if (!isSuper && !isOwner(doc, req.user?._id)) {
          return next(
            new ErrorHandler(403, "Bu hujjat sizga tegishli emas"),
          );
        }
        doc.approvalSteps = buildChainSteps(doc.formVersion);
        doc.status = "draft";
        doc.file = null;
        revoke(doc, "Qayta ochildi");
        await doc.save();
        return res.status(200).json({
          message: "Fan dasturi qayta tahrirlash uchun ochildi",
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
        return next(new ErrorHandler(400, "Rad etish uchun comment (asos) majburiy"));
      }

      const doc = await ScienceProgram.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      if (doc.status === "approved") return await runFinalRevoke({ entity: "scienceProgram", doc, req, res, next, afterSave: autoSavePdf });

      if (doc.status !== "in_review") {
        return next(
          new ErrorHandler(
            400,
            "Faqat 'in_review' holatdagi hujjatni rad etish mumkin",
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

      if (doc.user) {
        try {
          await safeDispatch({
            userId: doc.user,
            eventType: "scienceProgram_rejected",
            title: `Fan dasturi rad etildi — "${step.step}" bosqichi`,
            body: comment,
            link: `/study-load/science-programs/${doc._id}/edit`,
            metadata: { scienceProgramId: doc._id, step: step.step },
          });
        } catch (notifErr) {
          winston.warn(`[ScienceProgram] rejected notification xato: ${notifErr.message}`);
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

  findOneScienceProgramTopic: async (req, res, next) => {
    try {
      let doc = await ScienceProgram.findOne(
        {
          _id: req.params?.id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        {
          "theoretical.topics": 1,
        },
      );

      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      return res.status(200).json(doc?.theoretical?.topics || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fan dasturini olishda xatolik", err.message),
      );
    }
  },

  findOneScienceProgramIndependentTask: async (req, res, next) => {
    try {
      let doc = await ScienceProgram.findOne(
        {
          _id: req.params?.id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        {
          independentTask: 1,
        },
      );

      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fan dasturini olishda xatolik", err.message),
      );
    }
  },

  findOneScienceProgramSeminarRecommendation: async (req, res, next) => {
    try {
      let doc = await ScienceProgram.findOne(
        {
          _id: req.params?.id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        {
          seminarRecommendation: 1,
        },
      );

      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Fan dasturini olishda xatolik", err.message),
      );
    }
  },

  generatePdf: async (req, res, next) => {
    try {
      const inScope = await ScienceProgram.exists({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!inScope) return res.status(404).json({ message: "Topilmadi" });
      return generateScienceProgramPdf(req, res, next);
    } catch (err) {
      return next(new ErrorHandler(400, "PDF yaratishda xatolik", err.message));
    }
  },
};
