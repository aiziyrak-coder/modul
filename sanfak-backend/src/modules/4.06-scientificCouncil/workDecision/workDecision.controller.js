const { ErrorHandler } = require("#shared/error");
const service = require("./workDecision.service");

module.exports = {
  addDecision: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Qaror qo'shishda xatolik", err.message),
      );
    }
  },

  findDecisionsByWork: async (req, res, next) => {
    try {
      const docs = await service.findByWork(req.params.workId);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Qarorlarni olishda xatolik", err.message),
      );
    }
  },

  getDalolatnomaPdf: async (req, res, next) => {
    try {
      const decision = await service.findOne(req.params.id);
      if (!decision)
        return next(new ErrorHandler(404, "Qaror topilmadi"));

      const typeLabels = {
        seminar: "Seminarga tavsiya etilsin",
        revision: "Qayta ishlashga qaytarilsin",
        rejection: "Rad etilsin",
      };

      const {
        createDoc,
        pipeToResponse,
        COLORS,
      } = require("#shared/pdfGenerators/pdfHelpers");
      const doc = createDoc();

      doc
        .fontSize(14)
        .fillColor(COLORS.primary)
        .text("DALOLATNOMA", { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .fillColor(COLORS.text)
        .text(
          "Ilmiy-tadqiqot ishni dastlabki hujjatlarni tekshirish dalolatnomasi",
          { align: "center" },
        );
      doc.moveDown(1);

      if (decision.work) {
        doc.fontSize(11).text(`Ilmiy ish: ${decision.work.title || ""}`);
        if (decision.work.researcher) {
          doc.text(
            `Muallif: ${decision.work.researcher.lastName || ""} ${decision.work.researcher.firstName || ""}`,
          );
        }
      }

      if (decision.finalConclusion) {
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Yakuniy xulosa: ${decision.finalConclusion}`);
      }

      doc.moveDown(0.5);
      doc.text(
        `Qaror turi: ${typeLabels[decision.type] || decision.type || ""}`,
      );
      if (decision.comment) {
        doc.moveDown(0.3);
        doc.text(`Izoh: ${decision.comment}`);
      }

      doc.moveDown(1);
      doc.fontSize(12).fillColor(COLORS.primary).text("Imzolar:");
      doc.moveDown(0.3);

      (decision.signedBy || []).forEach((s, i) => {
        const name = s.user
          ? `${s.user.lastName || ""} ${s.user.firstName || ""}`.trim()
          : "Noma'lum";
        const date = s.signedAt
          ? new Date(s.signedAt).toLocaleDateString("uz-UZ")
          : "";
        doc
          .fontSize(10)
          .fillColor(COLORS.text)
          .text(`${i + 1}. ${name}  —  ${date}`);
      });

      doc.moveDown(1);
      doc
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(`Sana: ${new Date().toLocaleDateString("uz-UZ")}`, {
          align: "right",
        });

      pipeToResponse(doc, res, `dalolatnoma-${req.params.id}.pdf`);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Dalolatnoma PDF xatosi", err.message),
      );
    }
  },

  signDecision: async (req, res, next) => {
    try {
      const doc = await service.sign(req.params.id, req.user._id);
      if (!doc)
        return next(new ErrorHandler(404, "Qaror topilmadi"));
      return res.status(200).json({ message: "successfully signed" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Imzolashda xatolik", err.message),
      );
    }
  },
};
