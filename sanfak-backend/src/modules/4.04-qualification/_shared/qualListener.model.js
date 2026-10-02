const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualListenerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    lastSeen: {
      type: Date,
    },
    passport: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualListenerSchema.plugin(mongoosePaginate);
QualListenerSchema.plugin(aggregatePaginate);

const model = mongoose.model("QualListener", QualListenerSchema);

module.exports = model;
