const { ErrorHandler } = require("#shared/error");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const ResidentApplication = require("./residentApplication.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  buildResidentScope,
  denyActForResident,
} = require("#modules/4.05-residency/_services/residentScope");
const { searchRegex } = require("#modules/4.05-residency/_services/searchTerm");
const {
  clearWarningIfBelowThreshold,
  revokeWarningInBackground,
} = require("#modules/4.05-residency/_services/attendanceWarning");
const {
  shouldCancelDraft,
  signedBasisLost,
} = require("#modules/4.05-residency/_services/expulsionReversal");
const {
  basisLostEffects,
  deliverDecisionInBackground,
} = require("#modules/4.05-residency/_services/expulsionOfficeNotices");
const {
  countUnexcusedHours,
} = require("#modules/4.05-residency/_services/expulsionCheck");
const {
  cancelDraftBelowThreshold,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  unexcusedDateFilter,
} = require("#modules/4.05-residency/_services/unexcusedWindow");
const {
  notifyResident,
  EVENTS,
  LINKS,
} = require("#modules/4.05-residency/_services/residentNotify");
const {
  applyApprovedExcuses,
} = require("#modules/4.05-residency/_services/approvedExcuses");

const CREATE_FIELDS = ["resident", "type", "reason", "fileUrl", "academicYear"];
function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

const RESIDENT_POP = {
  path: "resident",
  select:
    "fullName program specialtyTitle departmentTitle courseNumber groupTitle specialty department group",
    populate: RESIDENT_REF_POPULATE,
};
const REVIEWER_POP = {
  path: "reviewedBy",
  select: "firstName lastName middleName",
};

function buildFilter(query, scoped) {
  const { search, status, type, academicYear, active } = query;
  const data = { ...scoped };
  if (status) data.status = status;
  if (type) data.type = type;
  applyAcademicYearFilter(data, academicYear);
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.reason = rx;
  return data;
}

const unlinkAttendanceOf = async (applicationId) => {
  const reverted = await Attendance.updateMany(
    { application: applicationId, status: "excused", active: true },
    {
      status: "absent",
      application: null,
      excuseReason: null,
      excuseApprovedBy: null,
      fromDate: null,
      toDate: null,
    },
  );
  await Attendance.updateMany(
    { application: applicationId },
    { application: null },
  );
  return reverted.modifiedCount ?? 0;
};

const recountUnexcused = async (residentId) => {
  const remaining = await Attendance.find({
    resident: residentId,
    status: "absent",
    active: true,

    date: unexcusedDateFilter(),
  }).select("hours");
  const totalUnexcusedHours = remaining.reduce(
    (sum, a) => sum + (a.hours || 2),
    0,
  );

  const resident = await Resident.findById(residentId).select(
    "warningIssued expulsionOrderCreated expulsionOrderCreatedAt user status active",
  );
  const update = { totalUnexcusedHours };
  if (
    clearWarningIfBelowThreshold(resident, totalUnexcusedHours, update) &&
    resident?.user
  ) {
    revokeWarningInBackground(resident.user);
  }

  if (shouldCancelDraft(resident, totalUnexcusedHours)) {
    await cancelDraftBelowThreshold(resident, {
      hours: totalUnexcusedHours,
      source: "application",
    });
  }

  if (signedBasisLost(resident, totalUnexcusedHours)) {
    const [effect] = await basisLostEffects({
      residentId,
      source: "application",
      countHours: countUnexcusedHours,
    });
    if (effect) deliverDecisionInBackground(effect.order, "basisLost");
  }

  await Resident.findByIdAndUpdate(residentId, update);
  return totalUnexcusedHours;
};

module.exports = {
  _recountUnexcused: recountUnexcused,

  addApplication: async (req, res, next) => {
    try {
      const payload = pick(req.body, CREATE_FIELDS);
      if (payload.resident) {
        if (await denyActForResident(req, res, payload.resident)) return undefined;
      } else {
        const mine = await Resident.findOne({ user: req.user._id }).select(
          "_id",
        );
        if (!mine)
          return res
            .status(400)
            .json({ message: "Sizga bog'langan rezident yozuvi topilmadi" });
        payload.resident = mine._id;
      }
      payload.status = "yangi";
      await new ResidentApplication(payload).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add application", err.message),
      );
    }
  },

  findAllApplications: async (req, res, next) => {
    try {
      const { filter: scoped } = await buildResidentScope(req.user);
      const docs = await ResidentApplication.find(
        buildFilter(req.query, scoped),
        { updatedAt: 0 },
      )
        .populate(RESIDENT_POP)
        .populate(REVIEWER_POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find applications", err.message),
      );
    }
  },

  paginateApplications: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const { filter: scoped } = await buildResidentScope(req.user);
      const doc = await ResidentApplication.paginate(
        buildFilter(req.query, scoped),
        {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: { createdAt: -1 },
          select: "-updatedAt",
          populate: [RESIDENT_POP, REVIEWER_POP],
        },
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate applications", err.message),
      );
    }
  },

  statsApplications: async (req, res, next) => {
    try {
      const { filter: scoped } = await buildResidentScope(req.user);
      const statsQuery = { ...req.query };
      delete statsQuery.status;
      delete statsQuery.active;
      for (const key of ["type", "academicYear", "search"]) {
        if (statsQuery[key] !== undefined && statsQuery[key] !== null)
          statsQuery[key] = String(statsQuery[key]);
      }
      const match = buildFilter(statsQuery, scoped);
      match.active = String(req.query.active ?? "true") !== "false";
      const rows = await ResidentApplication.aggregate([
        { $match: match },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const stats = {
        total: 0,
        yangi: 0,
        korib_chiqilmoqda: 0,
        tasdiqlangan: 0,
        rad_etilgan: 0,
        pending: 0,
      };
      for (const r of rows) {
        if (r._id in stats) stats[r._id] = r.count;
        stats.total += r.count;
      }
      stats.pending = stats.yangi + stats.korib_chiqilmoqda;
      return res.status(200).json(stats);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get application stats", err.message),
      );
    }
  },

  reviewApplication: async (req, res, next) => {
    try {
      const current = await ResidentApplication.findById(req.params.id).select(
        "resident",
      );
      if (!current) return res.status(404).json({ message: "not found" });
      const { denied } = await buildResidentScope(
        req.user,
        String(current.resident),
      );
      if (denied) return res.status(404).json({ message: "not found" });

      const { status, comment, fromDate, toDate } = req.body;
      const update = { status, reviewedBy: req.user._id };
      if (comment !== undefined) update.comment = comment;
      if (fromDate !== undefined) update.fromDate = fromDate;
      if (toDate !== undefined) update.toDate = toDate;

      const doc = await ResidentApplication.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });

      if (status === "tasdiqlangan" && fromDate && toDate) {
        await unlinkAttendanceOf(doc._id);
        await applyApprovedExcuses(doc.resident);
        await recountUnexcused(doc.resident);
      } else if (status !== "tasdiqlangan") {
        const reverted = await unlinkAttendanceOf(doc._id);
        if (reverted) {
          await applyApprovedExcuses(doc.resident);
          await recountUnexcused(doc.resident);
        }
      }

      if (status === "tasdiqlangan" || status === "rad_etilgan") {
        const approved = status === "tasdiqlangan";
        await notifyResident(doc.resident, {
          eventType: EVENTS.APPLICATION_REVIEWED,
          title: approved ? "Arizangiz tasdiqlandi" : "Arizangiz rad etildi",
          body: doc.comment
            ? `${doc.reason || "Ariza"} — ${doc.comment}`
            : doc.reason || "Ariza",
          link: LINKS.APPLICATIONS,
        });
      }

      return res.status(200).json({ message: "successfully reviewed" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to review application", err.message),
      );
    }
  },
};
