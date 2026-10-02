const { ErrorHandler } = require("#shared/error");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const OpenLesson = require("./openLesson.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const S = require("./openLesson.service");

const RESIDENT_POP = {
  path: "resident",
  select:
    "fullName program specialtyTitle courseNumber groupTitle departmentTitle specialty department group",
    populate: RESIDENT_REF_POPULATE,
};

const POP = [
  RESIDENT_POP,
  { path: "room", select: "title building capacity" },
  { path: "attendees.user", select: "firstName lastName middleName" },
];

const SORT = { date: -1 };

async function buildPatch(req, residentId) {
  const scope = await S.checkResidentScope(req.user, residentId);
  if (!scope.ok) return { error: scope };

  const patch = {};
  const b = req.body;

  if (b.room !== undefined) {
    const r = await S.resolveRoom(b.room);
    if (r.error) return { error: { status: 400, message: r.error } };
    patch.room = r.room;
    patch.roomTitle = r.roomTitle;
  }

  if (b.attendees !== undefined) {
    const a = await S.resolveAttendees(b.attendees);
    if (a.error) return { error: { status: 400, message: a.error } };
    patch.attendees = a.attendees;
  }

  if (b.plan !== undefined || b.planKind !== undefined) {
    const p = await S.resolvePlan(b.planKind, b.plan, residentId);
    if (p.error) return { error: { status: 400, message: p.error } };
    patch.plan = p.plan;
    patch.planKind = p.planKind;
    patch.planTitle = p.planTitle;
  }

  for (const key of ["type", "date", "topic", "taskTitle", "note", "academicYear"]) {
    if (b[key] !== undefined) patch[key] = b[key];
  }

  return { patch };
}

module.exports = {
  addOpenLesson: async (req, res, next) => {
    try {
      const residentId = req.body.resident;
      const { error, patch } = await buildPatch(req, residentId);
      if (error) return res.status(error.status).json({ message: error.message });

      const r = await Resident.findById(residentId).select("fullName").lean();

      const doc = await new OpenLesson({
        ...patch,
        resident: residentId,
        residentName: r?.fullName ?? null,
        assignedBy: req.user?._id ?? null,
      }).save();

      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ochiq dars biriktirishda xato", err.message),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const { filter } = await S.buildScope(req.user);
      const docs = await OpenLesson.find(S.buildListFilter(req.query, filter))
        .populate(POP)
        .sort(SORT);
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Ochiq darslar ro'yxati xatosi", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const { filter } = await S.buildScope(req.user);
      const doc = await OpenLesson.paginate(S.buildListFilter(req.query, filter), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: SORT,
        populate: POP,
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Ochiq darslar sahifalash xatosi", err.message));
    }
  },

  findByResident: async (req, res, next) => {
    try {
      const scope = await S.checkResidentScope(req.user, req.params.residentId);
      if (!scope.ok && scope.status === 403) return res.status(200).json([]);
      if (!scope.ok) return res.status(scope.status).json({ message: scope.message });

      const docs = await OpenLesson.find({ resident: req.params.residentId }).sort(SORT);
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Ochiq darslar xatosi", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await OpenLesson.findById(req.params.id).populate(POP);
      if (!doc) return res.status(404).json({ message: "not found" });

      const { allowed } = await S.buildScope(req.user);
      const owner = S.idStr(doc.resident);
      if (allowed !== null && !allowed.some((id) => String(id) === owner)) {
        return res.status(404).json({ message: "not found" });
      }
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Ochiq darsni topishda xato", err.message));
    }
  },

  updateOpenLesson: async (req, res, next) => {
    try {
      const doc = await OpenLesson.findById(req.params.id).select("resident");
      if (!doc) return res.status(404).json({ message: "not found" });

      const { error, patch } = await buildPatch(req, doc.resident);
      if (error) return res.status(error.status).json({ message: error.message });

      await OpenLesson.updateOne({ _id: doc._id }, { $set: patch }, { runValidators: true });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Ochiq darsni yangilashda xato", err.message));
    }
  },

  deleteOpenLesson: async (req, res, next) => {
    try {
      const doc = await OpenLesson.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });

      const scope = await S.checkResidentScope(req.user, S.idStr(doc.resident));
      if (!scope.ok) return res.status(scope.status).json({ message: scope.message });

      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Ochiq darsni o'chirishda xato", err.message));
    }
  },
};
