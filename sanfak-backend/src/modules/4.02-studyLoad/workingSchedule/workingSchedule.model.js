const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const ApprovalStepSchema = require("#modules/4.02-studyLoad/_shared/approvalStep.schema");
const {
  VerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const StatisticItemSchema = {
  key: { type: String, default: null },
  slug: { type: String, default: "" },
  title: { type: String, default: "" },
  value: { type: Number, default: 0 },
};

const SummaryRowSchema = new mongoose.Schema(
  {
    key: { type: String, maxlength: 5 },
    title: { type: String, maxlength: 200 },
  },
  { _id: false },
);

const WorkingScheduleSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default:
        "OʻZBEKISTON RESPUBLIKASI SOGʻLIQNI SAQLASH VAZIRLIGI\n FARGʻONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI\n ISHCHI OʻQUV REJA\n ____/____ oʻquv yili\n  __ bosqich",
    },
    desc: {
      type: String,
      default:
        "Toshkent davlat tubbryot universiteti tomonidan ____-yil tasdiqlangan\noʻquv reja asosida ishlab chiqilgan",
    },
    attestationNote: { type: String, default: null, maxlength: 500 },
    summaryRows: { type: [SummaryRowSchema], default: undefined },
    title: {
      type: String,
      default: "",
      maxlength: 500,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },
    enrollmentYear: {
      type: String,
      required: true,
    },
    currentCourse: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    courseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
    },

    learningProcess: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "learningProcess",
      default: null,
    },

    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "group",
      },
    ],

    stage: {
      type: String,
      default: null,
    },

    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "direction",
      required: true,
    },
    academicLevel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicLevel",
      required: true,
    },
    readingForm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "readingForm",
      required: true,
    },
    educationForm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "educationForm",
      required: true,
    },
    studyPeriod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "studyPeriod",
      required: true,
    },
    specialization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "specialization",
      required: true,
    },
    agreed: {
      agree: { type: String, default: "ʻʻKELISHILDIʼʼ" },
      position: { type: String, default: "Oʻquv ishlari boʻyicha prorektor" },
      viceRector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: "202__yil ʻʻ___ʼʼ ____" },
    },
    confirmation: {
      confirm: { type: String, default: "ʻʻTASDIQLAYMANʼʼ" },
      position: {
        type: String,
        default: "Fargʻona jamoat salomatligi tibbiyot\n instituti rektori",
      },
      rector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: "202__yil ʻʻ___ʼʼ ____" },
    },
    year: { type: String, required: true },
    studySchedule: { type: String, default: null },
    keys: [
      {
        key: { type: String, default: " ", maxlength: 5 },
        title: { type: String, default: "", maxlength: 500 },
      },
    ],
    courses: [
      {
        course: { type: String, default: null, minlength: 1, maxlength: 5 },
        courseNum: { type: Number, default: 0 },
        months: [
          {
            month: { type: String, default: null, minlength: 3, maxlength: 20 },
            weeks: [
              {
                week: { type: Number },
                key: { type: String, default: " ", maxlength: 5 },
              },
            ],
          },
        ],
        weeks: { type: Map, of: String, default: {} },
        total: { type: Number, default: 0 },
        statistics: { type: [StatisticItemSchema], default: [] },
      },
    ],
    allValues: {
      total: { type: Number, default: 0 },
      statistics: { type: [StatisticItemSchema], default: [] },
    },
    comment: { type: String, default: null },
    learningProcessData: {
      keys: {
        type: [
          {
            key: { type: String, default: " ", maxlength: 5 },
            title: { type: String, default: "", maxlength: 500 },
            week: { type: Number, default: 0 },
            semester: { type: String, default: null },
          },
        ],
      },
      title: { type: String, default: null },
    },
    approval: {
      type: String,
      default:
        "Fargʻona jamoat salomatligi tibbiyot instituti\n kengashida maʻqullangan 202__ yil ʻʻ___ʼʼ\n ___ dagi __-sonli bayonnoma",
    },
    methodicalHead: {
      position: { type: String, default: "Oʻquv-uslubiy boshqarma boshligʻi" },
      leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: null },
    },
    facultyDean: {
      position: { type: String, default: "Fakultet dekani" },
      dean: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: null },
    },

    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "rejected"],
      default: "draft",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    approvalHistory: {
      type: [ApprovalStepSchema],
      default: () => [
        { step: "methodical" },
        { step: "dean" },
        { step: "prorektor" },
        { step: "rektor" },
      ],
    },

    file: {
      type: String,
      default: null,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },

    verify: {
      token: { type: String },
      issuedAt: { type: Date, default: null },
      issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      revokedAt: { type: Date, default: null },
      revokedReason: { type: String, default: null },
      snapshot: { type: [VerifySnapshotSchema], default: [] },
    },
  },
  { timestamps: true, versionKey: false },
);

WorkingScheduleSchema.index({
  enrollmentYear: 1,
  direction: 1,
  currentCourse: 1,
});
WorkingScheduleSchema.index({ learningProcess: 1 });
WorkingScheduleSchema.index({ status: 1 });
WorkingScheduleSchema.index(
  { "verify.token": 1 },
  {
    unique: true,
    partialFilterExpression: { "verify.token": { $type: "string" } },
  },
);

WorkingScheduleSchema.plugin(mongoosePaginate);
WorkingScheduleSchema.plugin(aggregatePaginate);

WorkingScheduleSchema.pre("save", async function (next) {
  try {
    if (!this.courseRef) {
      const { resolveCourse } = require("#references/_services/courseResolver");
      if (this.currentCourse) {
        this.courseRef = await resolveCourse(this.currentCourse);
      }
      if (!this.courseRef && this.stage) {
        this.courseRef = await resolveCourse(this.stage);
      }
    }

    if (
      !this.groups?.length &&
      this.direction &&
      this.courseRef &&
      this.academicYear
    ) {
      const {
        resolveScheduleGroups,
      } = require("#modules/4.02-studyLoad/_services/scheduleGroupsResolver");
      this.groups = await resolveScheduleGroups(this, { persist: false });
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("workingSchedule", WorkingScheduleSchema);
