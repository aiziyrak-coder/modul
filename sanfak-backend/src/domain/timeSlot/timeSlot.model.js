const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const TimeSlotSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    order: { type: Number },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

TimeSlotSchema.plugin(mongoosePaginate);
TimeSlotSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("timeSlot", TimeSlotSchema);
