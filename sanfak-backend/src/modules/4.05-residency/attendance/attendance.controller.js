const { ErrorHandler } = require("#shared/error");
const {
  checkScoreWindow,
} = require("#modules/4.05-residency/_services/scoreWindow");
const { lessonTypeScoreError, lessonTypeWriteGuard } =
  require("#modules/4.05-residency/_services/lessonTypeGrading");
const { SCORE_ROLLUP } = require("#modules/4.05-residency/_services/lessonScore");
const {
  REASONS: EVIDENCE_REASONS,
  MSG: EVIDENCE_MSG,
  manualVerificationPatch,
  presentEvidenceError,
  presentEvidenceFilter,
} = require("#modules/4.05-residency/_services/presenceEvidence");
const {
  getOrCreate: getResidencySettings,
} = require("#modules/4.05-residency/residencySetting/residencySetting.service");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const ObjectId = require("mongoose").Types.ObjectId;
const Attendance = require("./attendance.model");
const { duplicateLessonError, attendanceWriteError } = require("./duplicateLesson");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  buildResidentScope,
  guardResident,
} = require("#modules/4.05-residency/_services/residentScope");
const {
  buildAttendanceFilter,
} = require("#modules/4.05-residency/_services/attendanceFilter");

const {
  runExpulsionCheck,
  _notifyInBackground,
  _dispatchInAppInBackground,
} = require("#modules/4.05-residency/_services/expulsionCheck");

async function denyAttendanceWrite(req, res, residentId) {
  return (await resolveWritableResident(req, res, residentId)) === null;
}

async function resolveWritableResident(req, res, residentId) {
  const target = await Resident.findById(residentId);
  if (!target) {
    res.status(404).json({ message: "Topilmadi" });
    return null;
  }
  return guardResident(req, res, target, "write") ? target : null;
}

const CREATE_FIELDS = [
  "resident",
  "date",
  "science",
  "scienceTitle",
  "lessonType",
  "group",
  "status",
  "hours",
  "score",
  "late",
  "lateMinutes",
  "excuseReason",
  "fromDate",
  "toDate",
];
const UPDATE_FIELDS = [
  "status",
  "science",
  "scienceTitle",
  "lessonType",
  "group",
  "hours",
  "score",
  "late",
  "lateMinutes",
  "excuseReason",
  "fromDate",
  "toDate",
];
function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

const evidenceRejection = ({ message, reason }) =>
  new ErrorHandler(400, message, "", { reason });

async function writeGuardedUpdate(id, update) {
  const guard = { ...presentEvidenceFilter(update), ...lessonTypeWriteGuard(update) };
  const doc = await Attendance.findOneAndUpdate({ _id: id, ...guard }, update, {
    new: true,
    runValidators: true,
  });
  if (doc || Object.keys(guard).length === 0) return { doc, changed: false };
  return { doc: null, changed: Boolean(await Attendance.exists({ _id: id })) };
}

async function scoreWindowError(row) {
  if (row.score === undefined || row.score === null) return null;
  const settings = await getResidencySettings();
  const verdict = checkScoreWindow(row, settings);
  return verdict.ok ? null : verdict.message;
}

function normalizeLate(payload, status) {
  if (status !== "present") {
    payload.late = false;
    payload.lateMinutes = null;
    return;
  }
  if (payload.late === false) {
    payload.lateMinutes = null;
    return;
  }
  if (payload.lateMinutes != null) payload.late = true;
}

const APPLICATION_POP = {
  path: "application",
  select: "fileUrl reason type status",
};

const RESIDENT_POP = {
  path: "resident",
  select:
    "fullName program specialtyTitle departmentTitle courseNumber groupTitle specialty department group",
    populate: RESIDENT_REF_POPULATE,
};

module.exports = {
  _notifyInBackground,
  _dispatchInAppInBackground,

  addAttendance: async (req, res, next) => {
    try {
      const { resident, status, date, science = null, lessonType = null } =
        req.body;

      const target = await resolveWritableResident(req, res, resident);
      if (!target) return undefined;

      const existing = await Attendance.findOne({
        resident,
        date,
        science,
        lessonType,
      });
      if (existing) return next(duplicateLessonError());

      const payload = pick(req.body, CREATE_FIELDS);
      Object.assign(
        payload,
        manualVerificationPatch({
          program: target.program,
          requested: req.body.manualVerified,
          userId: req.user?._id ?? null,
        }),
      );
      const evidenceErr = presentEvidenceError(status, target.program, payload);
      if (evidenceErr) return next(evidenceRejection(evidenceErr));

      if (payload.group === undefined || payload.group === null) {
        payload.group = target.group || null;
      }

      payload.teacher = req.user?._id ?? null;

      normalizeLate(payload, status);

      const typeErr = lessonTypeScoreError(payload);
      if (typeErr) return next(typeErr);

      const scoreErr = await scoreWindowError({
        ...payload,
        program: target.program,
        status,
      });
      if (scoreErr) return res.status(400).json({ message: scoreErr });

      await new Attendance(payload).save();

      if (status === "absent") await runExpulsionCheck(resident);

      return res.status(201).json({ message: "Muvaffaqiyatli saqlandi" });
    } catch (err) {
      return next(attendanceWriteError(err, "Davomat qo'shishda xato"));
    }
  },

  paginateAttendance: async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      const { filter, denied } = await buildAttendanceFilter(
        req.user,
        req.query,
      );
      if (denied)
        return res
          .status(200)
          .json({ docs: [], totalDocs: 0, page: 1, totalPages: 0 });

      const doc = await Attendance.paginate(filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { date: -1 },
        select: "-createdAt -updatedAt",
        populate: [
          RESIDENT_POP,
          APPLICATION_POP,
          { path: "science", select: "title" },
          { path: "teacher", select: "firstName lastName middleName position" },
        ],
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Davomatni sahifalashda xato", err.message),
      );
    }
  },

  findAttendanceByResident: async (req, res, next) => {
    try {
      const { resident } = req.params;
      const { startDate, endDate, science, lessonType } = req.query;

      const { filter: scoped, denied } = await buildResidentScope(
        req.user,
        resident,
      );
      if (denied) return res.status(403).json({ message: "Ruxsat yo'q" });

      const filter = { ...scoped };
      if (science) filter.science = science;
      if (lessonType) filter.lessonType = lessonType;
      if (startDate && endDate) {
        filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      const docs = await Attendance.find(filter, { createdAt: 0, updatedAt: 0 })
        .populate(RESIDENT_POP)
        .populate(APPLICATION_POP)
        .populate({ path: "science", select: "title" })
        .populate({
          path: "teacher",
          select: "firstName lastName middleName position",
        })
        .populate({
          path: "excuseApprovedBy",
          select: "firstName lastName middleName",
        })
        .sort({ date: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Davomat ro'yxatini olishda xato", err.message),
      );
    }
  },

  updateAttendance: async (req, res, next) => {
    try {
      const current = await Attendance.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "Topilmadi" });
      const target = await resolveWritableResident(req, res, current.resident);
      if (target === null) return undefined;

      const update = pick(req.body, UPDATE_FIELDS);
      Object.assign(
        update,
        manualVerificationPatch({
          program: target.program,
          requested: req.body.manualVerified,
          wasVerified: current.manualVerified === true,
          userId: req.user?._id ?? null,
        }),
      );

      const nextStatus = update.status ?? current.status;
      const evidence = {
        samsVerified: current.samsVerified,
        manualVerified: update.manualVerified ?? current.manualVerified,
      };
      const evidenceErr = presentEvidenceError(nextStatus, target.program, evidence);
      if (evidenceErr) return next(evidenceRejection(evidenceErr));
      normalizeLate(update, nextStatus);

      const typeErr = lessonTypeScoreError(update, current);
      if (typeErr) return next(typeErr);

      const scoreErr = await scoreWindowError({
        program: target.program,
        status: nextStatus,
        ...evidence,
        score: "score" in update ? update.score : current.score,
        checkInTime: current.checkInTime,
        checkOutTime: current.checkOutTime,
      });
      if (scoreErr) return res.status(400).json({ message: scoreErr });

      const { doc, changed } = await writeGuardedUpdate(req.params.id, update);
      if (changed) {
        return next(new ErrorHandler(409, EVIDENCE_MSG.stateChanged, "", {
          reason: EVIDENCE_REASONS.stateChanged,
        }));
      }
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await runExpulsionCheck(doc.resident.toString());
      return res.status(200).json({ message: "Muvaffaqiyatli yangilandi" });
    } catch (err) {
      return next(attendanceWriteError(err, "Davomatni yangilashda xato"));
    }
  },

  approveExcuse: async (req, res, next) => {
    try {
      const current = await Attendance.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "Topilmadi" });
      if (await denyAttendanceWrite(req, res, current.resident)) return undefined;

      const { reason, fromDate, toDate } = req.body;
      const update = {
        status: "excused",
        excuseReason: reason,
        excuseApprovedBy: req.user._id,
      };
      if (fromDate !== undefined) update.fromDate = fromDate;
      if (toDate !== undefined) update.toDate = toDate;

      const doc = await Attendance.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await runExpulsionCheck(doc.resident.toString());
      return res.status(200).json({ message: "Sabab tasdiqlandi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Sababni tasdiqlashda xato", err.message),
      );
    }
  },

  getJournalStats: async (req, res, next) => {
    try {
      const { filter, denied } = await buildAttendanceFilter(
        req.user,
        req.query,
      );
      const empty = {
        present: 0,
        absent: 0,
        excused: 0,
        late: 0,
        total: 0,
        percent: 0,
      };
      if (denied) return res.status(200).json(empty);

      const [row] = await Attendance.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
            excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ["$late", true] }, 1, 0] } },
            total: { $sum: 1 },
          },
        },
      ]);

      if (!row) return res.status(200).json(empty);
      const { _id, ...counts } = row;
      return res.status(200).json({
        ...counts,
        percent: counts.total
          ? Math.round((counts.present / counts.total) * 100)
          : 0,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Jurnal statistikasini olishda xato", err.message),
      );
    }
  },

  getJournalStatsByResident: async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const { filter, denied } = await buildAttendanceFilter(
        req.user,
        req.query,
      );
      if (denied)
        return res
          .status(200)
          .json({ docs: [], totalDocs: 0, page: 1, totalPages: 0 });

      const agg = Attendance.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$resident",
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
            excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ["$late", true] }, 1, 0] } },
            scoreSum: { $sum: { $ifNull: ["$score", 0] } },
            ...SCORE_ROLLUP.group,
            lastDate: { $max: "$date" },
          },
        },
        { $sort: { lastDate: -1 } },
        {
          $lookup: {
            from: "residents",
            localField: "_id",
            foreignField: "_id",
            as: "resident",
          },
        },
        { $unwind: { path: "$resident", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "residencyspecialties",
            localField: "resident.specialty",
            foreignField: "_id",
            as: "residentSpecialty",
          },
        },
        { $unwind: { path: "$residentSpecialty", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            resident: {
              _id: "$resident._id",
              fullName: "$resident.fullName",
              specialtyTitle: {
                $ifNull: ["$residentSpecialty.title", "$resident.specialtyTitle"],
              },
              courseNumber: "$resident.courseNumber",
            },
            total: 1,
            present: 1,
            absent: 1,
            excused: 1,
            late: 1,
            scoreSum: 1,
            ...SCORE_ROLLUP.project,
            lastDate: 1,
          },
        },
      ]);

      const doc = await Attendance.aggregatePaginate(agg, {
        useFacet: false,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Rezident kesimidagi yig'mani olishda xato",
          err.message,
        ),
      );
    }
  },

  getAttendanceStats: async (req, res, next) => {
    try {
      const { resident } = req.params;

      const { denied } = await buildResidentScope(req.user, resident);
      if (denied) return res.status(403).json({ message: "Ruxsat yo'q" });

      const stats = await Attendance.aggregate([
        { $match: { resident: new ObjectId(resident), active: true } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalHours: { $sum: "$hours" },
          },
        },
      ]);

      const residentData = await Resident.findById(resident).select(
        "fullName totalUnexcusedHours warningIssued warningIssuedAt expulsionOrderCreated expulsionOrderCreatedAt",
      );
      return res.status(200).json({ stats, summary: residentData });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Statistika olishda xato", err.message),
      );
    }
  },
  normalizeLate,
  CREATE_FIELDS,
  UPDATE_FIELDS,
};
