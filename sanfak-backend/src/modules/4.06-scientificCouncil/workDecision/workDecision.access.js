const WorkDecision = require("./workDecision.model");
const { ErrorHandler } = require("#shared/error");
const {
  canReadWork,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");

const requireDecisionReadAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(
        new ErrorHandler(
          500,
          "workDecision.access: req.user topilmadi — authenticate middleware chaqirilganmi?",
        ),
      );
    }

    const decision = await WorkDecision.findById(req.params.id)
      .populate({
        path: "work",
        select: "researcher secretary councilMembers",
      })
      .exec();

    if (!decision) return next(new ErrorHandler(404, "Qaror topilmadi"));

    if (!decision.work || !canReadWork(decision.work, req.user)) {
      return next(
        new ErrorHandler(403, "Bu qarorni ko'rishga ruxsatingiz yo'q"),
      );
    }

    req.decision = decision;
    return next();
  } catch (err) {
    return next(
      new ErrorHandler(
        400,
        "Qarorga kirishni tekshirishda xatolik",
        err.message,
      ),
    );
  }
};

module.exports = { requireDecisionReadAccess };
