const { ErrorHandler } = require("#shared/error");
const { MODULES, ACTIONS } = require("#config/constants");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");

async function teacherRoleIds() {
  const roles = await Role.find({
    active: true,
    permissions: {
      $elemMatch: {
        section: MODULES.QUAL_TOPIC_LECTURE,
        actionKeys: ACTIONS.CREATE,
      },
    },
  }).select("_id");
  return roles.map((r) => r._id);
}

module.exports = {
  findAllTeachers: async (req, res, next) => {
    try {
      const { search } = req.query;

      const query = { role: { $in: await teacherRoleIds() } };

      if (search) {
        const regex = new RegExp(search, "i");

        query.$or = [
          { firstName: regex },
          { lastName: regex },
          { middleName: regex },
        ];
      }

      const docs = await User.find(query)
        .populate({
          path: "department",
          select: "title",
        })
        .sort({ createdAt: 1 })
        .setOptions({ strictPopulate: false });

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find Teachers", err.message),
      );
    }
  },

  paginateTeachers: async (req, res, next) => {
    try {
      const { page, limit, search } = req.query;

      const query = { role: { $in: await teacherRoleIds() } };

      if (search) {
        const regex = new RegExp(search, "i");

        query.$or = [
          { firstName: regex },
          { lastName: regex },
          { middleName: regex },
          { passportSeria: regex },
        ];
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: 1 },
        strictPopulate: false,
        populate: [
          {
            path: "department",
            select: "title",
          },
        ],
      };

      const doc = await User.paginate(query, options);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate Teachers", err.message),
      );
    }
  },

  findAllQualCourseTeachers: async (req, res, next) => {
    try {
      const { course } = req.query;

      if (!course)
        return res.status(400).json({ message: "Course id required" });

      const courseDoc = await QualCourse.findById(course)
        .select("teachers")
        .populate({
          path: "teachers",
          select: "firstName lastName middleName department",
          populate: {
            path: "department",
            select: "title",
          },
        });

      if (!courseDoc) {
        return res.status(404).json({ message: "not found" });
      }

      return res.status(200).json(courseDoc.teachers || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualCourseTeachers", err.message),
      );
    }
  },

  paginateQualCourseTeachers: async (req, res, next) => {
    try {
      const { page, limit, course } = req.query;

      if (!course)
        return res.status(400).json({ message: "Course id required" });

      const courseDoc = await QualCourse.findById(course).select("teachers");

      if (!courseDoc) {
        return res.status(404).json({ message: "not found" });
      }

      const query = {
        _id: { $in: courseDoc.teachers || [] },
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: 1 },
        select: "firstName lastName middleName department",

        strictPopulate: false,
        populate: [
          {
            path: "department",
            select: "title",
          },
        ],
      };

      const doc = await User.paginate(query, options);

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualTeachers", err.message),
      );
    }
  },

  addTeachersToCourse: async (req, res, next) => {
    try {
      const { course, teachers } = req.body;

      if (!course)
        return res.status(400).json({ message: "Course id required" });

      if (!teachers?.length)
        return res.status(400).json({ message: "Teachers required" });

      const doc = await QualCourse.findByIdAndUpdate(
        course,
        {
          $addToSet: {
            teachers: { $each: teachers },
          },
        },
        { new: true },
      ).populate({
        path: "teachers",
        select: "firstName lastName middleName department",
        populate: {
          path: "department",
          select: "title",
        },
      });

      if (!doc) {
        return res.status(404).json({ message: "not found" });
      }

      return res.status(200).json(doc.teachers);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add teachers to course", err.message),
      );
    }
  },

  removeTeachersFromCourse: async (req, res, next) => {
    try {
      const { course, teachers } = req.body;

      if (!course)
        return res.status(400).json({ message: "Course id required" });

      if (!teachers?.length)
        return res.status(400).json({ message: "Teachers required" });

      const doc = await QualCourse.findByIdAndUpdate(
        course,
        { $pull: { teachers: { $in: teachers } } },
        { new: true },
      ).populate({
        path: "teachers",
        select: "firstName lastName middleName department",
        populate: {
          path: "department",
          select: "title",
        },
      });

      if (!doc) {
        return res.status(404).json({ message: "not found" });
      }

      return res.status(200).json(doc.teachers);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to remove teachers from course",
          err.message,
        ),
      );
    }
  },
};
