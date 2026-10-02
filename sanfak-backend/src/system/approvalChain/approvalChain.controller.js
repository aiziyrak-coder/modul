const { ErrorHandler } = require("#shared/error");
const ApprovalChain = require("#system/approvalChain/approvalChain.model");

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await new ApprovalChain({
        ...req.body,
        currentStep: 0,
        status: "pending",
      }).save();
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to create approval chain", err.message),
      );
    }
  },

  findByDocument: async (req, res, next) => {
    try {
      const doc = await ApprovalChain.findOne({
        document: req.params.documentId,
      })
        .populate("steps.user", "firstName lastName")

        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find approval chain by document",
          err.message,
        ),
      );
    }
  },

  findById: async (req, res, next) => {
    try {
      const doc = await ApprovalChain.findById(req.params.id)
        .populate("steps.user", "firstName lastName")

        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find approval chain", err.message),
      );
    }
  },

  sign: async (req, res, next) => {
    try {
      const { eriSignature, comment } = req.body;
      const chain = await ApprovalChain.findById(req.params.id);
      if (!chain) return res.status(404).json({ message: "not found" });

      if (chain.status === "approved" || chain.status === "rejected") {
        return res.status(400).json({ message: "Zanjir yakunlangan" });
      }

      const step = chain.steps[chain.currentStep];
      if (!step)
        return res.status(400).json({ message: "Joriy qadam topilmadi" });

      step.status = "approved";
      step.eriSignature = eriSignature || null;
      step.comment = comment || null;
      step.signedAt = new Date();
      step.user = req.user._id;

      if (chain.currentStep + 1 < chain.steps.length) {
        chain.currentStep += 1;
        chain.status = "pending";
      } else {
        chain.status = "approved";
      }

      await chain.save();
      return res.status(200).json({ message: "successfully signed", chain });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to sign approval chain", err.message),
      );
    }
  },

  reject: async (req, res, next) => {
    try {
      const { comment } = req.body;
      const chain = await ApprovalChain.findById(req.params.id);
      if (!chain) return res.status(404).json({ message: "not found" });

      const step = chain.steps[chain.currentStep];
      if (step) {
        step.status = "returned";
        step.comment = comment;
        step.signedAt = new Date();
      }

      chain.status = "returned";
      await chain.save();
      return res.status(200).json({ message: "successfully rejected", chain });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to reject approval chain", err.message),
      );
    }
  },
};
