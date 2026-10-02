const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  VerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const ObjectId = mongoose.Schema.Types.ObjectId;

const FORM_VERSIONS = ["v259", "v142"];
const CHAINS = {
  v259: ["teacher", "kafedra", "arm", "methodical", "dean"],
  v142: ["teacher", "kafedra", "dean"],
};
const LEGACY_STEPS = ["prorektor", "rektor"];
const ALL_STEPS = [
  ...new Set([...Object.values(CHAINS).flat(), ...LEGACY_STEPS]),
];

function buildChainSteps(formVersion) {
  const chain = formVersion === "v142" ? CHAINS.v142 : CHAINS.v259;
  return chain.map((step) => ({ step }));
}

const TOPIC_TYPES = [
  "maruza",
  "amaliy",
  "seminar",
  "laboratoriya",
  "klinik_amaliyot",
];

const TOPIC_CODE_PREFIX = Object.freeze({
  maruza: "M",
  amaliy: "A",
  seminar: "S",
  laboratoriya: "L",
  klinik_amaliyot: "K",
});

const EDUCATION_FORMS = ["kunduzgi", "sirtqi", "kechki", "masofaviy"];

const TopicSchema = new mongoose.Schema(
  {
    order: { type: Number, default: 0 },
    title: { type: String, required: true },
    desc:  { type: String, default: null },
  }
);

const TitleDescSchema = new mongoose.Schema(
  {
    title: { type: String, default: null },
    desc:  { type: String, default: null },
  }
);

const HourItemSchema = new mongoose.Schema(
  {
    slug:  { type: String, default: "" },
    title: { type: String, default: "" },
    value: { type: Number, default: 0 },
  }
);

const LiteratureGroupSchema = new mongoose.Schema(
  {
    slug:        { type: String, default: "" },
    title:       { type: String, default: "" },
    desc:        { type: String, default: null },
    literatures: { type: [String], default: [] },
  }
);

const ApprovalStepSchema = new mongoose.Schema(
  {
    step: {
      type: String,
      enum: ALL_STEPS,
      required: true,
    },
    label: { type: String, default: null },
    approvedBy: { type: ObjectId, ref: "user", default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    comment:   { type: String, default: null },
    protocol:  { type: String, default: null },
    signature: { type: String, default: null },
    eriSignature: { type: String, default: null },
    eriSerial:    { type: String, default: null },
    eriSignedAt:  { type: Date,   default: null },
    date:      { type: Date,   default: null },
  }
);

const V142PrerequisiteSchema = new mongoose.Schema(
  {
    code:  { type: String, default: null },
    title: { type: String, required: true },
  },
  { _id: false },
);

const V142OutcomeSchema = new mongoose.Schema(
  {
    code: { type: String, default: null },
    text: { type: String, required: true },
  },
  { _id: false },
);

const V142OutcomesSchema = new mongoose.Schema(
  {
    competencies: { type: [V142OutcomeSchema], default: [] },
    skills:       { type: [V142OutcomeSchema], default: [] },
  },
  { _id: false },
);

const V142TopicSchema = new mongoose.Schema(
  {
    type:  { type: String, enum: TOPIC_TYPES, required: true },
    code:  { type: String, maxlength: 8, default: null },
    title: { type: String, required: true },
    hours: { type: Number, min: 0, default: 0 },
    refs:  { type: [Number], default: [] },
  },
  { _id: false },
);

const V142IndependentTaskSchema = new mongoose.Schema(
  {
    order: { type: Number, default: 0 },
    title: { type: String, required: true },
    hours: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const V142GradingSchema = new mongoose.Schema(
  {
    a: { type: [String], default: [] },
    b: { type: [String], default: [] },
    d: { type: [String], default: [] },
    e: { type: [String], default: [] },
  },
  { _id: false },
);

const V142PersonSchema = new mongoose.Schema(
  {
    fio:        { type: String, required: true },
    degree:     { type: String, default: null },
    title:      { type: String, default: null },
    department: { type: String, default: null },
    position:   { type: String, default: null },
  },
  { _id: false },
);

const V142ProtocolSchema = new mongoose.Schema(
  {
    date:   { type: Date,   default: null },
    number: { type: String, maxlength: 20, default: null },
  },
  { _id: false },
);

const V142Schema = new mongoose.Schema(
  {
    educationForm: { type: String, enum: EDUCATION_FORMS, default: "kunduzgi" },
    prerequisites: { type: [V142PrerequisiteSchema], default: [] },
    outcomes:      { type: V142OutcomesSchema, default: () => ({}) },
    topics:        { type: [V142TopicSchema], default: [] },
    independentTasks: { type: [V142IndependentTaskSchema], default: [] },
    independentNote: { type: String, default: null },
    techMethods:   { type: [String], default: [] },
    grading:       { type: V142GradingSchema, default: () => ({}) },
    authors:       { type: [V142PersonSchema], default: [] },
    reviewers:     { type: [V142PersonSchema], default: [] },
    councilProtocol:    { type: V142ProtocolSchema, default: () => ({}) },
    departmentProtocol: { type: V142ProtocolSchema, default: () => ({}) },
  },
  { _id: false },
);

const ScienceProgramSchema = new mongoose.Schema(
  {
    title: { type: String, default: null },

    confirmation: {
      confirm:  { type: String, default: null },
      position: { type: String, default: null },
      rector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      desc:      { type: String, default: null },
      signature: { type: String, default: null },
      date:      { type: String, default: null },
    },

    science:    { type: ObjectId, ref: "science", required: true },
    label:      { type: String, default: null },
    directions: { type: [{ type: ObjectId, ref: "direction" }], default: [] },

    studyPlan: { type: ObjectId, ref: "studyPlan", default: null },
    workingPlan: { type: ObjectId, ref: "workingPlan", default: null },

    knowledgeArea: { type: [{ type: String }], default: [] },
    educationArea: { type: [{ type: String }], default: [] },

    code:         { type: String, default: null },
    serialNumber: { type: String, default: null },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },
    semester:     { type: String, default: null },
    courseRef:    { type: ObjectId, ref: "course", default: null },
    credits:      { type: Number, default: null },
    moduleType:   { type: String, default: null },
    language:     { type: String, default: null },
    weeklyHours:  { type: Number, default: null },
    classroomHours:   { type: Number, default: null },
    independentHours: { type: Number, default: null },
    totalHours:       { type: Number, default: null },

    hourItems: { type: [HourItemSchema], default: [] },

    lectureHours:   { type: Number, default: null },
    seminarHours:   { type: Number, default: null },
    labHours:       { type: Number, default: null },
    practicalHours: { type: Number, default: null },

    scienceEssence: {
      title: { type: String, default: null },
      sciencePurpose: { type: TitleDescSchema, default: () => ({}) },
      scienceTasks:   { type: TitleDescSchema, default: () => ({}) },
    },

    theoretical: {
      title:  { type: String, default: null },
      desc:   { type: String, default: null },
      topics: { type: [TopicSchema], default: [] },
    },

    seminarRecommendation: { type: TitleDescSchema, default: null },

    independentTask: { type: TitleDescSchema, default: null },

    learningOutcome: {
      title:           { type: String, default: null },
      learningOutcome: { type: String, default: null },
      desc:            { type: String, default: null },
    },

    teachingMethods: { type: TitleDescSchema, default: null },

    creditRequirements: { type: TitleDescSchema, default: null },

    literatureGroups: { type: [LiteratureGroupSchema], default: [] },

    guidanceLiterature:   { type: TitleDescSchema, default: null },
    primaryLiterature:    { type: TitleDescSchema, default: null },
    additionalLiterature: { type: TitleDescSchema, default: null },
    informationSource:    { type: TitleDescSchema, default: null },

    approval_info: { type: String, default: null },

    responsible: { type: TitleDescSchema, default: null },

    reviewer:    { type: TitleDescSchema, default: null },

    formVersion: { type: String, enum: FORM_VERSIONS, default: "v259" },

    v142: { type: V142Schema, default: undefined },

    approvalSteps: {
      type: [ApprovalStepSchema],
      default: () => buildChainSteps("v259"),
    },

    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "rejected"],
      default: "draft",
    },

    barcode: { type: String, default: null },
    file:    { type: String, default: null },

    location: { type: String, default: null },

    active: { type: Boolean, default: true },
    user:   { type: ObjectId, ref: "user", required: true },

    verify: {
      token: { type: String },
      issuedAt: { type: Date, default: null },
      issuedBy: { type: ObjectId, ref: "user", default: null },
      revokedAt: { type: Date, default: null },
      revokedReason: { type: String, default: null },
      snapshot: { type: [VerifySnapshotSchema], default: [] },
    },
  },
  { timestamps: true, versionKey: false },
);

ScienceProgramSchema.index({ science: 1, academicYear: 1, semester: 1 });
ScienceProgramSchema.index({ status: 1 });
ScienceProgramSchema.index({ directions: 1 });
ScienceProgramSchema.index({ studyPlan: 1 });
ScienceProgramSchema.index({ workingPlan: 1 });
ScienceProgramSchema.index(
  { "verify.token": 1 },
  {
    unique: true,
    partialFilterExpression: { "verify.token": { $type: "string" } },
  },
);

ScienceProgramSchema.plugin(mongoosePaginate);
ScienceProgramSchema.plugin(aggregatePaginate);
ScienceProgramSchema.plugin(require("#shared/softDeletePlugin"));

module.exports = mongoose.model("scienceProgram", ScienceProgramSchema);
module.exports.FORM_VERSIONS = FORM_VERSIONS;
module.exports.CHAINS = CHAINS;
module.exports.LEGACY_STEPS = LEGACY_STEPS;
module.exports.buildChainSteps = buildChainSteps;
module.exports.TOPIC_TYPES = TOPIC_TYPES;
module.exports.TOPIC_CODE_PREFIX = TOPIC_CODE_PREFIX;
module.exports.EDUCATION_FORMS = EDUCATION_FORMS;
