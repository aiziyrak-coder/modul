const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const winston = require("#shared/winston.logger");
const {
  safeDispatchMany,
  getDepartmentHeadUserIds,
} = require("#modules/4.02-studyLoad/_shared/chainNotify");
const {
  notifyTeacherAssigned,
  notifyHeadsTeacherResponded,
} = require("./workloadDistribution.teacherNotify");
const {
  isEditable,
  isLocked,
  notEditableMessage,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");
const classTypeSplit = require("./classTypeSplit");
const { groupIds, coverageOf, coverageClash } = require("./blockCoverage");
const {
  resolvePositionSlug,
} = require("#modules/4.02-studyLoad/_shared/positionSlug");
const {
  rollupEntryAcceptance,
} = require("#modules/4.02-studyLoad/_shared/acceptanceRollup");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const { resolveAcademicYearId } = require("#references/_services/academicYearResolver");
const {
  issueToken,
  revoke,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { runFinalRevoke } = require("#modules/4.02-studyLoad/_shared/finalStepRevoke");
const { supersedePreviousDistributions } = require("./workloadDistribution.supersede");
const { approvedRespondGate } = require("./approvedRespond");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistribution = require("./workloadDistribution.model");
const electiveService = require("./workloadDistribution.service");
const GroupModel = require("#references/group/group.model");
const {
  restrictUnsubmittedVisibility,
} = require("#modules/4.02-studyLoad/_shared/draftVisibility");
const {
  buildChainVisibilityFilter,
  andFilters,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const {
  generateDistributionPdf,
  buildDistributionPdf,
} = require("#modules/4.02-studyLoad/_pdf/distribution.pdf");
const {
  saveAndUpdatePdf,
  shouldRegeneratePdf,
} = require("#shared/pdfGenerators/pdfHelpers");
const {
  validateTeacherMinHours,
  validateMaxOverload,
  getActiveNorma,
  calcHourBounds,
  calcEntryAuditoriumHour,
  getAllowedStakes,
  isAllowedStake,
} = require("#modules/4.02-studyLoad/_services/workloadValidator");
const suitabilityFlag = require("#modules/4.02-studyLoad/_services/suitabilityFlag");

async function autoSavePdf(doc) {
  if (!shouldRegeneratePdf(null, doc.status)) return null;
  return saveAndUpdatePdf({
    buildFn: buildDistributionPdf,
    Model: WorkloadDistribution,
    id: doc._id,
    prefix: "yuklama-taqsimoti",
  });
}

function getCurrentStep(steps = []) {
  return steps.find((s) => s.status === "pending") || null;
}

function allApproved(steps = []) {
  return steps.length > 0 && steps.every((s) => s.status === "approved");
}

function toCourseSemester(globalSemester) {
  const n = Number(globalSemester);
  if (!Number.isInteger(n) || n < 1) return 1;
  return ((n - 1) % 2) + 1;
}

function restrictDraftVisibility(filter, req) {
  return restrictUnsubmittedVisibility(filter, req, [ROLES.KAFEDRA_MUDIRI]);
}

const { STEP_ROLES } = require("./workloadDistribution.chain");

const lockedDeleteError = (status) =>
  status === "superseded"
    ? new ErrorHandler(
      409,
      "Bu taqsimot yangi versiya bilan almashtirilgan (o'z kuchini yo'qotgan) — o'chirib bo'lmaydi",
      undefined,
      { reason: "superseded" },
    )
    : new ErrorHandler(400, `Taqsimot "${status}" holatida — o'chirib bo'lmaydi`);

const chainVisibilityFilter = (userRole) =>
  buildChainVisibilityFilter("workloadDistribution", userRole);

function calcFromWorkload(workload) {
  let totalHour = 0;
  const scienceSet = new Set();
  const courseSet = new Set();

  for (const dir of workload.directions || []) {
    for (const block of dir.blocks || []) {
      totalHour += block.totalHour || 0;

      if (block.science) scienceSet.add(block.science.toString());
      if (block.course) courseSet.add(block.course);
    }
  }

  return {
    totalHour,
    scienceNumber: scienceSet.size,
    course: courseSet.size > 0 ? Math.min(...courseSet) : 0,
  };
}

const wrapErr = (err, message) =>
  err && err.statusCode ? err : new ErrorHandler(400, message, err?.message);

module.exports = {
  addWorkloadDistribution: async (req, res, next) => {
    try {
      const { workload, date } = req.body;

      if (!workload) {
        return res.status(400).json({ message: "workload id majburiy" });
      }

      const workloadData = await Workload.findById(workload).exec();
      if (!workloadData) {
        return res.status(404).json({ message: "Yuklama topilmadi" });
      }

      if (workloadData.status !== "approved") {
        return next(
          new ErrorHandler(
            400,
            "Taqsimot faqat TASDIQLANGAN yuklama uchun yaratiladi",
            `Yuklamaning joriy holati: "${workloadData.status}"`,
          ),
        );
      }

      const existing = await WorkloadDistribution.findOne(
        { workload },
        { _id: 1 },
      );

      if (existing) {
        return res.status(409).json({
          message: "Bu yuklama uchun taqsimot allaqachon yaratilgan",
          distributionId: existing._id,
        });
      }

      const { totalHour, scienceNumber, course } = calcFromWorkload(workloadData);

      const doc = await new WorkloadDistribution({
        workload: workload,
        department: workloadData?.department || null,
        academicYear: workloadData?.academicYear,
        course,
        scienceNumber,
        totalHour,
        residueHour: totalHour,
        teachers: [],
        status: "draft",
        date: new Date().toLocaleDateString("uz-UZ"),
      }).save();

      return res.status(201).json({
        message: "Taqsimot muvaffaqiyatli yaratildi",
        data: {
          _id: doc._id,
          department: doc.department,
          academicYear: doc.academicYear,
          course: doc.course,
          scienceNumber: doc.scienceNumber,
          totalHour: doc.totalHour,
          residueHour: doc.residueHour,
          status: doc.status,
          date: doc.date,
        },
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Taqsimot yaratishda xatolik", err.message),
      );
    }
  },

  findAllWorkloadDistributions: async (req, res, next) => {
    try {
      const { workload, department, year, academicYear, status } = req.query;
      const filter = { ...req.scope };
      if (workload) filter.workload = workload;
      if (department && !req.scope?.department) filter.department = department;
      const ayInput = academicYear || year;
      if (ayInput) {
        const ayId = await resolveAcademicYearId(ayInput);
        if (ayId) filter.academicYear = ayId;
      }
      if (status) filter.status = status;
      restrictDraftVisibility(filter, req);

      const docs = await WorkloadDistribution.find(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title)),
        {
          createdAt: 0,
          updatedAt: 0,
        },
      )
        .select(
          "-confirmation -methodicalHead -financialHead -departmentHead -meta -approvalSteps -staffPositions -workload -createdAt -updatedAt -teachers -courseRef -active -needsRecalculation -lastRecalculation",
        )
        .populate({ path: "academicYear", select: "title" })
        .populate({ path: "department", select: "title", strictPopulate: false })
        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Taqsimotlarni olishda xatolik", err.message),
      );
    }
  },

  paginateWorkloadDistributions: async (req, res, next) => {
    try {
      const {
        workload,
        department,
        year,
        academicYear,
        status,
        page = 1,
        limit = 20,
      } = req.query;

      const filter = { active: true, ...req.scope };
      if (workload) filter.workload = workload;
      if (department && !req.scope?.department) filter.department = department;
      const ayInput = academicYear || year;
      if (ayInput) {
        const ayId = await resolveAcademicYearId(ayInput);
        if (ayId) filter.academicYear = ayId;
      }
      if (status) filter.status = status;
      restrictDraftVisibility(filter, req);

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        select:
          "-confirmation -methodicalHead -financialHead -departmentHead -meta -approvalSteps -staffPositions -workload -createdAt -updatedAt -teachers -courseRef -active -needsRecalculation -lastRecalculation",
        populate: [
          { path: "academicYear", select: "title" },
          { path: "department", select: "title", strictPopulate: false },
        ],
        lean: true,
      };

      const doc = await WorkloadDistribution.paginate(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title)),
        options,
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Taqsimotlarni sahifalashda xatolik",
          err.message,
        ),
      );
    }
  },

  findOneWorkloadDistribution: async (req, res, next) => {
    try {
      const doc = await WorkloadDistribution.findOne(
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
          { path: "department", select: "title", strictPopulate: false },
          {
            path: "workload",
            select: "academicYear title date",
            strictPopulate: false,
          },
          {
            path: "teachers.teacher",
            select: "firstName lastName middleName",
            strictPopulate: false,
          },
          {
            path: "approvalSteps.approvedBy",
            select: "firstName lastName",
            strictPopulate: false,
          },
          {
            path: "confirmation.rector",
            select: "firstName lastName",
            strictPopulate: false,
          },
          {
            path: "methodicalHead.leader",
            select: "firstName lastName",
            strictPopulate: false,
          },
          {
            path: "financialHead.leader",
            select: "firstName lastName",
            strictPopulate: false,
          },
          {
            path: "departmentHead.manager",
            select: "firstName lastName",
            strictPopulate: false,
          },
          {
            path: "teachers.blocks.science",
            select: "title department",
            strictPopulate: false,
          },
          {
            path: "teachers.blocks.justification.declaredBy",
            select: "firstName lastName",
            strictPopulate: false,
          },
        ])

        .exec();

      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      const norma = await getActiveNorma();
      const out = doc.toObject();
      out.teachers = (out.teachers || []).map((t) => {
        const auditoriumHour = calcEntryAuditoriumHour(t);
        if (t.isVacant) return { ...t, auditoriumHour };
        const bounds = calcHourBounds(norma, t.position, t.stavka);
        return bounds
          ? { ...t, ...bounds, auditoriumHour }
          : { ...t, auditoriumHour };
      });
      out.allowedStakes = getAllowedStakes(norma);
      return res.status(200).json(out);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Taqsimotni olishda xatolik", err.message),
      );
    }
  },

  updateWorkloadDistribution: async (req, res, next) => {
    try {
      const existing = await WorkloadDistribution.findOne(
        {
          _id: req.params.id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        { status: 1 },
      );
      if (!existing) return res.status(404).json({ message: "Topilmadi" });
      const userRole = req.user?.role?.title;
      if (userRole !== ROLES.SUPER_ADMIN && userRole !== ROLES.KAFEDRA_MUDIRI) {
        return next(
          new ErrorHandler(403, "Taqsimotni faqat kafedra mudiri tahrirlay oladi"),
        );
      }
      if (!isEditable(existing.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", existing.status) });
      }

      const doc = await WorkloadDistribution.findOneAndUpdate(
        {
          _id: req.params.id,
          ...andFilters(req.scope, chainVisibilityFilter(userRole)),
        },
        req.body,
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "Muvaffaqiyatli yangilandi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Taqsimotni yangilashda xatolik", err.message),
      );
    }
  },

  deleteWorkloadDistribution: async (req, res, next) => {
    try {
      const doc = await WorkloadDistribution.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      const userRole = req.user?.role?.title;
      if (userRole !== ROLES.SUPER_ADMIN && userRole !== ROLES.KAFEDRA_MUDIRI) {
        return next(
          new ErrorHandler(403, "Taqsimotni faqat kafedra mudiri o'chira oladi"),
        );
      }

      if (isLocked(doc.status)) return next(lockedDeleteError(doc.status));

      await doc.deleteOne();

      return res.status(200).json({
        message: `Taqsimot o'chirildi`,
        _id: doc._id,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Taqsimotni o'chirishda xatolik", err.message),
      );
    }
  },

  vacateTeacher: async (req, res, next) => {
    try {
      const { id, teacherEntryId } = req.params;
      const {
        reason,
        requiredPosition,
        requiredSpecialization,
        requiredAcademicTitle,
        deadline,
      } = req.body || {};

      const doc = await WorkloadDistribution.findOne({
        _id: id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "Taqsimot topilmadi" });
      if (!isEditable(doc.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", doc.status) });
      }

      const entry = doc.teachers.find(
        (t) => t._id.toString() === teacherEntryId,
      );
      if (!entry) {
        return res.status(404).json({ message: "O'qituvchi yozuvi topilmadi" });
      }

      if (entry.isVacant) {
        return res.status(400).json({
          message: "Bu yozuv allaqachon vakant",
        });
      }

      const releasedHours = entry.totalHour || 0;
      const now = new Date();

      if (entry.teacher) {
        if (!entry.vacancy) entry.vacancy = {};
        if (!Array.isArray(entry.vacancy.history)) entry.vacancy.history = [];
        entry.vacancy.history.push({
          teacher: entry.teacher,
          assignedAt: entry.assignedAt || null,
          leftAt: now,
          reason: reason || null,
        });
      }

      entry.isVacant = true;
      entry.vacantSince = now;
      entry.vacancyReason = reason || null;
      entry.assignedAt = null;

      if (
        requiredPosition ||
        requiredSpecialization ||
        requiredAcademicTitle ||
        deadline
      ) {
        if (!entry.vacancy) entry.vacancy = {};
        if (requiredPosition) entry.vacancy.requiredPosition = requiredPosition;
        if (requiredSpecialization) {
          entry.vacancy.requiredSpecialization = requiredSpecialization;
        }
        if (requiredAcademicTitle) {
          entry.vacancy.requiredAcademicTitle = requiredAcademicTitle;
        }
        if (deadline) entry.vacancy.deadline = deadline;
      }

      doc.residueHour = (doc.residueHour || 0) + releasedHours;

      await doc.save();

      return res.status(200).json({
        message: "O'qituvchi vakantsiyaga o'tkazildi",
        vacancyNumber: entry.vacancyNumber,
        releasedHours,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Vakantsiyaga o'tkazishda xatolik", err.message),
      );
    }
  },

  fillVacancy: async (req, res, next) => {
    try {
      const { id, teacherEntryId } = req.params;
      const {
        teacher,
        position,
        specialization,
        phone,
        stavka,
        suitabilityBasis,
        suitabilityNote,
      } = req.body || {};

      if (!teacher) {
        return res.status(400).json({ message: "teacher id majburiy" });
      }

      const doc = await WorkloadDistribution.findOne({
        _id: id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "Taqsimot topilmadi" });
      if (!isEditable(doc.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", doc.status) });
      }

      const entry = doc.teachers.find(
        (t) => t._id.toString() === teacherEntryId,
      );
      if (!entry) {
        return res.status(404).json({ message: "O'qituvchi yozuvi topilmadi" });
      }

      if (!entry.isVacant) {
        return res.status(400).json({
          message: "Bu slot vakant emas — to'ldirish mumkin emas",
        });
      }

      if (stavka !== undefined && stavka !== null) {
        const stavkaNorma = await getActiveNorma();
        if (!isAllowedStake(stavkaNorma, stavka)) {
          return next(
            new ErrorHandler(
              400,
              `Stavka qiymati ruxsat etilgan ro'yxatda yo'q: ${stavka}`,
            ),
          );
        }
      }

      const teacherProfile = await TeacherProfile.findOne({ user: teacher })
        .select("department active")
        .lean();
      if (!teacherProfile) {
        return next(
          new ErrorHandler(
            400,
            "Bunday o'qituvchining TeacherProfile yozuvi topilmadi — vakantni to'ldirib bo'lmaydi",
            `teacher=${teacher}`,
          ),
        );
      }
      if (teacherProfile.active === false) {
        return next(
          new ErrorHandler(
            400,
            "O'qituvchi profili faol emas — vakantni to'ldirib bo'lmaydi",
            `teacher=${teacher}`,
          ),
        );
      }

      const suitabilities = await Promise.all(
        (entry.blocks || []).map((block) =>
          suitabilityFlag.buildSuitabilityFromDepartment({
            teacherDepartmentId: teacherProfile.department,
            scienceId: block.science,
          }),
        ),
      );

      const crossBlockIds = (entry.blocks || [])
        .filter((_block, i) =>
          suitabilityFlag.requiresJustification(suitabilities[i].flag),
        )
        .map((b) => String(b._id));
      if (crossBlockIds.length > 0 && !suitabilityBasis) {
        return next(
          new ErrorHandler(
            409,
            "Boshqa kafedra o'qituvchisi vakant o'ringa tayinlanmoqda — sabab (bayonnoma) ko'rsatilishi shart",
            `blockIds=${crossBlockIds.join(",")}`,
            {
              code: "SUITABILITY_BASIS_REQUIRED",
              suitability: "crossDepartment",
              blockIds: crossBlockIds,
            },
          ),
        );
      }
      const crossJustification = suitabilityBasis
        ? {
            basis: suitabilityBasis,
            note: suitabilityNote,
            declaredBy: req.user?._id || null,
            declaredAt: new Date(),
          }
        : null;

      const reclaimedHours = entry.totalHour || 0;

      const now = new Date();

      entry.reassignedAt = now;
      entry.reassignedFrom = entry.teacher || null;
      entry.reassignedBy = req.user?._id || null;

      entry.teacher = teacher;
      entry.isVacant = false;
      entry.vacantSince = null;
      entry.vacancyReason = null;
      entry.vacantLabel = null;

      if (position !== undefined) entry.position = position;
      if (specialization !== undefined) entry.specialization = specialization;
      if (phone !== undefined) entry.phone = phone;
      if (stavka !== undefined) entry.stavka = stavka;

      entry.assignedAt = now;

      entry.acceptanceStatus = "pending";
      entry.rejectionReason = null;
      entry.respondedAt = null;

      (entry.blocks || []).forEach((block, i) => {
        block.acceptanceStatus = "pending";
        block.rejectionReason = null;
        block.respondedAt = null;
        block.suitability = suitabilities[i];
        block.justification = suitabilityFlag.requiresJustification(
          suitabilities[i].flag,
        )
          ? crossJustification
          : suitabilityFlag.emptyJustification();
      });

      doc.residueHour = (doc.residueHour || 0) - reclaimedHours;

      await doc.save();

      return res.status(200).json({
        message: "Vakant o'qituvchi bilan to'ldirildi",
        reclaimedHours,
        teacher: entry.teacher,
        assignedAt: entry.assignedAt,
        previousTeacher: entry.reassignedFrom,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Vakantni to'ldirishda xatolik", err.message),
      );
    }
  },

  addTeacher: async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        teacher = null,
        stavka = 1.0,
        position = null,
        specialization = null,
        phone = null,
        isVacant = false,
        vacantLabel = "Vakant",
        vacancyReason = null,
        vacancy = {},
      } = req.body;

      if (!isVacant && !teacher) {
        return res
          .status(400)
          .json({ message: "teacher id majburiy (isVacant=false uchun)" });
      }

      const vacancyPayload = isVacant
        ? {
            requiredPosition: vacancy.requiredPosition || null,
            requiredSpecialization: vacancy.requiredSpecialization || null,
            requiredAcademicTitle: vacancy.requiredAcademicTitle || null,
            deadline: vacancy.deadline || null,
          }
        : undefined;

      const dist = await WorkloadDistribution.findOne({
        _id: id,
        ...req.scope,
      });
      if (!dist) return res.status(404).json({ message: "Taqsimot topilmadi" });
      if (!isEditable(dist.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", dist.status) });
      }

      const stavkaNorma = await getActiveNorma();
      if (!isAllowedStake(stavkaNorma, stavka)) {
        return next(
          new ErrorHandler(
            400,
            `Stavka qiymati ruxsat etilgan ro'yxatda yo'q: ${stavka}`,
          ),
        );
      }

      let teacherProfile = null;
      if (teacher) {
        teacherProfile = await TeacherProfile.findOne({ user: teacher })
          .populate("position", "title")
          .select("position active")
          .lean();
        if (!teacherProfile) {
          return next(
            new ErrorHandler(
              400,
              "Bunday o'qituvchining TeacherProfile yozuvi topilmadi — biriktirib bo'lmaydi",
              `teacher=${teacher}`,
            ),
          );
        }
        if (teacherProfile.active === false) {
          return next(
            new ErrorHandler(
              400,
              "O'qituvchi profili faol emas — biriktirib bo'lmaydi",
              `teacher=${teacher}`,
            ),
          );
        }
      }

      let resolvedPosition = position;
      if (!resolvedPosition && teacher && !isVacant) {
        resolvedPosition = resolvePositionSlug(teacherProfile?.position?.title);
      }

      if (!isVacant && teacher) {
        const existing = (dist.teachers || []).find(
          (t) => !t.isVacant && String(t.teacher || "") === String(teacher),
        );
        if (existing) {
          if (stavka !== undefined && stavka !== null) existing.stavka = stavka;
          if (resolvedPosition && !existing.position) {
            existing.position = resolvedPosition;
          }
          await dist.save();

          return res.status(200).json({
            message: "O'qituvchi allaqachon taqsimotda — mavjud yozuv qaytarildi",
            teacherEntryId: existing._id,
            vacancyNumber: existing.vacancyNumber || null,
            reused: true,
          });
        }
      }

      const newEntry = {
        teacher,
        stavka,
        position: resolvedPosition,
        specialization,
        phone,
        isVacant,
        vacantLabel,
        vacancyReason,
        ...(vacancyPayload && { vacancy: vacancyPayload }),
        blocks: [],
        totalHour: 0,
        acceptanceStatus: "pending",
      };

      dist.teachers.push(newEntry);
      await dist.save();

      const added = dist.teachers[dist.teachers.length - 1];
      return res.status(201).json({
        message: "O'qituvchi taqsimotga qo'shildi",
        teacherEntryId: added._id,
        vacancyNumber: added.vacancyNumber || null,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "O'qituvchi qo'shishda xatolik", err.message),
      );
    }
  },

  removeTeacher: async (req, res, next) => {
    try {
      const { id, teacherEntryId } = req.params;

      const dist = await WorkloadDistribution.findOne(
        { _id: id, ...req.scope },
        { teachers: 1, residueHour: 1, status: 1 },
      );
      if (!dist) return res.status(404).json({ message: "Taqsimot topilmadi" });
      if (!isEditable(dist.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", dist.status) });
      }

      const entry = dist.teachers.find(
        (t) => t._id.toString() === teacherEntryId,
      );
      if (!entry) {
        return res.status(404).json({ message: "O'qituvchi yozuvi topilmadi" });
      }

      await WorkloadDistribution.findByIdAndUpdate(id, {
        $pull: { teachers: { _id: teacherEntryId } },
        $inc: { residueHour: entry.totalHour },
      });

      return res
        .status(200)
        .json({ message: "O'qituvchi taqsimotdan olib tashlandi" });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "O'qituvchini olib tashlashda xatolik",
          err.message,
        ),
      );
    }
  },

  addBlockToTeacher: async (req, res, next) => {
    try {
      const { id, teacherEntryId } = req.params;
      const {
        workloadBlockId,
        subGroup = 0,
        semester,
        groups = [],
        streams = [],
        classTypeSlugs: rawClassTypeSlugs,
        suitabilityBasis,
        suitabilityNote,
      } = req.body;

      if (!workloadBlockId) {
        return res.status(400).json({ message: "workloadBlockId majburiy" });
      }

      const dist = await WorkloadDistribution.findOne(
        { _id: id, ...req.scope },
        { workload: 1, residueHour: 1, teachers: 1, status: 1 },
      );
      if (!dist) return res.status(404).json({ message: "Taqsimot topilmadi" });
      if (!isEditable(dist.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", dist.status) });
      }

      const teacherEntry = dist.teachers.find(
        (t) => t._id.toString() === teacherEntryId,
      );
      if (!teacherEntry) {
        return res.status(404).json({ message: "O'qituvchi yozuvi topilmadi" });
      }

      const workload = await Workload.findById(dist.workload, {
        directions: 1,
      });
      if (!workload)
        return res.status(404).json({ message: "Yuklama topilmadi" });

      let foundBlock = null;
      let foundDirection = null;
      for (const dir of workload.directions || []) {
        for (const blk of dir.blocks || []) {
          if (blk._id.toString() === workloadBlockId) {
            foundBlock = blk;
            foundDirection = dir;
            break;
          }
        }
        if (foundBlock) break;
      }

      if (!foundBlock) {
        return res.status(404).json({ message: "Yuklamada bu blok topilmadi" });
      }

      const normalized = classTypeSplit.normalizeClassTypeSlugs(
        foundBlock.studyWork?.classTypes,
        rawClassTypeSlugs,
      );
      if (normalized.error) {
        return next(new ErrorHandler(400, normalized.error));
      }
      const classTypeSlugs = normalized.slugs;
      const splitByClassType = classTypeSlugs.length > 0;
      if (
        splitByClassType &&
        (!Array.isArray(groups) || groups.length === 0) &&
        (!Array.isArray(streams) || streams.length === 0)
      ) {
        return next(
          new ErrorHandler(
            400,
            "Dars turi bo'yicha bo'lish uchun guruh yoki oqim tanlanishi shart",
          ),
        );
      }
      if (classTypeSplit.lectureNeedsStream(classTypeSlugs, streams)) {
        return next(
          new ErrorHandler(
            400,
            "Ma'ruza uchun oqim tanlanishi shart (ma'ruza soati oqimlar bo'yicha hisoblanadi)",
          ),
        );
      }

      const incomingGroups = groupIds(groups);
      const incomingCoverage = coverageOf(groups, streams);

      for (const t of dist.teachers || []) {
        for (const b of t.blocks || []) {
          const sameSource = b.workloadBlockId
            ? String(b.workloadBlockId) === String(workloadBlockId)
            : String(b.science || "") === String(foundBlock.science || "") &&
              b.course === (foundBlock.course || 0) &&
              b.type === (foundBlock.type || "lesson") &&
              b.totalHour === (foundBlock.totalHour || 0);

          if (!sameSource) continue;

          const cov = coverageClash(
            incomingCoverage,
            coverageOf(b.groups, b.streams),
          );

          const typesClash = classTypeSplit.classTypesIntersect(
            classTypeSlugs,
            b.classTypeSlugs,
          );
          if (cov.clash && typesClash) {
            const typeLabel = splitByClassType
              ? ` shu dars turlarida (${classTypeSplit.classTypeLabel({
                  classTypeSlugs,
                  studyWork: foundBlock.studyWork,
                })})`
              : "";
            const messages = {
              "both-whole":
                "Bu blok allaqachon biriktirilgan — takroriy biriktirish " +
                "soatlarni ikki marta hisoblaydi",
              whole:
                "Bu blok allaqachon biriktirilgan — guruhsiz (butun blok) " +
                "biriktirish bilan soat ikki marta hisoblanadi. Faqat " +
                "biriktirilmagan guruhlarni tanlang.",
              overlap:
                `Bu blok ${cov.overlap} ta guruh bilan${typeLabel} allaqachon ` +
                "biriktirilgan — o'sha guruhlar soati ikki marta " +
                "hisoblanadi. Boshqa guruhlarni tanlang.",
            };
            return next(new ErrorHandler(400, messages[cov.kind]));
          }
        }
      }

      const normalizedStreams = (Array.isArray(streams) ? streams : []).map(
        (s, idx) => ({
          number: Number.isInteger(s?.number) ? s.number : idx + 1,
          groups: Array.isArray(s?.groups) ? s.groups : [],
          language: s?.language || null,
        }),
      );

      const hasScope = normalizedStreams.length > 0 || incomingGroups.length > 0;

      let scopedStudyWork = foundBlock.studyWork || {};
      let scopedStudent = foundBlock.student || 0;
      let scopedTotalHour = foundBlock.totalHour || 0;
      let nonAuditHour = 0;

      if (hasScope) {
        scopedStudyWork = JSON.parse(
          JSON.stringify(foundBlock.studyWork || {}),
        );
        scopedStudyWork.stream = normalizedStreams.length;
        scopedStudyWork.group = incomingGroups.length;

        for (const it of scopedStudyWork.items || []) {
          it.overridden = false;
        }
        scopedStudent =
          incomingGroups.length > 0
            ? (
                await GroupModel.find(
                  { _id: { $in: incomingGroups } },
                  { studentNumber: 1 },
                ).lean()
              ).reduce((sum, g) => sum + (g.studentNumber || 0), 0)
            : 0;

        const sameSourceBlocks = (dist.teachers || []).flatMap((t) =>
          (t.blocks || []).filter(
            (b) =>
              b.workloadBlockId &&
              String(b.workloadBlockId) === String(workloadBlockId),
          ),
        );
        nonAuditHour = classTypeSplit.nonAuditHourFor({
          sourceBlock: foundBlock,
          sameSourceBlocks,
          classTypeSlugs,
          plannedSlugs: classTypeSplit.plannedSlugs(foundBlock.studyWork?.classTypes),
        });

        const fullScopedTotal = Workload.calculateBlockTotal(
          scopedStudyWork,
          null,
          0,
          scopedStudent,
        );
        const split = classTypeSplit.applyClassTypeFilter(
          scopedStudyWork,
          classTypeSlugs,
          classTypeSplit.scalarOwnerSlug(foundBlock.studyWork?.classTypes),
        );
        scopedTotalHour =
          (splitByClassType ? split.teachingHour + split.itemsSum : fullScopedTotal) +
          nonAuditHour;
      }

      const blockToAdd = {
        workloadBlockId: foundBlock._id,
        section: foundBlock.section || null,
        type: foundBlock.type || "lesson",
        science: foundBlock.science || null,
        practiceTitle: foundBlock.practiceTitle || null,
        course: foundBlock.course || 0,
        semester: semester === 1 || semester === 2 ? semester : toCourseSemester(foundBlock.studyWork?.semester),
        student: scopedStudent,
        subGroup,
        groups: Array.isArray(groups) ? groups : [],
        streams: normalizedStreams,
        studyWork: scopedStudyWork,
        nonAuditHour,
        totalHour: scopedTotalHour,
        classTypeSlugs,
      };

      blockToAdd.electiveSlot = await electiveService.resolveElectiveSlot({
        workingPlanId: foundDirection ? foundDirection.workingPlan : null,
        semester: blockToAdd.semester,
        section: blockToAdd.section,
        science: blockToAdd.science,
      });

      blockToAdd.suitability = await suitabilityFlag.buildSuitability({
        teacherUserId: teacherEntry.teacher,
        scienceId: blockToAdd.science,
      });

      const newResidue = (dist.residueHour || 0) - blockToAdd.totalHour;
      if (newResidue < 0) {
        return next(
          new ErrorHandler(
            400,
            "Taqsimotda yetarli qoldiq soat yo'q",
            `Qoldiq: ${dist.residueHour || 0} soat · biriktirilayotgan: ${blockToAdd.totalHour}`,
          ),
        );
      }

      blockToAdd.justification = suitabilityFlag.emptyJustification();
      if (suitabilityFlag.requiresJustification(blockToAdd.suitability.flag)) {
        if (!suitabilityBasis) {
          return next(
            new ErrorHandler(
              409,
              "Boshqa kafedra o'qituvchisiga fan biriktirilmoqda — sabab (bayonnoma) ko'rsatilishi shart",
              `teacherDepartment=${blockToAdd.suitability.teacherDepartment || "null"} scienceDepartment=${blockToAdd.suitability.scienceDepartment || "null"}`,
              {
                code: "SUITABILITY_BASIS_REQUIRED",
                suitability: "crossDepartment",
                blockIds: [],
              },
            ),
          );
        }
        blockToAdd.justification = {
          basis: suitabilityBasis,
          note: suitabilityNote,
          declaredBy: req.user?._id || null,
          declaredAt: new Date(),
        };
      }

      await WorkloadDistribution.findOneAndUpdate(
        { _id: id, "teachers._id": teacherEntryId },
        {
          $push: { "teachers.$.blocks": blockToAdd },
          $inc: {
            "teachers.$.totalHour": blockToAdd.totalHour,
            residueHour: -blockToAdd.totalHour,
          },
        },
      );

      const updated = await WorkloadDistribution.findById(id);
      if (updated) {
        const updatedEntry = updated.teachers?.id?.(teacherEntryId);
        if (updatedEntry) {
          const rollup = rollupEntryAcceptance(
            updatedEntry.blocks,
            updatedEntry.acceptanceStatus,
          );
          updatedEntry.acceptanceStatus = rollup.acceptanceStatus;
          updatedEntry.rejectionReason = rollup.rejectionReason;
          updatedEntry.respondedAt = rollup.respondedAt;
        }
        await updated.save();
      }

      res.status(201).json({
        message: "Blok o'qituvchiga biriktirildi",
        addedHour: blockToAdd.totalHour,
      });

      void notifyTeacherAssigned({
        teacherUserId: teacherEntry.teacher,
        distributionId: dist._id,
        science: foundBlock.science,
        hours: blockToAdd.totalHour,
      });
      return undefined;
    } catch (err) {
      return next(
        new ErrorHandler(400, "Blok biriktirishda xatolik", err.message),
      );
    }
  },

  updateBlockHours: async (req, res, next) => {
    try {
      const { id, teacherEntryId, blockId } = req.params;
      const { totalHour } = req.body;

      const dist = await WorkloadDistribution.findOne(
        { _id: id, ...req.scope },
        { workload: 1, residueHour: 1, totalHour: 1, teachers: 1, status: 1 },
      );
      if (!dist) return res.status(404).json({ message: "Taqsimot topilmadi" });

      if (!isEditable(dist.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", dist.status) });
      }

      const entry = dist.teachers.find(
        (t) => t._id.toString() === teacherEntryId,
      );
      if (!entry) {
        return res.status(404).json({ message: "O'qituvchi yozuvi topilmadi" });
      }

      const block = (entry.blocks || []).find(
        (b) => b._id.toString() === blockId,
      );
      if (!block) return res.status(404).json({ message: "Blok topilmadi" });

      const oldHour = block.totalHour || 0;
      const newHour = Number(totalHour);

      if (block.workloadBlockId) {
        const workload = await Workload.findById(dist.workload, {
          directions: 1,
        });
        let sourceBlock = null;
        for (const dir of workload?.directions || []) {
          for (const blk of dir.blocks || []) {
            if (blk._id.toString() === String(block.workloadBlockId)) {
              sourceBlock = blk;
              break;
            }
          }
          if (sourceBlock) break;
        }

        if (sourceBlock) {
          const sourceHour = sourceBlock.totalHour || 0;
          let assignedElsewhere = 0;
          for (const t of dist.teachers || []) {
            for (const b of t.blocks || []) {
              if (
                b._id.toString() !== blockId &&
                String(b.workloadBlockId || "") === String(block.workloadBlockId)
              ) {
                assignedElsewhere += b.totalHour || 0;
              }
            }
          }

          if (assignedElsewhere + newHour > sourceHour) {
            return next(
              new ErrorHandler(
                400,
                "Blok bo'yicha taqsimlangan soat yuklamadagi soatdan oshib ketadi",
                `Yuklamada: ${sourceHour} soat · boshqa biriktirishlar: ${assignedElsewhere} · so'ralgan: ${newHour}`,
              ),
            );
          }
        }
      }

      const delta = newHour - oldHour;
      const newResidue = (dist.residueHour || 0) - delta;
      if (newResidue < 0) {
        return next(
          new ErrorHandler(
            400,
            "Taqsimotda yetarli qoldiq soat yo'q",
            `Qoldiq: ${dist.residueHour || 0} soat · qo'shimcha talab: ${delta}`,
          ),
        );
      }

      block.totalHour = newHour;
      entry.totalHour = (entry.blocks || []).reduce(
        (sum, b) => sum + (b.totalHour || 0),
        0,
      );
      dist.residueHour = newResidue;

      const rollup = rollupEntryAcceptance(entry.blocks, entry.acceptanceStatus);
      entry.acceptanceStatus = rollup.acceptanceStatus;
      entry.rejectionReason = rollup.rejectionReason;
      entry.respondedAt = rollup.respondedAt;

      await dist.save();

      return res.status(200).json({
        message: "Blok soati yangilandi",
        blockId,
        previousHour: oldHour,
        totalHour: newHour,
        teacherTotalHour: entry.totalHour,
        residueHour: dist.residueHour,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Blok soatini yangilashda xatolik", err.message),
      );
    }
  },

  removeBlockFromTeacher: async (req, res, next) => {
    try {
      const { id, teacherEntryId, blockId } = req.params;

      const dist = await WorkloadDistribution.findOne(
        { _id: id, ...req.scope },
        { teachers: 1, status: 1 },
      );
      if (!dist) return res.status(404).json({ message: "Taqsimot topilmadi" });
      if (!isEditable(dist.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("taqsimot", dist.status) });
      }

      const entry = dist.teachers.find(
        (t) => t._id.toString() === teacherEntryId,
      );
      if (!entry) {
        return res.status(404).json({ message: "O'qituvchi yozuvi topilmadi" });
      }

      const block = (entry.blocks || []).find(
        (b) => b._id.toString() === blockId,
      );
      if (!block) {
        return res.status(404).json({ message: "Blok topilmadi" });
      }

      const afterPull = await WorkloadDistribution.findOneAndUpdate(
        { _id: id, "teachers._id": teacherEntryId },
        {
          $pull: { "teachers.$.blocks": { _id: blockId } },
          $inc: {
            "teachers.$.totalHour": -(block.totalHour || 0),
            residueHour: +(block.totalHour || 0),
          },
        },
        { new: true },
      );

      const afterEntry = (afterPull?.teachers || []).find(
        (t) => t._id.toString() === teacherEntryId,
      );
      if (afterEntry) {
        const rollup = rollupEntryAcceptance(
          afterEntry.blocks,
          afterEntry.acceptanceStatus,
        );
        await WorkloadDistribution.findOneAndUpdate(
          { _id: id, "teachers._id": teacherEntryId },
          {
            $set: {
              "teachers.$.acceptanceStatus": rollup.acceptanceStatus,
              "teachers.$.rejectionReason": rollup.rejectionReason,
              "teachers.$.respondedAt": rollup.respondedAt,
            },
          },
        );
      }

      return res.status(200).json({
        message: "Blok o'qituvchidan olib tashlandi",
        restoredHour: block.totalHour,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Blokni olib tashlashda xatolik", err.message),
      );
    }
  },

  approve: async (req, res, next) => {
    try {
      const { signature, eriSignature, eriSerial } = req.body || {};
      const doc = await WorkloadDistribution.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!doc) return next(new ErrorHandler(404, "Taqsimot topilmadi"));

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;
      const isKafedra = userRole === ROLES.KAFEDRA_MUDIRI;

      if (doc.status === "draft") {
        if (!isSuper && !isKafedra) {
          return next(
            new ErrorHandler(
              403,
              "Faqat kafedra mudiri taqsimotni yubora oladi",
            ),
          );
        }
        const minHourErrors = await validateTeacherMinHours(doc);
        if (minHourErrors.length > 0) {
          return res.status(400).json({
            message: "Min soat shartiga rioya qilinmagan o'qituvchilar bor",
            errors: minHourErrors,
          });
        }
        const overloadWarnings = (
          await Promise.all(
            (doc.teachers || []).map((entry) => validateMaxOverload(entry)),
          )
        ).filter(Boolean);

        const k = doc.approvalSteps.find((s) => s.step === "kafedra");
        if (k) {
          k.status = "approved";
          k.approvedBy = req.user?._id || null;
          k.date = new Date();
        }
        doc.status = "in_review";
        await doc.save();
        await autoSavePdf(doc);
        return res.status(200).json({
          message: "Taqsimot ko'rib chiqish uchun yuborildi",
          action: "submitted",
          status: doc.status,
          warnings: overloadWarnings,
          suitabilityWarnings: suitabilityFlag.collectCrossDepartmentBlocks(doc),
        });
      }

      if (doc.status === "in_review") {
        const step = getCurrentStep(doc.approvalSteps);
        if (!step) {
          return next(
            new ErrorHandler(400, "Tasdiqlash uchun bosqich topilmadi"),
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
        if (step.step === "methodical") {
          const pendingTeachers = (doc.teachers || []).filter(
            (t) =>
              !t.isVacant &&
              (t.blocks || []).length > 0 &&
              t.acceptanceStatus !== "accepted",
          );
          if (pendingTeachers.length > 0) {
            const summary = pendingTeachers
              .map((t) => t.acceptanceStatus || "pending")
              .reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});
            return next(
              new ErrorHandler(
                400,
                `Zanjirni davom ettirish uchun barcha o'qituvchilar taqsimotni qabul qilishi shart — ${pendingTeachers.length} ta o'qituvchi hali qabul qilmagan`,
                Object.entries(summary)
                  .map(([s, n]) => `${s}: ${n}`)
                  .join(" · "),
              ),
            );
          }
        }

        step.status = "approved";
        step.approvedBy = req.user?._id || null;
        step.date = new Date();
        step.signature = signature || null;
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
            winston.error(
              `[WorkloadDistribution] QR token yaratishda xato: ${err.message}`,
            );
          }
        }
        await doc.save();
        await autoSavePdf(doc);

        let superseded = 0;
        if (doc.status === "approved") {
          try {
            superseded = await supersedePreviousDistributions(doc);
          } catch (err) {
            winston.error(`[WorkloadDistribution] supersede xato: ${err.message}`);
          }
        }

        if (doc.status === "approved") {
          try {
            const heads = await getDepartmentHeadUserIds(doc.department);
            await safeDispatchMany(heads, {
              eventType: "workload_approved",
              title: "Taqsimot to'liq tasdiqlandi",
              body: `"${doc.title || "Taqsimot"}" barcha bosqichlardan o'tib tasdiqlandi.`,
              link: `/study-load/distributions/${doc._id}`,
              metadata: { distributionId: doc._id },
            });
          } catch (notifErr) {
            winston.warn(`[WorkloadDistribution] approved notification xato: ${notifErr.message}`);
          }
        }

        return res.status(200).json({
          message: `"${step.label || step.step}" bosqichi tasdiqlandi`,
          action: "approved_step",
          approvedStep: step.step,
          status: doc.status,
          superseded,
        });
      }

      if (doc.status === "rejected") {
        if (!isSuper && !isKafedra) {
          return next(
            new ErrorHandler(
              403,
              "Faqat kafedra mudiri taqsimotni qayta ocha oladi",
            ),
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
        revoke(doc, "Qayta ochildi");
        await doc.save();
        return res.status(200).json({
          message: "Taqsimot qayta tahrirlash uchun ochildi",
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

  withdraw: async (req, res, next) => {
    try {
      const doc = await WorkloadDistribution.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!doc) return next(new ErrorHandler(404, "Taqsimot topilmadi"));

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;
      const isKafedra = userRole === ROLES.KAFEDRA_MUDIRI;
      if (!isSuper && !isKafedra) {
        return next(
          new ErrorHandler(
            403,
            "Faqat kafedra mudiri taqsimotni qaytarib ola oladi",
          ),
        );
      }

      if (doc.status !== "in_review") {
        return next(
          new ErrorHandler(
            400,
            `Faqat tasdiqlashga yuborilgan taqsimotni qaytarib olish mumkin. Joriy holat: ${doc.status}`,
          ),
        );
      }

      const approvedStep = (doc.approvalSteps || []).find(
        (s) => s.status === "approved" && s.step !== "kafedra",
      );
      if (approvedStep) {
        return next(
          new ErrorHandler(
            400,
            `"${approvedStep.label || approvedStep.step}" bosqichi allaqachon tasdiqlagan — ` +
              `qaytarib olib bo'lmaydi. O'zgartirish uchun tasdiqlovchidan rad etishni so'rang, ` +
              `so'ng taqsimotni qayta oching.`,
          ),
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
      revoke(doc, "Qaytarib olindi");
      await doc.save();

      return res.status(200).json({
        message: "Taqsimot qaytarib olindi — endi tahrirlash mumkin",
        action: "withdrawn",
        status: doc.status,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Qaytarib olishda xatolik", err.message),
      );
    }
  },

  reject: async (req, res, next) => {
    try {
      const { comment } = req.body || {};
      if (!comment) {
        return next(new ErrorHandler(400, "comment majburiy"));
      }

      const doc = await WorkloadDistribution.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!doc) return next(new ErrorHandler(404, "Taqsimot topilmadi"));
      if (doc.status === "approved") return await runFinalRevoke({ entity: "workloadDistribution", doc, req, res, next, afterSave: autoSavePdf });
      if (doc.status === "superseded") {
        return next(new ErrorHandler(409, "Bu taqsimot yangi versiya bilan almashtirilgan (o'z kuchini yo'qotgan) — qaytarib bo'lmaydi", undefined, { reason: "superseded" }));
      }

      if (doc.status !== "in_review") {
        return next(
          new ErrorHandler(
            400,
            `Faqat 'in_review' taqsimotni rad etish mumkin. Joriy: ${doc.status}`,
          ),
        );
      }

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;

      const step = getCurrentStep(doc.approvalSteps);
      if (!step) {
        return next(new ErrorHandler(400, "Rad etish uchun bosqich topilmadi"));
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
      doc.comment = comment;
      revoke(doc, "Rad etildi");
      await doc.save();
      await autoSavePdf(doc);

      try {
        const heads = await getDepartmentHeadUserIds(doc.department);
        await safeDispatchMany(heads, {
          eventType: "workload_rejected",
          title: `Taqsimot rad etildi — "${step.label || step.step}" bosqichi`,
          body: comment,
          link: `/study-load/distributions/${doc._id}`,
          metadata: { distributionId: doc._id, step: step.step },
        });
      } catch (notifErr) {
        winston.warn(`[WorkloadDistribution] rejected notification xato: ${notifErr.message}`);
      }

      return res.status(200).json({
        message: `"${step.label || step.step}" bosqichi rad etildi`,
        action: "rejected_step",
        rejectedStep: step.step,
        status: doc.status,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Rad etishda xatolik", err.message));
    }
  },

  getMyDistributions: async (req, res, next) => {
    try {
      const userId = req.user._id;

      const docs = await WorkloadDistribution.find(
        {
          teachers: {
            $elemMatch: { teacher: userId, isVacant: { $ne: true } },
          },
        },
        {
          workload: 1,
          department: 1,
          academicYear: 1,
          course: 1,
          totalHour: 1,
          residueHour: 1,
          status: 1,
          date: 1,
          teachers: 1,
          supersededAt: 1,
        },
      )
        .populate({ path: "academicYear", select: "title" })
        .populate({ path: "teachers.blocks.science", select: "title", strictPopulate: false })
        .lean()
        .exec();

      const result = docs.map((dist) => {
        const myEntries = (dist.teachers || []).filter(
          (t) =>
            !t.isVacant &&
            t.teacher &&
            t.teacher.toString() === userId.toString(),
        );
        return {
          _id: dist._id,
          academicYear: dist.academicYear,
          course: dist.course,
          totalHour: dist.totalHour,
          status: dist.status,
          date: dist.date,
          superseded: dist.status === "superseded",
          supersededAt: dist.supersededAt ?? null,
          myEntries: myEntries.map((entry) => ({
            teacherEntryId: entry._id,
            acceptanceStatus: entry.acceptanceStatus,
            rejectionReason: entry.rejectionReason ?? null,
            respondedAt: entry.respondedAt ?? null,
            stavka: entry.stavka,
            totalHour: entry.totalHour,
            blocks: (entry.blocks || []).map((b) => ({
              blockId: b._id,
              science: b.science,
              course: b.course,
              semester: b.semester,
              totalHour: b.totalHour,
              type: b.type,
              classTypeSlugs: b.classTypeSlugs ?? [],
              acceptanceStatus:
                b.acceptanceStatus ?? entry.acceptanceStatus ?? "pending",
              rejectionReason: b.rejectionReason ?? null,
              respondedAt: b.respondedAt ?? null,
            })),
          })),
        };
      });

      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(400, "O'qituvchi yuklamalarini olishda xatolik", err.message),
      );
    }
  },

  teacherRespond: async (req, res, next) => {
    try {
      const { id, teacherEntryId } = req.params;
      const { action, reason, blockIds } = req.body;

      if (!["accepted", "rejected"].includes(action)) {
        return res.status(400).json({
          message: "action faqat 'accepted' yoki 'rejected' bo'lishi mumkin",
        });
      }

      if (action === "rejected" && !reason) {
        return res.status(400).json({
          message: "Rad etish uchun reason (asos) majburiy",
        });
      }

      const ownEntry = {
        _id: id,
        status: { $nin: ["approved", "superseded"] },
        teachers: {
          $elemMatch: { _id: teacherEntryId, teacher: req.user._id },
        },
      };

      const teacherEntryObjId = new mongoose.Types.ObjectId(teacherEntryId);
      const teacherObjId = new mongoose.Types.ObjectId(req.user._id);

      const hasBlockIds = Array.isArray(blockIds) && blockIds.length > 0;
      const blockObjIds = hasBlockIds
        ? blockIds.map((bid) => new mongoose.Types.ObjectId(bid))
        : null;

      const blockPath = hasBlockIds
        ? "teachers.$[t].blocks.$[b]"
        : "teachers.$[t].blocks.$[]";

      const arrayFilters = [{ "t._id": teacherEntryObjId, "t.teacher": teacherObjId }];
      if (hasBlockIds) {
        arrayFilters.push({ "b._id": { $in: blockObjIds } });
      }

      const respondedAt = new Date();
      const update = {
        $set: {
          [`${blockPath}.acceptanceStatus`]: action,
          [`${blockPath}.respondedAt`]: respondedAt,
          [`${blockPath}.rejectionReason`]: action === "rejected" ? reason : null,
        },
      };

      const NOT_FOUND_MSG =
        "Taqsimot yoki o'qituvchi yozuvi topilmadi " +
        "(yoki taqsimot allaqachon tasdiqlangan, yoki so'ralgan blok topilmadi).";

      let writeFilter = ownEntry;
      if (hasBlockIds) {
        const preEntryDoc = await WorkloadDistribution.findOne(
          { ...ownEntry, status: { $ne: "superseded" } },
          { teachers: 1, status: 1 },
        ).lean();

        if (!preEntryDoc) {
          return res.status(404).json({ message: NOT_FOUND_MSG });
        }

        const preEntry = (preEntryDoc.teachers || []).find(
          (t) =>
            t._id.toString() === teacherEntryId &&
            t.teacher &&
            t.teacher.toString() === req.user._id.toString(),
        );

        if (!preEntry) {
          return res.status(404).json({ message: NOT_FOUND_MSG });
        }

        const preBlockIds = new Set(
          (preEntry.blocks || []).map((b) => b._id.toString()),
        );
        const allExist = blockIds.every((bid) => preBlockIds.has(String(bid)));
        if (!allExist) {
          return res.status(404).json({ message: NOT_FOUND_MSG });
        }

        if (preEntryDoc.status === "approved") {
          const gate = approvedRespondGate({
            action,
            blocks: preEntry.blocks,
            blockIds,
          });
          if (gate) return res.status(gate.status).json({ message: gate.message });
          writeFilter = { ...ownEntry, status: "approved" };
          arrayFilters[1]["b.acceptanceStatus"] = "pending";
        }
      }

      const doc = await WorkloadDistribution.findOneAndUpdate(
        writeFilter,
        update,
        { new: true, arrayFilters },
      );

      if (!doc) {
        return res.status(404).json({ message: NOT_FOUND_MSG });
      }

      const entry = (doc.teachers || []).find(
        (t) =>
          t._id.toString() === teacherEntryId &&
          t.teacher &&
          t.teacher.toString() === req.user._id.toString(),
      );

      if (!entry) {
        return res.status(404).json({ message: NOT_FOUND_MSG });
      }

      if (!entry.blocks || entry.blocks.length === 0) {
        return res.status(400).json({
          message: "Ushbu yozuvda javob beriladigan fan yo'q",
        });
      }

      const targetBlockIds = hasBlockIds
        ? blockIds.map(String)
        : (entry.blocks || []).map((b) => b._id.toString());

      const entryBlockMap = new Map(
        (entry.blocks || []).map((b) => [b._id.toString(), b]),
      );
      const allUpdated = targetBlockIds.every((bid) => {
        const block = entryBlockMap.get(String(bid));
        return block && block.acceptanceStatus === action;
      });
      if (!allUpdated) {
        return res.status(404).json({ message: NOT_FOUND_MSG });
      }

      const rollup = rollupEntryAcceptance(entry.blocks, entry.acceptanceStatus);

      await WorkloadDistribution.findOneAndUpdate(writeFilter, {
        $set: {
          "teachers.$.acceptanceStatus": rollup.acceptanceStatus,
          "teachers.$.rejectionReason": rollup.rejectionReason,
          "teachers.$.respondedAt": rollup.respondedAt,
        },
      });

      res.status(200).json({
        message:
          action === "accepted"
            ? "Yuklama qabul qilindi"
            : "Yuklama rad etildi",
      });

      void notifyHeadsTeacherResponded({
        dist: doc,
        entry,
        action,
        reason,
        actor: req.user,
      });
      return undefined;
    } catch (err) {
      return next(
        new ErrorHandler(400, "Qabul/rad jarayonida xatolik", err.message),
      );
    }
  },

  generatePdf: async (req, res, next) => {
    try {
      const inScope = await WorkloadDistribution.exists({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!inScope) return res.status(404).json({ message: "Topilmadi" });
      return generateDistributionPdf(req, res, next);
    } catch (err) {
      return next(
        new ErrorHandler(400, "PDF yaratishda xatolik", err.message),
      );
    }
  },

  getVacancies: async (req, res, next) => {
    try {
      const rows = await WorkloadDistribution.aggregate([
        { $match: { ...req.scope, active: true } },

        { $unwind: "$teachers" },

        { $match: { "teachers.isVacant": true } },

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
          $lookup: {
            from: "academicyears",
            localField: "academicYear",
            foreignField: "_id",
            as: "_ayDoc",
          },
        },
        { $unwind: { path: "$_ayDoc", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "sciences",
            localField: "teachers.blocks.science",
            foreignField: "_id",
            as: "_sciDocs",
          },
        },

        {
          $lookup: {
            from: "teacherleaves",
            let: { distId: "$_id", entryId: "$teachers._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$distribution", "$$distId"] },
                      { $eq: ["$teacherEntryId", "$$entryId"] },
                      { $eq: ["$status", "approved"] },
                    ],
                  },
                },
              },
              { $sort: { approvalDate: -1 } },
              { $limit: 1 },
              { $project: { _id: 1, type: 1, fromDate: 1, toDate: 1 } },
            ],
            as: "_leaveDocs",
          },
        },

        {
          $project: {
            _id: 0,
            distributionId: "$_id",
            distributionTitle: "$title",
            distributionStatus: "$status",
            course: "$course",
            department: { _id: "$department", title: "$_deptDoc.title" },
            academicYear: { _id: "$academicYear", title: "$_ayDoc.title" },
            teacherEntryId: "$teachers._id",
            vacancyNumber: "$teachers.vacancyNumber",
            vacantLabel: "$teachers.vacantLabel",
            vacancyReason: "$teachers.vacancyReason",
            vacantSince: "$teachers.vacantSince",
            leave: { $ifNull: [{ $arrayElemAt: ["$_leaveDocs", 0] }, null] },
            totalHour: "$teachers.totalHour",
            blocks: {
              $map: {
                input: { $ifNull: ["$teachers.blocks", []] },
                as: "b",
                in: {
                  science: "$$b.science",
                  scienceTitle: {
                    $let: {
                      vars: {
                        doc: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$_sciDocs",
                                as: "s",
                                cond: { $eq: ["$$s._id", "$$b.science"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: { $ifNull: ["$$doc.title", null] },
                    },
                  },
                  course: "$$b.course",
                  semester: "$$b.semester",
                  totalHour: "$$b.totalHour",
                },
              },
            },
            requiredPosition: "$teachers.vacancy.requiredPosition",
            requiredSpecialization: "$teachers.vacancy.requiredSpecialization",
            requiredAcademicTitle: "$teachers.vacancy.requiredAcademicTitle",
            deadline: "$teachers.vacancy.deadline",
            postedAt: "$teachers.vacancy.postedAt",
          },
        },
      ]).exec();

      return res.status(200).json(rows);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Vakant yuklamalarni olishda xatolik", err.message),
      );
    }
  },

  getElectiveOptions: async (req, res, next) => {
    try {
      const data = await electiveService.getElectiveOptions({
        id: req.params.id,
        blockId: req.query.blockId,
        scope: req.scope,
      });
      return res.status(200).json({ message: "Tanlov variantlari", data });
    } catch (err) {
      return next(wrapErr(err, "Tanlov variantlarini olishda xatolik"));
    }
  },

  setElectiveChoice: async (req, res, next) => {
    try {
      const data = await electiveService.applyElectiveChoice({
        id: req.params.id,
        blockId: req.body.blockId,
        scienceId: req.body.scienceId,
        scope: req.scope,
        user: req.user,
        suitabilityBasis: req.body.suitabilityBasis,
        suitabilityNote: req.body.suitabilityNote,
      });
      return res.status(200).json({ message: "Tanlov fani yangilandi", data });
    } catch (err) {
      return next(wrapErr(err, "Tanlov fanini saqlashda xatolik"));
    }
  },
};
