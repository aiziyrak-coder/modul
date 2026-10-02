const { ErrorHandler } = require("#shared/error");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const {
  notifyResident,
  EVENTS,
  LINKS,
} = require("#modules/4.05-residency/_services/residentNotify");
const DailyLog = require("./dailyLog.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  buildResidentScope,
  denyActForResident,
} = require("#modules/4.05-residency/_services/residentScope");

const CREATE_FIELDS = [
  "resident",
  "date",
  "workType",
  "semester",
  "clinicalWork",
  "skills",
  "treatments",
  "practicalSkills",
  "fileUrl",
  "comment",
];
const UPDATE_FIELDS = CREATE_FIELDS.filter((f) => f !== "resident");

function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

async function buildLogFilter(user, query = {}) {
  const { resident, status } = query;
  const { filter: scoped, denied } = await buildResidentScope(user, resident);
  if (denied) return { filter: null, denied: true };

  const filter = { ...scoped };
  if (status) filter.status = status;
  return { filter, denied: false };
}

const RESIDENT_POP = {
  path: "resident",
  select:
    "fullName program specialtyTitle departmentTitle courseNumber group groupTitle specialty department",
    populate: RESIDENT_REF_POPULATE,
};
const SUP_POP = {
  path: "supervisor",
  select: "firstName lastName middleName position",
};

async function guardLog(req, res) {
  const doc = await DailyLog.findById(req.params.id).select("resident");
  if (!doc) return res.status(404).json({ message: "not found" });
  const { denied } = await buildResidentScope(req.user, String(doc.resident));
  if (denied) return res.status(404).json({ message: "not found" });
  return null;
}

module.exports = {
  addLog: async (req, res, next) => {
    try {
      const payload = pick(req.body, CREATE_FIELDS);

      const own = await Resident.findOne({
        user: req.user._id,
        active: true,
      }).select("_id");
      if (own) payload.resident = own._id;
      if (!payload.resident) {
        return next(
          new ErrorHandler(400, "Rezident aniqlanmadi — resident majburiy"),
        );
      }
      if (!own && (await denyActForResident(req, res, payload.resident))) {
        return undefined;
      }

      payload.status = "kutilmoqda";
      payload.supervisorApproved = false;
      await new DailyLog(payload).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add daily log", err.message));
    }
  },

  paginateLogs: async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const { filter, denied } = await buildLogFilter(req.user, req.query);
      if (denied)
        return res
          .status(200)
          .json({ docs: [], totalDocs: 0, page: 1, totalPages: 0 });

      const doc = await DailyLog.paginate(filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { date: -1 },
        select: "-updatedAt",
        populate: [RESIDENT_POP, SUP_POP],
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate daily logs", err.message),
      );
    }
  },

  statsLogs: async (req, res, next) => {
    try {
      const stats = { total: 0, kutilmoqda: 0, tasdiqlangan: 0, qaytarilgan: 0 };
      const { filter, denied } = await buildLogFilter(req.user, req.query);
      if (denied) return res.status(200).json(stats);

      const rows = await DailyLog.aggregate([
        { $match: DailyLog.find(filter).cast(DailyLog) },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      for (const r of rows) {
        if (r._id in stats) stats[r._id] = r.count;
        stats.total += r.count;
      }
      return res.status(200).json(stats);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get daily log stats", err.message),
      );
    }
  },

  findLogsByResident: async (req, res, next) => {
    try {
      const { residentId } = req.params;
      const { startDate, endDate, status } = req.query;

      const { denied } = await buildResidentScope(req.user, residentId);
      if (denied) return res.status(403).json({ message: "Ruxsat yo'q" });

      const data = { resident: residentId };
      if (status) data.status = status;
      if (startDate || endDate) {
        data.date = {};
        if (startDate) data.date.$gte = new Date(startDate);
        if (endDate) data.date.$lte = new Date(endDate);
      }

      const docs = await DailyLog.find(data, { updatedAt: 0 })
        .populate(RESIDENT_POP)
        .populate(SUP_POP)
        .sort({ date: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find logs by resident", err.message),
      );
    }
  },

  updateLog: async (req, res, next) => {
    try {
      if (await guardLog(req, res)) return undefined;

      const update = pick(req.body, UPDATE_FIELDS);
      update.status = "kutilmoqda";
      update.supervisorApproved = false;
      update.supervisorComment = null;

      const doc = await DailyLog.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update daily log", err.message),
      );
    }
  },

  approveLog: async (req, res, next) => {
    try {
      if (await guardLog(req, res)) return undefined;

      const doc = await DailyLog.findByIdAndUpdate(
        req.params.id,
        {
          status: "tasdiqlangan",
          supervisorApproved: true,
          supervisor: req.user._id,
          supervisorComment: req.body?.comment ?? null,
        },
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });

      await notifyResident(doc.resident, {
        eventType: EVENTS.DAILY_LOG_REVIEWED,
        title: "Kundalik yozuvingiz tasdiqlandi",
        body: doc.supervisorComment || "",
        link: LINKS.DAILY_LOG,
      });
      return res.status(200).json({ message: "successfully approved" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to approve daily log", err.message),
      );
    }
  },

  returnLog: async (req, res, next) => {
    try {
      if (await guardLog(req, res)) return undefined;

      const doc = await DailyLog.findByIdAndUpdate(
        req.params.id,
        {
          status: "qaytarilgan",
          supervisorApproved: false,
          supervisor: req.user._id,
          supervisorComment: req.body.reason,
        },
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });

      await notifyResident(doc.resident, {
        eventType: EVENTS.DAILY_LOG_REVIEWED,
        title: "Kundalik yozuvingiz qaytarildi",
        body: doc.supervisorComment || "",
        link: LINKS.DAILY_LOG,
      });
      return res.status(200).json({ message: "successfully returned" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to return daily log", err.message),
      );
    }
  },
};
