const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualContractSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    listener: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualListener",
      required: true,
    },
    petition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualPetition",
      required: true,
    },
    number: {
      type: String,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    debitPrice: {
      type: Number,
      required: true,
    },
    file: {
      type: String,
    },
    fileDetails: {
      type: Object,
    },
  },
  { timestamps: true, versionKey: false },
);

QualContractSchema.plugin(mongoosePaginate);
QualContractSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualContract", QualContractSchema);

module.exports = model;
