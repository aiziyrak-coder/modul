const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualTopicScenarioSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualTopic",
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualTopicScenarioSchema.plugin(mongoosePaginate);
QualTopicScenarioSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualTopicScenario", QualTopicScenarioSchema);

module.exports = model;
