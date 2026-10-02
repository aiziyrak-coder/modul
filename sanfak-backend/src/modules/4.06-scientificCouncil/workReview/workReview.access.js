const WorkReview = require("./workReview.model");
const { ErrorHandler } = require("#shared/error");
const {
  isGlobalScope,
  sameId,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");

const canWriteReview = (review, user) =>
  isGlobalScope(user) || sameId(review.member, user._id);

const isAssignedToDoc = (work, docKey, userId) => {
  if (!docKey || !work || !work.docAssignments) return false;
  const assignments = work.docAssignments;
  const assignees =
    typeof assignments.get === "function"
      ? assignments.get(docKey)
      : assignments[docKey];
  return Array.isArray(assignees) && assignees.some((m) => sameId(m, userId));
};

const requireDocAssignment = (req, res, next) => {
  if (!req.user) {
    return next(
      new ErrorHandler(
        500,
        "requireDocAssignment: req.user topilmadi — authenticate middleware chaqirilganmi?",
      ),
    );
  }
  if (isGlobalScope(req.user)) return next();

  if (!req.work) {
    return next(
      new ErrorHandler(
        500,
        "requireDocAssignment: req.work topilmadi — requireWorkReadAccessFromBody avval chaqirilganmi?",
      ),
    );
  }

  if (!isAssignedToDoc(req.work, req.body?.docKey, req.user._id)) {
    return next(
      new ErrorHandler(403, "Sizga bu hujjatni taqriz qilish biriktirilmagan"),
    );
  }
  return next();
};

const requireReviewWriteAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(
        new ErrorHandler(
          500,
          "workReview.access: req.user topilmadi — authenticate middleware chaqirilganmi?",
        ),
      );
    }

    const review = await WorkReview.findById(req.params.id).exec();
    if (!review) return next(new ErrorHandler(404, "Xulosa topilmadi"));

    if (!canWriteReview(review, req.user)) {
      return next(
        new ErrorHandler(403, "Bu xulosani tahrirlashga ruxsatingiz yo'q"),
      );
    }

    req.review = review;
    return next();
  } catch (err) {
    return next(
      new ErrorHandler(
        400,
        "Xulosaga kirishni tekshirishda xatolik",
        err.message,
      ),
    );
  }
};

module.exports = {
  requireReviewWriteAccess,
  canWriteReview,
  requireDocAssignment,
  isAssignedToDoc,
};
