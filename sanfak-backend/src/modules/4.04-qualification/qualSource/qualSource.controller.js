const { ErrorHandler } = require("#shared/error");
const QualSource = require("./qualSource.model");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualPetition = require("#modules/4.04-qualification/qualPetition/qualPetition.model");
const {
  getPassport,
} = require("#modules/4.04-qualification/_shared/listenerContext");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const {
  paymentStatus,
  LOCK_MESSAGE,
} = require("#modules/4.04-qualification/_shared/paymentGate");

const normalizeTitle = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

module.exports = {
  addQualSource: async (req, res, next) => {
    try {
      const doc = await QualSource.create({
        ...req.body,
        fileDetails: req.fileDetails,
      });
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualSource", err.message),
      );
    }
  },

  findAllQualSources: async (req, res, next) => {
    try {
      const {} = req.query;
      const query = {};

      let docs = await QualSource.find(query).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualSources", err.message),
      );
    }
  },

  findSourcesByCourseName: async (req, res, next) => {
    try {
      const { course } = req.query;
      const passport = await getPassport(req);

      const selected = await QualCourse.findById(course)
        .select("title")
        .lean();
      if (!selected) return res.status(200).json([]);

      const wanted = normalizeTitle(selected.title);

      const activeCourses = await QualCourse.find({ active: true })
        .select("_id title")
        .lean();

      const myPetitions = await QualPetition.find({ passport, status: 2 })
        .select("course")
        .lean();
      const mySet = new Set(myPetitions.map((p) => String(p.course)));
      const myTitles = new Set(
        activeCourses
          .filter((c) => mySet.has(String(c._id)))
          .map((c) => normalizeTitle(c.title)),
      );
      if (!myTitles.has(wanted)) return res.status(200).json([]);

      const listener = await QualListener.findOne({ passport }).select("_id").lean();
      if (listener) {
        const gate = await paymentStatus(listener._id, course);
        if (gate.locked) {
          return res.status(402).json({ message: LOCK_MESSAGE, dueAt: gate.dueAt });
        }
      }

      const ids = activeCourses
        .filter((c) => normalizeTitle(c.title) === wanted)
        .map((c) => c._id);

      const docs = await QualSource.find({ course: { $in: ids } })
        .populate({ path: "course", select: "title form" })
        .sort({ createdAt: -1 })
        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find qualSources by course name",
          err.message,
        ),
      );
    }
  },

  paginateQualSources: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const query = {};

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [{ path: "course", select: "title form" }],
      };
      let doc = await QualSource.paginate(query, options);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualSources", err.message),
      );
    }
  },

  findOneQualSource: async (req, res, next) => {
    try {
      let doc = await QualSource.findById(req.params.id).exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualSource", err.message),
      );
    }
  },

  updateQualSource: async (req, res, next) => {
    try {
      const body = { ...req.body };

      if (req?.files?.file) body.fileDetails = req.fileDetails;
      const doc = await QualSource.findByIdAndUpdate(req.params.id, body, {
        new: true,
      });

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualSource", err.message),
      );
    }
  },

  deleteQualSource: async (req, res, next) => {
    try {
      const doc = await QualSource.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualSource", err.message),
      );
    }
  },
};
