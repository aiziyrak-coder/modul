const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { ErrorHandler } = require("#shared/error");
const QualContract = require("./qualContract.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
require("#modules/4.04-qualification/qualCourseType/qualCourseType.model");
const {
  getListenerId,
  listenerScope,
} = require("#modules/4.04-qualification/_shared/listenerContext");

const courseLookupStages = [
  {
    $lookup: {
      from: QualCourse.collection.name,
      localField: "course",
      foreignField: "_id",
      as: "course",
    },
  },
  { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
];

module.exports = {
  getMyContracts: async (req, res, next) => {
    try {
      const listenerId = await getListenerId(req);
      if (!listenerId) return res.status(200).json({ data: [] });

      const contracts = await QualContract.find({ listener: listenerId })
        .populate({
          path: "course",
          select: "title form creditHours startDate endDate courseType",
          populate: { path: "courseType", select: "title" },
        })
        .sort({ createdAt: -1 })
        .lean();

      const data = contracts
        .filter((c) => c.course)
        .map((c) => ({
          id: String(c._id),
          courseTitle: c.course.title,
          courseType: c.course.courseType ? c.course.courseType.title : "",
          form: c.course.form,
          creditHours: c.course.creditHours,
          startDate: c.course.startDate,
          endDate: c.course.endDate,
          totalPrice: c.totalPrice,
          file: c.file,
          createdAt: c.createdAt,
        }));

      return res.status(200).json({ data });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get my contracts", err.message),
      );
    }
  },

  findAllQualContracts: async (req, res, next) => {
    try {
      const { search, course } = req.query;
      const pipeline = [];

      const scope = await listenerScope(req, "listener");
      if (Object.keys(scope).length) pipeline.push({ $match: scope });

      pipeline.push({
        $lookup: {
          from: QualListener.collection.name,
          localField: "listener",
          foreignField: "_id",
          as: "listener",
        },
      });

      pipeline.push({ $unwind: "$listener" });

      if (course) {
        pipeline.push({ $match: { course: new ObjectId(course) } });
      }

      if (search) {
        pipeline.push({
          $match: {
            "listener.fullName": {
              $regex: search,
              $options: "i",
            },
          },
        });
      }

      pipeline.push(...courseLookupStages);

      const docs = await QualContract.aggregate(pipeline);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualContracts", err.message),
      );
    }
  },

  paginateQualContracts: async (req, res, next) => {
    try {
      const { page, limit, search, course } = req.query;
      const pipeline = [];

      const scope = await listenerScope(req, "listener");
      if (Object.keys(scope).length) pipeline.push({ $match: scope });

      pipeline.push({
        $lookup: {
          from: QualListener.collection.name,
          localField: "listener",
          foreignField: "_id",
          as: "listener",
        },
      });

      pipeline.push({ $unwind: "$listener" });

      if (course) {
        pipeline.push({ $match: { course: new ObjectId(course) } });
      }

      if (search) {
        pipeline.push({
          $match: {
            "listener.fullName": {
              $regex: search,
              $options: "i",
            },
          },
        });
      }

      pipeline.push(...courseLookupStages);

      const aggregate = QualContract.aggregate(pipeline);

      const options = {
        useFacet: false,
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const doc = await QualContract.aggregatePaginate(aggregate, options);

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualContracts", err.message),
      );
    }
  },

  findOneQualContract: async (req, res, next) => {
    try {
      const scope = await listenerScope(req, "listener");
      let doc = await QualContract.findOne({
        _id: req.params.id,
        ...scope,
      }).exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualContract", err.message),
      );
    }
  },

  deleteQualContract: async (req, res, next) => {
    try {
      const doc = await QualContract.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualContract", err.message),
      );
    }
  },
};
