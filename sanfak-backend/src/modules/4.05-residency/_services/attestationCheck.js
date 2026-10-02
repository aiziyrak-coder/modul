const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const DailyLog = require("#modules/4.05-residency/dailyLog/dailyLog.model");
const Assessment = require("#modules/4.05-residency/assessment/assessment.model");
const { currentAcademicYearTitle, unexcusedDateFilter } = require("./unexcusedWindow");

const THRESHOLDS = {
  WARNING_HOURS: 6,
  EXPULSION_HOURS: 72,
  MIN_DAILY_LOG_APPROVAL_RATIO: 0.7,
  MIN_INTERIM_ASSESSMENTS: 1,
};

function explicitRange(fromDate, toDate) {
  if (!fromDate && !toDate) return null;
  const dateRange = {};
  if (fromDate) dateRange.$gte = new Date(fromDate);
  if (toDate) dateRange.$lte = new Date(toDate);
  return dateRange;
}

function attendanceHoursWindow({ fromDate, toDate }, now) {
  const range = explicitRange(fromDate, toDate);
  if (range) {
    return {
      range,
      explicit: true,
      window: {
        source: "explicit",
        academicYear: null,
        from: range.$gte ?? null,
        to: range.$lte ?? null,
      },
    };
  }
  const yearRange = unexcusedDateFilter(now);
  return {
    range: yearRange,
    explicit: false,
    window: {
      source: "academicYear",
      academicYear: currentAcademicYearTitle(now),
      from: yearRange.$gte,
      to: yearRange.$lte,
    },
  };
}

async function checkAttestationEligibility(residentId, opts = {}) {
  const { science, fromDate, toDate, now = new Date() } = opts;
  const hoursWindow = attendanceHoursWindow({ fromDate, toDate }, now);

  const attendanceFilter = { resident: residentId, active: true, date: hoursWindow.range };
  const dailyLogFilter = { resident: residentId, active: true };
  const assessmentFilter = { resident: residentId, active: true };

  if (hoursWindow.explicit) dailyLogFilter.date = hoursWindow.range;

  if (science) {
    assessmentFilter.science = science;
  }

  const attendanceRecords = await Attendance.find(attendanceFilter)
    .select("status hours excuseReason excuseApprovedBy")
    .lean();

  let unexcusedHours = 0;
  let totalAbsentHours = 0;
  let totalAttendedHours = 0;

  for (const a of attendanceRecords) {
    const hours = a.hours || 2;
    if (a.status === "absent") {
      totalAbsentHours += hours;
      if (!a.excuseApprovedBy) unexcusedHours += hours;
    } else if (a.status === "present") {
      totalAttendedHours += hours;
    }
  }

  const dailyLogs = await DailyLog.find(dailyLogFilter)
    .select("supervisorApproved practicalSkills")
    .lean();

  const totalLogs = dailyLogs.length;
  const approvedLogs = dailyLogs.filter((d) => d.supervisorApproved).length;
  const dailyLogApprovalRatio = totalLogs > 0 ? approvedLogs / totalLogs : 0;

  const allAssessments = await Assessment.find(assessmentFilter)
    .select("type score maxScore")
    .lean();

  const isGraded = (a) => typeof a.score === "number";

  const interimAssessments = allAssessments.filter(
    (a) => a.type === "oraliq" && isGraded(a),
  );

  const summarizeType = (type) => {
    const graded = allAssessments.filter((a) => a.type === type && isGraded(a));
    return {
      count: graded.length,
      avgScore: graded.length
        ? Number(
            (
              graded.reduce((s, a) => s + (a.score / (a.maxScore || 100)) * 100, 0) /
              graded.length
            ).toFixed(1),
          )
        : null,
    };
  };

  const reasons = [];
  let eligible = true;

  if (unexcusedHours >= THRESHOLDS.EXPULSION_HOURS) {
    eligible = false;
    reasons.push(
      `Sababsiz qoldirilgan soatlar ${unexcusedHours} (chetlatish chegarasi: ${THRESHOLDS.EXPULSION_HOURS})`,
    );
  } else if (unexcusedHours >= THRESHOLDS.WARNING_HOURS) {
    reasons.push(
      `Sababsiz qoldirilgan soatlar ${unexcusedHours} — ogohlantirish (${THRESHOLDS.WARNING_HOURS}+ soat)`,
    );
  }

  if (totalLogs > 0 && dailyLogApprovalRatio < THRESHOLDS.MIN_DAILY_LOG_APPROVAL_RATIO) {
    eligible = false;
    reasons.push(
      `Kundalik tasdiqlash foizi ${(dailyLogApprovalRatio * 100).toFixed(1)}% (talab: ${
        THRESHOLDS.MIN_DAILY_LOG_APPROVAL_RATIO * 100
      }%)`,
    );
  }

  if (interimAssessments.length < THRESHOLDS.MIN_INTERIM_ASSESSMENTS) {
    eligible = false;
    reasons.push(
      `Qo'yilgan oraliq nazorat ballari yetarli emas: ${interimAssessments.length} ta (talab: ${THRESHOLDS.MIN_INTERIM_ASSESSMENTS}+)`,
    );
  }

  return {
    eligible,
    reasons,
    expulsionTriggered: unexcusedHours >= THRESHOLDS.EXPULSION_HOURS,
    warningTriggered: unexcusedHours >= THRESHOLDS.WARNING_HOURS,
    details: {
      attendance: {
        totalRecords: attendanceRecords.length,
        totalAttendedHours,
        totalAbsentHours,
        unexcusedHours,
        window: hoursWindow.window,
      },
      dailyLog: {
        total: totalLogs,
        approved: approvedLogs,
        approvalRatio: Number(dailyLogApprovalRatio.toFixed(3)),
      },
      assessment: {
        interimCount: interimAssessments.length,
        avgScore:
          interimAssessments.length > 0
            ? interimAssessments.reduce(
                (s, a) => s + (a.score / (a.maxScore || 100)) * 100,
                0,
              ) / interimAssessments.length
            : 0,
        byType: {
          oraliq: summarizeType("oraliq"),
          test: summarizeType("test"),
          amaliy: summarizeType("amaliy"),
        },
      },
    },
  };
}

module.exports = { checkAttestationEligibility, THRESHOLDS };
