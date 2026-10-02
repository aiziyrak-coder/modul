const { ErrorHandler } = require("#shared/error");
const {
  safeDispatchMany,
  getKotibUserIds,
} = require("#modules/4.06-scientificCouncil/_shared/scienceCouncilNotify");
const { discardSavedFile } = require("./public.upload");
const service = require("./public.service");

const wrapErr = (err, fallbackMessage) =>
  err instanceof ErrorHandler
    ? err
    : new ErrorHandler(400, fallbackMessage, err.message);

module.exports = {
  getFormRefs: async (req, res, next) => {
    try {
      const data = await service.getFormRefs();
      return res.status(200).json({ data });
    } catch (err) {
      return next(wrapErr(err, "Ma'lumotnomalarni olishda xatolik"));
    }
  },

  submitApplication: async (req, res, next) => {
    try {
      const work = await service.submitApplication(req.body);

      const kotiblar = await getKotibUserIds();
      await safeDispatchMany({
        userIds: kotiblar,
        eventType: "science_work_submitted",
        title: `Yangi ariza (tashqi tadqiqotchi): "${work.title}"`,
        link: `/science-council/works/${work._id}`,
      });

      return res.status(201).json({
        message: "Ariza qabul qilindi",
        id: String(work._id),
      });
    } catch (err) {
      discardSavedFile(req);
      return next(wrapErr(err, "Arizani yuborishda xatolik"));
    }
  },
};
