const { ErrorHandler } = require("#shared/error");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const QualCourse = require("./qualCourse.model");
const QualCourseSubscription = require("#modules/4.04-qualification/qualCourseSubscription/qualCourseSubscription.model");
const QualCourseType = require("#modules/4.04-qualification/qualCourseType/qualCourseType.model");

const DAY_MS = 24 * 60 * 60 * 1000;

function computeCourseStatus(startDate, endDate, now = new Date()) {
  if (!startDate || !endDate) return 1;
  const t = now.getTime();
  if (t < new Date(startDate).getTime()) return 1;
  if (t >= new Date(endDate).getTime() + DAY_MS) return 3;
  return 2;
}

const COURSE_STATUS_STAGE = {
  $addFields: {
    status: {
      $switch: {
        branches: [
          {
            case: {
              $or: [{ $eq: ["$startDate", null] }, { $eq: ["$endDate", null] }],
            },
            then: 1,
          },
          { case: { $lt: ["$$NOW", "$startDate"] }, then: 1 },
          { case: { $gte: ["$$NOW", { $add: ["$endDate", DAY_MS] }] }, then: 3 },
        ],
        default: 2,
      },
    },
  },
};

module.exports = {
  addQualCourse: async (req, res, next) => {
    try {
      const doc = await QualCourse.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualCourse", err.message),
      );
    }
  },

  findAllQualCourses: async (req, res, next) => {
    try {
      const { search, status, startDate, endDate, form } = req.query;
      const query = { active: true };

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      if (status) {
        query.status = Number(status);
      }

      if (form) {
        query.form = Number(form);
      }

      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end) {
          query.$and = [
            { startDate: { $lte: end } },
            { endDate: { $gte: start } },
          ];
        } else if (start) {
          query.endDate = { $gte: start };
        } else if (end) {
          query.startDate = { $lte: end };
        }
      }

      const pipeline = [
        { $match: query },

        {
          $lookup: {
            from: QualCourseSubscription.collection.name,
            localField: "_id",
            foreignField: "course",
            as: "subscriptions",
          },
        },

        {
          $addFields: {
            totalSubscribers: { $size: "$subscriptions" },
          },
        },

        {
          $project: {
            subscriptions: 0,
          },
        },

        {
          $project: {
            title: 1,
            creditHours: 1,
            price: 1,
            form: 1,
            listenersLimit: 1,
            startDate: 1,
            endDate: 1,
            address: 1,
            location: 1,
            status: 1,
            active: 1,

            totalSubscribers: 1,
          },
        },

        { $sort: { createdAt: -1 } },
      ];

      const docs = await QualCourse.aggregate(pipeline);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualCourses", err.message),
      );
    }
  },

  paginateQualCourses: async (req, res, next) => {
    try {
      const { search, status, startDate, endDate, page, limit, form } = req.query;
      const query = { active: true };

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      if (form) {
        query.form = Number(form);
      }

      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end) {
          query.$and = [
            { startDate: { $lte: end } },
            { endDate: { $gte: start } },
          ];
        } else if (start) {
          query.endDate = { $gte: start };
        } else if (end) {
          query.startDate = { $lte: end };
        }
      }

      const options = { useFacet: false, ...normalizePageParams({ page, limit }) };
      const pipeline = [
        { $match: query },
        COURSE_STATUS_STAGE,
        ...(status ? [{ $match: { status: Number(status) } }] : []),

        { $sort: withTiebreaker({ createdAt: -1 }) },

        {
          $lookup: {
            from: QualCourseSubscription.collection.name,
            localField: "_id",
            foreignField: "course",
            as: "subscriptions",
          },
        },

        {
          $addFields: {
            totalSubscribers: { $size: "$subscriptions" },
          },
        },

        {
          $project: {
            subscriptions: 0,
          },
        },

        {
          $lookup: {
            from: QualCourseType.collection.name,
            localField: "courseType",
            foreignField: "_id",
            as: "courseType",
          },
        },
        { $unwind: { path: "$courseType", preserveNullAndEmptyArrays: true } },

        {
          $project: {
            title: 1,
            creditHours: 1,
            price: 1,
            form: 1,
            listenersLimit: 1,
            startDate: 1,
            endDate: 1,
            address: 1,
            location: 1,
            status: 1,
            active: 1,
            totalSubscribers: 1,
            courseType: { _id: "$courseType._id", title: "$courseType.title" },
          },
        },
      ];

      const aggregate = QualCourse.aggregate(pipeline);

      const doc = await QualCourse.aggregatePaginate(aggregate, options);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualCourses", err.message),
      );
    }
  },

  findOneQualCourse: async (req, res, next) => {
    try {
      let doc = await QualCourse.findById(req.params.id)
        .populate([
          { path: "courseType", select: "title" },
          { path: "teachers", select: "firstName lastName middleName" },
        ])
        .setOptions({ strictPopulate: false })
        .exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      const obj = doc.toObject();
      obj.status = computeCourseStatus(obj.startDate, obj.endDate);
      return res.status(200).json(obj);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualCourse", err.message),
      );
    }
  },

  updateQualCourse: async (req, res, next) => {
    try {
      const doc = await QualCourse.findOneAndUpdate(
        { _id: req.params.id, status: 1 },
        req.body,
        { new: true },
      );

      if (!doc) {
        return res
          .status(400)
          .json({ message: "Course not found or not editable (only planned)" });
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualCourse", err.message),
      );
    }
  },

  deleteQualCourse: async (req, res, next) => {
    try {
      const doc = await QualCourse.findByIdAndUpdate(req.params.id, {
        active: false,
      });

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualCourse", err.message),
      );
    }
  },
};
