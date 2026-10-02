const { ErrorHandler } = require("#shared/error");
const ApplicationTemplate = require("./applicationTemplate.model");

const KEY = "application";

const wrapErr = (err, fallback) =>
  err instanceof ErrorHandler ? err : new ErrorHandler(400, fallback, err.message);

module.exports = {
  getTemplate: async (req, res, next) => {
    try {
      const doc = await ApplicationTemplate.findOne({ key: KEY }, { __v: 0 })
        .populate({ path: "uploadedBy", select: "firstName lastName" })
        .exec();
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza namunasini olishda xatolik"));
    }
  },

  uploadTemplate: async (req, res, next) => {
    try {
      const filePath = req.body.file || req.body.filePath;
      if (!filePath) {
        return next(new ErrorHandler(400, "Fayl yuborilmadi"));
      }

      const doc = await ApplicationTemplate.findOneAndUpdate(
        { key: KEY },
        {
          key: KEY,
          fileName: req.fileDetails?.name || filePath.split("/").pop(),
          filePath,
          size: req.fileDetails?.size ?? null,
          unit: req.fileDetails?.unit ?? null,
          uploadedBy: req.user._id,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      return res.status(200).json({ message: "successfully uploaded", _id: doc._id });
    } catch (err) {
      return next(wrapErr(err, "Ariza namunasini yuklashda xatolik"));
    }
  },

  deleteTemplate: async (req, res, next) => {
    try {
      const doc = await ApplicationTemplate.findOneAndDelete({ key: KEY });
      if (!doc) return next(new ErrorHandler(404, "Ariza namunasi topilmadi"));
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(wrapErr(err, "Ariza namunasini o'chirishda xatolik"));
    }
  },
};
