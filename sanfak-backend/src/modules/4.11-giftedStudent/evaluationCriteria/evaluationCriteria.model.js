const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  points: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
});

const EvaluationCriteriaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    icon: { type: String },
    maxPoints: { type: Number },
    categories: [CategorySchema],
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

EvaluationCriteriaSchema.plugin(mongoosePaginate);
EvaluationCriteriaSchema.plugin(aggregatePaginate);
EvaluationCriteriaSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("evaluationCriteria", EvaluationCriteriaSchema);
