const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const winston = require("#shared/winston.logger");
const {
  safeDispatchMany,
  getDepartmentHeadUserIds,
} = require("#modules/4.02-studyLoad/_shared/chainNotify");
const {
  isEditable,
  notEditableMessage,
  isLocked,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");
const {
  isPracticeEntry,
  isSupervisedPractice,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const {
  computeWorkloadTotals,
} = require("#modules/4.02-studyLoad/_shared/workloadTotals");
const {
  restrictUnsubmittedVisibility,
} = require("#modules/4.02-studyLoad/_shared/draftVisibility");
const {
  resolveAcademicYearId,
  getYearPrefix,
  getAcademicYearTitle,
} = require("#references/_services/academicYearResolver");
const DepartmentModel = require("#references/department/department.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const DirectionModel = require("#references/direction/direction.model");
const WorkloadModel = require("./workload.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const {
  createScheduleStatsResolver,
  contingentWarnings,
} = require("#modules/4.02-studyLoad/_services/departmentContingentStats");
const {
  generateWorkloadPdf,
  buildWorkloadPdf,
} = require("#modules/4.02-studyLoad/_pdf/workload.pdf");
const {
  saveAndUpdatePdf,
  shouldRegeneratePdf,
} = require("#shared/pdfGenerators/pdfHelpers");
const { particleValue, CANONICAL } = require("#shared/particleHelpers");
const {
  buildStaffPositions,
} = require("#modules/4.02-studyLoad/_services/staffPositionsCalculator");
const {
  collectClinicalPrefixes,
  isClinicalRow,
  applyClinicalSplit,
} = require("#modules/4.02-studyLoad/_shared/clinicalPractice");
const workloadService = require("./workload.service");
const {
  buildSummaryRows,
  buildWorkloadSummaryWorkbook,
  summaryFileName,
} = require("#modules/4.02-studyLoad/_excel/workloadSummary.xlsx");
const {
  issueToken,
  revoke,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { runFinalRevoke } = require("#modules/4.02-studyLoad/_shared/finalStepRevoke");
const workloadVersioning = require("./workload.versioning");
const {
  staffTableMissing,
  carryOverStaffItems,
  STAFF_TABLE_MISSING_MSG,
} = require("./workload.staffGate");
const WORKLOAD_REVOCABLE = ["approved", "superseded"];

const { calculateBlockTotal, CLINICAL_PRACTICE_SHARE } = WorkloadModel;

async function autoSavePdf(doc) {
  if (!shouldRegeneratePdf(null, doc.status)) return null;
  return saveAndUpdatePdf({
    buildFn: buildWorkloadPdf,
    Model: WorkloadModel,
    id: doc._id,
    prefix: "yuklama",
  });
}

function getCurrentStep(steps = []) {
  return steps.find((s) => s.status === "pending") || null;
}

function allApproved(steps = []) {
  return steps.length > 0 && steps.every((s) => s.status === "approved");
}

const { STEP_ROLES } = require("./workload.chain");

const {
  buildChainVisibilityFilter,
  andFilters,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");

const chainVisibilityFilter = (userRole) =>
  buildChainVisibilityFilter("workload", userRole);

const getActiveSemesters = (semestersMap) => {
  if (!semestersMap) return [];
  const src =
    semestersMap instanceof Map
      ? Object.fromEntries(semestersMap)
      : semestersMap;
  return Object.entries(src)
    .filter(([, val]) => (val?.hour || 0) + (val?.credit || 0) > 0)
    .map(([key]) => parseInt(key));
};

const buildLastSemesterMap = async (studyPlanId) => {
  const map = new Map();
  if (!studyPlanId) return map;

  const plan = await StudyPlanModel.findById(studyPlanId)
    .select("blocks.sciences.science blocks.sciences.semesters")
    .lean();
  if (!plan) return map;

  for (const block of plan.blocks || []) {
    for (const sci of block.sciences || []) {
      if (!sci.science) continue;
      const active = getActiveSemesters(sci.semesters);
      if (active.length === 0) continue;
      const key = String(sci.science);
      map.set(key, Math.max(map.get(key) || 0, ...active));
    }
  }
  return map;
};

const makeBlock = ({
  section,
  science,
  particle,
  courseNum,
  semNum,
  groupStats,
  lastSemesterByScience,
  isClinical = false,
}) => {
  const streamCount = groupStats.streamCount || 0;

  const lecStream =
    particleValue(particle, CANONICAL.LECTURE, 0) ||
    particleValue(particle, "maruza", 0);

  const semStream =
    particleValue(particle, CANONICAL.SEMINAR, 0) ||
    particleValue(particle, "seminar", 0);

  const clinStream = particleValue(particle, "klinik_amaliyot", 0);
  const labStream =
    particleValue(particle, CANONICAL.LABORATORY, 0) ||
    particleValue(particle, "laboratoriya", 0);
  const practStream =
    particleValue(particle, CANONICAL.PRACTICAL, 0) ||
    particleValue(particle, "amaliy", 0);

  const independentHour =
    particleValue(particle, CANONICAL.INDEPENDENT, 0) ||
    particleValue(particle, "mustaqil_ta_lim", 0);

  const lastSemester = lastSemesterByScience?.get(String(science)) || 0;
  const isLastSemester = lastSemester === 0 || (semNum || 0) >= lastSemester;

  let finalClinStream = clinStream;
  let finalPractStream = practStream;
  if (isClinical) {
    const split = applyClinicalSplit(
      {
        lecture: lecStream,
        seminar: semStream,
        laboratory: labStream,
        practical: practStream,
        clinical: clinStream,
      },
      { share: CLINICAL_PRACTICE_SHARE },
    );
    finalClinStream = split.clinical;
    finalPractStream = split.practical;
    if (split.clamped) {
      winston.warn(
        `[workload] Klinik amaliyot cheklovga uchradi (klinik > amaliy) — ` +
          `science=${science || "-"}, section=${section || "-"}, semNum=${semNum || "-"}`,
      );
    }
  }

  const block = {
    section,
    type: "lesson",
    science: science || null,
    practiceTitle: null,
    course: courseNum || 0,
    student: groupStats.studentCount,
    studyWork: {
      group: groupStats.groupCount,
      stream: streamCount,
      semester: semNum || 0,
      isLastSemester,
      thisSemester: { totalHour: 0, auditoriumHour: 0, independentHour },
      classTypes: [
        { slug: "maruza", title: "Ma'ruza", stream: lecStream, total: 0 },
        {
          slug: "klinik_amaliyot",
          title: "Klinik o'quv amaliyoti",
          stream: finalClinStream,
          total: 0,
        },
        {
          slug: "seminar",
          title: "Seminar",
          stream: semStream,
          total: 0,
        },
        {
          slug: "laboratoriya",
          title: "Laboratoriya mashg'uloti",
          stream: labStream,
          total: 0,
        },
        { slug: "amaliy", title: "Amaliy mashg'ulot", stream: finalPractStream, total: 0 },
      ],
      items: [
        { slug: "on", title: "ON (1 tal. 0.2 soat)", value: 0 },
        { slug: "yan", title: "YAN (1 tal. 0.3 soat)", value: 0 },
        {
          slug: "qoldirilgan",
          title: "Qoldirilgan dars / Qayta topshirish (1 tal. 0.1 soat)",
          value: 0,
        },
        {
          slug: "malakaviy",
          title: "Malakaviy amaliyotga rahbarlik",
          value: 0,
        },
      ],
    },
    otherWork: {
      items: [
        { slug: "yada_umumiy", title: "YADA umumiy ma'ruza", value: 0 },
        { slug: "yada_qatnashish", title: "YADA qatnashish", value: 0 },
        { slug: "qabul", title: "Qabul (ijodiy imtihon)", value: 0 },
        { slug: "maslahatchilik", title: "MI ilmiy maslahatchilik", value: 0 },
        { slug: "ochiq_kafedra", title: "Ochiq leksiya (kafedrada)", value: 0 },
        { slug: "ochiq_integral", title: "Ochiq leksiya (integral)", value: 0 },
      ],
    },
    leadership: 0,
    totalHour: 0,
  };

  block.totalHour = calculateBlockTotal(
    block.studyWork,
    block.otherWork,
    block.leadership,
    block.student,
  );

  return block;
};

module.exports = {
  addWorkload: async (req, res, next) => {
    try {
      const { department, academicYear } = req.body;

      if (!department || !academicYear) {
        return next(
          new ErrorHandler(400, "department va academicYear majburiy"),
        );
      }

      const academicYearId = await resolveAcademicYearId(academicYear);
      if (!academicYearId) {
        return next(
          new ErrorHandler(404, `AcademicYear topilmadi: ${academicYear}`),
        );
      }

      const yearPrefix = await getYearPrefix(academicYearId);

      const allSchedules = await WorkingScheduleModel.find(
        { academicYear: academicYearId, active: true },
        {
          direction: 1,
          year: 1,
          academicYear: 1,
          groups: 1,
          currentCourse: 1,
          courseRef: 1,
          status: 1,
        },
      );

      if (!allSchedules.length) {
        return next(
          new ErrorHandler(
            404,
            `${yearPrefix} uchun WorkingSchedule topilmadi`,
          ),
        );
      }

      const schedules = allSchedules.filter((s) => s.status === "approved");
      const unapproved = allSchedules.filter((s) => s.status !== "approved");
      if (!schedules.length) {
        const byStatus = unapproved.reduce((acc, s) => {
          acc[s.status || "draft"] = (acc[s.status || "draft"] || 0) + 1;
          return acc;
        }, {});
        const detail = Object.entries(byStatus)
          .map(([st, n]) => `${st} ×${n}`)
          .join(", ");
        return next(
          new ErrorHandler(
            409,
            `${yearPrefix} uchun ishchi o'quv reja hali TASDIQLANMAGAN (${detail}) — yuklama faqat tasdiqlangan ishchi rejadan yaratiladi. Avval ishchi reja tasdiqlash zanjirini yakunlang.`,
          ),
        );
      }

      const directionBlocks = [];
      const warnings = [];
      if (unapproved.length) {
        warnings.push({
          code: "UNAPPROVED_SCHEDULES_SKIPPED",
          message: `${unapproved.length} ta tasdiqlanmagan ishchi reja hisobga olinmadi (${unapproved
            .map((s) => s.status || "draft")
            .join(", ")}). Ular tasdiqlangach yuklamani qayta hisoblang.`,
        });
      }
      let unlinkedInPlan = 0;
      const statsForSchedule = createScheduleStatsResolver({
        department,
        academicYear: academicYearId,
      });

      for (const schedule of schedules) {
        const workingPlan = await WorkingPlanModel.findOne({
          workingSchedule: schedule._id,
        });

        if (!workingPlan) continue;

        const lastSemesterByScience = await buildLastSemesterMap(
          workingPlan.studyPlan,
        );

        const groupStats = await statsForSchedule(schedule);
        warnings.push(...contingentWarnings(groupStats, schedule));

        if (!groupStats.groupCount) {
          const [ayTitle, dirDoc] = await Promise.all([
            getAcademicYearTitle(academicYearId),
            DirectionModel.findById(schedule.direction).select("title").lean(),
          ]);
          const ayLabel = ayTitle || yearPrefix;
          const dirLabel = dirDoc?.title || String(schedule.direction);
          warnings.push({
            code: "NO_GROUPS",
            message:
              `"${ayLabel}" o'quv yilida "${dirLabel}" yo'nalishi uchun ` +
              `hech qanday guruh topilmadi — bu yo'nalishning barcha ` +
              `bloklari 0 soat bilan yaratiladi.`,
            academicYear: ayLabel,
            direction: dirLabel,
          });
        }

        const blocks = [];

        let clinicalRowCount = 0;

        let practiceHours = 0;
        const directionDoc = await DirectionModel.findById(schedule.direction)
          .select("practiceDepartment")
          .lean();
        const practiceDeptId = directionDoc?.practiceDepartment
          ? String(directionDoc.practiceDepartment)
          : null;
        const practiceBelongsHere =
          practiceDeptId && practiceDeptId === String(department);

        const semestersObj =
          workingPlan.semesters instanceof Map
            ? Object.fromEntries(workingPlan.semesters)
            : workingPlan.semesters || {};

        for (const [semKey, semData] of Object.entries(semestersObj)) {
          const localSemNum = Number(semKey);

          const courseNum = schedule.currentCourse || 1;
          const semNum = (courseNum - 1) * 2 + localSemNum;

          for (const planBlock of semData.blocks || []) {
            const section = planBlock.title || planBlock.blockCode || null;
            const clinicalPrefixes = collectClinicalPrefixes(
              planBlock.sciences,
            );

            for (const sci of planBlock.sciences || []) {
              if (isPracticeEntry(sci)) {
                if (practiceBelongsHere && isSupervisedPractice(sci)) {
                  practiceHours +=
                    particleValue(sci.particle, CANONICAL.HOUR, 0) ||
                    particleValue(sci.particle, "soat", 0);
                }
                continue;
              }

              const hasCode =
                typeof sci.code === "string" && sci.code.trim() !== "";
              const isRealSubject =
                hasCode &&
                sci.title &&
                sci.title !== "Jami" &&
                sci.title !== "HAMMASI";
              if (isRealSubject && !sci.science) unlinkedInPlan += 1;

              if (
                !sci.department ||
                sci.department.toString() !== department.toString()
              ) {
                continue;
              }
              if (
                !sci.science &&
                (!sci.title || sci.title === "Jami" || sci.title === "HAMMASI")
              ) {
                continue;
              }

              const isClinical = isClinicalRow(sci, clinicalPrefixes);
              if (isClinical) clinicalRowCount += 1;

              blocks.push(
                makeBlock({
                  section,
                  science: sci.science,
                  particle: sci.particle,
                  courseNum,
                  semNum,
                  groupStats,
                  lastSemesterByScience,
                  isClinical,
                }),
              );
            }
          }
        }

        winston.info(
          `[workload] Klinik qatorlar: direction=${schedule.direction}, ` +
            `department=${department}, count=${clinicalRowCount}`,
        );

        if (practiceHours > 0 && blocks.length > 0) {
          const b0 = blocks[0];
          const item = (b0.studyWork?.items || []).find(
            (it) => it.slug === "malakaviy",
          );
          if (item) {
            item.value = (Number(item.value) || 0) + practiceHours;
            b0.totalHour = calculateBlockTotal(
              b0.studyWork,
              b0.otherWork,
              b0.leadership,
              b0.student,
            );
          }
        }

        if (blocks.length > 0) {
          directionBlocks.push({
            direction: schedule.direction,
            workingPlan: workingPlan._id,
            blocks,
          });
        }
      }

      if (!directionBlocks.length) {
        if (unlinkedInPlan > 0) {
          return next(
            new ErrorHandler(
              404,
              `O'quv reja fanlari katalogga bog'lanmagan (${unlinkedInPlan} ta) — ` +
                `avval fanlarni fanlar katalogi bilan bog'lang, so'ng yuklama yarating.`,
            ),
          );
        }
        return next(
          new ErrorHandler(404, "Bu kafedra uchun tegishli fanlar topilmadi"),
        );
      }

      const staffPositions = await buildStaffPositions({
        directions: directionBlocks,
      });

      const [depDoc, ayDoc] = await Promise.all([
        DepartmentModel.findById(department).select("title").lean().exec(),
        AcademicYearModel.findById(academicYearId).select("title").lean().exec(),
      ]);
      const title = `${depDoc?.title || "Kafedra"}ning ${
        ayDoc?.title || ""
      } o'quv yili uchun soatlar hisobi va ish o'rinlari`
        .replace(/\s+/g, " ")
        .trim();

      const versionPlan = await workloadVersioning.prepareNewVersion({
        department,
        academicYear: academicYearId,
      });
      if (versionPlan.error) return next(versionPlan.error);

      const hasStaffItems =
        Array.isArray(staffPositions?.items) && staffPositions.items.length > 0;
      if (versionPlan.previousVersion && !hasStaffItems) {
        const prev = await WorkloadModel.findById(versionPlan.previousVersion, {
          "staffPositions.items": 1,
        }).lean();
        staffPositions.items = carryOverStaffItems(prev?.staffPositions?.items);
      }

      const doc = await new WorkloadModel({
        department,
        academicYear: academicYearId,
        title,
        date: new Date().toLocaleDateString("uz-UZ"),
        directions: directionBlocks,
        staffPositions,
        version: versionPlan.version,
        previousVersion: versionPlan.previousVersion,
      }).save();

      return res.status(201).json({
        message: "Workload muvaffaqiyatli yaratildi",
        _id: doc._id,
        version: doc.version,
        directionsCount: directionBlocks.length,
        totalBlocks: directionBlocks.reduce((s, d) => s + d.blocks.length, 0),
        warnings,
      });
    } catch (err) {
      const duplicate = workloadVersioning.duplicateVersionError(err);
      if (duplicate) return next(duplicate);
      return next(
        new ErrorHandler(400, "Workload yaratishda xatolik", err.message),
      );
    }
  },

  findAllWorkloads: async (req, res, next) => {
    try {
      const { department, year, academicYear, status, excludeDistributed } =
        req.query;
      const data = andFilters(
        req.scope,
        chainVisibilityFilter(req.user?.role?.title),
      );
      if (department && !req.scope?.department) data.department = department;
      const ayInput = academicYear || year;
      if (ayInput) {
        const ayId = await resolveAcademicYearId(ayInput);
        if (ayId) data.academicYear = ayId;
      }
      if (status) {
        data["status"] = status;
      }
      restrictUnsubmittedVisibility(data, req, [
        ROLES.OQUV_USLUBIY_BOSHQARMA,
      ]);
      if (excludeDistributed === "true" || excludeDistributed === true) {
        const distributedIds = await WorkloadDistributionModel.distinct(
          "workload",
        );
        data._id = { $nin: distributedIds };
      }
      let docs = await WorkloadModel.find(data)
        .select([
          "title",
          "academicYear",
          "status",
          "date",
          "directions",
          "department",
          "approvalSteps",
          "lastEditedAfterApprovalAt",
          "lastEditedAfterApprovalBy",
          "needsRecalculation",
          "version",
          "previousVersion",
          "supersededBy",
          "supersededAt",
        ])
        .populate([
          {
            path: "department",
            strictPopulate: true,
          },
          {
            path: "academicYear",
            select: "title",
          },
        ])

        .exec();
      docs = docs.map((doc) => {
        const { totalLectures, totalHours } = computeWorkloadTotals(doc);

        doc.totalLectures = totalLectures;
        doc.totalHours = totalHours;
        doc.currentStep =
          (doc.approvalSteps || []).find((s) => s.status === "pending")?.step ??
          null;
        delete doc?.approvalSteps;
        delete doc?.directions;

        return doc;
      });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find workloads", err.message),
      );
    }
  },

  paginateWorkloads: async (req, res, next) => {
    try {
      const { department, academicYear, year, page, limit, status } = req.query;
      const data = andFilters(
        req.scope,
        chainVisibilityFilter(req.user?.role?.title),
      );
      if (department && !req.scope?.department) data.department = department;
      const ayInput = academicYear || year;
      if (ayInput) {
        const ayId = await resolveAcademicYearId(ayInput);
        if (ayId) data.academicYear = ayId;
      }
      if (status) {
        data["status"] = status;
      }
      restrictUnsubmittedVisibility(data, req, [
        ROLES.OQUV_USLUBIY_BOSHQARMA,
      ]);
      let doc = await WorkloadModel.paginate(data, {
        limit: parseInt(limit) || 10,
        page: parseInt(page) || 1,
        lean: true,
        populate: [
          { path: "department", strictPopulate: true, select: ["title"] },
          { path: "academicYear", select: "title" },
        ],
        select: [
          "title",
          "academicYear",
          "status",
          "date",
          "directions",
          "department",
          "approvalSteps",
          "lastEditedAfterApprovalAt",
          "lastEditedAfterApprovalBy",
          "needsRecalculation",
          "version",
          "previousVersion",
          "supersededBy",
          "supersededAt",
        ],
      });

      doc["docs"] = doc?.docs.map((item) => {
        const { totalLectures, totalHours } = computeWorkloadTotals(item);

        item.totalLectures = totalLectures;
        item.totalHours = totalHours;
        item.currentStep =
          (item.approvalSteps || []).find((s) => s.status === "pending")?.step ??
          null;
        delete item?.approvalSteps;
        delete item?.directions;

        return item;
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate workloads", err.message),
      );
    }
  },

  findOneWorkload: async (req, res, next) => {
    try {
      const doc = await WorkloadModel.findOne(
        {
          _id: req.params.id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        { createdAt: 0, updatedAt: 0 },
      )
        .populate([
          { path: "directions.blocks.science", select: "title department" },
          { path: "directions.direction", select: "title" },
        ])
        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find workload", err.message),
      );
    }
  },

  updateWorkload: async (req, res, next) => {
    try {
      const existing = await WorkloadModel.findOne(
        { _id: req.params.id, ...req.scope },
        { status: 1 },
      );
      if (!existing) return res.status(404).json({ message: "not found" });
      if (!isEditable(existing.status)) {
        return res
          .status(400)
          .json({ message: notEditableMessage("yuklama", existing.status) });
      }

      const doc = await WorkloadModel.findOneAndUpdate(
        { _id: req.params.id, ...req.scope },
        req.body,
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update workload", err.message),
      );
    }
  },

  deleteWorkload: async (req, res, next) => {
    try {
      const doc = await WorkloadModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      const DELETABLE_STATUSES = ["draft", "new", "rejected"];
      if (!DELETABLE_STATUSES.includes(doc.status))
        return res.status(400).json({
          message:
            "Faqat tasdiqlash jarayoniga kirmagan yoki rad etilgan (draft/new/rejected) yuklamalarni o'chirish mumkin",
        });
      await doc.deleteOne();
      return res
        .status(200)
        .json({ message: `Yuklama o'chirildi`, _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete workload", err.message),
      );
    }
  },

  approve: async (req, res, next) => {
    try {
      const { signature, eriSignature, eriSerial } = req.body || {};
      const doc = await WorkloadModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;
      const isUslubi = userRole === ROLES.OQUV_USLUBIY_BOSHQARMA;

      if (doc.status === "draft") {
        if (!isSuper && !isUslubi) {
          return next(
            new ErrorHandler(
              403,
              "Faqat o'quv-uslubiy boshqarma yuklamani yubora oladi",
            ),
          );
        }
        if (staffTableMissing(doc.staffPositions)) {
          return next(new ErrorHandler(400, STAFF_TABLE_MISSING_MSG));
        }
        const m = doc.approvalSteps.find((s) => s.step === "methodical");
        if (m) {
          m.status = "approved";
          m.approvedBy = req.user?._id || null;
          m.date = new Date();
        }
        doc.status = "in_review";
        await doc.save();
        await autoSavePdf(doc);
        return res.status(200).json({
          message: "Yuklama ko'rib chiqish uchun yuborildi",
          action: "submitted",
          status: doc.status,
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
          const versionConflict = await workloadVersioning.higherVersionError(doc);
          if (versionConflict) return next(versionConflict);
          doc.status = "approved";
          try {
            await issueToken(doc, req.user?._id || null);
          } catch (err) {
            winston.error(
              `[Workload] QR token yaratishda xato: ${err.message}`,
            );
          }
        }
        await doc.save();
        await autoSavePdf(doc);

        let superseded = 0;
        if (doc.status === "approved") {
          try {
            superseded = await workloadVersioning.supersedePreviousWorkloads(doc);
          } catch (err) {
            winston.error(`[Workload] supersede xato: ${err.message}`);
          }
        }

        if (doc.status === "approved") {
          try {
            const heads = await getDepartmentHeadUserIds(doc.department);
            await safeDispatchMany(heads, {
              eventType: "workload_approved",
              title: "Yuklama to'liq tasdiqlandi",
              body: `"${doc.title}" barcha bosqichlardan o'tib tasdiqlandi.`,
              link: `/study-load/workloads/${doc._id}`,
              metadata: { workloadId: doc._id },
            });
          } catch (notifErr) {
            winston.warn(`[Workload] approved notification xato: ${notifErr.message}`);
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
        if (!isSuper && !isUslubi) {
          return next(
            new ErrorHandler(
              403,
              "Faqat o'quv-uslubiy boshqarma yuklamani qayta ocha oladi",
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
          message: "Yuklama qayta tahrirlash uchun ochildi",
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

      const doc = await WorkloadModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      if (WORKLOAD_REVOCABLE.includes(doc.status)) {
        return await runFinalRevoke({ entity: "workload", doc, req, res, next, afterSave: autoSavePdf, revocableStatuses: WORKLOAD_REVOCABLE });
      }

      if (doc.status !== "in_review") {
        return next(
          new ErrorHandler(
            400,
            `Faqat 'in_review' yuklamani rad etish mumkin. Joriy: ${doc.status}`,
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
          title: `Yuklama rad etildi — "${step.label || step.step}" bosqichi`,
          body: comment,
          link: `/study-load/workloads/${doc._id}`,
          metadata: { workloadId: doc._id, step: step.step },
        });
      } catch (notifErr) {
        winston.warn(`[Workload] rejected notification xato: ${notifErr.message}`);
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

  generatePdf: async (req, res, next) => {
    try {
      const inScope = await WorkloadModel.exists({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!inScope) return res.status(404).json({ message: "not found" });
      return generateWorkloadPdf(req, res, next);
    } catch (err) {
      return next(
        new ErrorHandler(400, "PDF yaratishda xatolik", err.message),
      );
    }
  },

  exportSummaryXlsx: async (req, res, next) => {
    try {
      const ayId = await resolveAcademicYearId(req.query.academicYear);
      if (!ayId) {
        return next(new ErrorHandler(400, "O'quv yili topilmadi"));
      }
      const filter = andFilters(
        req.scope,
        chainVisibilityFilter(req.user?.role?.title),
      );
      filter.academicYear = ayId;
      restrictUnsubmittedVisibility(filter, req, [ROLES.OQUV_USLUBIY_BOSHQARMA]);

      const [docs, academicYearTitle] = await Promise.all([
        workloadService.loadSummaryWorkloads(filter),
        getAcademicYearTitle(ayId),
      ]);

      if (!docs.length) {
        return next(
          new ErrorHandler(
            409,
            `${academicYearTitle || "Tanlangan"} o'quv yilida tasdiqlangan yuklama topilmadi`,
            "Hisobot faqat tasdiqlangan yuklamalardan tuziladi.",
          ),
        );
      }

      const rows = buildSummaryRows(docs);
      const wb = buildWorkloadSummaryWorkbook({
        rows,
        academicYearTitle: academicYearTitle || "",
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${summaryFileName(academicYearTitle)}"`,
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(
        new ErrorHandler(400, "Excel jadvalini yaratishda xatolik", err.message),
      );
    }
  },

  recalculateBulk: async (req, res, next) => {
    try {
      const { workloadIds, needsRecalculation, all } = req.body;
      const filter = { active: true, ...(req.scope || {}), status: { $ne: "superseded" } };

      if (Array.isArray(workloadIds) && workloadIds.length > 0) {
        filter._id = { $in: workloadIds };
      } else if (needsRecalculation) {
        filter.needsRecalculation = true;
      } else if (!all) {
        return next(
          new ErrorHandler(
            400,
            "Body majburiy: workloadIds[] yoki needsRecalculation:true yoki all:true",
          ),
        );
      }

      const docs = await WorkloadModel.find(filter);
      const results = [];
      const warnings = [];

      for (const wl of docs) {
        try {
          if (isLocked(wl.status)) {
            wl.needsRecalculation = true;
            await wl.save();
            results.push({
              workloadId: wl._id,
              skipped: true,
              reason: `status="${wl.status}" — ERI himoyasi tufayli qayta hisoblanmadi`,
              success: true,
            });
            continue;
          }

          let blockChanged = 0;
          const statsForSchedule = createScheduleStatsResolver({
            department: wl.department,
            academicYear: wl.academicYear,
          });

          for (const dir of wl.directions || []) {
            const schedules = await WorkingScheduleModel.find({
              direction: dir.direction,
              academicYear: wl.academicYear,
              active: true,
            }).select("groups direction courseRef academicYear currentCourse");

            const statsByCourse = new Map();
            for (const sch of schedules) {
              const stats = await statsForSchedule(sch);
              statsByCourse.set(Number(sch.currentCourse), stats);
              warnings.push(
                ...contingentWarnings(stats, sch, {
                  workloadId: wl._id,
                  direction: dir.direction,
                  course: Number(sch.currentCourse),
                }),
              );
            }
            const EMPTY_STATS = { studentCount: 0, groupCount: 0, streamCount: 0 };

            for (const block of dir.blocks || []) {
              const before = block.totalHour;
              const groupStats =
                statsByCourse.get(Number(block.course)) || EMPTY_STATS;

              block.student = groupStats.studentCount;
              block.studyWork.group = groupStats.groupCount;
              block.studyWork.stream = groupStats.streamCount;
              block.totalHour = calculateBlockTotal(
                block.studyWork,
                block.otherWork,
                block.leadership,
                block.student,
              );

              if (block.totalHour !== before) blockChanged++;
            }
          }

          wl.staffPositions = await buildStaffPositions(wl);
          wl.needsRecalculation = false;
          wl.lastRecalculation = {
            triggeredBy: req.user?._id,
            triggeredAt: new Date(),
            reason: "Bulk recalculate (manual)",
          };
          await wl.save();

          results.push({
            workloadId: wl._id,
            blocksUpdated: blockChanged,
            success: true,
          });
        } catch (err) {
          results.push({
            workloadId: wl._id,
            success: false,
            error: err.message,
          });
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.length - successful;

      return res.status(200).json({
        message: `Qayta hisoblash yakunlandi: ${successful} ta muvaffaqiyatli, ${failed} ta xato`,
        total: results.length,
        successful,
        failed,
        results,
        warnings,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Bulk recalc xato", err.message));
    }
  },

  updateBlockContent: async (req, res, next) => {
    try {
      const { id, blockId } = req.params;
      const result = await workloadService.applyBlockEdit({
        filter: {
          _id: id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        blockId,
        body: req.body,
        userId: req.user?._id,
      });

      return res.status(200).json({
        message: "Blok kontenti yangilandi",
        blockId,
        previousHour: result.previousHour,
        totalHour: result.totalHour,
        thisSemester: result.thisSemester,
        staffPositions: result.staffPositions,
      });
    } catch (err) {
      return next(
        err.statusCode
          ? err
          : new ErrorHandler(
              400,
              "Blok kontentini tahrirlashda xatolik",
              err.message,
            ),
      );
    }
  },

  updateStaffPositions: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await workloadService.applyStaffPositionsEdit({
        filter: {
          _id: id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        items: req.body.items,
        userId: req.user?._id,
      });

      return res.status(200).json({
        message: "Shtat birliklari jadvali (Jadval 2) yangilandi",
        staffPositions: result.staffPositions,
      });
    } catch (err) {
      return next(
        err.statusCode
          ? err
          : new ErrorHandler(
              400,
              "Shtat birliklari jadvalini yangilashda xatolik",
              err.message,
            ),
      );
    }
  },
};
