const { notify } = require("#system/notification/notification.service");
const winston = require("#shared/winston.logger");
const { createCrudService } = require("../lib/crudService");
const AdmissionMessage = require("./admissionMessage.model");
const Applicant = require("../internationalAdmission/internationalAdmission.model");

const POPULATE = [
  { path: "direction", select: "titleUz titleRu titleEn" },
  { path: "educationLanguage", select: "titleUz titleRu titleEn" },
  { path: "sentBy", select: "firstName lastName" },
];

const base = createCrudService({
  model: AdmissionMessage,
  notFound: "Xabar topilmadi",
  searchFields: ["text"],
  filterFields: ["direction", "educationLanguage", "academicYear", "season"],
  populate: POPULATE,
  sort: { sentAt: -1 },
});

function recipientQuery({ direction, educationLanguage, academicYear }) {
  const q = { active: true, status: "approved" };
  if (direction) q.direction = direction;
  if (educationLanguage) q.educationLanguage = educationLanguage;
  if (academicYear) q.academicYear = academicYear;
  return q;
}

async function previewRecipients(filter) {
  return Applicant.countDocuments(recipientQuery(filter));
}

async function send(user, payload) {
  const recipients = await Applicant.find(recipientQuery(payload))
    .select("fullName email")
    .lean();

  const doc = await AdmissionMessage.create({
    text: payload.text,
    direction: payload.direction || null,
    educationLanguage: payload.educationLanguage || null,
    academicYear: payload.academicYear,
    season: payload.season,
    recipientCount: recipients.length,
    sentBy: user._id,
    sentAt: new Date(),
  });

  const withEmail = recipients.filter((r) => r.email);
  const results = await Promise.all(
    withEmail.map(async (r) => {
      try {
        const res = await notify({
          type: "email",
          email: r.email,
          subject: "Xalqaro qabul — xabarnoma",
          message: payload.text,
        });
        return res.some((x) => x.channel === "email" && x.success);
      } catch (err) {
        winston.error(`[admissionMessage] ${r.email} ga yuborilmadi: ${err.message}`);
        return false;
      }
    }),
  );

  doc.deliveredCount = results.filter(Boolean).length;
  await doc.save();
  return doc;
}

module.exports = {
  list: base.list,
  paginate: base.paginate,
  findById: base.findById,
  previewRecipients,
  send,
  recipientQuery,
};
