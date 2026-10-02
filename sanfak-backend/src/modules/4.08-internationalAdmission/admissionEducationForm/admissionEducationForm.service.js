const { createCrudService } = require("../lib/crudService");
const AdmissionEducationForm = require("./admissionEducationForm.model");

module.exports = createCrudService({
  model: AdmissionEducationForm,
  notFound: "Ta'lim shakli topilmadi",
  searchFields: ["titleUz", "titleRu", "titleEn"],
  sort: { titleUz: 1 },
});
