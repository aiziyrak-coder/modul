const { ErrorHandler } = require("#shared/error");
const ObjectId = require("mongoose").Types.ObjectId;
const TimeSlotModel = require("#domain/timeSlot/timeSlot.model");

module.exports = {
  addTimeSlot: async (req, res, next) => {
    try {
      const doc = await new TimeSlotModel(req.body).save();
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add time slot", err.message),
      );
    }
  },

  findAllTimeSlots: async (req, res, next) => {
    try {
      const { search } = req.query;
      let data = {};
      if (search) data["title"] = { $regex: new RegExp(search, "i") };

      const docs = await TimeSlotModel.find(data, {
        createdAt: 0,
        updatedAt: 0,
      })
        .sort({ order: 1 })

        .exec();
      if (!docs) return res.status(404).json({ message: "not found" });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find time slots", err.message),
      );
    }
  },

  updateTimeSlot: async (req, res, next) => {
    try {
      const doc = await TimeSlotModel.findByIdAndUpdate(
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
        new ErrorHandler(400, "Failed to update time slot", err.message),
      );
    }
  },

  deleteTimeSlot: async (req, res, next) => {
    try {
      const doc = await TimeSlotModel.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete time slot", err.message),
      );
    }
  },
};
