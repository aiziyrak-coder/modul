const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const CouncilMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "department" },
    canVote: { type: Boolean, default: true },
    role: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

CouncilMemberSchema.plugin(mongoosePaginate);
CouncilMemberSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("councilMember", CouncilMemberSchema);
