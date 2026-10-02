const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const winston = require("#shared/winston.logger");
const WorkingScheduleModel = require("./workingSchedule.model");
const { narrowDirectionFilter } = require("./workingSchedule.scope");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const {
  sanitizeApproval,
} = require("#modules/4.02-studyLoad/_shared/approvalText");
const {
  parseCourseSelection,
  pickSelectedCourses,
} = require("./courseSelection");
const {
  issueOrRefresh,
  revoke,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { runFinalRevoke } = require("#modules/4.02-studyLoad/_shared/finalStepRevoke");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const WorkingScheduleJob = require("#modules/4.02-studyLoad/_shared/workingScheduleJob.model");
const {
  restrictUnsubmittedVisibility,
} = require("#modules/4.02-studyLoad/_shared/draftVisibility");
const {
  buildChainVisibilityFilter,
  andFilters,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const escapeRegex = require("#modules/4.02-studyLoad/_shared/escapeRegex");
const {
  isPracticeEntry,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const {
  isEmptySlotRow,
  buildQuotaSlotRow,
  countEmptySlots,
} = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");
const {
  syncKeyWeeksFromStats,
} = require("#modules/4.02-studyLoad/_shared/compositionSync");

const toPlainStat = (s) => ({
  key: s?.key ?? null,
  slug: s?.slug ?? "",
  title: s?.title ?? "",
  value: Number(s?.value) || 0,
});

function practiceTitle(semBlocks) {
  const names = [
    ...new Set(
      (semBlocks || [])
        .flatMap((b) => b.sciences || [])
        .filter((sci) => isPracticeEntry(sci))
        .map((sci) => String(sci.title || "").trim())
        .filter(Boolean),
    ),
  ];
  return names.length
    ? `Malakaviy amaliyot (${names.join(", ")})`
    : "Malakaviy amaliyot";
}

const {
  resolveWeeklyHours,
} = require("#modules/4.02-studyLoad/_services/semesterBreakdown");
const {
  collectUnlinkedCodes,
  loadCatalogByCodes,
  resolveLink,
} = require("#modules/4.02-studyLoad/_services/scienceLinker");
const {
  isLocked,
  lockedMessage,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");
const LearningProcess = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const GroupModel = require("#references/group/group.model");
const { resolveCourse } = require("#references/_services/courseResolver");
const DirectionModel = require("#references/direction/direction.model");
const { populateAllSlugRefs } = require("#references/_services/educationActivityResolver");
const {
  buildWorkingRejaDoc,
} = require("#modules/4.02-studyLoad/_pdf/workingPlan.pdf");
const { pipeToResponse } = require("#shared/pdfGenerators/pdfHelpers");
const mongoose = require("mongoose");

const getCourseKeys = (courseNum) => {
  const s1 = String(courseNum * 2 - 1);
  const s2 = String(courseNum * 2);
  return [s1, s2];
};

const filterSemesters = (semesters, semKeys) => {
  if (!semesters) return {};
  const src =
    semesters instanceof Map ? Object.fromEntries(semesters) : semesters;
  return Object.fromEntries(
    Object.entries(src).filter(([k]) => semKeys.includes(k)),
  );
};

const countWeeksByKey = (weeks) => {
  const counts = {};
  const src = weeks instanceof Map ? Object.fromEntries(weeks) : weeks || {};
  for (const val of Object.values(src)) {
    const k = val === null || val === undefined ? " " : val;
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
};

const toPlainWeeks = (weeks) => {
  if (!weeks) return {};
  return weeks instanceof Map ? Object.fromEntries(weeks) : weeks;
};

const isSummaryRow = (s) => {
  if (!s) return true;
  if (s.science) return false;
  const code = String(s.code || "").trim();
  if (code && !/^\d+-?kurs$/i.test(code)) return false;
  const t = String(s.title || "")
    .trim()
    .toLowerCase();
  return /^jami:?$/i.test(t) || /^hammasi$/i.test(t) || /^jami\s/i.test(t);
};

const refreshVerifyToken = async (doc, userId) => {
  try {
    await issueOrRefresh(doc, userId);
  } catch (err) {
    winston.error(`[WorkingSchedule] QR token yaratishda xato: ${err.message}`);
  }
};

const countUnfilledSlotsOfSchedule = async (workingScheduleId) => {
  const plans = await WorkingPlanModel.find({ workingSchedule: workingScheduleId })
    .select("semesters")
    .lean();
  return (plans || []).reduce((n, p) => n + countEmptySlots(p.semesters), 0);
};

const projectAlternatives = (s) => {
  if (!Array.isArray(s?.alternatives)) return [];
  return s.alternatives.map((a) => ({
    science: a.science || null,
    code: a.code || null,
    title: a.title || null,
    department: a.department || null,
  }));
};

const recalcBlockParticle = (filteredSciences, originalParticle) => {
  const sums = {};
  for (const sci of filteredSciences || []) {
    for (const p of sci.particle || []) {
      if (!p?.slug) continue;
      sums[p.slug] = (sums[p.slug] || 0) + (Number(p.value) || 0);
    }
  }
  const base = Array.isArray(originalParticle) ? originalParticle : [];
  return base.map((p) => ({
    slug: p.slug,
    title: p.title,
    value: sums[p.slug] || 0,
  }));
};

const filterMetaForCourse = (meta, courseNum) => {
  if (!meta) return {};
  const src = typeof meta.toObject === "function" ? meta.toObject() : meta;
  const idx = (courseNum || 1) - 1;
  const sem1 = (courseNum - 1) * 2;
  const sem2 = sem1 + 1;
  const pick = (arr, i) =>
    Array.isArray(arr) && i >= 0 && i < arr.length ? [arr[i]] : [];
  const pickPair = (arr) => {
    if (!Array.isArray(arr)) return [];
    const out = [];
    if (sem1 < arr.length) out.push(arr[sem1]);
    if (sem2 < arr.length) out.push(arr[sem2]);
    return out;
  };

  const out = { ...src };
  if (src.distribution) {
    out.distribution = {
      ...src.distribution,
      courses: pick(src.distribution.courses, idx),
      weekly: pick(src.distribution.weekly, idx),
      semester: pickPair(src.distribution.semester),
      audience: pickPair(src.distribution.audience),
      semesterColNums: pickPair(src.distribution.semesterColNums),
      courseColNums: pick(src.distribution.courseColNums, idx),
    };
  }
  if (src.credit) {
    out.credit = {
      ...src.credit,
      courses: pick(src.credit.courses, idx),
      weekly: pick(src.credit.weekly, idx),
      semester: pickPair(src.credit.semester),
      distribution: pickPair(src.credit.distribution),
      semesterColNums: pickPair(src.credit.semesterColNums),
      courseColNums: pick(src.credit.courseColNums, idx),
    };
  }
  return out;
};

const { STEP_ROLES } = require("./workingSchedule.chain");
const { updateWorkingScheduleMonthWeeks } = require("./monthWeeks.service");

const chainVisibilityFilter = (userRole) =>
  buildChainVisibilityFilter("workingSchedule", userRole);

const STEP_SIGNATURE_BLOCK = {
  methodical: { block: "methodicalHead", personField: "leader" },
  dean: { block: "facultyDean", personField: "dean" },
  prorektor: { block: "agreed", personField: "viceRector" },
  rektor: { block: "confirmation", personField: "rector" },
};

const formatSignatureDate = (date) => date.toISOString().slice(0, 10);

const fillSignatureBlock = (doc, stepName, approverId, date) => {
  const target = STEP_SIGNATURE_BLOCK[stepName];
  if (!target) return;
  if (!doc[target.block]) doc[target.block] = {};
  doc[target.block][target.personField] = approverId;
  doc[target.block].date = formatSignatureDate(date);
};

const sseSend = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const buildCourseProgressMessage = (courseNum, result) => {
  const replaced = result?.replaced || 0;
  const locked = result?.lockedReplaced || 0;
  if (replaced === 0) return `${courseNum}-kurs uchun yaratildi`;
  return locked > 0
    ? `${courseNum}-kurs yangilandi (eski reja almashtirildi, shundan ${locked} tasi tasdiqlangan edi)`
    : `${courseNum}-kurs yangilandi (eski reja almashtirildi)`;
};

const buildDoneMessage = ({
  totalCreated,
  totalReplaced,
  totalLockedReplaced,
  totalSkipped,
}) => {
  if (totalCreated === 0) {
    return totalSkipped > 0
      ? `Hech qanday ishchi o'quv reja yaratilmadi (${totalSkipped} ta kurs o'tkazib yuborildi)`
      : "Hech qanday ishchi o'quv reja yaratilmadi";
  }

  let msg = `${totalCreated} ta kurs uchun ishchi o'quv reja yaratildi`;
  if (totalReplaced > 0) {
    msg +=
      totalLockedReplaced > 0
        ? ` (${totalReplaced} tasi almashtirildi, shundan ${totalLockedReplaced} tasi tasdiqlangan edi)`
        : ` (${totalReplaced} tasi almashtirildi)`;
  }
  if (totalSkipped > 0) msg += `, ${totalSkipped} ta kurs o'tkazib yuborildi`;
  return msg;
};

const withFallbackTitle = (doc) => {
  const plain =
    typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  if (!plain.title) {
    const dirName = plain.direction?.title ?? "";
    const yearName = plain.academicYear?.title ?? "";
    const stage = plain.stage ?? "";
    plain.title = [dirName, yearName, stage].filter(Boolean).join(" — ");
  }
  return plain;
};

const supersedeKey = ({ direction, enrollmentYear, currentCourse }) => ({
  direction,
  enrollmentYear: String(enrollmentYear),
  currentCourse,
});

const supersedePreviousSchedules = async ({
  direction,
  enrollmentYear,
  currentCourse,
}) => {
  const existing = await WorkingScheduleModel.find(
    supersedeKey({ direction, enrollmentYear, currentCourse }),
  ).select("_id status");

  if (existing.length === 0)
    return { action: "created", replaced: 0, lockedReplaced: 0 };

  const lockedReplaced = existing.filter((d) => isLocked(d.status)).length;

  const ids = existing.map((d) => d._id);

  const plansToRemove = await WorkingPlanModel.find({
    workingSchedule: { $in: ids },
  })
    .select("_id")
    .lean();
  const planIds = plansToRemove.map((p) => p._id);
  if (planIds.length) {
    const affected = await WorkloadModel.updateMany(
      { "directions.workingPlan": { $in: planIds } },
      { $set: { needsRecalculation: true } },
    );
    if (affected.modifiedCount) {
      winston.warn(
        `[workingSchedule] supersede: ${affected.modifiedCount} ta yuklama manba ishchi rejasidan ` +
          `ayrildi (dir=${direction} yil=${enrollmentYear} kurs=${currentCourse}) — ` +
          `"qayta hisoblash kerak" deb belgilandi.`,
      );
    }
  }

  await WorkingPlanModel.deleteMany({ workingSchedule: { $in: ids } });
  await WorkingScheduleModel.deleteMany({ _id: { $in: ids } });
  winston.info(
    `[workingSchedule] dublikat almashtirildi: dir=${direction} yil=${enrollmentYear} kurs=${currentCourse} — ${ids.length} ta eski hujjat o'chirildi (${lockedReplaced} tasi tasdiqlangan/ko'rib chiqilayotgan edi)`,
  );
  return { action: "replaced", replaced: ids.length, lockedReplaced };
};

const createOneCourseWorkingPlan = async ({
  lp,
  reja,
  course,
  year,
  directionTitle = "",
  approval = null,
}) => {
  const kurs = course?.course;
  const courseNum = course?.courseNum;
  const semKeys = getCourseKeys(courseNum);

  const weeksObj = toPlainWeeks(course.weeks);
  const weekCounts = countWeeksByKey(weeksObj);
  const totalWeeks = Object.values(weekCounts).reduce((a, b) => a + b, 0);

  const allKeys = lp?.keys || [];

  const allLpKeys = (lp?.learningProcess?.keys || []).map((k) => {
    if (k.title === "JAMI") {
      return {
        key: k.key,
        title: k.title,
        week: totalWeeks,
        semester: k.semester ?? null,
      };
    }
    return {
      key: k.key,
      title: k.title,
      week: weekCounts[k.key] ?? 0,
      semester: k.semester ?? null,
    };
  });

  const yearTitle = `${Number(year) + (courseNum - 1)}/${Number(year) + courseNum}`;
  let yearDoc = await AcademicYearModel.findOne({ title: yearTitle });
  if (!yearDoc) {
    yearDoc = await AcademicYearModel.create({ title: yearTitle, active: true });
  }

  const workingData = {
    learningProcess: lp?._id,
    direction: lp?.direction,
    academicLevel: lp?.academicLevel,
    readingForm: lp?.readingForm,
    educationForm: lp?.educationForm,
    studyPeriod: lp?.studyPeriod,
    specialization: lp?.specialization,
    enrollmentYear: String(year),
    currentCourse: courseNum,
    year: yearTitle,
    academicYear: yearDoc._id,
    title: `${yearTitle} oʻquv yili ${directionTitle} ${String(kurs)} bosqich`,
    desc: lp?.basisNote || null,
    attestationNote: lp?.attestationNote || null,
    summaryRows: lp?.summaryRows || null,
    ...(approval ? { approval } : {}),
    stage: String(kurs),
    keys: allKeys.map(({ key, title }) => ({ key, title })),
    courses: [
      {
        course: course.course,
        courseNum: course.courseNum,
        months: (course.months || []).map((m) => ({
          month: m.month,
          weeks: (m.weeks || []).map((w) => ({ week: w.week, key: w.key })),
        })),
        weeks: weeksObj,
        total: course.total || 0,
        statistics: Array.isArray(course.statistics) ? course.statistics : [],
      },
    ],
    allValues: {
      total: course.total || 0,
      statistics: Array.isArray(course.statistics) ? course.statistics : [],
    },
    comment: lp?.comment || null,
    learningProcessData: {
      keys: allLpKeys,
      title: lp?.learningProcess?.title ?? null,
    },
  };

  const courseId = await resolveCourse(courseNum);
  const groupIds = courseId
    ? await GroupModel.find({
        direction: lp?.direction,
        course: courseId,
        academicYear: yearDoc._id,
        active: true,
      }).distinct("_id")
    : [];
  workingData.groups = groupIds;
  if (groupIds.length === 0) {
    winston.warn(
      `[workingSchedule] kontingent topilmadi: dir=${lp?.direction} kurs=${courseNum} yil=${yearTitle} — yuklama soatlari 0 bo'ladi`,
    );
  }

  const supersede = await supersedePreviousSchedules({
    direction: lp?.direction,
    enrollmentYear: String(year),
    currentCourse: courseNum,
  });
  if (supersede.action === "skipped") {
    return {
      course: course.course,
      courseNum,
      skipped: true,
      reason: supersede.reason,
    };
  }

  const workingSchedule = await WorkingScheduleModel.create(workingData);

  const lateCatalog = await loadCatalogByCodes(
    collectUnlinkedCodes(reja.blocks),
  );

  const semestersData = {};

  semKeys.forEach((globalSemKey, idx) => {
    const localSemKey = String(idx + 1);

    const semBlocks = (reja.blocks || [])
      .map((block) => {
        const semSciences = (block.sciences || [])
          .map((s) => {
            if (isSummaryRow(s)) return null;
            if (isEmptySlotRow(s)) return null;

            const semData = filterSemesters(s.semesters, [globalSemKey])[
              globalSemKey
            ];
            if (!semData) return null;
            const semHour = Number(semData.hour) || 0;
            const semCredit = Number(semData.credit) || 0;
            if (semHour === 0 && semCredit === 0) return null;

            let semParticle = [];
            if (
              Array.isArray(semData.particles) &&
              semData.particles.length > 0
            ) {
              semParticle = semData.particles.map((p) => ({
                slug: p.slug,
                slugRef: p.slugRef || null,
                title: p.title || "",
                value: Number(p.value) || 0,
                canonical: p.canonical || null,
                colNum: p.colNum != null ? p.colNum : null,
              }));
            } else if (Array.isArray(s.particle) && s.particle.length > 0) {
              const allSems = Object.entries(
                s.semesters instanceof Map
                  ? Object.fromEntries(s.semesters)
                  : s.semesters || {},
              ).filter(
                ([, v]) => v && (Number(v.hour) > 0 || Number(v.credit) > 0),
              );
              const totalHourAll = allSems.reduce(
                (a, [, v]) => a + (Number(v.hour) || 0),
                0,
              );
              const ratio =
                allSems.length === 1
                  ? 1
                  : totalHourAll > 0
                    ? semHour / totalHourAll
                    : 0;
              semParticle = s.particle.map((p) => ({
                slug: p.slug,
                slugRef: p.slugRef || null,
                title: p.title || "",
                value:
                  allSems.length === 1
                    ? Number(p.value) || 0
                    : Math.round((Number(p.value) || 0) * ratio),
                canonical: p.canonical || null,
                colNum: p.colNum != null ? p.colNum : null,
              }));
            }

            const link = resolveLink(s, lateCatalog);

            return {
              serialNumber: s.serialNumber,
              code: s.code,
              title: s.title,
              science: link.science,
              department: link.department,
              particle: semParticle,
              totalCredit: semCredit,
              weeklyHours: resolveWeeklyHours(semData),
              evaluationType: semData.assessmentType || s.evaluationType || null,
              alternatives: projectAlternatives(s),
            };
          })
          .filter(Boolean);

        const quotaSlot = buildQuotaSlotRow(block, globalSemKey, {
          existingRows: semSciences,
        });
        if (quotaSlot) semSciences.push(quotaSlot);

        if (semSciences.length === 0) return null;

        return {
          blockCode: block.blockCode,
          serialNumber: block.serialNumber,
          code: block.code,
          title: block.title,
          sciences: semSciences,
        };
      })
      .filter(Boolean);

    semestersData[localSemKey] = {
      semester: localSemKey,
      blocks: semBlocks,
      practice: {
        title: practiceTitle(semBlocks),
        code: null,
        hour: 0,
        credit: 0,
        particles: [],
      },
    };
  });

  const workingPlan = await WorkingPlanModel.create({
    workingSchedule: workingSchedule._id,
    studyPlan: reja._id,
    meta: filterMetaForCourse(reja.meta, courseNum),
    semesters: semestersData,
  });

  return {
    course: course.course,
    courseNum: course.courseNum,
    semesters: semKeys,
    workingSchedule: workingSchedule._id,
    workingPlan: workingPlan._id,
    replaced: supersede.replaced,
    lockedReplaced: supersede.lockedReplaced,
  };
};

module.exports = {
  _supersedePreviousSchedules: supersedePreviousSchedules,
  _createOneCourseWorkingPlan: createOneCourseWorkingPlan,
  _buildDoneMessage: buildDoneMessage,
  _getCourseKeys: getCourseKeys,
  _projectAlternatives: projectAlternatives,

  create: async (req, res, next) => {
    try {
      const reja = await StudyPlanModel.findOne({
        learningProcess: req.body?.learningProcess,
      })
        .populate({
          path: "learningProcess",
          select: ["-file", "-status", "-active", "-createdAt", "-updatedAt"],
          strictPopulate: false,
        })

        .exec();

      if (!reja) {
        return next(new ErrorHandler(404, "StudyPlan topilmadi"));
      }

      const lp = reja.learningProcess;
      if (!lp) {
        return next(
          new ErrorHandler(
            404,
            "StudyPlan ga bog'liq LearningProcess topilmadi",
          ),
        );
      }

      const direcData = await DirectionModel.findById(lp?.direction).exec();

      if (!direcData)
        return next(
          new ErrorHandler(404, "Siz biriktirgan yo'nalish topilmadi"),
        );

      const year = lp?.year;
      const courses = lp?.courses || [];

      if (courses.length === 0) {
        return next(
          new ErrorHandler(400, "LearningProcess da kurslar topilmadi"),
        );
      }

      const created = [];
      const skipped = [];
      let totalReplaced = 0;
      let totalLockedReplaced = 0;

      for (const course of courses) {
        const kurs = course?.course;
        const courseNum = course?.courseNum;
        const semKeys = getCourseKeys(courseNum);
        const dataYear = `${Number(year) + (courseNum - 1)}/${Number(year) + courseNum}`;

        let yearDoc = await AcademicYearModel.findOne({ title: dataYear });
        if (!yearDoc) {
          yearDoc = await AcademicYearModel.create({
            title: dataYear,
            active: true,
          });
        }

        const weeksObj = toPlainWeeks(course.weeks);
        const weekCounts = countWeeksByKey(weeksObj);

        const totalWeeks = Object.values(weekCounts).reduce((a, b) => a + b, 0);

        const allKeys = lp?.keys || [];

        const allLpKeys = (lp?.learningProcess?.keys || []).map((k) => {
          if (k.title === "JAMI") {
            return {
              key: k.key,
              title: k.title,
              week: totalWeeks,
              semester: k.semester ?? null,
            };
          }

          return {
            key: k.key,
            title: k.title,
            week: weekCounts[k.key] ?? 0,
            semester: k.semester ?? null,
          };
        });

        const workingData = {
          label: `OʻZBEKISTON RESPUBLIKASI SOGʻLIQNI SAQLASH VAZIRLIGI\n FARGʻONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI\n ISHCHI OʻQUV REJA\n ${dataYear} oʻquv yili\n  ${String(kurs)} bosqich`,
          desc: lp?.basisNote || null,
          attestationNote: lp?.attestationNote || null,
          summaryRows: lp?.summaryRows || null,
          title: `${dataYear} oʻquv yili ${direcData?.title} ${String(kurs)} bosqich`,
          learningProcess: lp?._id,
          direction: lp?.direction,
          academicLevel: lp?.academicLevel,
          readingForm: lp?.readingForm,
          educationForm: lp?.educationForm,
          studyPeriod: lp?.studyPeriod,
          specialization: lp?.specialization,
          enrollmentYear: String(year),
          currentCourse: courseNum,
          year: `${Number(year) + (courseNum - 1)}`,

          academicYear: yearDoc?._id,
          stage: String(kurs),

          keys: allKeys.map(({ key, title }) => ({ key, title })),

          courses: [
            {
              course: course.course,
              courseNum: course.courseNum,
              months: (course.months || []).map((m) => ({
                month: m.month,
                weeks: (m.weeks || []).map((w) => ({
                  week: w.week,
                  key: w.key,
                })),
              })),
              weeks: weeksObj,
              total: course.total || 0,
              statistics: Array.isArray(course.statistics)
                ? course.statistics
                : [],
            },
          ],

          allValues: {
            total: course.total || 0,
            statistics: Array.isArray(course.statistics)
              ? course.statistics
              : [],
          },

          comment: lp?.comment || null,

          learningProcessData: {
            keys: allLpKeys,
            title: lp?.learningProcess?.title ?? null,
          },
          approval: req.body.approval,
        };

        const supersede = await supersedePreviousSchedules({
          direction: lp?.direction,
          enrollmentYear: workingData.enrollmentYear,
          currentCourse: workingData.currentCourse,
        });
        if (supersede.action === "skipped") {
          skipped.push({
            courseNum: workingData.currentCourse,
            reason: supersede.reason,
          });
          continue;
        }

        totalReplaced += supersede.replaced || 0;
        totalLockedReplaced += supersede.lockedReplaced || 0;

        const workingSchedule = await WorkingScheduleModel.create(workingData);

        const lateCatalog = await loadCatalogByCodes(
          collectUnlinkedCodes(reja.blocks),
        );

        const semestersData = {};

        semKeys.forEach((globalSemKey, idx) => {
          const localSemKey = String(idx + 1);

          const semBlocks = (reja.blocks || [])
            .map((block) => {
              const semSciences = (block.sciences || [])
                .map((s) => {
                  if (isSummaryRow(s)) return null;
                  if (isEmptySlotRow(s)) return null;

                  const semData = filterSemesters(s.semesters, [globalSemKey])[
                    globalSemKey
                  ];
                  if (!semData) return null;
                  const semHour = Number(semData.hour) || 0;
                  const semCredit = Number(semData.credit) || 0;
                  if (semHour === 0 && semCredit === 0) return null;

                  let semParticle = [];
                  if (
                    Array.isArray(semData.particles) &&
                    semData.particles.length > 0
                  ) {
                    semParticle = semData.particles.map((p) => ({
                      slug: p.slug,
                      slugRef: p.slugRef || null,
                      title: p.title || "",
                      value: Number(p.value) || 0,
                      canonical: p.canonical || null,
                      colNum: p.colNum != null ? p.colNum : null,
                    }));
                  } else if (
                    Array.isArray(s.particle) &&
                    s.particle.length > 0
                  ) {
                    const allSems = Object.entries(
                      s.semesters instanceof Map
                        ? Object.fromEntries(s.semesters)
                        : s.semesters || {},
                    ).filter(
                      ([, v]) =>
                        v && (Number(v.hour) > 0 || Number(v.credit) > 0),
                    );
                    const totalHourAll = allSems.reduce(
                      (a, [, v]) => a + (Number(v.hour) || 0),
                      0,
                    );
                    const ratio =
                      allSems.length === 1
                        ? 1
                        : totalHourAll > 0
                          ? semHour / totalHourAll
                          : 0;
                    semParticle = s.particle.map((p) => ({
                      slug: p.slug,
                      slugRef: p.slugRef || null,
                      title: p.title || "",
                      value:
                        allSems.length === 1
                          ? Number(p.value) || 0
                          : Math.round((Number(p.value) || 0) * ratio),
                      canonical: p.canonical || null,
                      colNum: p.colNum != null ? p.colNum : null,
                    }));
                  }

                  const link = resolveLink(s, lateCatalog);

                  return {
                    serialNumber: s.serialNumber,
                    code: s.code,
                    title: s.title,
                    science: link.science,
                    department: link.department,
                    particle: semParticle,
                    totalCredit: semCredit,
                    weeklyHours: resolveWeeklyHours(semData),
                    evaluationType: semData.assessmentType || s.evaluationType || null,
                    alternatives: projectAlternatives(s),
                  };
                })
                .filter(Boolean);

              const quotaSlot = buildQuotaSlotRow(block, globalSemKey, {
                existingRows: semSciences,
              });
              if (quotaSlot) semSciences.push(quotaSlot);

              if (semSciences.length === 0) return null;

              return {
                blockCode: block.blockCode,
                serialNumber: block.serialNumber,
                code: block.code,
                title: block.title,
                sciences: semSciences,
              };
            })
            .filter(Boolean);

          semestersData[localSemKey] = {
            semester: localSemKey,
            blocks: semBlocks,
            practice: {
              title: practiceTitle(semBlocks),
              code: null,
              hour: 0,
              credit: 0,
              particles: [],
            },
          };
        });

        const workingPlan = await WorkingPlanModel.create({
          workingSchedule: workingSchedule._id,
          studyPlan: reja._id,
          meta: filterMetaForCourse(reja.meta, courseNum),
          semesters: semestersData,
        });

        created.push({
          course: course.course,
          courseNum: course.courseNum,
          semesters: semKeys,
          workingSchedule: workingSchedule._id,
          workingPlan: workingPlan._id,
        });
      }

      if (created.length > 0) {
        try {
          await LearningProcess.updateOne(
            { _id: lp._id },
            { $set: { status: "created" } },
          );
        } catch (statusErr) {
          winston.warn(
            `LearningProcess status yangilash xatosi (${lp._id}): ${statusErr.message}`,
          );
        }
      } else {
        winston.warn(
          `[workingSchedule] hech qanday ishchi reja yaratilmadi (lp=${lp._id}) — status o'zgartirilmadi`,
        );
      }

      return res.status(201).json({
        message: buildDoneMessage({
          totalCreated: created.length,
          totalReplaced,
          totalLockedReplaced,
          totalSkipped: skipped.length,
        }),
        totalCreated: created.length,
        totalReplaced,
        totalLockedReplaced,
        ...(skipped.length > 0 && { skipped }),
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Ishchi o'quv reja yaratishda xatolik",
          err.message,
        ),
      );
    }
  },

  subAddWorkingPlanStream: async (req, res, next) => {
    const learningProcessId =
      req.query.learningProcess || req.body?.learningProcess;

    const approval = sanitizeApproval(req.query.approval);

    if (!learningProcessId) {
      return res.status(400).json({ message: "learningProcess kerak" });
    }

    const selection = parseCourseSelection(req.query.courses);
    if (selection.error) {
      return res.status(400).json({ message: selection.error });
    }

    const inScope = await LearningProcess.exists({
      _id: learningProcessId,
      ...req.scope,
    });
    if (!inScope) {
      return res.status(404).json({ message: "not found" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);
    req.on("close", () => clearInterval(heartbeat));

    const userId = req.user?._id;

    let job = null;

    try {
      const reja = await StudyPlanModel.findOne({
        learningProcess: learningProcessId,
      })
        .populate({
          path: "learningProcess",
          select: ["-file", "-status", "-active", "-createdAt", "-updatedAt"],
          strictPopulate: false,
        })

        .exec();

      if (!reja) {
        sseSend(res, "error", { message: "StudyPlan topilmadi" });
        clearInterval(heartbeat);
        return res.end();
      }

      const lp = reja.learningProcess;
      const year = lp?.year;
      const { courses, missing } = pickSelectedCourses(
        lp?.courses,
        selection.courses,
      );

      if (missing.length) {
        sseSend(res, "error", {
          message: `Tanlangan kurs(lar) o'quv rejada yo'q: ${missing.join(", ")}`,
        });
        clearInterval(heartbeat);
        return res.end();
      }

      if (!courses.length) {
        sseSend(res, "error", { message: "LearningProcess da kurslar yo'q" });
        clearInterval(heartbeat);
        return res.end();
      }

      const direcDoc = await DirectionModel.findById(lp?.direction).lean().exec();
      const directionTitle = direcDoc?.title ?? "";

      try {
        job = await WorkingScheduleJob.create({
          learningProcess: learningProcessId,
          user: userId,
          state: "running",
          totalCourses: courses.length,
          courses: courses.map((c) => ({
            courseNum: c.courseNum,
            status: "pending",
          })),
        });
      } catch (err) {
        if (err.code === 11000) {
          sseSend(res, "error", {
            message:
              "Bu o'quv reja uchun yaratish jarayoni allaqachon ishlamoqda",
          });
        } else {
          sseSend(res, "error", { message: err.message });
        }
        clearInterval(heartbeat);
        return res.end();
      }

      sseSend(res, "start", {
        jobId: job._id,
        totalCourses: courses.length,
        courses: courses.map((c) => ({
          courseNum: c.courseNum,
          status: "pending",
        })),
      });

      const created = [];
      const skipped = [];
      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];

        await WorkingScheduleJob.updateOne(
          { _id: job._id, "courses.courseNum": course.courseNum },
          { $set: { "courses.$.status": "in_progress" } },
        );
        sseSend(res, "progress", {
          courseNum: course.courseNum,
          status: "in_progress",
          percent: Math.round((i / courses.length) * 100),
          message: `${course.courseNum}-kurs uchun yaratilmoqda`,
        });

        const result = await createOneCourseWorkingPlan({
          lp,
          reja,
          course,
          year,
          directionTitle,
          approval,
        });

        const completed = i + 1;
        const percent = Math.round((completed / courses.length) * 100);

        if (result.skipped) {
          skipped.push({ courseNum: course.courseNum, reason: result.reason });
          await WorkingScheduleJob.updateOne(
            { _id: job._id, "courses.courseNum": course.courseNum },
            {
              $set: {
                "courses.$.status": "skipped",
                completedCourses: completed,
                percent,
              },
            },
          );
          sseSend(res, "progress", {
            courseNum: course.courseNum,
            status: "skipped",
            percent,
            message: result.reason,
          });
          continue;
        }

        created.push(result);

        await WorkingScheduleJob.updateOne(
          { _id: job._id, "courses.courseNum": course.courseNum },
          {
            $set: {
              "courses.$.status": "created",
              completedCourses: completed,
              percent,
            },
          },
        );
        sseSend(res, "progress", {
          courseNum: course.courseNum,
          status: "created",
          percent,
          replaced: result.replaced || 0,
          lockedReplaced: result.lockedReplaced || 0,
          message: buildCourseProgressMessage(course.courseNum, result),
        });
      }

      const statusUpdated = created.length > 0;
      if (statusUpdated) {
        try {
          await Promise.all([
            LearningProcess.updateOne(
              { _id: learningProcessId },
              { $set: { status: "created" } },
            ),
            StudyPlanModel.updateOne(
              { _id: reja._id },
              { $set: { status: "created" } },
            ),
          ]);
        } catch (statusErr) {
          winston.warn(
            `Status yangilash xatosi (lp=${learningProcessId}, sp=${reja._id}): ${statusErr.message}`,
          );
        }
      } else {
        winston.warn(
          `[workingSchedule] hech qanday ishchi reja yaratilmadi (lp=${learningProcessId}, sp=${reja._id}) — status o'zgartirilmadi`,
        );
      }

      const totalReplaced = created.reduce(
        (a, r) => a + (r.replaced || 0),
        0,
      );
      const totalLockedReplaced = created.reduce(
        (a, r) => a + (r.lockedReplaced || 0),
        0,
      );

      await WorkingScheduleJob.updateOne(
        { _id: job._id },
        { $set: { state: "completed", percent: 100, finishedAt: new Date() } },
      );
      sseSend(res, "done", {
        success: statusUpdated,
        totalCreated: created.length,
        totalReplaced,
        totalLockedReplaced,
        totalSkipped: skipped.length,
        statusUpdated,
        message: buildDoneMessage({
          totalCreated: created.length,
          totalReplaced,
          totalLockedReplaced,
          totalSkipped: skipped.length,
        }),
        learningProcessStatus: statusUpdated ? "created" : "new",
        created,
        skipped,
      });
    } catch (err) {
      if (job?._id) {
        await WorkingScheduleJob.updateOne(
          { _id: job._id },
          {
            $set: {
              state: "failed",
              error: err.message,
              finishedAt: new Date(),
            },
          },
        ).catch(() => {});
      }
      sseSend(res, "error", { message: err.message });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  },

  supersedePreview: async (req, res, next) => {
    try {
      const learningProcessId = req.query?.learningProcess;
      if (!learningProcessId) {
        return next(new ErrorHandler(400, "learningProcess kerak"));
      }
      if (
        typeof learningProcessId !== "string" ||
        !mongoose.isValidObjectId(learningProcessId)
      ) {
        return next(new ErrorHandler(400, "learningProcess noto'g'ri"));
      }

      const lp = await LearningProcess.findOne({
        _id: learningProcessId,
        ...req.scope,
      })
        .select("direction year courses.courseNum")
        .lean()
        .exec();

      if (!lp) {
        return next(new ErrorHandler(404, "O'quv jarayoni topilmadi"));
      }

      const courseNums = [
        ...new Set(
          (lp.courses || [])
            .map((c) => c?.courseNum)
            .filter((n) => Number.isFinite(n)),
        ),
      ];

      if (courseNums.length === 0) {
        return res
          .status(200)
          .json({ affected: [], totalExisting: 0, totalLocked: 0 });
      }

      const docs = await WorkingScheduleModel.find(
        supersedeKey({
          direction: lp.direction,
          enrollmentYear: lp.year,
          currentCourse: { $in: courseNums },
        }),
      )
        .select("currentCourse status")
        .lean()
        .exec();

      const byCourse = new Map();
      for (const d of docs) {
        const row = byCourse.get(d.currentCourse) || {
          courseNum: d.currentCourse,
          existing: 0,
          locked: 0,
        };
        row.existing += 1;
        if (isLocked(d.status)) row.locked += 1;
        byCourse.set(d.currentCourse, row);
      }

      const affected = courseNums
        .filter((n) => byCourse.has(n))
        .map((n) => byCourse.get(n));

      return res.status(200).json({
        affected,
        totalExisting: docs.length,
        totalLocked: affected.reduce((a, r) => a + r.locked, 0),
      });
    } catch (err) {
      return next(
        err.statusCode
          ? err
          : new ErrorHandler(
              400,
              "Almashtirish ogohlantirishini olishda xatolik",
              err.message,
            ),
      );
    }
  },

  getJobStatus: async (req, res, next) => {
    try {
      const job = await WorkingScheduleJob.findOne({
        _id: req.params.id,
        user: req.user?._id,
      });
      if (!job) return next(new ErrorHandler(404, "Job topilmadi"));
      return res.json({ data: job });
    } catch (err) {
      return next(err);
    }
  },

  findAll: async (req, res, next) => {
    try {
      const {
        direction,
        academicYear,
        enrollmentYear,
        courseRef,
        active,
        stage,
        status,
        search,
      } = req.query;
      const filter = { ...narrowDirectionFilter(req.scope, direction) };

      if (search) filter.title = { $regex: new RegExp(escapeRegex(search), "i") };

      if (courseRef) filter.courseRef = courseRef;

      if (academicYear) filter.academicYear = academicYear;

      if (enrollmentYear) filter.enrollmentYear = enrollmentYear;

      if (status) filter.status = status;

      restrictUnsubmittedVisibility(filter, req, [
        ROLES.OQUV_USLUBIY_BOSHQARMA,
      ]);

      if (active !== undefined) filter.active = active === "true";

      const docs = await WorkingScheduleModel.find(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title)),
      )
        .select([
          "title",
          "direction",
          "stage",
          "courseRef",
          "academicYear",
          "date",
          "status",
          "learningProcess",
        ])
        .populate("direction", "title directionCode")
        .populate("courseRef", "title")
        .populate("academicYear", "title")
        .sort({ createdAt: 1 });

      if (!docs) return res.status(404).json({ message: "not found" });

      const lpIds = docs
        .map((d) => d.learningProcess)
        .filter(Boolean);
      const studyPlans = lpIds.length
        ? await StudyPlanModel.find(
            { learningProcess: { $in: lpIds } },
            { learningProcess: 1, file: 1 },
          ).lean()
        : [];
      const planFileMap = {};
      for (const sp of studyPlans) {
        planFileMap[String(sp.learningProcess)] = sp.file || null;
      }

      return res.status(200).json(
        docs.map((d) => {
          const obj = withFallbackTitle(d);
          obj.file = planFileMap[String(d.learningProcess)] ?? null;
          return obj;
        }),
      );
    } catch (err) {
      return next(err);
    }
  },

  paginate: async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        direction,
        academicYear,
        enrollmentYear,
        courseRef,
        search,
        active,
        stage,
        status,
      } = req.query;
      const filter = { ...narrowDirectionFilter(req.scope, direction) };

      if (search) filter.title = { $regex: new RegExp(escapeRegex(search), "i") };

      if (courseRef) filter.courseRef = courseRef;

      if (academicYear) filter.academicYear = academicYear;

      if (enrollmentYear) filter.enrollmentYear = enrollmentYear;

      if (status) filter.status = status;

      restrictUnsubmittedVisibility(filter, req, [
        ROLES.OQUV_USLUBIY_BOSHQARMA,
      ]);

      if (active !== undefined) filter.active = active === "true";

      const doc = await WorkingScheduleModel.paginate(
        andFilters(filter, chainVisibilityFilter(req.user?.role?.title)),
        {
          page: Number(page),
          limit: Number(limit),
          select: [
            "title",
            "direction",
            "stage",
            "courseRef",
            "academicYear",
            "date",
            "status",
            "learningProcess",
            "approvalHistory",
          ],
          populate: [
            { path: "direction", select: "title directionCode" },
            { path: "courseRef", select: "title" },
            { path: "academicYear", select: "title" },
          ],
          sort: { createdAt: 1 },
        },
      );

      if (!doc) return res.status(404).json({ message: "not found" });

      const rows = doc.docs || [];
      const lpIds = rows.map((d) => d.learningProcess).filter(Boolean);
      const studyPlans = lpIds.length
        ? await StudyPlanModel.find(
            { learningProcess: { $in: lpIds } },
            { learningProcess: 1, file: 1 },
          ).lean()
        : [];
      const planFileMap = {};
      for (const sp of studyPlans) {
        planFileMap[String(sp.learningProcess)] = sp.file || null;
      }

      return res.status(200).json({
        ...doc,
        docs: rows.map((d) => {
          const obj = withFallbackTitle(d);
          obj.file = planFileMap[String(d.learningProcess)] ?? null;
          obj.currentStep =
            (obj.approvalHistory || []).find((s) => s.status === "pending")
              ?.step ?? null;
          delete obj.approvalHistory;
          return obj;
        }),
      });
    } catch (err) {
      return next(err);
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await WorkingScheduleModel.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      })
        .populate("direction", "title directionCode")
        .populate("academicLevel", "title")
        .populate("readingForm", "title")
        .populate("courseRef", "title")
        .populate("academicYear", "title")
        .populate("educationForm", "title")
        .populate("studyPeriod", "title")
        .populate("specialization", "title")
        .populate("groups", "title studentNumber")
        .populate("agreed.viceRector", "firstName lastName")
        .populate("confirmation.rector", "firstName lastName")
        .populate("methodicalHead.leader", "firstName lastName")
        .populate("facultyDean.dean", "firstName lastName");

      if (!doc)
        return next(new ErrorHandler(404, "WorkingSchedule Topilmadi"));

      const docPlan = await WorkingPlanModel.findOne({
        workingSchedule: req.params.id,
      })
        .lean()
        .exec();

      if (!docPlan)
        return next(new ErrorHandler(404, "WorkingPlan Topilmadi"));

      await populateAllSlugRefs(docPlan);

      const result = doc.toObject();
      result.workingPlan = docPlan;

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  },

  findOneProcess: async (req, res, next) => {
    try {
      const doc = await WorkingScheduleModel.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      }).select(["keys", "courses"]);

      if (!doc)
        return next(new ErrorHandler(404, "WorkingSchedule Topilmadi"));

      return res.status(200).json(doc);
    } catch (err) {
      return next(err);
    }
  },

  updateMonthWeeks: async (req, res, next) => {
    try {
      const userRole = req.user?.role?.title;
      if (userRole !== ROLES.SUPER_ADMIN && userRole !== ROLES.OQUV_USLUBIY_BOSHQARMA) {
        return next(
          new ErrorHandler(403, "Ishchi rejani faqat o'quv-uslubiy boshqarma tahrirlay oladi"),
        );
      }
      const data = await updateWorkingScheduleMonthWeeks({
        id: req.params.id,
        filter: andFilters(req.scope, chainVisibilityFilter(userRole)),
        counts: req.body.counts,
      });
      return res.status(200).json({ message: "Taqsimot saqlandi", data });
    } catch (err) {
      if (err instanceof ErrorHandler) return next(err);
      return next(new ErrorHandler(400, "Taqsimotni saqlab bo'lmadi", err.message));
    }
  },

  updateWorkingProcess: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { courseId, weeks, total, statistics } = req.body;

      const existing = await WorkingScheduleModel.findOne({
        _id: id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      }).select("status");
      if (!existing) return next(new ErrorHandler(404, "Topilmadi"));

      const userRole = req.user?.role?.title;
      if (
        userRole !== ROLES.SUPER_ADMIN &&
        userRole !== ROLES.OQUV_USLUBIY_BOSHQARMA
      ) {
        return next(
          new ErrorHandler(
            403,
            "Ishchi rejani faqat o'quv-uslubiy boshqarma tahrirlay oladi",
          ),
        );
      }
      if (isLocked(existing.status)) {
        return next(
          new ErrorHandler(
            400,
            lockedMessage("Ishchi o'quv reja", existing.status),
          ),
        );
      }

      const setObj = {};

      if (total !== undefined) {
        setObj["courses.$[course].total"] = total;
      }

      if (weeks) {
        setObj["courses.$[course].weeks"] = weeks;
      }

      let doc = await WorkingScheduleModel.findOneAndUpdate(
        {
          _id: id,
          ...andFilters(req.scope, chainVisibilityFilter(userRole)),
        },
        { $set: setObj },
        {
          arrayFilters: [
            { "course._id": new mongoose.Types.ObjectId(courseId) },
          ],
          new: true,
        },
      );

      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      if (weeks) {
        for (const [weekNum, keyValue] of Object.entries(weeks)) {
          await WorkingScheduleModel.findByIdAndUpdate(
            id,
            {
              $set: {
                "courses.$[course].months.$[].weeks.$[week].key":
                  keyValue || " ",
              },
            },
            {
              arrayFilters: [
                { "course._id": new mongoose.Types.ObjectId(courseId) },
                { "week.week": Number(weekNum) },
              ],
            },
          );
        }
      }

      if (statistics && statistics.length > 0) {
        for (const stat of statistics) {
          await WorkingScheduleModel.findByIdAndUpdate(
            id,
            {
              $set: {
                "courses.$[course].statistics.$[stat].value": stat.value,
              },
            },
            {
              arrayFilters: [
                { "course._id": new mongoose.Types.ObjectId(courseId) },
                { "stat._id": new mongoose.Types.ObjectId(stat._id) },
              ],
            },
          );
        }

        const currentDoc = await WorkingScheduleModel.findById(id);

        const targetCourse = currentDoc.courses.find(
          (c) => c._id.toString() === courseId,
        );

        const courseStats = (targetCourse?.statistics || []).map(toPlainStat);
        const learningKeys = currentDoc.learningProcessData.keys.map((k) =>
          k.toObject(),
        );

        const updatedKeys = syncKeyWeeksFromStats(learningKeys, courseStats, {
          fallbackTotal:
            currentDoc.allValues?.statistics?.find(
              (stat) => stat.slug === "hammasi",
            )?.value ?? null,
        });

        const syncSet = { "learningProcessData.keys": updatedKeys };
        if (targetCourse) {
          syncSet["allValues.total"] = Number(targetCourse.total) || 0;
          syncSet["allValues.statistics"] = courseStats;
        }

        await WorkingScheduleModel.findByIdAndUpdate(
          id,
          { $set: syncSet },
          { new: true },
        );
      }
      const updatedDoc = await WorkingScheduleModel.findById(id);
      return res.status(200).json(updatedDoc);
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const allowed = ["draft", "in_review", "approved", "rejected"];
      const { status } = req.body;
      if (!allowed.includes(status)) {
        return next(new ErrorHandler(400, `Noto'g'ri status: ${status}`));
      }
      const doc = await WorkingScheduleModel.findByIdAndUpdate(
        req.params.id,
        { status, approvedBy: req.user?._id || null },
        { new: true },
      );
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      return res.json({
        message: "Status yangilandi",
        data: { status: doc.status },
      });
    } catch (err) {
      return next(err);
    }
  },

  findOneComposition: async (req, res, next) => {
    try {
      let doc = await WorkingScheduleModel.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      })
        .select(["learningProcessData"])
        .exec();

      if (!doc) return res.status(404).json({ message: "not found" });

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find Working Schedul", err.message),
      );
    }
  },

  updateComposition: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { learningProcess } = req.body;

      const existing = await WorkingScheduleModel.findOne({
        _id: id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      }).select("status");
      if (!existing) return next(new ErrorHandler(404, "Topilmadi"));

      const userRole = req.user?.role?.title;
      if (
        userRole !== ROLES.SUPER_ADMIN &&
        userRole !== ROLES.OQUV_USLUBIY_BOSHQARMA
      ) {
        return next(
          new ErrorHandler(
            403,
            "Ishchi rejani faqat o'quv-uslubiy boshqarma tahrirlay oladi",
          ),
        );
      }
      if (isLocked(existing.status)) {
        return next(
          new ErrorHandler(
            400,
            lockedMessage("Ishchi o'quv reja", existing.status),
          ),
        );
      }

      const $set = {};
      const arrayFilters = [];

      if (learningProcess?.keys?.length) {
        learningProcess.keys.forEach((updatedKey, index) => {
          const f = `k${index}`;
          arrayFilters.push({
            [`${f}._id`]: new mongoose.Types.ObjectId(updatedKey._id),
          });

          if (updatedKey.week !== undefined) {
            $set[`learningProcessData.keys.$[${f}].week`] = updatedKey.week;
          }
          if (updatedKey.semester !== undefined) {
            $set[`learningProcessData.keys.$[${f}].semester`] =
              updatedKey.semester;
          }
        });
      }

      if (!Object.keys($set).length) {
        return next(new ErrorHandler(400, "Hech qanday o'zgartirish yo'q"));
      }

      const doc = await WorkingScheduleModel.findOneAndUpdate(
        {
          _id: id,
          ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
        },
        { $set },
        {
          new: true,
          runValidators: false,
          ...(arrayFilters.length && { arrayFilters }),
        },
      );

      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      winston.error(err);
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  updateCompositionTitle: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { learningProcess } = req.body;

      const existing = await WorkingScheduleModel.findOne({
        _id: id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      }).select("status");
      if (!existing) return next(new ErrorHandler(404, "Topilmadi"));

      const userRole = req.user?.role?.title;
      if (
        userRole !== ROLES.SUPER_ADMIN &&
        userRole !== ROLES.OQUV_USLUBIY_BOSHQARMA
      ) {
        return next(
          new ErrorHandler(
            403,
            "Ishchi rejani faqat o'quv-uslubiy boshqarma tahrirlay oladi",
          ),
        );
      }
      if (isLocked(existing.status)) {
        return next(
          new ErrorHandler(
            400,
            lockedMessage("Ishchi o'quv reja", existing.status),
          ),
        );
      }

      const $set = {};
      const arrayFilters = [];

      if (learningProcess?.title) {
        $set[`learningProcessData.title`] = learningProcess?.title;
      }

      if (!Object.keys($set).length) {
        return next(new ErrorHandler(400, "Hech qanday o'zgartirish yo'q"));
      }

      const doc = await WorkingScheduleModel.findOneAndUpdate(
        {
          _id: id,
          ...andFilters(req.scope, chainVisibilityFilter(userRole)),
        },
        { $set },
        {
          new: true,
          runValidators: false,
          ...(arrayFilters.length && { arrayFilters }),
        },
      );

      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      winston.error(err);
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  approve: async (req, res, next) => {
    try {
      const { signature, eriSignature, eriSerial } = req.body || {};
      const doc = await WorkingScheduleModel.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
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
              "Faqat o'quv-uslubiy boshqarma rejani yubora oladi",
            ),
          );
        }
        const unfilled = await countUnfilledSlotsOfSchedule(doc._id);
        const m = doc.approvalHistory.find((s) => s.step === "methodical");
        if (m) {
          m.status = "approved";
          m.approvedBy = req.user?._id || null;
          m.date = new Date();
        }
        doc.status = "in_review";
        await refreshVerifyToken(doc, req.user?._id || null);
        await doc.save();
        return res.status(200).json({
          message: "Ishchi reja ko'rib chiqish uchun yuborildi",
          action: "submitted",
          status: doc.status,
          unfilledSlots: unfilled,
          warning:
            unfilled > 0
              ? `${unfilled} ta tanlov fani sloti to'ldirilmagan — yuborilgan hujjatda endi o'zgartirib bo'lmaydi`
              : null,
        });
      }

      if (doc.status === "in_review") {
        const step = doc.approvalHistory.find((s) => s.status === "pending");
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
        fillSignatureBlock(doc, step.step, step.approvedBy, step.date);
        if (req.eri) {
          step.eriSignature = req.eri.signature;
          step.eriSerial = req.eri.serialNumber || null;
          step.eriSignedAt = req.eri.signedAt || new Date();
        } else if (eriSignature) {
          step.eriSignature = eriSignature;
          step.eriSerial = eriSerial || null;
          step.eriSignedAt = new Date();
        }
        const allDone = doc.approvalHistory.every(
          (s) => s.status === "approved",
        );
        if (allDone) {
          doc.status = "approved";
          doc.approvedBy = req.user?._id || null;
        }
        await refreshVerifyToken(doc, req.user?._id || null);
        await doc.save();
        return res.status(200).json({
          message: `"${step.label || step.step}" bosqichi tasdiqlandi`,
          action: "approved_step",
          approvedStep: step.step,
          status: doc.status,
        });
      }

      if (doc.status === "rejected") {
        if (!isSuper && !isUslubi) {
          return next(
            new ErrorHandler(
              403,
              "Faqat o'quv-uslubiy boshqarma rejani qayta ocha oladi",
            ),
          );
        }
        doc.approvalHistory.forEach((s) => {
          s.status = "pending";
          s.approvedBy = null;
          s.date = null;
          s.comment = null;
          s.signature = null;
          s.eriSignature = null;
          s.eriSerial = null;
          s.eriSignedAt = null;
        });
        Object.values(STEP_SIGNATURE_BLOCK).forEach(
          ({ block, personField }) => {
            if (!doc[block]) doc[block] = {};
            doc[block][personField] = null;
            doc[block].date = null;
          },
        );
        doc.status = "draft";
        doc.approvedBy = null;
        revoke(doc, "Qayta ochildi");
        await doc.save();
        return res.status(200).json({
          message: "Ishchi reja qayta tahrirlash uchun ochildi",
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

      const doc = await WorkingScheduleModel.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!doc || doc.status === "approved")
        return doc
          ? await runFinalRevoke({ entity: "workingSchedule", doc, req, res, next })
          : next(new ErrorHandler(404, "Topilmadi"));

      if (doc.status !== "in_review") {
        return next(
          new ErrorHandler(
            400,
            `Faqat 'in_review' rejani rad etish mumkin. Joriy: ${doc.status}`,
          ),
        );
      }

      const userRole = req.user?.role?.title;
      const isSuper = userRole === ROLES.SUPER_ADMIN;

      const step = doc.approvalHistory.find((s) => s.status === "pending");
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
      revoke(doc, "Rad etildi");
      await doc.save();

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

  delete: async (req, res, next) => {
    try {
      const doc = await WorkingScheduleModel.findOne({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!doc) return res.status(404).json({ message: "not found" });

      const userRole = req.user?.role?.title;
      if (
        userRole !== ROLES.SUPER_ADMIN &&
        userRole !== ROLES.OQUV_USLUBIY_BOSHQARMA
      ) {
        return next(
          new ErrorHandler(
            403,
            "Ishchi rejani faqat o'quv-uslubiy boshqarma o'chira oladi",
          ),
        );
      }

      if (isLocked(doc.status)) {
        return next(
          new ErrorHandler(
            400,
            `Ishchi o'quv reja "${doc.status}" holatida — o'chirib bo'lmaydi`,
          ),
        );
      }

      await doc.deleteOne();

      await WorkingPlanModel.findOneAndDelete({
        workingSchedule: doc?._id,
      });

      let learningProcessReset = false;
      if (doc.learningProcess) {
        try {
          const remaining = await WorkingScheduleModel.countDocuments({
            learningProcess: doc.learningProcess,
          });
          if (remaining === 0) {
            await Promise.all([
              LearningProcess.updateOne(
                { _id: doc.learningProcess, status: "created" },
                { $set: { status: "new" } },
              ),
              StudyPlanModel.updateMany(
                { learningProcess: doc.learningProcess, status: "created" },
                { $set: { status: "new" } },
              ),
            ]);
            learningProcessReset = true;
          }
        } catch (statusErr) {
          winston.warn(
            `[workingSchedule.delete] LP status qaytarish xatosi (lp=${doc.learningProcess}): ${statusErr.message}`,
          );
        }
      }

      return res.status(200).json({
        message: `successfully deleted ${doc?._id}`,
        learningProcessReset,
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to delete working schedules",
          err.message,
        ),
      );
    }
  },

  generatePdf: async (req, res, next) => {
    try {
      const inScope = await WorkingScheduleModel.exists({
        _id: req.params.id,
        ...andFilters(req.scope, chainVisibilityFilter(req.user?.role?.title)),
      });
      if (!inScope) return res.status(404).json({ message: "not found" });

      const workingPlan = await WorkingPlanModel.findOne({
        workingSchedule: req.params.id,
      }).exec();

      if (!workingPlan) {
        return next(
          new ErrorHandler(
            404,
            "Ishchi o'quv rejasi (WorkingPlan) topilmadi — avval reja generatsiya qilinishi kerak",
          ),
        );
      }

      const doc = await buildWorkingRejaDoc(workingPlan._id);
      pipeToResponse(res, doc, `ishchi-oqyuv-reja-${req.params.id}`);
      doc.end();
    } catch (err) {
      winston.error(
        `[workingSchedule.controller] generatePdf xatolik (${req.params.id}): ${err.message}`,
      );
      return next(
        new ErrorHandler(400, "PDF yaratishda xatolik", err.message),
      );
    }
  },
};
