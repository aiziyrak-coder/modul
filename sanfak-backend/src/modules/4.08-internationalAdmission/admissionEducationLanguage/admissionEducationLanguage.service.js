const { createCrudService } = require("../lib/crudService");
const AdmissionEducationLanguage = require("./admissionEducationLanguage.model");

module.exports = createCrudService({
  model: AdmissionEducationLanguage,
  notFound: "Ta'lim tili topilmadi",
  searchFields: ["titleUz", "titleRu", "titleEn"],
  sort: { titleUz: 1 },
});
