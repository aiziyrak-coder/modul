const { ErrorHandler } = require("#shared/error");
const ObjectId = require("mongoose").Types.ObjectId;
const ScheduleModel = require("#domain/schedule/schedule.model");

module.exports = {
  addSchedule: async (req, res, next) => {
    try {
      const doc = await new ScheduleModel(req.body).save();
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add schedule", err.message));
    }
  },

  findAllSchedules: async (req, res, next) => {
    try {
      const { search, semester, academicYear, dayOfWeek } = req.query;
      let data = {};
      if (semester) data["semester"] = parseInt(semester);
      if (academicYear) data["academicYear"] = academicYear;
      if (dayOfWeek) data["dayOfWeek"] = parseInt(dayOfWeek);

      const docs = await ScheduleModel.find(data, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate("science")
        .populate("teacher")
        .populate("room")
        .populate("timeSlot")
        .populate("group")
        .populate("academicYear", "title")

        .exec();
      if (!docs) return res.status(404).json({ message: "not found" });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find schedules", err.message),
      );
    }
  },

  paginateSchedules: async (req, res, next) => {
    try {
      const { semester, academicYear, dayOfWeek, page, limit } = req.query;
      let data = {};
      if (semester) data["semester"] = parseInt(semester);
      if (academicYear) data["academicYear"] = academicYear;
      if (dayOfWeek) data["dayOfWeek"] = parseInt(dayOfWeek);

      const options = {
        limit: parseInt(limit),
        page: parseInt(page),
        select: ["-createdAt", "-updatedAt"],
        populate: ["science", "teacher", "room", "timeSlot", "group"],
      };
      const doc = await ScheduleModel.paginate(data, options);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate schedules", err.message),
      );
    }
  },

  findOneSchedule: async (req, res, next) => {
    try {
      let doc = await ScheduleModel.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate("science")
        .populate("teacher")
        .populate("room")
        .populate("timeSlot")
        .populate("group")
        .populate("academicYear", "title")

        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find schedule", err.message),
      );
    }
  },

  updateSchedule: async (req, res, next) => {
    try {
      const doc = await ScheduleModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update schedule", err.message),
      );
    }
  },

  deleteSchedule: async (req, res, next) => {
    try {
      const doc = await ScheduleModel.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete schedule", err.message),
      );
    }
  },

  getScheduleByGroup: async (req, res, next) => {
    try {
      const { group } = req.params;
      const docs = await ScheduleModel.find(
        { group },
        {
          createdAt: 0,
          updatedAt: 0,
        },
      )
        .populate("science")
        .populate("teacher")
        .populate("room")
        .populate("timeSlot")
        .populate("academicYear", "title")
        .sort({ dayOfWeek: 1 })

        .exec();
      if (!docs) return res.status(404).json({ message: "not found" });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get schedule by group", err.message),
      );
    }
  },

  getScheduleByTeacher: async (req, res, next) => {
    try {
      const { teacher } = req.params;
      const docs = await ScheduleModel.find(
        { teacher },
        {
          createdAt: 0,
          updatedAt: 0,
        },
      )
        .populate("science")
        .populate("teacher")
        .populate("room")
        .populate("timeSlot")
        .populate("academicYear", "title")
        .sort({ dayOfWeek: 1 })

        .exec();
      if (!docs) return res.status(404).json({ message: "not found" });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get schedule by teacher", err.message),
      );
    }
  },

  checkConflict: async (req, res, next) => {
    try {
      const { dayOfWeek, timeSlot, room, teacher } = req.body;

      if (!dayOfWeek || !timeSlot) {
        return res
          .status(400)
          .json({ message: "dayOfWeek and timeSlot are required" });
      }

      const roomConflict = room
        ? await ScheduleModel.findOne({ dayOfWeek, timeSlot, room }).exec()
        : null;

      const teacherConflict = teacher
        ? await ScheduleModel.findOne({
            dayOfWeek,
            timeSlot,
            teacher,
          }).exec()
        : null;

      const conflicts = [];
      if (roomConflict) {
        conflicts.push({
          type: "room",
          message: "Room is already occupied at this time slot",
          schedule: roomConflict,
        });
      }
      if (teacherConflict) {
        conflicts.push({
          type: "teacher",
          message: "Teacher already has a schedule at this time slot",
          schedule: teacherConflict,
        });
      }

      if (conflicts.length > 0) {
        return res
          .status(409)
          .json({ message: "conflict detected", conflicts });
      }

      return res.status(200).json({ message: "no conflict", conflicts: [] });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to check conflict", err.message),
      );
    }
  },
};
