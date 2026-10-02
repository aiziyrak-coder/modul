const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualPaymentSchema = new mongoose.Schema(
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
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualContract",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    method: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: Number,
      required: true,
    },
    click: {
      type: Object,
      default: null,
    },
    payme: {
      type: Object,
      default: null,
    },
    bank: {
      type: Object,
      default: null,
    },
    transactionId: {
      type: String,
    },
  },
  { timestamps: true, versionKey: false },
);

QualPaymentSchema.plugin(mongoosePaginate);
QualPaymentSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualPayment", QualPaymentSchema);

module.exports = model;
