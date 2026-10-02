const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");

const PROGRAMS = ["magistratura", "ordinatura"];
const NOTICE_STATUSES = ["yangi", "kutilmoqda", "korib_chiqilgan"];

const CLIENT_NOTICE_KINDS = ["oddiy", "davomat"];
const NOTICE_KIND_AUTO = "avtomatik";
const NOTICE_KINDS = [...CLIENT_NOTICE_KINDS, NOTICE_KIND_AUTO];

const AUTO_STATE_ACTIVE = "faol";
const AUTO_STATE_REVOKED = "bekor_qilingan";
const AUTO_STATES = [AUTO_STATE_ACTIVE, AUTO_STATE_REVOKED];
const AUTO_INDEX_NAME = "resident_year_auto_faol_unique";

function isAutoKind() {
  return this.kind === NOTICE_KIND_AUTO;
}
function isClientKind() {
  return this.kind !== NOTICE_KIND_AUTO;
}

const AutoSchema = new mongoose.Schema(
  {
    countingYear: { type: String, required: true },
    state: { type: String, enum: AUTO_STATES, required: true },
    hoursAtIssue: { type: Number, required: true },
    templateVersion: { type: Number, required: true },
    notifiedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    hoursAtRevoke: { type: Number, default: null },
  },
  { _id: false },
);

const ResidencyNoticeSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: isClientKind,
      index: true,
    },
    senderName: { type: String, default: null },
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      default: null,
      required: isAutoKind,
      index: true,
    },
    program: { type: String, enum: PROGRAMS, required: true, index: true },
    academicYear: { type: String, default: null, index: true },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: NOTICE_STATUSES,
      default: "yangi",
      index: true,
    },
    kind: {
      type: String,
      enum: NOTICE_KINDS,
      default: "oddiy",
      index: true,
    },

    absence: {
      type: new mongoose.Schema(
        {
          days: { type: Number, required: true, min: 1 },
          from: { type: String, required: true },
          to: { type: String, required: true },
          windowDays: { type: Number, default: null, min: 1 },
          windowFrom: { type: String, default: null },
          windowTo: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },

    document: {
      type: new mongoose.Schema(
        {
          storageKey: { type: String, required: true },
          fileName: { type: String, required: true },
          size: { type: Number, required: true },
          sha256: { type: String, required: true },
          generatedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },

    auto: { type: AutoSchema, default: null, required: isAutoKind },

    decision: { type: String, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    reviewedByName: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyNoticeSchema.index(
  { resident: 1, "auto.countingYear": 1 },
  {
    unique: true,
    partialFilterExpression: { "auto.state": AUTO_STATE_ACTIVE },
    name: AUTO_INDEX_NAME,
  },
);

ResidencyNoticeSchema.plugin(mongoosePaginate);
ResidencyNoticeSchema.plugin(softDeletePlugin);

ResidencyNoticeSchema.plugin(academicYearRefPlugin);

const ResidencyNoticeModel = mongoose.model("residencyNotice", ResidencyNoticeSchema);

module.exports = ResidencyNoticeModel;
module.exports.NOTICE_STATUSES = NOTICE_STATUSES;
module.exports.NOTICE_KINDS = NOTICE_KINDS;
module.exports.CLIENT_NOTICE_KINDS = CLIENT_NOTICE_KINDS;
module.exports.NOTICE_KIND_AUTO = NOTICE_KIND_AUTO;
module.exports.AUTO_STATES = AUTO_STATES;
module.exports.AUTO_STATE_ACTIVE = AUTO_STATE_ACTIVE;
module.exports.AUTO_STATE_REVOKED = AUTO_STATE_REVOKED;
module.exports.AUTO_INDEX_NAME = AUTO_INDEX_NAME;
module.exports.PROGRAMS = PROGRAMS;
