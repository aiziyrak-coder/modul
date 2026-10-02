const { createCrudController } = require("../lib/crudController");
const service = require("./admissionCountry.service");

const base = createCrudController(service, "Davlat");

function applyFlag(req) {
  const uploaded = Array.isArray(req.body.media) ? req.body.media[0] : null;
  if (uploaded && uploaded.image) req.body.flagUrl = uploaded.image;
  delete req.body.media;
}

module.exports = {
  ...base,

  add: async (req, res, next) => {
    applyFlag(req);
    return base.add(req, res, next);
  },

  update: async (req, res, next) => {
    applyFlag(req);
    return base.update(req, res, next);
  },
};
