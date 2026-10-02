const { createCrudService } = require("../lib/crudService");
const AdmissionDirection = require("./admissionDirection.model");

module.exports = createCrudService({
  model: AdmissionDirection,
  notFound: "Yo'nalish topilmadi",
  searchFields: ["titleUz", "titleRu", "titleEn"],
  sort: { titleUz: 1 },
});
