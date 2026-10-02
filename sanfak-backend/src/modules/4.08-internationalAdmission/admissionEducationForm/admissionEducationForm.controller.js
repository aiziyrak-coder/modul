const { createCrudController } = require("../lib/crudController");
const service = require("./admissionEducationForm.service");

module.exports = createCrudController(service, "Ta'lim shakli");
