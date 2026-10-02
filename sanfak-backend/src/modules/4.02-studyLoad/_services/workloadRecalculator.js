const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");
const { createScheduleStatsResolver } = require("./departmentContingentStats");
const { isLocked } = require("#modules/4.02-studyLoad/_shared/editableStatus");
const getModels = () => ({
  Workload: require("#modules/4.02-studyLoad/workload/workload.model"),
  WorkloadDistribution: require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model"),
  WorkingSchedule: require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model"),
});
const {
  buildStaffPositions,
} = require("#modules/4.02-studyLoad/_services/staffPositionsCalculator");
const {
  calculateBlockTotal,
} = require("#modules/4.02-studyLoad/workload/workload.model");

async function onGroupStudentCountChange({
  groupId,
  newCount,
  oldCount,
  direction,
  course,
  actorUserId = null,
}) {
  if (!direction || !course) {
    winston.warn(
      `[Recalculator] direction/course berilmagan, group=${groupId}`,
    );
    return null;
  }

  const { Workload, WorkloadDistribution, WorkingSchedule } = getModels();

  const workloads = await Workload.find({
    "directions.direction": direction,
    active: true,
    status: { $ne: "superseded" },
  });

  let totalRecalculatedAssignments = 0;

  for (const wl of workloads) {
    if (isLocked(wl.status)) {
      wl.needsRecalculation = true;
      wl.lastRecalculation = {
        triggeredBy: actorUserId,
        triggeredAt: new Date(),
        reason: `Group ${groupId} studentNumber: ${oldCount} → ${newCount} (ERI himoyasi — qayta hisoblanmadi)`,
      };
      await wl.save();
      continue;
    }

    let blockChanged = 0;
    const statsForSchedule = createScheduleStatsResolver({
      department: wl.department,
      academicYear: wl.academicYear,
    });

    for (const dir of wl.directions || []) {
      if (String(dir.direction) !== String(direction)) continue;

      const schedules = await WorkingSchedule.find({
        direction: dir.direction,
        academicYear: wl.academicYear,
        active: true,
      }).select("groups direction courseRef academicYear currentCourse");

      const statsByCourse = new Map();
      for (const sch of schedules) {
        statsByCourse.set(Number(sch.currentCourse), await statsForSchedule(sch));
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

    if (blockChanged > 0) {
      wl.staffPositions = await buildStaffPositions(wl);
      wl.needsRecalculation = false;
      wl.lastRecalculation = {
        triggeredBy: actorUserId,
        triggeredAt: new Date(),
        reason: `Group ${groupId} studentNumber: ${oldCount} → ${newCount}`,
      };
      await wl.save();
      totalRecalculatedAssignments += blockChanged;
    }
  }

  const workloadIds = workloads.map((w) => w._id);
  const distributions = await WorkloadDistribution.find({
    workload: { $in: workloadIds },
    active: true,
  });

  let flaggedDistributions = 0;
  for (const dist of distributions) {
    if (dist.needsRecalculation) continue;
    dist.needsRecalculation = true;
    dist.lastRecalculation = {
      triggeredBy: actorUserId,
      triggeredAt: new Date(),
      reason: `Group ${groupId} studentNumber: ${oldCount} → ${newCount} — ota yuklama qayta hisoblandi, taqsimot qo'lda ko'rib chiqilishi kerak`,
    };
    await dist.save();
    flaggedDistributions++;
  }

  winston.info(
    `[Recalculator] Group ${groupId} (${oldCount}→${newCount}): ` +
      `${workloads.length} workload, ${distributions.length} distribution ` +
      `(${flaggedDistributions} yangi belgilandi), ` +
      `${totalRecalculatedAssignments} blok qayta hisoblandi`,
  );

  try {
    if (totalRecalculatedAssignments > 0) {
      const Department = require("#references/department/department.model");
      const Direction = require("#references/direction/direction.model");
      const User = require("#modules/4.01-auth/user/user.model");
      const { dispatch } = require("#system/notification/notificationDispatcher");

      const dir = await Direction.findById(direction).select("department").lean();
      const departmentIds = [];
      if (dir?.department) departmentIds.push(dir.department);

      for (const d of distributions) {
        if (d.department && !departmentIds.find((x) => String(x) === String(d.department))) {
          departmentIds.push(d.department);
        }
      }

      if (departmentIds.length > 0) {
        const mudirs = await User.find({
          department: { $in: departmentIds },
          active: true,
        })
          .populate("role")
          .select("firstName lastName email telegramChatId role")
          .lean();

        const targetUsers = mudirs.filter(
          (u) => u.role?.title === ROLES.KAFEDRA_MUDIRI,
        );

        for (const u of targetUsers) {
          await dispatch({
            userId: u._id,
            user: u,
            eventType: "recalc_required",
            title: "🔄 Yuklama qayta hisoblash kerak",
            body:
              `Guruh kontingenti o'zgardi: ${oldCount} → ${newCount} talaba\n` +
              `Ta'sirlangan yuklamalar: ${workloads.length}\n` +
              `Ta'sirlangan taqsimotlar: ${distributions.length}\n` +
              `Iltimos, ko'rib chiqing va tasdiqlang.`,
            link: `/distributions?needsRecalculation=true`,
            metadata: {
              groupId,
              oldCount,
              newCount,
              affectedWorkloads: workloads.map((w) => w._id),
            },
          });
        }
      }
    }
  } catch (notifErr) {
    winston.warn(`[Recalculator] notification fail: ${notifErr.message}`);
  }

  return {
    affectedWorkloads: workloads.map((w) => w._id),
    affectedDistributions: distributions.map((d) => d._id),
    recalculatedAssignments: totalRecalculatedAssignments,
  };
}

function attachToGroupSchema(GroupSchema) {
  GroupSchema.pre("save", async function (next) {
    if (this.isNew) {
      this._oldStudentNumber = 0;
      return next();
    }
    if (!this.isModified("studentNumber")) return next();

    const Group = this.constructor;
    const before = await Group.findById(this._id).select("studentNumber").lean();
    this._oldStudentNumber = before?.studentNumber || 0;
    next();
  });

  GroupSchema.post("save", async function (doc) {
    if (doc._oldStudentNumber === undefined) return;
    if (doc._oldStudentNumber === doc.studentNumber) return;

    try {
      await onGroupStudentCountChange({
        groupId: doc._id,
        newCount: doc.studentNumber,
        oldCount: doc._oldStudentNumber,
        direction: doc.direction,
        course: doc.course,
        actorUserId: doc._actorUserId || null,
      });
    } catch (err) {
      winston.error(`[Recalculator] post-save hook xato: ${err.message}`);
    }
  });

  GroupSchema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate() || {};
      const nextValue =
        update.$set?.studentNumber ?? update.studentNumber ?? undefined;

      if (nextValue === undefined) return next();

      const before = await this.model
        .findOne(this.getQuery())
        .select("studentNumber")
        .lean();
      this._oldStudentNumber = before?.studentNumber ?? 0;
      return next();
    } catch (err) {
      winston.error(`[Recalculator] pre-findOneAndUpdate xato: ${err.message}`);
      return next();
    }
  });

  GroupSchema.post("findOneAndUpdate", async function (doc) {
    if (this._oldStudentNumber === undefined) return;
    if (!doc) return;
    if (this._oldStudentNumber === doc.studentNumber) return;

    try {
      await onGroupStudentCountChange({
        groupId: doc._id,
        newCount: doc.studentNumber,
        oldCount: this._oldStudentNumber,
        direction: doc.direction,
        course: doc.course,
        actorUserId: null,
      });
    } catch (err) {
      winston.error(
        `[Recalculator] post-findOneAndUpdate hook xato: ${err.message}`,
      );
    }
  });
}

module.exports = {
  onGroupStudentCountChange,
  attachToGroupSchema,
};
