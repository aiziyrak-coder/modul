const GiftedStudentModel = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const { checkApplyEligibility } = require("./applicationEligibility");
const { isStudent } = require("./moduleRoles");

const NOT_IN_REGISTRY = "Siz iqtidorli talabalar ro'yxatida emassiz";

const resolveApplicant = async (user) => {
  if (!isStudent(user?.role)) return null;
  const gifted = await GiftedStudentModel.findOne({ user: user._id })
    .select("course courseId scoresByYear")
    .lean();
  return { gifted: gifted || null };
};

const withCanApply = (doc, applicant, now) => {
  const plain = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!applicant) return plain;
  if (!applicant.gifted) {
    return { ...plain, canApply: false, canApplyReason: NOT_IN_REGISTRY };
  }
  const problem = checkApplyEligibility(plain, applicant.gifted, now);
  return problem
    ? { ...plain, canApply: false, canApplyReason: problem.message }
    : { ...plain, canApply: true, canApplyReason: null };
};

const attachCanApply = (docs, applicant, now = new Date()) =>
  docs.map((d) => withCanApply(d, applicant, now));

module.exports = { resolveApplicant, withCanApply, attachCanApply, NOT_IN_REGISTRY };
