const { wrapErr } = require("../lib/crudController");
const service = require("./admissionOffer.service");

module.exports = {
  getOffer: async (req, res, next) => {
    try {
      const doc = await service.get();
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ommaviy oferta olinmadi"));
    }
  },

  saveOffer: async (req, res, next) => {
    try {
      await service.replaceBlocks(req.user, req.body.blocks);
      return res.status(200).json({ message: "Ommaviy oferta saqlandi" });
    } catch (err) {
      return next(wrapErr(err, "Ommaviy oferta saqlanmadi"));
    }
  },
};
