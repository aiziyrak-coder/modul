const { createCrudService } = require("../lib/crudService");
const AdmissionCountry = require("./admissionCountry.model");

module.exports = createCrudService({
  model: AdmissionCountry,
  notFound: "Davlat topilmadi",
  searchFields: ["titleUz", "titleRu", "titleEn"],
  sort: { titleUz: 1 },
});
