const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  VerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const ObjectId = mongoose.Schema.Types.ObjectId;

const HourItemSchema = new mongoose.Schema(
  {
    slug:  { type: String, default: "" },
    title: { type: String, default: "" },
    value: { type: Number, default: 0 },
  }
);

const TopicSchema = new mongoose.Schema(
  {
    topic: { type: String, default: null },
    hour:  { type: Number, default: 0 },
  }
);

const WeekScheduleItemSchema = new mongoose.Schema(
  {
    week:  { type: Number, default: 0 },
    topic: { type: String, default: null },
    type:  { type: String, default: null },
    hour:  { type: Number, default: 0 },
  }
);

const GradingCriterionSchema = new mongoose.Schema(
  {
    slug:  { type: String, default: "" },
    title: { type: String, default: "" },
    desc:  { type: String, default: null },
  }
);

const LiteratureGroupSchema = new mongoose.Schema(
  {
    slug:        { type: String, default: "" },
    title:       { type: String, default: "" },
    literatures: { type: [String], default: [] },
  }
);

const ApprovalStepSchema = new mongoose.Schema(
  {
    step: {
      type: String,
      enum: ["kafedra", "arm", "methodical", "dean", "prorektor"],
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
    signature: { type: String, default: null },
    protocol:  { type: String, default: null },
    eriSignature: { type: String, default: null },
    eriSerial:    { type: String, default: null },
    eriSignedAt:  { type: Date,   default: null },
    date:      { type: Date,   default: null },
  }
);

const SyllabusSchema = new mongoose.Schema(
  {
    title: { type: String, default: null },

    confirmation: {
      confirm:   { type: String, default: null },
      position:  { type: String, default: null },
      viceRector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date:      { type: String, default: null },
    },

    scienceProgram: { type: ObjectId, ref: "scienceProgram", default: null },

    workload:             { type: ObjectId, ref: "workload", default: null },
    workloadDistribution: { type: ObjectId, ref: "workloadDistribution", default: null },

    science:      { type: ObjectId, ref: "science", required: true },
    scienceLabel: { type: String, default: null },
    label:        { type: String, default: null },
    directions:   { type: [{ type: ObjectId, ref: "direction" }], default: [] },

    syllabus: { type: String, default: null },
    faculty:  { type: ObjectId, ref: "faculty", required: true },

    scienceTitle: { type: String, default: null },
    scienceType:  { type: String, default: null },
    scienceCode:  { type: String, default: null },
    year:         { type: Number, default: 0 },
    semester:     { type: Number, default: 0 },
    courseRef:    { type: ObjectId, ref: "course", default: null },
    educationForm: { type: String, default: null },

    hoursByType: {
      title:      { type: String, default: null },
      totalHours: { type: Number, default: 0 },
      items: { type: [HourItemSchema], default: [] },
    },

    credits:        { type: Number, default: 0 },
    evaluationForm: { type: String, default: null },
    scienceLang:    { type: String, default: null },

    sciencePurpose: {
      title: { type: String, default: null },
      desc:  { type: String, default: null },
    },

    prerequisiteKnowledge: {
      title: { type: String, default: null },
      desc:  { type: String, default: null },
    },

    learningOutcome: {
      title:             { type: String, default: null },
      knowledgeAspect:   { type: String, default: null },
      knowledgeOutcomes: { type: [String], default: [] },
      skillsAspect:      { type: String, default: null },
      skillOutcomes:     { type: [String], default: [] },
    },

    scienceContent: {
      title:  { type: String, default: null },
      desc:   { type: String, default: null },
      topics: { type: [TopicSchema], default: [] },
    },

    trainingSeminar: {
      title:  { type: String, default: null },
      topics: { type: [TopicSchema], default: [] },
    },

    independent: {
      title:  { type: String, default: null },
      topics: { type: [TopicSchema], default: [] },
    },

    literatureGroups: { type: [LiteratureGroupSchema], default: [] },

    evaluationCriteria: {
      title:    { type: String, default: null },
      criteria: { type: [GradingCriterionSchema], default: [] },
    },

    author: {
      teacher:      { type: ObjectId, ref: "user", default: null },
      email:        { type: String, default: null },
      organization: { type: String, default: null },
      reviewer: {
        title: { type: String, default: null },
        desc:  { type: String, default: null },
      },
    },

    desc: { type: String, default: null },

    weeklySchedule: {
      title: { type: String, default: null },
      weeks: { type: [WeekScheduleItemSchema], default: [] },
    },

    submissionRules: {
      title: { type: String, default: null },
      desc:  { type: String, default: null },
    },

    contactInfo: {
      title:    { type: String, default: null },
      schedule: { type: String, default: null },
      room:     { type: String, default: null },
      phone:    { type: String, default: null },
      desc:     { type: String, default: null },
    },

    methodicalHead: {
      position:  { type: String, default: null },
      leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date:      { type: String, default: null },
    },
    facultyDean: {
      position:  { type: String, default: null },
      dean: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date:      { type: String, default: null },
    },
    departmentHead: {
      position:  { type: String, default: null },
      manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date:      { type: String, default: null },
    },
    creator: {
      position:  { type: String, default: null },
      teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date:      { type: String, default: null },
    },

    approvalSteps: {
      type: [ApprovalStepSchema],
      default: () => [
        { step: "kafedra" },
        { step: "arm" },
        { step: "methodical" },
        { step: "dean" },
        { step: "prorektor" },
      ],
    },

    status: {
      type: String,
      enum: ["draft", "new", "in_review", "approved", "rejected"],
      default: "draft",
    },

    submittedAt: { type: Date, default: null },

    location: { type: String, default: null },

    file:   { type: String, default: null },
    active: { type: Boolean, default: true },

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

SyllabusSchema.index({ science: 1, "author.teacher": 1, year: 1 });
SyllabusSchema.index({ scienceProgram: 1 });
SyllabusSchema.index({ status: 1 });
SyllabusSchema.index({ workload: 1 });
SyllabusSchema.index({ workloadDistribution: 1 });
SyllabusSchema.index(
  { "verify.token": 1 },
  {
    unique: true,
    partialFilterExpression: { "verify.token": { $type: "string" } },
  },
);

SyllabusSchema.plugin(mongoosePaginate);
SyllabusSchema.plugin(aggregatePaginate);
SyllabusSchema.plugin(require("#shared/softDeletePlugin"));

module.exports = mongoose.model("syllabus", SyllabusSchema);
