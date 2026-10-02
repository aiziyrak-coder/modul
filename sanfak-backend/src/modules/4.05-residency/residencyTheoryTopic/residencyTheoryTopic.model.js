const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const ResidencyTheoryTopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyTheoryTopicSchema.index(
  { title: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

ResidencyTheoryTopicSchema.plugin(mongoosePaginate);
ResidencyTheoryTopicSchema.plugin(aggregatePaginate);
ResidencyTheoryTopicSchema.plugin(softDeletePlugin);

module.exports = mongoose.model(
  "residencyTheoryTopic",
  ResidencyTheoryTopicSchema,
);
