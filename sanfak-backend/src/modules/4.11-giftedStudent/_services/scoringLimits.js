const EvaluationCriteriaModel = require("#modules/4.11-giftedStudent/evaluationCriteria/evaluationCriteria.model");

const key = (criteriaId, categoryId) => `${String(criteriaId)}|${categoryId ? String(categoryId) : ""}`;

async function buildMaxScoreMap(scholarship) {
  const entries = scholarship?.criteria || [];
  const critIds = entries.map((c) => c.criteria).filter(Boolean);
  const catalog = critIds.length
    ? await EvaluationCriteriaModel.find({ _id: { $in: critIds } })
        .select("categories maxPoints")
        .lean()
    : [];
  const byId = new Map(catalog.map((c) => [String(c._id), c]));

  const max = new Map();
  for (const entry of entries) {
    const cid = String(entry.criteria);
    const cat = byId.get(cid);
    const overrides = new Map(
      (entry.pointOverrides || []).map((o) => [String(o.categoryId), o.points]),
    );

    if ((entry.categoryIds || []).length) {
      for (const categoryId of entry.categoryIds) {
        const fromCatalog = (cat?.categories || []).find(
          (x) => String(x._id) === String(categoryId),
        )?.points;
        max.set(key(cid, categoryId), overrides.get(String(categoryId)) ?? fromCatalog ?? 0);
      }
    } else {
      max.set(key(cid, null), entry.typePointOverride ?? cat?.maxPoints ?? 0);
    }
  }
  return max;
}

async function validateScores(scholarship, scores) {
  const max = await buildMaxScoreMap(scholarship);
  for (const s of scores || []) {
    const k = key(s.criteria, s.categoryId);
    if (!max.has(k)) {
      return "Bu mezon (yoki kategoriya) shu yo'nalishning baholash ro'yxatida yo'q";
    }
    const limit = max.get(k);
    if (Number(s.value) > limit) {
      return `Ball maksimaldan katta: ${s.value} > ${limit}`;
    }
  }
  return null;
}

async function validateAchievementScore({ scoreCriteria, scoreCategoryId, score }) {
  const value = Number(score);
  if (score === undefined || score === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (!scoreCriteria) return "Ball berish uchun baholash mezoni tanlanishi shart";

  const crit = await EvaluationCriteriaModel.findById(scoreCriteria)
    .select("name categories maxPoints")
    .lean();
  if (!crit) return "Baholash mezoni topilmadi (o'chirilgan bo'lishi mumkin)";

  const cats = crit.categories || [];
  let limit;
  let label = crit.name || "";

  if (cats.length) {
    if (!scoreCategoryId) return "Bu mezon uchun kategoriya tanlanishi shart";
    const cat = cats.find((c) => String(c._id) === String(scoreCategoryId));
    if (!cat) return "Bu kategoriya tanlangan mezonga tegishli emas";
    limit = cat.points;
    label = `${crit.name} (${cat.name})`;
  } else {
    limit = crit.maxPoints;
  }

  if (limit == null) return `"${label}" uchun maksimal ball belgilanmagan`;
  if (value > Number(limit)) return `Ball maksimaldan katta: ${value} > ${limit} (${label})`;
  return null;
}

module.exports = { buildMaxScoreMap, validateScores, validateAchievementScore };
