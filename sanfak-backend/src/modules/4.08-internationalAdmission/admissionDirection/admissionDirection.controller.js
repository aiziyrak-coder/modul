const { createCrudController } = require("../lib/crudController");
const service = require("./admissionDirection.service");

module.exports = createCrudController(service, "Yo'nalish");
