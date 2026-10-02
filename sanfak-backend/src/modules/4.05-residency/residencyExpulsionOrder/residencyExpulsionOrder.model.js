const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const EXPULSION_ORDER_STATUSES = [
  "loyiha",
  "imzolangan",
  "bekor_qilingan",
  "rad_etilgan",
];
const ORDER_OPEN = "loyiha";
const ORDER_SIGNED = "imzolangan";
const ORDER_REJECTED = "rad_etilgan";

const ORDER_ORIGINS = ["tizim", "meros"];

const CLOSE_REASONS = [
  "soat_72_dan_past",
  "yangi_oquv_yili",
  "rezident_ochirildi",
  "migratsiya_qaytarildi",
  "imzolangan_buyruq_bor",
  "yaroqsiz_loyiha",
];

const HISTORY_ACTIONS = [
  "yaratildi",
  "migratsiya",
  "bekor_qilindi",
  "skan_yuklandi",
  "imzolandi",
  "rad_etildi",
  "asos_72_dan_past",
  "pdf_yaratildi",
];

const HISTORY_SOURCES = [
  "attendance",
  "cron",
  "application",
  "resident_delete",
  "migration",
  "office",
  "runbook",
  "sams",
];

const HistorySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    action: { type: String, enum: HISTORY_ACTIONS, required: true },
    source: { type: String, enum: HISTORY_SOURCES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    actorName: { type: String, default: null },
    hours: { type: Number, default: null },
    note: { type: String, default: null },
  },
  { _id: false },
);

const ScanSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true },
    fileName: { type: String, default: null },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    uploadedByName: { type: String, default: null },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
);

const DraftPdfSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true },
    fileName: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    hours: { type: Number, required: true },
    templateVersion: { type: Number, required: true },
    generatedAt: { type: Date, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    generatedByName: { type: String, default: null },
  },
  { _id: false },
);

const DeliveriesSchema = new mongoose.Schema(
  {
    signed: { type: Date, default: null },
    rejected: { type: Date, default: null },
    basisLost: { type: Date, default: null },
  },
  { _id: false },
);

const ResidencyExpulsionOrderSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      immutable: true,
    },
    residentName: { type: String, default: null },
    origin: { type: String, enum: ORDER_ORIGINS, required: true, immutable: true },

    status: { type: String, enum: EXPULSION_ORDER_STATUSES, required: true },

    countingYear: { type: String, required: true },
    draftedAt: { type: Date, required: true },
    hoursAtDraft: { type: Number, default: null },
    noticesSentAt: { type: Date, default: null },
    remindedStage: { type: Number, default: null },

    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    closedByName: { type: String, default: null },
    closeReason: { type: String, enum: [...CLOSE_REASONS, null], default: null },
    hoursAtClose: { type: Number, default: null },
    closeNote: { type: String, default: null },

    paperOrderNumber: { type: String, default: null },
    paperOrderDate: { type: String, default: null },
    scan: { type: ScanSchema, default: null },
    draftPdf: { type: DraftPdfSchema, default: null },

    signedAt: { type: Date, default: null },
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    signedByName: { type: String, default: null },
    hoursAtSign: { type: Number, default: null },
    eriSerialNumber: { type: String, default: null },
    eriSubject: { type: String, default: null },
    eriSignedAt: { type: Date, default: null },
    residentAppliedAt: { type: Date, default: null },
    basisLostAt: { type: Date, default: null },
    hoursAtBasisLost: { type: Number, default: null },
    deliveries: { type: DeliveriesSchema, default: () => ({}) },

    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

ResidencyExpulsionOrderSchema.plugin(mongoosePaginate);

ResidencyExpulsionOrderSchema.index(
  { resident: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ORDER_OPEN },
    name: "resident_open_unique",
  },
);

ResidencyExpulsionOrderSchema.index({ resident: 1, createdAt: -1 });

ResidencyExpulsionOrderSchema.index({ status: 1, draftedAt: -1 }, { name: "status_draftedAt" });

const ResidencyExpulsionOrderModel = mongoose.model(
  "residencyExpulsionOrder",
  ResidencyExpulsionOrderSchema,
);

module.exports = ResidencyExpulsionOrderModel;
module.exports.EXPULSION_ORDER_STATUSES = EXPULSION_ORDER_STATUSES;
module.exports.ORDER_OPEN = ORDER_OPEN;
module.exports.ORDER_SIGNED = ORDER_SIGNED;
module.exports.ORDER_REJECTED = ORDER_REJECTED;
module.exports.ORDER_ORIGINS = ORDER_ORIGINS;
module.exports.CLOSE_REASONS = CLOSE_REASONS;
module.exports.HISTORY_ACTIONS = HISTORY_ACTIONS;
module.exports.HISTORY_SOURCES = HISTORY_SOURCES;
module.exports.OPEN_INDEX_NAME = "resident_open_unique";
