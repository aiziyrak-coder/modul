const ScientificWork = require("./scientificWork.model");
const { ErrorHandler } = require("#shared/error");
const {
  canReadWork,
  canWriteWork,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");

const canRead = canReadWork;
const canWrite = canWriteWork;

const buildGuard = (check, deniedMessage) => async (req, res, next) => {
  try {
    if (!req.user) {
      return next(
        new ErrorHandler(
          500,
          "scientificWork.access: req.user topilmadi — authenticate middleware chaqirilganmi?",
        ),
      );
    }

    const work = await ScientificWork.findById(req.params.id).exec();
    if (!work) return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));

    if (!check(work, req.user)) {
      return next(new ErrorHandler(403, deniedMessage));
    }

    req.work = work;
    return next();
  } catch (err) {
    return next(
      new ErrorHandler(
        400,
        "Ilmiy ishga kirishni tekshirishda xatolik",
        err.message,
      ),
    );
  }
};

module.exports = {
  requireReadAccess: buildGuard(
    canRead,
    "Bu ilmiy ishni ko'rishga ruxsatingiz yo'q",
  ),
  requireWriteAccess: buildGuard(
    canWrite,
    "Bu ilmiy ishni tahrirlashga ruxsatingiz yo'q",
  ),
  canRead,
  canWrite,
};
