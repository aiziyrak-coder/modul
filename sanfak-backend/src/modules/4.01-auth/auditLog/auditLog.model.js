const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const AuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    userName: {
      type: String,
    },
    action: {
      type: String,
      required: true,
    },
    module: {
      type: String,
    },
    method: {
      type: String,
    },
    path: {
      type: String,
    },
    statusCode: {
      type: Number,
    },
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
    },
    requestQuery: { type: Object },
    responseTime: {
      type: Number,
    },
    targetId: { type: String, index: true },
    ip: { type: String },
    userAgent: { type: String },
    files: { type: [String], default: undefined },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

const APPEND_ONLY_MESSAGE =
  "Audit jurnali o'zgartirilmaydi (append-only, TZ 1.3). Yozuvni tahrirlash yoki o'chirish taqiqlangan.";

const blockWrite = function blockWrite(next) {
  next(new Error(APPEND_ONLY_MESSAGE));
};

[
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
  "findOneAndRemove",
].forEach((op) => AuditLogSchema.pre(op, blockWrite));

AuditLogSchema.pre("save", function preventUpdate(next) {
  if (this.isNew) return next();
  return next(new Error(APPEND_ONLY_MESSAGE));
});

AuditLogSchema.plugin(mongoosePaginate);
AuditLogSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("auditLog", AuditLogSchema);
