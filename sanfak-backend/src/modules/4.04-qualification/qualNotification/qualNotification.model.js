const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualNotificationSchema.plugin(mongoosePaginate);
QualNotificationSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualNotification", QualNotificationSchema);

module.exports = model;
