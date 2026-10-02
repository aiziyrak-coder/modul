const CouncilNumber = require("#modules/4.06-scientificCouncil/councilNumber/councilNumber.model");

const specialtyIdsOfCouncil = async (councilNumberId) => {
  const doc = await CouncilNumber.findById(councilNumberId)
    .select("specialties")
    .lean();
  return (doc?.specialties ?? []).map((id) => String(id));
};

const specialtyCondition = (specialty, specialtyIds) => {
  if (specialty && specialtyIds) {
    const ids = specialtyIds.map(String);
    return ids.includes(String(specialty)) ? specialty : { $in: [] };
  }
  if (specialty) return specialty;
  if (specialtyIds) return { $in: specialtyIds };
  return undefined;
};

module.exports = { specialtyIdsOfCouncil, specialtyCondition };
