const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const RoomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    building: { type: String },
    capacity: {
      type: Number,
    },
    type: {
      type: String,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

RoomSchema.plugin(mongoosePaginate);
RoomSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("room", RoomSchema);
