const { ErrorHandler } = require("#shared/error");
const service = require("./workReview.service");
const {
  isGlobalScope,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");
const {
  safeDispatchMany,
  getKotibUserIds,
} = require("#modules/4.06-scientificCouncil/_shared/scienceCouncilNotify");
const scientificWorkService = require("#modules/4.06-scientificCouncil/scientificWork/scientificWork.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addReview: async (req, res, next) => {
    try {
      await service.assertAssigned(req.body.work, req.body.docKey, req.user._id);
      const doc = await service.create({
        ...req.body,
        member: req.user._id,
      });

      await scientificWorkService.markReviewedIfComplete(doc.work, req.user._id);

      const kotiblar = await getKotibUserIds();
      await safeDispatchMany({
        userIds: kotiblar,
        eventType: "science_review_added",
        title: "Ilmiy ish uchun yangi xulosa qoldirildi",
        link: `/science-council/works/${doc.work}`,
        metadata: { workId: doc.work, reviewId: doc._id },
      });

      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(wrapErr(err, "Xulosa qo'shishda xatolik"));
    }
  },

  findReviewsByWork: async (req, res, next) => {
    try {
      const ownMemberId = isGlobalScope(req.user) ? undefined : req.user._id;
      const docs = await service.findByWork(req.params.workId, ownMemberId);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Xulosalarni olishda xatolik", err.message),
      );
    }
  },

  updateReview: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc)
        return next(new ErrorHandler(404, "Xulosa topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Xulosani yangilashda xatolik", err.message),
      );
    }
  },

  deleteReview: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc)
        return next(new ErrorHandler(404, "Xulosa topilmadi"));
      await scientificWorkService.revertToPendingIfIncomplete(doc.work, req.user._id);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Xulosani o'chirishda xatolik", err.message),
      );
    }
  },
};
