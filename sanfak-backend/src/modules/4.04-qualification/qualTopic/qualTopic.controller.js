const { ErrorHandler } = require("#shared/error");
const QualTopic = require("./qualTopic.model");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");

const assertOrderFree = async (course, orderNumber, exceptId) => {
  const filter = { course, orderNumber };
  if (exceptId) filter._id = { $ne: exceptId };
  const clash = await QualTopic.findOne(filter).select("title").lean();
  return clash
    ? `Bu tartib raqami band — "${clash.title}" mavzusida ishlatilgan`
    : null;
};

module.exports = {
  addQualTopic: async (req, res, next) => {
    try {
      const { orderNumber, course } = req.body;

      const courseDoc = await QualCourse.findOne({ _id: course });

      if (!courseDoc)
        return res.status(404).json({ message: "Course not found" });

      if (courseDoc.form == 2)
        return res.status(409).json({ message: "Course is not online type" });

      let preciseOrderNumber = orderNumber;
      if (!orderNumber) {
        const last = await QualTopic.findOne({ course })
          .sort({ orderNumber: -1 })
          .select("orderNumber");
        preciseOrderNumber = last ? last.orderNumber + 1 : 1;
      } else {
        const busy = await assertOrderFree(course, orderNumber);
        if (busy) return res.status(409).json({ message: busy });
      }

      const doc = await QualTopic.create({
        ...req.body,
        orderNumber: preciseOrderNumber,
      });
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualTopic", err.message),
      );
    }
  },

  findAllQualTopics: async (req, res, next) => {
    try {
      const { course } = req.query;
      const sort = { orderNumber: 1 };
      const query = {};
      if (course) query.course = course;

      let docs = await QualTopic.find(query).sort(sort).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTopics", err.message),
      );
    }
  },

  paginateQualTopics: async (req, res, next) => {
    try {
      const { page, limit, course } = req.query;
      const sort = { orderNumber: 1 };
      const query = {};
      if (course) query.course = course;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
      };
      let doc = await QualTopic.paginate(query, options);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualTopics", err.message),
      );
    }
  },

  findOneQualTopic: async (req, res, next) => {
    try {
      let doc = await QualTopic.findById(req.params.id).exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTopic", err.message),
      );
    }
  },

  updateQualTopic: async (req, res, next) => {
    try {
      const { orderNumber } = req.body;
      if (orderNumber) {
        const current = await QualTopic.findById(req.params.id).select("course").lean();
        if (!current) return res.status(404).json({ message: "not found" });
        const busy = await assertOrderFree(current.course, orderNumber, req.params.id);
        if (busy) return res.status(409).json({ message: busy });
      }

      const doc = await QualTopic.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualTopic", err.message),
      );
    }
  },

  deleteQualTopic: async (req, res, next) => {
    try {
      const doc = await QualTopic.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualTopic", err.message),
      );
    }
  },
};
