const { createCrudController } = require("../lib/crudController");
const service = require("./admissionEducationLanguage.service");

module.exports = createCrudController(service, "Ta'lim tili");
